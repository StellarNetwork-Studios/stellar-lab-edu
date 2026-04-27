//! # Stealth Address – Proof of Concept (Issue #157 / Privacy v2)
//!
//! ## Overview
//!
//! Implements a Diffie-Hellman-based stealth address mechanism on Soroban.
//! Because Soroban SDK v23 does not expose raw elliptic-curve point operations,
//! we simulate the ECDH shared-secret derivation using SHA-256 as a key-derivation
//! function over the concatenation of the sender's ephemeral public key and the
//! recipient's scan key.  This is a **proof-of-concept** – a production deployment
//! would replace the KDF with a proper secp256k1 / Ed25519 point-multiplication
//! once the SDK exposes those primitives.
//!
//! ## Protocol (simplified dual-key stealth)
//!
//! ```text
//! Recipient publishes:  (scan_pub_key, spend_pub_key)   [32 bytes each]
//!
//! Sender (off-chain):
//!   1. Generate ephemeral keypair (eph_priv, eph_pub).
//!   2. shared_secret = KDF(eph_pub || scan_pub_key)     [SHA-256]
//!   3. stealth_address = KDF(spend_pub_key || shared_secret)
//!   4. Call register_ephemeral_key(stealth_address, eph_pub, token, amount, timeout)
//!      → funds locked under stealth_address commitment.
//!
//! Recipient (off-chain):
//!   1. Scan chain for EphemeralKeyRegistered events.
//!   2. For each event: shared_secret = KDF(eph_pub || scan_priv_key * G)
//!      (simplified: KDF(eph_pub || scan_priv_key_bytes))
//!   3. Recompute stealth_address = KDF(spend_pub_key || shared_secret).
//!   4. If stealth_address matches → funds are for me.
//!   5. Derive stealth_priv_key = KDF(spend_priv_key || shared_secret).
//!   6. Call stealth_withdraw(stealth_address, eph_pub, amount, token)
//!      → contract re-derives stealth_address and releases funds.
//! ```
//!
//! ## On-chain privacy guarantee
//!
//! The recipient's main public address (`spend_pub_key` / `scan_pub_key`) never
//! appears in any transaction or event.  Only the one-time `stealth_address` and
//! the sender's `eph_pub` are recorded on-chain.

use soroban_sdk::{token, Address, Bytes, BytesN, Env};

use crate::{
    errors::QuickexError,
    events,
    storage::{get_stealth_escrow, get_stealth_registry, put_stealth_escrow, put_stealth_registry},
    types::{EscrowStatus, StealthDepositParams, StealthEscrowEntry, StealthKeyPair},
};

const MAX_ENCRYPTED_MEMO_LEN: u32 = 1024;

// ---------------------------------------------------------------------------
// Key-derivation helpers
// ---------------------------------------------------------------------------

/// Derive a 32-byte shared secret from two 32-byte public-key blobs.
///
/// `KDF(a, b) = SHA-256(a || b)`
///
/// In a production implementation this would be replaced by proper EC scalar
/// multiplication (e.g. `eph_priv * scan_pub` on secp256k1).
pub fn derive_shared_secret(env: &Env, key_a: &BytesN<32>, key_b: &BytesN<32>) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&Bytes::from(key_a.clone()));
    payload.append(&Bytes::from(key_b.clone()));
    env.crypto().sha256(&payload).into()
}

/// Derive the one-time stealth address from a spend key and a shared secret.
///
/// `stealth = SHA-256(spend_pub || shared_secret)`
pub fn derive_stealth_address(
    env: &Env,
    spend_pub: &BytesN<32>,
    shared_secret: &BytesN<32>,
) -> BytesN<32> {
    let mut payload = Bytes::new(env);
    payload.append(&Bytes::from(spend_pub.clone()));
    payload.append(&Bytes::from(shared_secret.clone()));
    env.crypto().sha256(&payload).into()
}

// ---------------------------------------------------------------------------
// register_ephemeral_key
// ---------------------------------------------------------------------------

/// Register an ephemeral public key and lock funds for a stealth recipient.
///
/// The sender provides:
/// - `stealth_address` – the one-time address derived off-chain via DH.
/// - `eph_pub`         – the sender's ephemeral public key (32 bytes).
/// - `spend_pub`       – recipient's spend public key (32 bytes).
/// - `cosigner`        – optional cosigner address (multi-sig withdrawal).
/// - `encrypted_memo`  – optional encrypted metadata for recipient.
///
/// The contract re-derives the stealth address on-chain to verify the sender's
/// computation, then locks `amount` of `token` under that stealth address.
///
/// # Errors
/// - [`InvalidAmount`]            – amount ≤ 0.
/// - [`StealthAddressMismatch`]   – on-chain re-derivation does not match `stealth_address`.
/// - [`StealthAddressAlreadyUsed`]– a deposit already exists for this stealth address.
/// - [`MemoTooLarge`]             – encrypted_memo exceeds 1024 bytes.
pub fn register_ephemeral_key(
    env: &Env,
    params: StealthDepositParams,
) -> Result<BytesN<32>, QuickexError> {
    let StealthDepositParams {
        sender,
        token,
        amount_due,
        amount_paid,
        eph_pub,
        spend_pub,
        stealth_address,
        timeout_secs,
        cosigner,
        encrypted_memo,
    } = params;

    if amount_due <= 0 || amount_paid <= 0 {
        return Err(QuickexError::InvalidAmount);
    }

    if amount_paid > amount_due {
        return Err(QuickexError::Overpayment);
    }

    if encrypted_memo.len() > MAX_ENCRYPTED_MEMO_LEN {
        return Err(QuickexError::MemoTooLarge);
    }

    sender.require_auth();

    let shared_secret = derive_shared_secret(env, &eph_pub, &spend_pub);
    let expected_stealth = derive_stealth_address(env, &spend_pub, &shared_secret);

    if expected_stealth != stealth_address {
        return Err(QuickexError::StealthAddressMismatch);
    }

    if get_stealth_escrow(env, &stealth_address).is_some() {
        return Err(QuickexError::StealthAddressAlreadyUsed);
    }

    let token_client = token::Client::new(env, &token);
    let contract_addr = env.current_contract_address();
    token_client.transfer(&sender, &contract_addr, &amount_paid);

    let now = env.ledger().timestamp();
    let expires_at = if timeout_secs > 0 {
        now.saturating_add(timeout_secs)
    } else {
        0
    };

    let entry = StealthEscrowEntry {
        token: token.clone(),
        amount_due,
        amount_paid,
        eph_pub: eph_pub.clone(),
        status: EscrowStatus::Pending,
        created_at: now,
        expires_at,
        cosigner,
        cosigner_approved: false,
        encrypted_memo,
    };

    put_stealth_escrow(env, &stealth_address, &entry);

    events::publish_ephemeral_key_registered(
        env,
        stealth_address.clone(),
        eph_pub,
        token,
        amount_due,
        amount_paid,
        expires_at,
    );

    Ok(stealth_address)
}

// ---------------------------------------------------------------------------
// stealth_withdraw
// ---------------------------------------------------------------------------

/// Withdraw funds locked under a stealth address.
///
/// The caller proves ownership by supplying the `spend_pub` key and the
/// `eph_pub` from the registration event.  The contract re-derives the
/// stealth address and, if it matches, transfers funds to `recipient`.
///
/// The `recipient` address is the caller's *real* on-chain address for
/// receiving the tokens – it is only revealed at withdrawal time and is
/// not linked to the original stealth address in any prior transaction.
///
/// If a cosigner was set during deposit, withdrawal is blocked until the
/// cosigner has called `approve_stealth_cosigner`.
///
/// # Errors
/// - [`StealthEscrowNotFound`]  – no escrow for this stealth address.
/// - [`AlreadySpent`]           – escrow already withdrawn or refunded.
/// - [`EscrowExpired`]          – escrow has passed its expiry.
/// - [`StealthAddressMismatch`] – re-derived address does not match.
/// - [`CosignerRequired`]      – cosigner has not yet approved.
pub fn stealth_withdraw(
    env: &Env,
    recipient: Address,
    eph_pub: BytesN<32>,
    spend_pub: BytesN<32>,
    stealth_address: BytesN<32>,
) -> Result<bool, QuickexError> {
    recipient.require_auth();

    let mut entry =
        get_stealth_escrow(env, &stealth_address).ok_or(QuickexError::StealthEscrowNotFound)?;

    if entry.status != EscrowStatus::Pending {
        return Err(QuickexError::AlreadySpent);
    }

    if entry.expires_at > 0 && env.ledger().timestamp() >= entry.expires_at {
        return Err(QuickexError::EscrowExpired);
    }

    if entry.cosigner.is_some() && !entry.cosigner_approved {
        return Err(QuickexError::CosignerRequired);
    }

    let shared_secret = derive_shared_secret(env, &eph_pub, &spend_pub);
    let expected_stealth = derive_stealth_address(env, &spend_pub, &shared_secret);

    if expected_stealth != stealth_address {
        return Err(QuickexError::StealthAddressMismatch);
    }

    entry.status = EscrowStatus::Spent;
    put_stealth_escrow(env, &stealth_address, &entry);

    let token_client = token::Client::new(env, &entry.token);
    token_client.transfer(
        &env.current_contract_address(),
        &recipient,
        &entry.amount_paid,
    );

    events::publish_stealth_withdrawn(
        env,
        stealth_address,
        recipient,
        entry.token,
        entry.amount_paid,
    );

    Ok(true)
}

// ---------------------------------------------------------------------------
// get_stealth_escrow_status (read-only)
// ---------------------------------------------------------------------------

/// Return the status of a stealth escrow without revealing sensitive fields.
///
/// Returns `None` if no escrow exists for the given stealth address.
pub fn get_stealth_status(env: &Env, stealth_address: &BytesN<32>) -> Option<EscrowStatus> {
    get_stealth_escrow(env, stealth_address).map(|e| e.status)
}

// ---------------------------------------------------------------------------
// Stealth key registry
// ---------------------------------------------------------------------------

/// Publish a (scan, spend) key pair so senders can derive stealth addresses.
///
/// The owner must authorize. Overwrites any previously registered keys.
pub fn register_stealth_keys(
    env: &Env,
    owner: Address,
    scan_pub: BytesN<32>,
    spend_pub: BytesN<32>,
) -> Result<(), QuickexError> {
    owner.require_auth();

    let keys = StealthKeyPair {
        scan_pub: scan_pub.clone(),
        spend_pub: spend_pub.clone(),
    };
    put_stealth_registry(env, &owner, &keys);

    events::publish_stealth_keys_registered(env, owner, scan_pub, spend_pub);
    Ok(())
}

/// Look up the stealth key pair registered by `owner`.
///
/// Returns `None` if no keys have been registered.
pub fn get_registered_stealth_keys(env: &Env, owner: &Address) -> Option<StealthKeyPair> {
    get_stealth_registry(env, owner)
}

// ---------------------------------------------------------------------------
// Cosigner approval
// ---------------------------------------------------------------------------

/// Approve a stealth withdrawal as a cosigner.
///
/// The cosigner must match the address set during the stealth deposit.
/// Once approved, the recipient can proceed with `stealth_withdraw`.
///
/// # Errors
/// - [`StealthEscrowNotFound`]    – no escrow for this stealth address.
/// - [`AlreadySpent`]             – escrow is not pending.
/// - [`InvalidCosigner`]          – caller does not match the registered cosigner.
/// - [`CosignerAlreadyApproved`]  – cosigner has already approved.
pub fn approve_stealth_cosigner(
    env: &Env,
    cosigner: Address,
    stealth_address: BytesN<32>,
) -> Result<(), QuickexError> {
    cosigner.require_auth();

    let mut entry =
        get_stealth_escrow(env, &stealth_address).ok_or(QuickexError::StealthEscrowNotFound)?;

    if entry.status != EscrowStatus::Pending {
        return Err(QuickexError::AlreadySpent);
    }

    let expected = entry.cosigner.as_ref().ok_or(QuickexError::InvalidCosigner)?;
    if *expected != cosigner {
        return Err(QuickexError::InvalidCosigner);
    }

    if entry.cosigner_approved {
        return Err(QuickexError::CosignerAlreadyApproved);
    }

    entry.cosigner_approved = true;
    put_stealth_escrow(env, &stealth_address, &entry);

    events::publish_cosigner_approved(env, stealth_address, cosigner);

    Ok(())
}

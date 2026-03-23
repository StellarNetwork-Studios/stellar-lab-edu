//! Multi-Signature Escrow logic: deposit, approve, release, refund.

use soroban_sdk::{token, Address, Bytes, BytesN, Env, Vec};

use crate::{
    commitment,
    errors::QuickexError,
    events,
    storage::{get_multisig_escrow, has_multisig_escrow, put_multisig_escrow},
    types::{EscrowStatus, MultiSigEscrow},
};

fn is_expired(env: &Env, entry: &MultiSigEscrow) -> bool {
    entry.expires_at > 0 && env.ledger().timestamp() >= entry.expires_at
}

pub fn deposit_multisig(
    env: &Env,
    token: Address,
    amount: i128,
    owner: Address,
    destination: Address,
    signers: Vec<Address>,
    threshold: u32,
    salt: Bytes,
    timeout_secs: u64,
) -> Result<BytesN<32>, QuickexError> {
    if amount <= 0 {
        return Err(QuickexError::InvalidAmount);
    }
    if threshold == 0 || threshold > signers.len() {
        return Err(QuickexError::InvalidThreshold);
    }

    owner.require_auth();

    let commitment = commitment::create_amount_commitment(env, owner.clone(), amount, salt)?;
    let commitment_bytes: Bytes = commitment.clone().into();

    if has_multisig_escrow(env, &commitment_bytes) {
        return Err(QuickexError::CommitmentAlreadyExists);
    }

    let now = env.ledger().timestamp();
    let expires_at = if timeout_secs > 0 {
        now.saturating_add(timeout_secs)
    } else {
        0
    };

    let token_client = token::Client::new(env, &token);
    let entry = MultiSigEscrow {
        token: token.clone(),
        amount,
        owner: owner.clone(),
        destination: destination.clone(),
        signers,
        threshold,
        approvals: Vec::new(env),
        status: EscrowStatus::Pending,
        created_at: now,
        expires_at,
    };

    put_multisig_escrow(env, &commitment_bytes, &entry);
    token_client.transfer(&owner, env.current_contract_address(), &amount);

    events::publish_multisig_deposited(
        env,
        commitment.clone(),
        owner,
        destination,
        token,
        amount,
        threshold,
        expires_at,
    );

    Ok(commitment)
}

pub fn approve_multisig(
    env: &Env,
    commitment: BytesN<32>,
    signer: Address,
) -> Result<(), QuickexError> {
    signer.require_auth();

    let commitment_bytes: Bytes = commitment.clone().into();
    let mut entry = get_multisig_escrow(env, &commitment_bytes)
        .ok_or(QuickexError::CommitmentNotFound)?;

    if entry.status != EscrowStatus::Pending {
        return Err(QuickexError::AlreadySpent);
    }
    if is_expired(env, &entry) {
        return Err(QuickexError::EscrowExpired);
    }
    if !entry.signers.contains(&signer) {
        return Err(QuickexError::SignerNotAuthorized);
    }
    if entry.approvals.contains(&signer) {
        return Err(QuickexError::AlreadyApproved);
    }

    entry.approvals.push_back(signer.clone());
    put_multisig_escrow(env, &commitment_bytes, &entry);

    events::publish_multisig_approved(env, commitment, signer);

    Ok(())
}

pub fn release_multisig(env: &Env, commitment: BytesN<32>) -> Result<(), QuickexError> {
    let commitment_bytes: Bytes = commitment.clone().into();
    let mut entry = get_multisig_escrow(env, &commitment_bytes)
        .ok_or(QuickexError::CommitmentNotFound)?;

    if entry.status != EscrowStatus::Pending {
        return Err(QuickexError::AlreadySpent);
    }
    if is_expired(env, &entry) {
        return Err(QuickexError::EscrowExpired);
    }
    if entry.approvals.len() < entry.threshold {
        return Err(QuickexError::ThresholdNotMet);
    }

    let token_ref = entry.token.clone();
    let destination_ref = entry.destination.clone();
    let amount = entry.amount;

    entry.status = EscrowStatus::Spent;
    put_multisig_escrow(env, &commitment_bytes, &entry);

    let token_client = token::Client::new(env, &token_ref);
    token_client.transfer(&env.current_contract_address(), &destination_ref, &amount);

    events::publish_multisig_released(env, commitment, destination_ref, token_ref, amount);

    Ok(())
}

pub fn refund_multisig(
    env: &Env,
    commitment: BytesN<32>,
    caller: Address,
) -> Result<(), QuickexError> {
    caller.require_auth();

    let commitment_bytes: Bytes = commitment.clone().into();
    let mut entry = get_multisig_escrow(env, &commitment_bytes)
        .ok_or(QuickexError::CommitmentNotFound)?;

    if entry.status != EscrowStatus::Pending {
        return Err(QuickexError::AlreadySpent);
    }
    if !is_expired(env, &entry) {
        return Err(QuickexError::EscrowNotExpired);
    }
    if caller != entry.owner {
        return Err(QuickexError::InvalidOwner);
    }

    entry.status = EscrowStatus::Refunded;
    put_multisig_escrow(env, &commitment_bytes, &entry);

    let token_client = token::Client::new(env, &entry.token);
    token_client.transfer(&env.current_contract_address(), &entry.owner, &entry.amount);

    // We can reuse the normal refunded event or create a specific one.
    // For now, using the normal refunded event is fine.
    events::publish_escrow_refunded(env, entry.owner, commitment, entry.token, entry.amount);

    Ok(())
}

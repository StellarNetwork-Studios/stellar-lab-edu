//! Types used in the QuickEx storage layer and contract logic.
//!
//! See [`crate::storage`] for the storage schema and key layout.

use soroban_sdk::{contracttype, Address, Bytes, BytesN};

/// Escrow entry status.
///
/// Tracks the lifecycle of a deposited commitment:
///
/// ```text
/// [*] --> Pending  : deposit()
/// Pending --> Spent    : withdraw(proof)  [current_time < expires_at]
/// Pending --> Refunded : refund(owner)    [current_time >= expires_at]
/// Pending --> Disputed : dispute()        [any participant with arbiter]
/// Disputed --> Spent/Refunded : resolve_dispute() [arbiter decides]
/// ```
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EscrowStatus {
    Pending,
    Spent,
    /// Kept for backwards-compat with any existing on-chain data; semantically
    /// equivalent to an escrow that has passed expiry but not yet been refunded.
    Expired,
    Refunded,
    /// Funds are locked pending arbiter resolution.
    Disputed,
}

/// Escrow entry structure.
///
/// Stored under [`DataKey::Escrow`](crate::storage::DataKey::Escrow)(commitment) in persistent storage.
#[contracttype]
#[derive(Clone)]
pub struct EscrowEntry {
    /// Token contract address for the escrowed funds.
    pub token: Address,
    /// Total amount due in token base units (the target amount to be paid).
    pub amount_due: i128,
    /// Amount already paid towards the escrow.
    pub amount_paid: i128,
    /// Owner who deposited and may refund after expiry.
    pub owner: Address,
    /// Current status (Pending, Spent, Refunded, Expired, Disputed).
    pub status: EscrowStatus,
    /// Ledger timestamp when the escrow was created.
    pub created_at: u64,
    /// Ledger timestamp after which withdrawal is blocked and refund is enabled.
    /// A value of `0` means the escrow never expires (no timeout).
    pub expires_at: u64,
    /// Optional arbiter address for dispute resolution.
    pub arbiter: Option<Address>,
}

/// Privacy-aware view of an escrow entry.
///
/// Returned by [`QuickexContract::get_escrow_details`] instead of the raw
/// [`EscrowEntry`]. Sensitive fields (`amount_due`, `amount_paid`, `owner`) are set to `None`
/// when the escrow owner has privacy enabled and the caller is not the owner.
///
/// ## Field visibility
///
/// | Field        | Privacy off | Privacy on + caller is owner | Privacy on + caller is stranger |
/// |--------------|-------------|------------------------------|---------------------------------|
/// | `token`      | ✓           | ✓                            | ✓                               |
/// | `status`     | ✓           | ✓                            | ✓                               |
/// | `created_at` | ✓           | ✓                            | ✓                               |
/// | `expires_at` | ✓           | ✓                            | ✓                               |
/// | `amount_due` | ✓           | ✓                            | `None`                          |
/// | `amount_paid`| ✓           | ✓                            | `None`                          |
/// | `owner`      | ✓           | ✓                            | `None`                          |
#[contracttype]
#[derive(Clone)]
pub struct PrivacyAwareEscrowView {
    /// Token contract address (always visible).
    pub token: Address,
    /// Total amount due. `None` when privacy is enabled and caller is not the owner.
    pub amount_due: Option<i128>,
    /// Amount already paid. `None` when privacy is enabled and caller is not the owner.
    pub amount_paid: Option<i128>,
    /// Owner address. `None` when privacy is enabled and caller is not the owner.
    pub owner: Option<Address>,
    /// Current lifecycle status (always visible).
    pub status: EscrowStatus,
    /// Creation timestamp (always visible).
    pub created_at: u64,
    /// Expiry timestamp; `0` means no expiry (always visible).
    pub expires_at: u64,
    /// Arbiter address for dispute resolution. `None` if not set.
    pub arbiter: Option<Address>,
}

/// Parameters for registering an ephemeral key (stealth deposit).
///
/// Bundles the arguments of `register_ephemeral_key` into a single struct
/// to satisfy the `clippy::too_many_arguments` lint (limit: 7).
#[contracttype]
#[derive(Clone)]
pub struct StealthDepositParams {
    /// Depositor address (must authorize the token transfer).
    pub sender: Address,
    /// Token contract address.
    pub token: Address,
    /// Total amount due; must be positive.
    pub amount_due: i128,
    /// Initial payment amount; must be positive and <= amount_due.
    pub amount_paid: i128,
    /// Sender's ephemeral public key (32 bytes).
    pub eph_pub: BytesN<32>,
    /// Recipient's spend public key (32 bytes).
    pub spend_pub: BytesN<32>,
    /// Pre-computed one-time stealth address (32 bytes).
    pub stealth_address: BytesN<32>,
    /// Seconds until expiry; 0 = no expiry.
    pub timeout_secs: u64,
    /// Optional cosigner address required to approve withdrawal.
    pub cosigner: Option<Address>,
    /// Encrypted memo only decryptable by the recipient (max 1024 bytes).
    pub encrypted_memo: Bytes,
}

/// Stealth escrow entry for Privacy v2 (Issue #157).
///
/// Locked under a one-time stealth address derived via Diffie-Hellman.
/// The original recipient's public address is never stored on-chain.
///
/// ## Field visibility
/// - `eph_pub` is public (needed by recipient to scan).
/// - `token`, `amount_due`, `amount_paid`, `status`, `created_at`, `expires_at` are public.
/// - The link between `eph_pub` and the recipient's real identity is only
///   computable by the recipient (who holds the matching private key).
///
/// ## Multi-sig (v2)
/// - When `cosigner` is `Some`, the cosigner must call `approve_stealth_cosigner`
///   before the recipient can withdraw. This prevents single-key compromise.
#[contracttype]
#[derive(Clone)]
pub struct StealthEscrowEntry {
    /// Token contract address for the escrowed funds.
    pub token: Address,
    /// Total amount due in token base units (the target amount to be paid).
    pub amount_due: i128,
    /// Amount already paid towards the escrow.
    pub amount_paid: i128,
    /// Sender's ephemeral public key (32 bytes). Stored so the recipient can
    /// scan events and re-derive the shared secret off-chain.
    pub eph_pub: BytesN<32>,
    /// Current lifecycle status.
    pub status: EscrowStatus,
    /// Ledger timestamp when the stealth escrow was created.
    pub created_at: u64,
    /// Expiry timestamp; `0` means no expiry.
    pub expires_at: u64,
    /// Optional cosigner required to approve before withdrawal.
    pub cosigner: Option<Address>,
    /// Whether the cosigner has approved the withdrawal.
    pub cosigner_approved: bool,
    /// Encrypted memo for the recipient (encrypted with DH shared secret).
    pub encrypted_memo: Bytes,
}

/// Published stealth key pair for a recipient.
///
/// Recipients register their (scan, spend) public keys on-chain so senders
/// can look them up and compute stealth addresses without out-of-band exchange.
#[contracttype]
#[derive(Clone)]
pub struct StealthKeyPair {
    /// Scan public key (32 bytes) — used by senders to derive the shared secret.
    pub scan_pub: BytesN<32>,
    /// Spend public key (32 bytes) — used to derive the one-time stealth address.
    pub spend_pub: BytesN<32>,
}

/// Fee configuration for the platform.
///
/// Stored under [`DataKey::FeeConfig`](crate::storage::DataKey::FeeConfig) in persistent storage.
#[contracttype]
#[derive(Clone, Copy, Debug)]
pub struct FeeConfig {
    /// Fee in basis points (1 = 0.01%, 100 = 1%, 10000 = 100%).
    pub fee_bps: u32,
}

/// Privileged roles for contract governance and operations.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Role {
    /// Full administrative access, including role management and upgrades.
    Admin = 1,
    /// Operational access, such as toggling pause flags and fee config.
    Operator = 2,
    /// Authorized to resolve disputes across escrows.
    Arbiter = 3,
}

//! Custom assertion helpers for  StellarFoundry-specific types.
//!
//! Reduces boilerplate in test assertions for [`EscrowStatus`], commitment
//! verification, and contract error matching.
//!
//! ## Available helpers
//!
//! | Helper                      | Purpose                                              |
//! |-----------------------------|------------------------------------------------------|
//! | [`assert_escrow_status`]    | Assert exact escrow status by commitment             |
//! | [`assert_escrow_pending`]   | Shorthand: status == `Pending`                       |
//! | [`assert_escrow_spent`]     | Shorthand: status == `Spent`                         |
//! | [`assert_escrow_refunded`]  | Shorthand: status == `Refunded`                      |
//! | [`assert_escrow_disputed`]  | Shorthand: status == `Disputed`                      |
//! | [`assert_escrow_not_found`] | Assert that no escrow exists for commitment          |
//! | [`assert_commitment_valid`] | Assert `verify_amount_commitment` returns `true`     |
//! | [`assert_commitment_invalid`]| Assert `verify_amount_commitment` returns `false`   |
//! | [`assert_qx_err`]           | Assert a `try_*` call returns a specific error       |
//!
//! ## Example
//!
//! ```rust
//! // Status assertions
//! assert_escrow_pending(&ctx.client, &commitment);
//! assert_escrow_spent(&ctx.client, &commitment);
//! assert_escrow_refunded(&ctx.client, &commitment);
//! assert_escrow_disputed(&ctx.client, &commitment);
//!
//! // Error assertion
//! assert_qx_err(ctx.client.try_deposit(&...),  StellarFoundryError::ContractPaused);
//!
//! // Commitment validity
//! assert_commitment_valid(&ctx.client, &commitment, &owner, amount, &salt);
//! ```

use soroban_sdk::{Address, Bytes, BytesN, ConversionError, InvokeError};

use crate::{errors:: StellarFoundryError, types::EscrowStatus,  StellarFoundryContractClient};

// -----------------------------------------------------------------------
// Escrow status assertions
// -----------------------------------------------------------------------

/// Assert that the escrow identified by `commitment` has the given `expected` status.
///
/// Panics with a descriptive message if the status does not match.
#[allow(dead_code)]
pub fn assert_escrow_status(
    client: & StellarFoundryContractClient<'_>,
    commitment: &BytesN<32>,
    expected: EscrowStatus,
) {
    let actual = client.get_commitment_state(commitment);
    assert_eq!(
        actual,
        Some(expected),
        "escrow status mismatch: expected {expected:?}, got {actual:?}",
    );
}

/// Assert that an escrow is in `Pending` state.
#[allow(dead_code)]
pub fn assert_escrow_pending(client: & StellarFoundryContractClient<'_>, commitment: &BytesN<32>) {
    assert_escrow_status(client, commitment, EscrowStatus::Pending);
}

/// Assert that an escrow is in `Spent` state.
#[allow(dead_code)]
pub fn assert_escrow_spent(client: & StellarFoundryContractClient<'_>, commitment: &BytesN<32>) {
    assert_escrow_status(client, commitment, EscrowStatus::Spent);
}

/// Assert that an escrow is in `Refunded` state.
#[allow(dead_code)]
pub fn assert_escrow_refunded(client: & StellarFoundryContractClient<'_>, commitment: &BytesN<32>) {
    assert_escrow_status(client, commitment, EscrowStatus::Refunded);
}

/// Assert that an escrow is in `Disputed` state.
#[allow(dead_code)]
pub fn assert_escrow_disputed(client: & StellarFoundryContractClient<'_>, commitment: &BytesN<32>) {
    assert_escrow_status(client, commitment, EscrowStatus::Disputed);
}

/// Assert that no escrow entry exists for the given commitment.
#[allow(dead_code)]
pub fn assert_escrow_not_found(client: & StellarFoundryContractClient<'_>, commitment: &BytesN<32>) {
    let actual = client.get_commitment_state(commitment);
    assert_eq!(
        actual, None,
        "expected no escrow for commitment, but found status {actual:?}",
    );
}

// -----------------------------------------------------------------------
// Commitment assertions
// -----------------------------------------------------------------------

/// Assert that a commitment verifies correctly for the given `(owner, amount, salt)`.
#[allow(dead_code)]
pub fn assert_commitment_valid(
    client: & StellarFoundryContractClient<'_>,
    commitment: &BytesN<32>,
    owner: &Address,
    amount: i128,
    salt: &Bytes,
) {
    assert!(
        client.verify_amount_commitment(commitment, owner, &amount, salt),
        "commitment expected to be valid for (owner, amount={amount}), but verify returned false",
    );
}

/// Assert that a commitment does NOT verify for the given `(owner, amount, salt)`.
#[allow(dead_code)]
pub fn assert_commitment_invalid(
    client: & StellarFoundryContractClient<'_>,
    commitment: &BytesN<32>,
    owner: &Address,
    amount: i128,
    salt: &Bytes,
) {
    assert!(
        !client.verify_amount_commitment(commitment, owner, &amount, salt),
        "commitment expected to be invalid for (owner, amount={amount}), but verify returned true",
    );
}

// -----------------------------------------------------------------------
// Contract error assertion
// -----------------------------------------------------------------------

/// Assert that a `try_*` client call returns the expected [` StellarFoundryError`].
///
/// Panics with a clear message if the call succeeds or returns a different error.
///
/// # Example
/// ```rust
/// assert_qx_err(ctx.client.try_withdraw(&...),  StellarFoundryError::EscrowExpired);
/// ```
#[allow(dead_code)]
pub fn assert_qx_err<T>(
    result: Result<Result<T, ConversionError>, Result< StellarFoundryError, InvokeError>>,
    expected:  StellarFoundryError,
) {
    match result {
        Err(Ok(actual)) => assert_eq!(
            actual, expected,
            "wrong contract error: expected {expected:?}, got {actual:?}",
        ),
        _ => {
            panic!("expected contract error {expected:?}, but call did not return a  StellarFoundryError",)
        }
    }
}

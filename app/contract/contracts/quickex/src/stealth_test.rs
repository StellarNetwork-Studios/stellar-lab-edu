//! Tests for the stealth address PoC (Issue #157 – Privacy v2).

use crate::{
    errors::QuickexError, stealth, types::StealthDepositParams, EscrowStatus, QuickexContract,
    QuickexContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Bytes, BytesN, Env,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup<'a>() -> (Env, QuickexContractClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(QuickexContract, ());
    let client = QuickexContractClient::new(&env, &contract_id);
    (env, client)
}

fn create_test_token(env: &Env) -> Address {
    env.register_stellar_asset_contract_v2(Address::generate(env))
        .address()
}

/// Simulate the off-chain DH key derivation so tests can compute the correct
/// stealth address without needing a real EC library.
fn compute_stealth_address(env: &Env, eph_pub: &BytesN<32>, spend_pub: &BytesN<32>) -> BytesN<32> {
    let shared = stealth::derive_shared_secret(env, eph_pub, spend_pub);
    stealth::derive_stealth_address(env, spend_pub, &shared)
}

/// Mint `amount` tokens to `recipient`.
fn mint(env: &Env, token: &Address, recipient: &Address, amount: i128) {
    token::StellarAssetClient::new(env, token).mint(recipient, &amount);
}

/// Build a `StealthDepositParams` with the given fields (no cosigner, empty memo).
#[allow(clippy::too_many_arguments)]
fn make_params(
    env: &Env,
    sender: Address,
    token: Address,
    amount_due: i128,
    amount_paid: i128,
    eph_pub: BytesN<32>,
    spend_pub: BytesN<32>,
    stealth_address: BytesN<32>,
    timeout_secs: u64,
) -> StealthDepositParams {
    StealthDepositParams {
        sender,
        token,
        amount_due,
        amount_paid,
        eph_pub,
        spend_pub,
        stealth_address,
        timeout_secs,
        cosigner: None,
        encrypted_memo: Bytes::new(env),
    }
}

/// Build a `StealthDepositParams` with a cosigner.
#[allow(clippy::too_many_arguments)]
fn make_params_with_cosigner(
    env: &Env,
    sender: Address,
    token: Address,
    amount_due: i128,
    amount_paid: i128,
    eph_pub: BytesN<32>,
    spend_pub: BytesN<32>,
    stealth_address: BytesN<32>,
    timeout_secs: u64,
    cosigner: Address,
) -> StealthDepositParams {
    StealthDepositParams {
        sender,
        token,
        amount_due,
        amount_paid,
        eph_pub,
        spend_pub,
        stealth_address,
        timeout_secs,
        cosigner: Some(cosigner),
        encrypted_memo: Bytes::new(env),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Happy path: sender registers ephemeral key, recipient withdraws.
#[test]
fn test_stealth_full_flow() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let amount: i128 = 1_000;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[1u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[2u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    let returned_stealth = client.register_ephemeral_key(&make_params(
        &env,
        sender,
        token.clone(),
        amount,
        amount,
        eph_pub.clone(),
        spend_pub.clone(),
        stealth_address.clone(),
        0,
    ));

    assert_eq!(returned_stealth, stealth_address);
    assert_eq!(
        client.get_stealth_status(&stealth_address),
        Some(EscrowStatus::Pending)
    );

    let ok = client.stealth_withdraw(&recipient, &eph_pub, &spend_pub, &stealth_address);
    assert!(ok);

    assert_eq!(
        client.get_stealth_status(&stealth_address),
        Some(EscrowStatus::Spent)
    );

    let token_client = token::Client::new(&env, &token);
    assert_eq!(token_client.balance(&recipient), amount);
}

/// Registering with a wrong stealth address must fail.
#[test]
fn test_register_wrong_stealth_address_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let amount: i128 = 500;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[3u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[4u8; 32]);
    let wrong_stealth: BytesN<32> = BytesN::from_array(&env, &[0u8; 32]);

    mint(&env, &token, &sender, amount);

    let err = client
        .try_register_ephemeral_key(&make_params(
            &env,
            sender,
            token,
            amount,
            amount,
            eph_pub,
            spend_pub,
            wrong_stealth,
            0,
        ))
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::StealthAddressMismatch);
}

/// Registering the same stealth address twice must fail.
#[test]
fn test_register_duplicate_stealth_address_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let amount: i128 = 200;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[5u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[6u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount * 2);

    client.register_ephemeral_key(&make_params(
        &env,
        sender.clone(),
        token.clone(),
        amount,
        amount,
        eph_pub.clone(),
        spend_pub.clone(),
        stealth_address.clone(),
        0,
    ));

    let err = client
        .try_register_ephemeral_key(&make_params(
            &env,
            sender,
            token,
            amount,
            amount,
            eph_pub,
            spend_pub,
            stealth_address,
            0,
        ))
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::StealthAddressAlreadyUsed);
}

/// Withdrawing with wrong spend_pub must fail.
#[test]
fn test_stealth_withdraw_wrong_spend_pub_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let amount: i128 = 300;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[7u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[8u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    client.register_ephemeral_key(&make_params(
        &env,
        sender,
        token,
        amount,
        amount,
        eph_pub.clone(),
        spend_pub,
        stealth_address.clone(),
        0,
    ));

    let wrong_spend_pub: BytesN<32> = BytesN::from_array(&env, &[99u8; 32]);

    let err = client
        .try_stealth_withdraw(&recipient, &eph_pub, &wrong_spend_pub, &stealth_address)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::StealthAddressMismatch);
}

/// Double withdrawal must fail with AlreadySpent.
#[test]
fn test_stealth_double_withdraw_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let amount: i128 = 400;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[9u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[10u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    client.register_ephemeral_key(&make_params(
        &env,
        sender,
        token,
        amount,
        amount,
        eph_pub.clone(),
        spend_pub.clone(),
        stealth_address.clone(),
        0,
    ));

    client.stealth_withdraw(&recipient, &eph_pub, &spend_pub, &stealth_address);

    let err = client
        .try_stealth_withdraw(&recipient, &eph_pub, &spend_pub, &stealth_address)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::AlreadySpent);
}

/// Withdrawal after expiry must fail with EscrowExpired.
#[test]
fn test_stealth_withdraw_after_expiry_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let amount: i128 = 600;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[11u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[12u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    client.register_ephemeral_key(&make_params(
        &env,
        sender,
        token,
        amount,
        amount,
        eph_pub.clone(),
        spend_pub.clone(),
        stealth_address.clone(),
        100,
    ));

    env.ledger().with_mut(|l| l.timestamp += 200);

    let err = client
        .try_stealth_withdraw(&recipient, &eph_pub, &spend_pub, &stealth_address)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::EscrowExpired);
}

/// Registering with zero amount must fail.
#[test]
fn test_stealth_register_zero_amount_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[13u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[14u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    let err = client
        .try_register_ephemeral_key(&make_params(
            &env,
            sender,
            token,
            0,
            0,
            eph_pub,
            spend_pub,
            stealth_address,
            0,
        ))
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::InvalidAmount);
}

/// Querying a non-existent stealth address returns None.
#[test]
fn test_get_stealth_status_not_found() {
    let (env, client) = setup();
    let unknown: BytesN<32> = BytesN::from_array(&env, &[0u8; 32]);
    assert_eq!(client.get_stealth_status(&unknown), None);
}

/// When contract is paused, register_ephemeral_key must fail.
#[test]
fn test_stealth_register_fails_when_paused() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let admin = Address::generate(&env);
    let amount: i128 = 100;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[15u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[16u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    client.initialize(&admin);
    client.set_paused(&admin, &true);

    mint(&env, &token, &sender, amount);

    let err = client
        .try_register_ephemeral_key(&make_params(
            &env,
            sender,
            token,
            amount,
            amount,
            eph_pub,
            spend_pub,
            stealth_address,
            0,
        ))
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::ContractPaused);
}

// ---------------------------------------------------------------------------
// Cosigner / Multi-sig tests
// ---------------------------------------------------------------------------

/// Withdrawal with cosigner: must fail without cosigner approval.
#[test]
fn test_stealth_cosigner_required() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let cosigner = Address::generate(&env);
    let amount: i128 = 500;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[20u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[21u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    client.register_ephemeral_key(&make_params_with_cosigner(
        &env,
        sender,
        token,
        amount,
        amount,
        eph_pub.clone(),
        spend_pub.clone(),
        stealth_address.clone(),
        0,
        cosigner,
    ));

    let err = client
        .try_stealth_withdraw(&recipient, &eph_pub, &spend_pub, &stealth_address)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::CosignerRequired);
}

/// Full flow with cosigner: approve then withdraw.
#[test]
fn test_stealth_cosigner_full_flow() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let cosigner = Address::generate(&env);
    let amount: i128 = 500;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[22u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[23u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    client.register_ephemeral_key(&make_params_with_cosigner(
        &env,
        sender,
        token.clone(),
        amount,
        amount,
        eph_pub.clone(),
        spend_pub.clone(),
        stealth_address.clone(),
        0,
        cosigner.clone(),
    ));

    client.approve_stealth_cosigner(&cosigner, &stealth_address);

    let ok = client.stealth_withdraw(&recipient, &eph_pub, &spend_pub, &stealth_address);
    assert!(ok);

    let token_client = token::Client::new(&env, &token);
    assert_eq!(token_client.balance(&recipient), amount);
}

/// Wrong cosigner must be rejected.
#[test]
fn test_stealth_wrong_cosigner_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let cosigner = Address::generate(&env);
    let wrong_cosigner = Address::generate(&env);
    let amount: i128 = 500;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[24u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[25u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    client.register_ephemeral_key(&make_params_with_cosigner(
        &env,
        sender,
        token,
        amount,
        amount,
        eph_pub,
        spend_pub,
        stealth_address.clone(),
        0,
        cosigner,
    ));

    let err = client
        .try_approve_stealth_cosigner(&wrong_cosigner, &stealth_address)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::InvalidCosigner);
}

/// Double cosigner approval must fail.
#[test]
fn test_stealth_double_cosigner_approval_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let sender = Address::generate(&env);
    let cosigner = Address::generate(&env);
    let amount: i128 = 500;

    let eph_pub: BytesN<32> = BytesN::from_array(&env, &[26u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[27u8; 32]);
    let stealth_address = compute_stealth_address(&env, &eph_pub, &spend_pub);

    mint(&env, &token, &sender, amount);

    client.register_ephemeral_key(&make_params_with_cosigner(
        &env,
        sender,
        token,
        amount,
        amount,
        eph_pub,
        spend_pub,
        stealth_address.clone(),
        0,
        cosigner.clone(),
    ));

    client.approve_stealth_cosigner(&cosigner, &stealth_address);

    let err = client
        .try_approve_stealth_cosigner(&cosigner, &stealth_address)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, QuickexError::CosignerAlreadyApproved);
}

// ---------------------------------------------------------------------------
// Stealth key registry tests
// ---------------------------------------------------------------------------

/// Register and retrieve stealth keys.
#[test]
fn test_stealth_key_registry() {
    let (env, client) = setup();
    let owner = Address::generate(&env);

    let scan_pub: BytesN<32> = BytesN::from_array(&env, &[30u8; 32]);
    let spend_pub: BytesN<32> = BytesN::from_array(&env, &[31u8; 32]);

    assert_eq!(client.get_stealth_keys(&owner), None);

    client.register_stealth_keys(&owner, &scan_pub, &spend_pub);

    let keys = client.get_stealth_keys(&owner).unwrap();
    assert_eq!(keys.scan_pub, scan_pub);
    assert_eq!(keys.spend_pub, spend_pub);
}

/// Key rotation: overwriting existing keys.
#[test]
fn test_stealth_key_rotation() {
    let (env, client) = setup();
    let owner = Address::generate(&env);

    let scan_pub_1: BytesN<32> = BytesN::from_array(&env, &[32u8; 32]);
    let spend_pub_1: BytesN<32> = BytesN::from_array(&env, &[33u8; 32]);
    client.register_stealth_keys(&owner, &scan_pub_1, &spend_pub_1);

    let scan_pub_2: BytesN<32> = BytesN::from_array(&env, &[34u8; 32]);
    let spend_pub_2: BytesN<32> = BytesN::from_array(&env, &[35u8; 32]);
    client.register_stealth_keys(&owner, &scan_pub_2, &spend_pub_2);

    let keys = client.get_stealth_keys(&owner).unwrap();
    assert_eq!(keys.scan_pub, scan_pub_2);
    assert_eq!(keys.spend_pub, spend_pub_2);
}

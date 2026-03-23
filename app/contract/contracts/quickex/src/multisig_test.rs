//! QuickEx multisig tests

use crate::{
    errors::QuickexError, storage::has_multisig_escrow, QuickexContract, QuickexContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Bytes, BytesN, Env, Vec,
};

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

fn assert_error<T, E: core::fmt::Debug>(result: Result<T, Result<QuickexError, E>>, expected: QuickexError) {
    match result {
        Err(Ok(actual)) => assert_eq!(actual, expected),
        _ => panic!("Expected contract error {:?}", expected),
    }
}

#[test]
fn test_multisig_happy_path_2_of_3() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    
    let depositor = Address::generate(&env);
    let destination = Address::generate(&env);
    
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    
    let signers: Vec<Address> = Vec::from_array(&env, [signer1.clone(), signer2.clone(), signer3.clone()]);
    let threshold = 2;
    let amount = 5000;
    let salt = Bytes::from_slice(&env, b"multisig_2_of_3");

    let token_client = token::StellarAssetClient::new(&env, &token);
    token_client.mint(&depositor, &amount);

    // Deposit
    let commitment = client.deposit_multisig(
        &token,
        &amount,
        &depositor,
        &destination,
        &signers,
        &threshold,
        &salt,
        &0,
    );

    assert_eq!(token_client.balance(&depositor), 0);
    assert_eq!(token_client.balance(&client.address), amount);

    // 1st approval
    client.approve_multisig(&commitment, &signer1);

    // Release too early fails
    let release_err = client.try_release_multisig(&commitment);
    assert_error(release_err, QuickexError::ThresholdNotMet);

    // 2nd approval
    client.approve_multisig(&commitment, &signer2);

    // Release success
    client.release_multisig(&commitment);

    assert_eq!(token_client.balance(&client.address), 0);
    assert_eq!(token_client.balance(&destination), amount);

    // Already spent error if trying to release again
    let release_err2 = client.try_release_multisig(&commitment);
    assert_error(release_err2, QuickexError::AlreadySpent);
}

#[test]
fn test_unauthorized_signer_fails() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    
    let depositor = Address::generate(&env);
    let destination = Address::generate(&env);
    let signer = Address::generate(&env);
    let rogue = Address::generate(&env);
    
    let signers: Vec<Address> = Vec::from_array(&env, [signer.clone()]);
    
    let threshold = 1;
    let amount = 1000;
    let salt = Bytes::from_slice(&env, b"unauth_test");

    let token_client = token::StellarAssetClient::new(&env, &token);
    token_client.mint(&depositor, &amount);

    let commitment = client.deposit_multisig(
        &token,
        &amount,
        &depositor,
        &destination,
        &signers,
        &threshold,
        &salt,
        &0,
    );

    let err = client.try_approve_multisig(&commitment, &rogue);
    assert_error(err, QuickexError::SignerNotAuthorized);
}

#[test]
fn test_refund_successful() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let depositor = Address::generate(&env);
    let destination = Address::generate(&env);
    let signer = Address::generate(&env);
    
    let signers: Vec<Address> = Vec::from_array(&env, [signer.clone()]);
    let amount = 1000;
    let salt = Bytes::from_slice(&env, b"refund_test");
    let timeout = 100;

    let token_client = token::StellarAssetClient::new(&env, &token);
    token_client.mint(&depositor, &amount);

    let commitment = client.deposit_multisig(
        &token,
        &amount,
        &depositor,
        &destination,
        &signers,
        &1,
        &salt,
        &timeout,
    );

    // Refund before expiration fails
    let err_early = client.try_refund_multisig(&commitment, &depositor);
    assert_error(err_early, QuickexError::EscrowNotExpired);

    // Fast-forward time
    env.ledger().set_timestamp(env.ledger().timestamp() + timeout + 1);

    // Refund successful
    client.refund_multisig(&commitment, &depositor);
    
    assert_eq!(token_client.balance(&depositor), amount);
}

#[test]
fn test_invalid_threshold() {
    let (env, client) = setup();
    let token = create_test_token(&env);
    let depositor = Address::generate(&env);
    let destination = Address::generate(&env);
    let signer = Address::generate(&env);
    
    let signers: Vec<Address> = Vec::from_array(&env, [signer.clone()]);
    let amount = 1000;
    let salt = Bytes::from_slice(&env, b"salt");

    let token_client = token::StellarAssetClient::new(&env, &token);
    token_client.mint(&depositor, &amount);

    // Threshold 0
    let err1 = client.try_deposit_multisig(&token, &amount, &depositor, &destination, &signers, &0, &salt, &0);
    assert_error(err1, QuickexError::InvalidThreshold);

    // Threshold > signers length
    let err2 = client.try_deposit_multisig(&token, &amount, &depositor, &destination, &signers, &2, &salt, &0);
    assert_error(err2, QuickexError::InvalidThreshold);
}

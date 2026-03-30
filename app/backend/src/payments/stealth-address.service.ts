import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  deriveStealthAddress,
  deriveStealthAddressCommitment,
  generateEphemeralKeypair,
  deriveSharedSecret,
  verifyStealthAddressDerivation,
  deriveStealthPrivateKey,
} from './key-derivation.utils';

/**
 * Stealth Address Service
 *
 * Coordinates stealth address generation and verification with the Soroban contract.
 * Implements the dual-key stealth address protocol:
 *
 * Recipients publish (scan_pub_key, spend_pub_key)
 * Senders generate ephemeral keypairs and derive one-time stealth addresses
 * Recipients can scan the chain and derive stealth private keys to claim funds
 *
 * This is non-custodial – the server does not store any private keys.
 */

export interface StealthPaymentParams {
  senderAddress: string;
  recipientScanPubKey: string; // Hex-encoded 32-byte key
  recipientSpendPubKey: string; // Hex-encoded 32-byte key
  token: string;
  amount: number;
  timeoutSecs: number;
}

export interface StealthPaymentDerivation {
  ephemeralPrivKey: string; // Hex-encoded (server does not store this)
  ephemeralPubKey: string; // Hex-encoded
  sharedSecret: string; // Hex-encoded
  stealthAddress: string; // Hex-encoded
  // Additional fields for contract interaction
  contractParams: {
    sender: string;
    token: string;
    amount: number;
    eph_pub: string;
    spend_pub: string;
    stealth_address: string;
    timeout_secs: number;
  };
}

export interface RecipientStealthKeys {
  scanPrivKey: string; // Hex-encoded (off-chain only)
  scanPubKey: string; // Hex-encoded (published)
  spendPrivKey: string; // Hex-encoded (off-chain only)
  spendPubKey: string; // Hex-encoded (published)
}

export interface StealthWithdrawalParams {
  stealthAddress: string; // Hex-encoded
  ephemeralPubKey: string; // Hex-encoded
  spendPubKey: string; // Hex-encoded
  recipientAddress: string; // Real address for receiving funds
}

@Injectable()
export class StealthAddressService {
  private readonly logger = new Logger(StealthAddressService.name);

  /**
   * Generate a new stealth keypair for a recipient
   *
   * Returns both public keys (for publishing) and private keys (for off-chain storage).
   * Recipients should securely store the private keys and only publish the public keys.
   *
   * @returns Recipient stealth keypair
   */
  generateRecipientKeypair(): RecipientStealthKeys {
    const scanPrivKey = crypto.randomBytes(32);
    const spendPrivKey = crypto.randomBytes(32);

    // For deterministic public key derivation, use SHA-256 (matching Soroban implementation)
    const scanPubKey = this.derivePublicKey(scanPrivKey);
    const spendPubKey = this.derivePublicKey(spendPrivKey);

    return {
      scanPrivKey: scanPrivKey.toString('hex'),
      scanPubKey: scanPubKey.toString('hex'),
      spendPrivKey: spendPrivKey.toString('hex'),
      spendPubKey: spendPubKey.toString('hex'),
    };
  }

  /**
   * Derive a payment from sender to recipient using stealth addressing
   *
   * Generates an ephemeral keypair and derives the one-time stealth address.
   * Returns all parameters needed to call the Soroban contract.
   *
   * @param params Payment parameters
   * @returns Derivation result with contract parameters
   */
  deriveStealthPayment(params: StealthPaymentParams): StealthPaymentDerivation {
    const {
      senderAddress,
      recipientScanPubKey,
      recipientSpendPubKey,
      token,
      amount,
      timeoutSecs,
    } = params;

    // Validate inputs
    if (!senderAddress || !senderAddress.startsWith('G')) {
      throw new BadRequestException('Invalid sender address');
    }
    if (!token || !token.startsWith('C')) {
      throw new BadRequestException('Invalid token address');
    }
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Parse hex keys
    let scanPubKeyBuf: Buffer;
    let spendPubKeyBuf: Buffer;

    try {
      scanPubKeyBuf = Buffer.from(recipientScanPubKey, 'hex');
      spendPubKeyBuf = Buffer.from(recipientSpendPubKey, 'hex');
    } catch (error) {
      throw new BadRequestException('Invalid hex-encoded public keys');
    }

    if (scanPubKeyBuf.length !== 32 || spendPubKeyBuf.length !== 32) {
      throw new BadRequestException('Public keys must be 32 bytes');
    }

    // Generate ephemeral keypair
    const { ephemeralPrivKey, ephemeralPubKey } = generateEphemeralKeypair();

    // Derive shared secret: KDF(eph_pub || scan_pub)
    const sharedSecret = deriveStealthAddress(ephemeralPubKey, scanPubKeyBuf);

    // Derive stealth address: KDF(spend_pub || shared_secret)
    const stealthAddress = deriveStealthAddressCommitment(spendPubKeyBuf, sharedSecret);

    this.logger.debug('Derived stealth payment', {
      sender: senderAddress,
      ephPubKey: ephemeralPubKey.toString('hex'),
      stealthAddress: stealthAddress.toString('hex'),
    });

    return {
      ephemeralPrivKey: ephemeralPrivKey.toString('hex'),
      ephemeralPubKey: ephemeralPubKey.toString('hex'),
      sharedSecret: sharedSecret.toString('hex'),
      stealthAddress: stealthAddress.toString('hex'),
      contractParams: {
        sender: senderAddress,
        token,
        amount,
        eph_pub: ephemeralPubKey.toString('hex'),
        spend_pub: recipientSpendPubKey,
        stealth_address: stealthAddress.toString('hex'),
        timeout_secs: timeoutSecs,
      },
    };
  }

  /**
   * Verify stealth address derivation (for auditing/testing)
   *
   * @param ephemeralPubKey Ephemeral public key (hex)
   * @param recipientScanPubKey Recipient's scan public key (hex)
   * @param recipientSpendPubKey Recipient's spend public key (hex)
   * @param expectedStealthAddress Expected stealth address (hex)
   * @returns true if derivation is valid
   */
  verifyStealthDerivation(
    ephemeralPubKey: string,
    recipientScanPubKey: string,
    recipientSpendPubKey: string,
    expectedStealthAddress: string,
  ): boolean {
    try {
      const ephPubBuf = Buffer.from(ephemeralPubKey, 'hex');
      const scanPubBuf = Buffer.from(recipientScanPubKey, 'hex');
      const spendPubBuf = Buffer.from(recipientSpendPubKey, 'hex');
      const expectedBuf = Buffer.from(expectedStealthAddress, 'hex');

      return verifyStealthAddressDerivation(ephPubBuf, spendPubBuf, expectedBuf);
    } catch (error) {
      this.logger.error('Stealth address verification failed', error);
      return false;
    }
  }

  /**
   * Scan the chain for stealth payments directed to a specific recipient
   *
   * Recipient uses their scan_priv_key to check if a payment is for them.
   * This is an off-chain operation.
   *
   * @param ephemeralPubKey Ephemeral key from the on-chain event (hex)
   * @param recipientScanPrivKey Recipient's scan private key (hex)
   * @param recipientSpendPubKey Recipient's spend public key (hex)
   * @param recordedStealthAddress Stealth address from on-chain (hex)
   * @returns true if this payment is for the recipient
   */
  scanStealthPayment(
    ephemeralPubKey: string,
    recipientScanPrivKey: string,
    recipientSpendPubKey: string,
    recordedStealthAddress: string,
  ): boolean {
    try {
      const ephPubBuf = Buffer.from(ephemeralPubKey, 'hex');
      const scanPrivBuf = Buffer.from(recipientScanPrivKey, 'hex');
      const spendPubBuf = Buffer.from(recipientSpendPubKey, 'hex');
      const recordedBuf = Buffer.from(recordedStealthAddress, 'hex');

      // Derive shared secret: KDF(eph_pub || scan_priv_key)
      // In practice, we use scan_pub derived from scan_priv for the KDF
      const scanPubDerived = this.derivePublicKey(scanPrivBuf);
      const sharedSecret = deriveStealthAddress(ephPubBuf, scanPubDerived);

      // Compute expected stealth address
      const expectedStealth = deriveStealthAddressCommitment(spendPubBuf, sharedSecret);

      return expectedStealth.equals(recordedBuf);
    } catch (error) {
      this.logger.error('Stealth payment scan failed', error);
      return false;
    }
  }

  /**
   * Derive the stealth private key that allows withdrawal
   *
   * Only the recipient (who knows spend_priv_key) can derive this.
   * This key is used to sign the withdrawal transaction.
   *
   * @param recipientSpendPrivKey Recipient's spend private key (hex)
   * @param sharedSecret Shared secret from scanning (hex)
   * @returns Stealth private key (hex)
   */
  deriveStealthPrivateKeyForWithdrawal(
    recipientSpendPrivKey: string,
    sharedSecret: string,
  ): string {
    try {
      const spendPrivBuf = Buffer.from(recipientSpendPrivKey, 'hex');
      const sharedSecretBuf = Buffer.from(sharedSecret, 'hex');

      const stealthPrivKey = deriveStealthPrivateKey(spendPrivBuf, sharedSecretBuf);
      return stealthPrivKey.toString('hex');
    } catch (error) {
      throw new BadRequestException(
        `Failed to derive stealth private key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Prepare withdrawal parameters for the Soroban contract
   *
   * @param params Withdrawal parameters
   * @returns Contract call parameters
   */
  prepareStealthWithdrawal(params: StealthWithdrawalParams) {
    const { stealthAddress, ephemeralPubKey, spendPubKey, recipientAddress } = params;

    if (!recipientAddress || !recipientAddress.startsWith('G')) {
      throw new BadRequestException('Invalid recipient address');
    }

    // Validate addresses are hex-encoded 32-byte values
    try {
      const stealthBuf = Buffer.from(stealthAddress, 'hex');
      const ephPubBuf = Buffer.from(ephemeralPubKey, 'hex');
      const spendPubBuf = Buffer.from(spendPubKey, 'hex');

      if (stealthBuf.length !== 32 || ephPubBuf.length !== 32 || spendPubBuf.length !== 32) {
        throw new BadRequestException('All cryptographic parameters must be 32 bytes');
      }
    } catch (error) {
      throw new BadRequestException('Invalid hex-encoded cryptographic parameters');
    }

    return {
      recipient: recipientAddress,
      eph_pub: ephemeralPubKey,
      spend_pub: spendPubKey,
      stealth_address: stealthAddress,
    };
  }

  /**
   * Batch verify multiple stealth addresses (for security audits)
   *
   * @param derivations Array of derivations to verify
   * @returns Array of verification results
   */
  batchVerifyStealthAddresses(
    derivations: Array<{
      ephemeralPubKey: string;
      scanPubKey: string;
      spendPubKey: string;
      stealthAddress: string;
    }>,
  ) {
    return derivations.map((d) => ({
      ...d,
      isValid: this.verifyStealthDerivation(
        d.ephemeralPubKey,
        d.scanPubKey,
        d.spendPubKey,
        d.stealthAddress,
      ),
    }));
  }

  /**
   * Derive public key from private key (using SHA-256 for determinism)
   *
   * This is a simplified implementation matching the Soroban contract's approach.
   * In production, use proper Ed25519 or secp256k1 point multiplication.
   *
   * @param privateKey 32-byte private key
   * @returns 32-byte public key
   */
  private derivePublicKey(privateKey: Buffer): Buffer {
    // Simplified: hash the private key
    // In production with Ed25519: return ed25519.publicKeyFromSecret(privateKey)
    return crypto.createHash('sha256').update(Buffer.concat([Buffer.from('pubkey'), privateKey])).digest();
  }
}

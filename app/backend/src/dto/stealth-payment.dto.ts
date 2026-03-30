import { IsString, IsNumber, IsOptional, IsHexadecimal, Length, Min, ValidateNested, Type } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Privacy-related DTOs for stealth payments and encrypted metadata
 */

/**
 * Recipient's stealth public keys (published, non-sensitive)
 */
export class RecipientStealthPublicKeysDto {
  @ApiProperty({
    description: 'Recipient scan public key (32 bytes, hex-encoded)',
    example: 'a'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  scanPubKey: string;

  @ApiProperty({
    description: 'Recipient spend public key (32 bytes, hex-encoded)',
    example: 'b'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  spendPubKey: string;
}

/**
 * Request to derive a stealth payment
 */
export class DeriveStealthPaymentDto {
  @ApiProperty({
    description: 'Sender Stellar address',
    example: 'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJQ4CDOODMQS7VYTSRQMTMQBFQT',
  })
  @IsString()
  senderAddress: string;

  @ApiProperty({
    description: 'Recipient scan public key (hex)',
    example: 'a'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  recipientScanPubKey: string;

  @ApiProperty({
    description: 'Recipient spend public key (hex)',
    example: 'b'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  recipientSpendPubKey: string;

  @ApiProperty({
    description: 'Token contract address',
    example: 'CCZST5X3NNQL4ID3NQWS45A7T2SRSQTVNUVE2D5ZWZOU6GBJUMXM6BS',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'Payment amount in stroops',
    example: 1000000,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    description: 'Timeout in seconds (0 = no expiry)',
    example: 86400,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  timeoutSecs?: number;
}

/**
 * Response from stealth payment derivation
 */
export class StealthPaymentDerivationResponseDto {
  @ApiProperty({
    description: 'Ephemeral public key (hex, 32 bytes)',
    example: 'c'.repeat(64),
  })
  ephemeralPubKey: string;

  @ApiProperty({
    description: 'Stealth address (hex, 32 bytes)',
    example: 'd'.repeat(64),
  })
  stealthAddress: string;

  @ApiProperty({
    description: 'Shared secret (hex, 32 bytes)',
    example: 'e'.repeat(64),
  })
  sharedSecret: string;

  @ApiProperty({
    description: 'Contract parameters for deposit call',
    type: Object,
  })
  contractParams: {
    sender: string;
    token: string;
    amount: number;
    eph_pub: string;
    spend_pub: string;
    stealth_address: string;
    timeout_secs: number;
  };

  @ApiPropertyOptional({
    description: 'Warning: Ephemeral private key (DO NOT share, DO NOT transmit insecurely)',
  })
  ephemeralPrivKey?: string;
}

/**
 * Request to verify stealth address derivation
 */
export class VerifyStealthAddressDto {
  @ApiProperty({
    description: 'Ephemeral public key (hex, 32 bytes)',
    example: 'c'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  ephemeralPubKey: string;

  @ApiProperty({
    description: 'Recipient scan public key (hex, 32 bytes)',
    example: 'a'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  scanPubKey: string;

  @ApiProperty({
    description: 'Recipient spend public key (hex, 32 bytes)',
    example: 'b'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  spendPubKey: string;

  @ApiProperty({
    description: 'Expected stealth address (hex, 32 bytes)',
    example: 'd'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  stealthAddress: string;
}

/**
 * Response for stealth address verification
 */
export class VerifyStealthAddressResponseDto {
  @ApiProperty({ example: true })
  isValid: boolean;

  @ApiPropertyOptional({
    description: 'Verification details/error message',
  })
  details?: string;
}

/**
 * Encrypted recipient metadata
 */
export class EncryptedMetadataDto {
  @ApiProperty({
    description: 'Encrypted data (hex-encoded ciphertext)',
    example: 'a'.repeat(100),
  })
  @IsHexadecimal()
  ciphertext: string;

  @ApiProperty({
    description: 'Nonce/IV (hex-encoded, 12 bytes)',
    example: 'b'.repeat(24),
  })
  @IsHexadecimal()
  @Length(24, 24)
  nonce: string;

  @ApiProperty({
    description: 'Authentication tag (hex-encoded, 16 bytes)',
    example: 'c'.repeat(32),
  })
  @IsHexadecimal()
  @Length(32, 32)
  tag: string;

  @ApiPropertyOptional({
    description: 'Salt for key derivation (hex-encoded, optional)',
  })
  @IsHexadecimal()
  @IsOptional()
  salt?: string;
}

/**
 * Request to encrypt recipient metadata
 */
export class EncryptRecipientMetadataDto {
  @ApiProperty({
    description: 'Recipient Stellar address',
    example: 'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJQ4CDOODMQS7VYTSRQMTMQBFQT',
  })
  @IsString()
  recipientAddress: string;

  @ApiPropertyOptional({
    description: 'Recipient display name',
  })
  @IsString()
  @IsOptional()
  recipientName?: string;

  @ApiPropertyOptional({
    description: 'Associated ledger account reference',
  })
  @IsString()
  @IsOptional()
  recipientLedgerAccount?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: 'Encryption key (32 bytes, hex-encoded)',
    example: 'f'.repeat(64),
  })
  @IsHexadecimal()
  @Length(64, 64)
  encryptionKey: string;

  @ApiPropertyOptional({
    description: 'Additional authenticated data (AAD, hex-encoded)',
  })
  @IsHexadecimal()
  @IsOptional()
  aad?: string;
}

/**
 * Request to scan for stealth payment (recipient-side)
 */
export class ScanStealthPaymentDto {
  @ApiProperty({
    description: 'Ephemeral public key from on-chain event (hex, 32 bytes)',
  })
  @IsHexadecimal()
  @Length(64, 64)
  ephemeralPubKey: string;

  @ApiProperty({
    description: 'Recipient scan private key (hex, 32 bytes) - only known to recipient',
  })
  @IsHexadecimal()
  @Length(64, 64)
  scanPrivKey: string;

  @ApiProperty({
    description: 'Recipient spend public key (hex, 32 bytes)',
  })
  @IsHexadecimal()
  @Length(64, 64)
  spendPubKey: string;

  @ApiProperty({
    description: 'Recorded stealth address from on-chain (hex, 32 bytes)',
  })
  @IsHexadecimal()
  @Length(64, 64)
  recordedStealthAddress: string;
}

/**
 * Response for stealth payment scanning
 */
export class ScanStealthPaymentResponseDto {
  @ApiProperty({
    description: 'Whether this payment is for the recipient',
  })
  isForRecipient: boolean;

  @ApiPropertyOptional({
    description: 'Details about the payment if identified',
  })
  details?: {
    stealthAddress: string;
    isPending: boolean;
  };
}

/**
 * Request to prepare stealth withdrawal
 */
export class PrepareStealthWithdrawalDto {
  @ApiProperty({
    description: 'Stealth address to withdraw from (hex, 32 bytes)',
  })
  @IsHexadecimal()
  @Length(64, 64)
  stealthAddress: string;

  @ApiProperty({
    description: 'Ephemeral public key (hex, 32 bytes)',
  })
  @IsHexadecimal()
  @Length(64, 64)
  ephemeralPubKey: string;

  @ApiProperty({
    description: 'Recipient spend public key (hex, 32 bytes)',
  })
  @IsHexadecimal()
  @Length(64, 64)
  spendPubKey: string;

  @ApiProperty({
    description: 'Real recipient Stellar address for receiving funds',
  })
  @IsString()
  recipientAddress: string;
}

/**
 * Response with prepared withdrawal parameters
 */
export class PrepareStealthWithdrawalResponseDto {
  @ApiProperty({
    description: 'Contract call parameters',
  })
  contractParams: {
    recipient: string;
    eph_pub: string;
    spend_pub: string;
    stealth_address: string;
  };
}

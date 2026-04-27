import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexadecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class DeriveStealthAddressDto {
  @ApiProperty({ description: 'Ephemeral public key (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  ephPub: string;

  @ApiProperty({ description: 'Recipient scan public key (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  scanPub: string;

  @ApiProperty({ description: 'Recipient spend public key (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  spendPub: string;
}

export class DeriveStealthAddressResponseDto {
  @ApiProperty({ description: 'Derived one-time stealth address (hex)' })
  stealthAddress: string;

  @ApiProperty({ description: 'Shared secret for memo encryption (hex)' })
  sharedSecret: string;
}

export class EncryptMemoDto {
  @ApiProperty({ description: 'Plaintext memo to encrypt' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  memo: string;

  @ApiProperty({ description: 'Shared secret from DH exchange (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  sharedSecret: string;
}

export class EncryptMemoResponseDto {
  @ApiProperty({ description: 'Encrypted memo (hex)' })
  encryptedMemo: string;
}

export class DecryptMemoDto {
  @ApiProperty({ description: 'Encrypted memo (hex)' })
  @IsHexadecimal()
  @IsNotEmpty()
  encryptedMemo: string;

  @ApiProperty({ description: 'Shared secret from DH exchange (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  sharedSecret: string;
}

export class DecryptMemoResponseDto {
  @ApiProperty({ description: 'Decrypted plaintext memo' })
  memo: string;
}

export class ScanStealthEventDto {
  @ApiProperty({ description: 'Ephemeral public key from on-chain event (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  ephPub: string;

  @ApiProperty({ description: 'Recipient scan private key (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  scanPriv: string;

  @ApiProperty({ description: 'Recipient spend public key (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  spendPub: string;

  @ApiProperty({ description: 'Stealth address from on-chain event (64-char hex)' })
  @IsHexadecimal()
  @Length(64, 64)
  stealthAddress: string;

  @ApiPropertyOptional({ description: 'Encrypted memo from on-chain event (hex)' })
  @IsOptional()
  @IsHexadecimal()
  encryptedMemo?: string;
}

export class ScanStealthEventResponseDto {
  @ApiProperty({ description: 'Whether this event is addressed to the recipient' })
  isMatch: boolean;

  @ApiPropertyOptional({ description: 'Decrypted memo (only present on match with memo)' })
  memo?: string;
}

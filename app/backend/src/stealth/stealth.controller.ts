import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { createHash } from 'crypto';

import { StealthCryptoService } from './stealth-crypto.service';
import {
  DeriveStealthAddressDto,
  DeriveStealthAddressResponseDto,
  EncryptMemoDto,
  EncryptMemoResponseDto,
  DecryptMemoDto,
  DecryptMemoResponseDto,
  ScanStealthEventDto,
  ScanStealthEventResponseDto,
} from './dto/stealth.dto';

@ApiTags('stealth')
@Controller('stealth')
export class StealthController {
  constructor(private readonly cryptoService: StealthCryptoService) {}

  @Post('derive-address')
  @ApiOperation({
    summary: 'Derive a one-time stealth address from public keys',
  })
  @ApiResponse({ status: 200, type: DeriveStealthAddressResponseDto })
  deriveAddress(
    @Body() dto: DeriveStealthAddressDto,
  ): DeriveStealthAddressResponseDto {
    const ephPub = Buffer.from(dto.ephPub, 'hex');
    const scanPub = Buffer.from(dto.scanPub, 'hex');
    const spendPub = Buffer.from(dto.spendPub, 'hex');

    const sharedSecret = this.cryptoService.deriveSharedSecret(ephPub, scanPub);
    const stealthAddress = this.cryptoService.deriveStealthAddress(
      spendPub,
      sharedSecret,
    );

    return {
      stealthAddress: stealthAddress.toString('hex'),
      sharedSecret: sharedSecret.toString('hex'),
    };
  }

  @Post('encrypt-memo')
  @ApiOperation({
    summary: 'Encrypt a memo using the DH shared secret',
  })
  @ApiResponse({ status: 200, type: EncryptMemoResponseDto })
  encryptMemo(@Body() dto: EncryptMemoDto): EncryptMemoResponseDto {
    const sharedSecret = Buffer.from(dto.sharedSecret, 'hex');
    const encrypted = this.cryptoService.encryptMemo(dto.memo, sharedSecret);

    return { encryptedMemo: encrypted.toString('hex') };
  }

  @Post('decrypt-memo')
  @ApiOperation({
    summary: 'Decrypt a memo using the DH shared secret',
  })
  @ApiResponse({ status: 200, type: DecryptMemoResponseDto })
  decryptMemo(@Body() dto: DecryptMemoDto): DecryptMemoResponseDto {
    const sharedSecret = Buffer.from(dto.sharedSecret, 'hex');
    const ciphertext = Buffer.from(dto.encryptedMemo, 'hex');
    const memo = this.cryptoService.decryptMemo(ciphertext, sharedSecret);

    return { memo };
  }

  @Post('scan')
  @ApiOperation({
    summary: 'Check if a stealth event is addressed to you and optionally decrypt the memo',
  })
  @ApiResponse({ status: 200, type: ScanStealthEventResponseDto })
  scanEvent(@Body() dto: ScanStealthEventDto): ScanStealthEventResponseDto {
    const ephPub = Buffer.from(dto.ephPub, 'hex');
    const scanPriv = Buffer.from(dto.scanPriv, 'hex');
    const spendPub = Buffer.from(dto.spendPub, 'hex');
    const stealthAddress = Buffer.from(dto.stealthAddress, 'hex');

    const isMatch = this.cryptoService.scanForRecipient(
      ephPub,
      scanPriv,
      spendPub,
      stealthAddress,
    );

    if (!isMatch) {
      return { isMatch: false };
    }

    if (dto.encryptedMemo) {
      const scanPub = createHash('sha256').update(scanPriv).digest();
      const sharedSecret = this.cryptoService.deriveSharedSecret(
        ephPub,
        scanPub,
      );
      const ciphertext = Buffer.from(dto.encryptedMemo, 'hex');
      const memo = this.cryptoService.decryptMemo(ciphertext, sharedSecret);
      return { isMatch: true, memo };
    }

    return { isMatch: true };
  }
}

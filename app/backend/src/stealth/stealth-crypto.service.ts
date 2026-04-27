import { Injectable } from '@nestjs/common';
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  hkdfSync,
} from 'crypto';

const AES_KEY_LEN = 32;
const AES_IV_LEN = 12;
const AES_TAG_LEN = 16;
const HKDF_SALT = Buffer.from('quickex-stealth-v2');
const HKDF_INFO_MEMO = Buffer.from('stealth-memo-encryption');

@Injectable()
export class StealthCryptoService {
  deriveSharedSecret(ephPub: Buffer, scanPub: Buffer): Buffer {
    const payload = Buffer.concat([ephPub, scanPub]);
    return createHash('sha256').update(payload).digest();
  }

  deriveStealthAddress(spendPub: Buffer, sharedSecret: Buffer): Buffer {
    const payload = Buffer.concat([spendPub, sharedSecret]);
    return createHash('sha256').update(payload).digest();
  }

  computeStealthAddress(
    ephPub: Buffer,
    scanPub: Buffer,
    spendPub: Buffer,
  ): Buffer {
    const sharedSecret = this.deriveSharedSecret(ephPub, scanPub);
    return this.deriveStealthAddress(spendPub, sharedSecret);
  }

  generateEphemeralKeyPair(): { ephPriv: Buffer; ephPub: Buffer } {
    const ephPriv = randomBytes(32);
    const ephPub = createHash('sha256').update(ephPriv).digest();
    return { ephPriv, ephPub };
  }

  private deriveEncryptionKey(sharedSecret: Buffer): Buffer {
    const derived = hkdfSync(
      'sha256',
      sharedSecret,
      HKDF_SALT,
      HKDF_INFO_MEMO,
      AES_KEY_LEN,
    );
    return Buffer.from(derived);
  }

  encryptMemo(memo: string, sharedSecret: Buffer): Buffer {
    const key = this.deriveEncryptionKey(sharedSecret);
    const iv = randomBytes(AES_IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(memo, 'utf8')),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]);
  }

  decryptMemo(ciphertext: Buffer, sharedSecret: Buffer): string {
    if (ciphertext.length < AES_IV_LEN + AES_TAG_LEN) {
      throw new Error('Ciphertext too short');
    }

    const key = this.deriveEncryptionKey(sharedSecret);
    const iv = ciphertext.subarray(0, AES_IV_LEN);
    const authTag = ciphertext.subarray(AES_IV_LEN, AES_IV_LEN + AES_TAG_LEN);
    const encrypted = ciphertext.subarray(AES_IV_LEN + AES_TAG_LEN);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  scanForRecipient(
    ephPub: Buffer,
    scanPriv: Buffer,
    spendPub: Buffer,
    onChainStealthAddress: Buffer,
  ): boolean {
    const scanPub = createHash('sha256').update(scanPriv).digest();
    const sharedSecret = this.deriveSharedSecret(ephPub, scanPub);
    const derivedStealth = this.deriveStealthAddress(spendPub, sharedSecret);
    return derivedStealth.equals(onChainStealthAddress);
  }
}

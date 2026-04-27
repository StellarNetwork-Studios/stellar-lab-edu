import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify, Keypair } from '@stellar/stellar-sdk';

import {
  SIGNED_PAYLOAD_ERROR_CODES,
  SignedPayloadErrorCode,
  SignedPayloadData,
  SignedPayloadConfig,
  DEFAULT_SIGNED_PAYLOAD_CONFIG,
} from './signed-payload.types';
import { ReplayProtectionService } from './replay-protection.service';

@Injectable()
export class SignedPayloadService {
  private readonly logger = new Logger(SignedPayloadService.name);
  private readonly config: SignedPayloadConfig;

  constructor(
    private readonly replayProtection: ReplayProtectionService,
    private readonly configService: ConfigService,
  ) {
    const enabled = this.configService.get<boolean>('SIGNED_PAYLOAD_ENABLED');
    const replayWindowMs = this.configService.get<number>('SIGNED_PAYLOAD_REPLAY_WINDOW_MS');

    this.config = {
      enabled: enabled ?? DEFAULT_SIGNED_PAYLOAD_CONFIG.enabled,
      replayWindowMs: replayWindowMs ?? DEFAULT_SIGNED_PAYLOAD_CONFIG.replayWindowMs,
    };
  }

  async verify(
    data: SignedPayloadData,
    signerPublicKey: string,
  ): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Signed payload verification is disabled');
      return;
    }

    const now = Date.now();
    const timeDiff = Math.abs(now - data.timestamp);

    if (timeDiff > this.config.replayWindowMs) {
      throw new UnauthorizedException({
        code: SIGNED_PAYLOAD_ERROR_CODES.INVALID_TIMESTAMP,
        message: `Timestamp outside acceptable window (${this.config.replayWindowMs}ms)`,
      });
    }

    const payload = `${data.timestamp}:${data.method}:${data.path}:${data.body}`;
    const signatureBuffer = Buffer.from(data.signature, 'base64');

    try {
      const isValid = verify(
        signerPublicKey,
        payload,
        signatureBuffer,
      );

      if (!isValid) {
        throw new UnauthorizedException({
          code: SIGNED_PAYLOAD_ERROR_CODES.INVALID_SIGNATURE,
          message: 'Signature verification failed',
        });
      }

      if (this.replayProtection.isReplay(data.signature)) {
        throw new UnauthorizedException({
          code: SIGNED_PAYLOAD_ERROR_CODES.REPLAY_DETECTED,
          message: 'Signature has already been used',
        });
      }

      this.replayProtection.addSignature(data.signature);
    } catch (err) {
      if (
        err instanceof UnauthorizedException &&
        err.getResponse() &&
        typeof err.getResponse() === 'object' &&
        'code' in err.getResponse()
      ) {
        throw err;
      }

      this.logger.error(`Signature verification error: ${err}`);
      throw new UnauthorizedException({
        code: SIGNED_PAYLOAD_ERROR_CODES.INVALID_SIGNATURE,
        message: 'Signature verification failed',
      });
    }
  }

  buildPayload(
    timestamp: number,
    method: string,
    path: string,
    body: string,
  ): string {
    return `${timestamp}:${method}:${path}:${body}`;
  }

  sign(payload: string, keypair: Keypair): string {
    return keypair.sign(Buffer.from(payload)).toString('base64');
  }
}
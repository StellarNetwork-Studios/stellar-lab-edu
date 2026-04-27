import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import {
  SIGNED_PAYLOAD_HEADER,
  SIGNED_PAYLOAD_ERROR_CODES,
  SignedPayloadData,
} from '../signed-payload.types';
import { SignedPayloadService } from '../signed-payload.service';
import { ReplayProtectionService } from '../replay-protection.service';
import { SignedPayload } from '../decorators/require-signed-payload.decorator';

@Injectable()
export class SignedPayloadGuard implements CanActivate {
  private readonly logger = new Logger(SignedPayloadGuard.name);

  constructor(
    private readonly signedPayloadService: SignedPayloadService,
    private readonly replayProtection: ReplayProtectionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requiresSignedPayload = this.getMetadata(context);

    if (!requiresSignedPayload) {
      return true;
    }

    const signedPayloadHeader = request.headers[SIGNED_PAYLOAD_HEADER];
    if (!signedPayloadHeader) {
      throw new UnauthorizedException({
        code: SIGNED_PAYLOAD_ERROR_CODES.MISSING_SIGNED_PAYLOAD,
        message: 'Signed payload header required for this endpoint',
      });
    }

    let parsed: SignedPayloadData;
    try {
      parsed = JSON.parse(signedPayloadHeader);
    } catch {
      throw new BadRequestException({
        code: SIGNED_PAYLOAD_ERROR_CODES.MISSING_SIGNED_PAYLOAD,
        message: 'Invalid signed payload header format',
      });
    }

    const { timestamp, method, path, signature } = parsed;
    const body = request.body ? JSON.stringify(request.body) : '';

    if (!timestamp || !method || !path || !signature) {
      throw new BadRequestException({
        code: SIGNED_PAYLOAD_ERROR_CODES.MISSING_SIGNED_PAYLOAD,
        message: 'Missing required signed payload fields',
      });
    }

    const data: SignedPayloadData = {
      timestamp,
      method,
      path,
      body,
      signature,
    };

    const signerPublicKey = request.headers['x-signer-public-key'] as string;
    if (!signerPublicKey) {
      throw new UnauthorizedException({
        code: SIGNED_PAYLOAD_ERROR_CODES.MISSING_SIGNED_PAYLOAD,
        message: 'Signer public key header required (x-signer-public-key)',
      });
    }

    await this.signedPayloadService.verify(data, signerPublicKey);

    return true;
  }

  private getMetadata(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();

    const handlerMeta = Reflect.getMetadata('signedPayloadRequired', handler);
    const controllerMeta = Reflect.getMetadata('signedPayloadRequired', controller);

    return handlerMeta ?? controllerMeta ?? false;
  }
}
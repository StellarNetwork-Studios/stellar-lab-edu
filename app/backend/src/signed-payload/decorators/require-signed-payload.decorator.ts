import { SetMetadata } from '@nestjs/common';

export const SIGNED_PAYLOAD_KEY = 'signedPayloadRequired';

export const SignedPayload = (required: boolean = true) =>
  SetMetadata(SIGNED_PAYLOAD_KEY, required);

export const requireSignedPayload = (required: boolean) => SetMetadata(SIGNED_PAYLOAD_KEY, required);
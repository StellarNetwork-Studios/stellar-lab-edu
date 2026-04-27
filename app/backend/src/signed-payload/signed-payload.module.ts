import { Module } from '@nestjs/common';

import { SignedPayloadService } from './signed-payload.service';
import { ReplayProtectionService } from './replay-protection.service';
import { SignedPayloadGuard } from './guards/signed-payload.guard';

@Module({
  providers: [
    SignedPayloadService,
    ReplayProtectionService,
    SignedPayloadGuard,
  ],
  exports: [
    SignedPayloadService,
    ReplayProtectionService,
    SignedPayloadGuard,
  ],
})
export class SignedPayloadModule {}
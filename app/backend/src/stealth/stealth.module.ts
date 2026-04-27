import { Module } from '@nestjs/common';
import { StealthCryptoService } from './stealth-crypto.service';
import { StealthController } from './stealth.controller';

@Module({
  controllers: [StealthController],
  providers: [StealthCryptoService],
  exports: [StealthCryptoService],
})
export class StealthModule {}

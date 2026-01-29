// import { Module } from '@nestjs/common';

// import { HealthController } from './health.controller';

// @Module({
//   controllers: [HealthController],
// })
// export class HealthModule {}

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReadinessService } from './readiness.service';

@Module({
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class HealthModule {}

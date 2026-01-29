// import { Controller, Get } from '@nestjs/common';
// import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

// import { HealthResponseDto } from './health-response.dto';

// @ApiTags('health')
// @Controller('health')
// export class HealthController {
//   @Get()
//   @ApiOperation({
//     summary: 'Health check',
//     description: 'Returns the health status of the API. Use this endpoint to verify the service is running.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Service is healthy',
//     type: HealthResponseDto,
//   })
//   getHealth(): HealthResponseDto {
//     return { status: 'ok' };
//   }
// }

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { HealthResponseDto } from './health-response.dto';
import { ReadinessResponseDto } from './readiness-response.dto';
import { ReadinessService } from './readiness.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly readinessService: ReadinessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Liveness probe. Confirms the API is running.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      version: process.env.APP_VERSION ?? 'unknown',
      uptime: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check',
    description:
      'Readiness probe. Validates env configuration and Supabase connectivity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready',
    type: ReadinessResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async getReadiness(): Promise<ReadinessResponseDto> {
    const checks = await this.readinessService.runChecks();
    const ready = checks.every((check) => check.ok);

    return {
      ready,
      checks,
    };
  }
}
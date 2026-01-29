import { ApiProperty } from '@nestjs/swagger';

/**
 * Health check response DTO
 */
export class HealthResponseDto {
  @ApiProperty({
    description: 'Health status of the service',
    example: 'ok',
    enum: ['ok'],
  })
  status!: 'ok';

  @ApiProperty({
    description: 'Running version of the API',
    example: '1.0.0',
  })
  version!: string;

  @ApiProperty({
    description: 'Uptime of the service in seconds',
    example: 12345,
  })
  uptime!: number;
}

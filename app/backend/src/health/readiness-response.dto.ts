import { ApiProperty } from '@nestjs/swagger';
import { ReadinessCheckDto } from './readiness-check.dto';

export class ReadinessResponseDto {
  @ApiProperty({ example: true })
  ready!: boolean;

  @ApiProperty({ type: [ReadinessCheckDto] })
  checks!: ReadinessCheckDto[];
}

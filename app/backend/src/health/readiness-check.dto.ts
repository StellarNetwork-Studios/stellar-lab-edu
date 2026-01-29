import { ApiProperty } from '@nestjs/swagger';

export class ReadinessCheckDto {
  @ApiProperty({ example: 'supabase' })
  name!: string;

  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({
    required: false,
    example: 'timeout',
  })
  error?: string;
}

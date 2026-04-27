import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export const SIGNED_PAYLOAD_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export class SignedPayloadDto {
  @ApiProperty({
    description: 'Unix timestamp in milliseconds',
    example: 1714324800000,
  })
  @IsNumber()
  @Min(0)
  timestamp!: number;

  @ApiProperty({
    description: 'HTTP method',
    example: 'POST',
  })
  @IsString()
  @IsNotEmpty()
  method!: string;

  @ApiProperty({
    description: 'Full request path including query params',
    example: '/marketplace/listing123/bid',
  })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiProperty({
    description: 'JSON stringified request body',
    example: '{"listingId":"listing123","bidAmount":100}',
  })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty({
    description: 'Stellar address signature (base64)',
    example: 'abcd1234...',
  })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}
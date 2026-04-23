import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Line Item DTO
// ---------------------------------------------------------------------------

export class LineItemDto {
  @ApiProperty({ description: 'Item name or description' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Total for this line item (auto-calculated if not provided)' })
  @IsNumber()
  @IsOptional()
  total?: number;
}

// ---------------------------------------------------------------------------
// Invoice Template DTOs
// ---------------------------------------------------------------------------

export class CreateInvoiceTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Line items', type: [LineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems!: LineItemDto[];

  @ApiPropertyOptional({ description: 'Tax rate percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Tax label' })
  @IsString()
  @IsOptional()
  taxLabel?: string;

  @ApiPropertyOptional({ description: 'Template notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class UpdateInvoiceTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Line items', type: [LineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  @IsOptional()
  lineItems?: LineItemDto[];

  @ApiPropertyOptional({ description: 'Tax rate percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Tax label' })
  @IsString()
  @IsOptional()
  taxLabel?: string;

  @ApiPropertyOptional({ description: 'Template notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class InvoiceTemplateResponseDto {
  @ApiProperty({ description: 'Template ID' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Template name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Template description' })
  description?: string;

  @ApiProperty({ description: 'Line items', type: [LineItemDto] })
  lineItems!: LineItemDto[];

  @ApiProperty({ description: 'Tax rate percentage' })
  taxRate!: number;

  @ApiProperty({ description: 'Tax label' })
  taxLabel!: string;

  @ApiPropertyOptional({ description: 'Template notes' })
  notes?: string;

  @ApiProperty({ description: 'Currency code' })
  currency!: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

// ---------------------------------------------------------------------------
// Customer DTOs
// ---------------------------------------------------------------------------

export class CreateCustomerDto {
  @ApiProperty({ description: 'Customer name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Customer email' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Customer address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Customer username' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: 'Customer Stellar address' })
  @IsString()
  @IsOptional()
  stellarAddress?: string;

  @ApiPropertyOptional({ description: 'Customer notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Customer name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Customer email' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Customer address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Customer username' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: 'Customer Stellar address' })
  @IsString()
  @IsOptional()
  stellarAddress?: string;

  @ApiPropertyOptional({ description: 'Customer notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CustomerResponseDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Customer name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Customer email' })
  email?: string;

  @ApiPropertyOptional({ description: 'Customer address' })
  address?: string;

  @ApiPropertyOptional({ description: 'Customer username' })
  username?: string;

  @ApiPropertyOptional({ description: 'Customer Stellar address' })
  stellarAddress?: string;

  @ApiPropertyOptional({ description: 'Customer notes' })
  notes?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

// ---------------------------------------------------------------------------
// Invoice DTOs
// ---------------------------------------------------------------------------

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Template ID' })
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Customer ID' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ description: 'Invoice number' })
  @IsString()
  invoiceNumber!: string;

  @ApiPropertyOptional({ description: 'Invoice status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Line items', type: [LineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems!: LineItemDto[];

  @ApiPropertyOptional({ description: 'Subtotal' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  subtotal?: number;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  taxAmount?: number;

  @ApiPropertyOptional({ description: 'Total amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Invoice notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsString()
  @IsOptional()
  dueDate?: string;
}

export class InvoiceResponseDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Template ID' })
  templateId?: string;

  @ApiPropertyOptional({ description: 'Customer ID' })
  customerId?: string;

  @ApiProperty({ description: 'Invoice number' })
  invoiceNumber!: string;

  @ApiProperty({ description: 'Invoice status' })
  status!: string;

  @ApiProperty({ description: 'Line items', type: [LineItemDto] })
  lineItems!: LineItemDto[];

  @ApiProperty({ description: 'Subtotal' })
  subtotal!: number;

  @ApiProperty({ description: 'Tax amount' })
  taxAmount!: number;

  @ApiProperty({ description: 'Total amount' })
  totalAmount!: number;

  @ApiProperty({ description: 'Currency code' })
  currency!: string;

  @ApiPropertyOptional({ description: 'Invoice notes' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  dueDate?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class BulkGenerateInvoiceDto {
  @ApiProperty({ description: 'Template ID' })
  @IsUUID()
  templateId!: string;

  @ApiProperty({ description: 'Customer IDs to generate invoices for' })
  @IsArray()
  @IsUUID('all', { each: true })
  customerIds!: string[];

  @ApiPropertyOptional({ description: 'Due date for all invoices' })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkGenerateResponseDto {
  @ApiProperty({ description: 'Success flag' })
  success!: boolean;

  @ApiProperty({ description: 'Number of invoices generated' })
  count!: number;

  @ApiProperty({ description: 'Generated invoices', type: [InvoiceResponseDto] })
  invoices!: InvoiceResponseDto[];
}

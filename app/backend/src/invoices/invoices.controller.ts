import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceTemplateDto,
  UpdateInvoiceTemplateDto,
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateInvoiceDto,
  BulkGenerateInvoiceDto,
  InvoiceTemplateResponseDto,
  CustomerResponseDto,
  InvoiceResponseDto,
  BulkGenerateResponseDto,
} from './dto/invoice.dto';

// TODO: Add auth guard import
// import { AuthGuard } from '../auth/guards/auth.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email?: string;
  };
}

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // ---------------------------------------------------------------------------
  // Invoice Templates
  // ---------------------------------------------------------------------------

  @Post('templates')
  @ApiOperation({ summary: 'Create a new invoice template' })
  @ApiResponse({ status: 201, description: 'Template created', type: InvoiceTemplateResponseDto })
  async createTemplate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInvoiceTemplateDto,
  ): Promise<InvoiceTemplateResponseDto> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.createTemplate(userId, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all invoice templates for current user' })
  @ApiResponse({ status: 200, description: 'List of templates', type: [InvoiceTemplateResponseDto] })
  async getTemplates(@Req() req: AuthenticatedRequest): Promise<InvoiceTemplateResponseDto[]> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.getTemplatesByUserId(userId);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get invoice template by ID' })
  @ApiResponse({ status: 200, description: 'Template details', type: InvoiceTemplateResponseDto })
  async getTemplateById(@Param('id') id: string): Promise<InvoiceTemplateResponseDto> {
    return this.invoicesService.getTemplateById(id);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update invoice template' })
  @ApiResponse({ status: 200, description: 'Template updated', type: InvoiceTemplateResponseDto })
  async updateTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceTemplateDto,
  ): Promise<InvoiceTemplateResponseDto> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.updateTemplate(id, userId, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete invoice template' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  async deleteTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.sub || 'test-user-id';
    await this.invoicesService.deleteTemplate(id, userId);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------

  @Post('customers')
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created', type: CustomerResponseDto })
  async createCustomer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.createCustomer(userId, dto);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get all customers for current user' })
  @ApiResponse({ status: 200, description: 'List of customers', type: [CustomerResponseDto] })
  async getCustomers(@Req() req: AuthenticatedRequest): Promise<CustomerResponseDto[]> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.getCustomersByUserId(userId);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer details', type: CustomerResponseDto })
  async getCustomerById(@Param('id') id: string): Promise<CustomerResponseDto> {
    return this.invoicesService.getCustomerById(id);
  }

  @Put('customers/:id')
  @ApiOperation({ summary: 'Update customer' })
  @ApiResponse({ status: 200, description: 'Customer updated', type: CustomerResponseDto })
  async updateCustomer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.updateCustomer(id, userId, dto);
  }

  @Delete('customers/:id')
  @ApiOperation({ summary: 'Delete customer' })
  @ApiResponse({ status: 200, description: 'Customer deleted' })
  async deleteCustomer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.sub || 'test-user-id';
    await this.invoicesService.deleteCustomer(id, userId);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created', type: InvoiceResponseDto })
  async createInvoice(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.createInvoice(userId, dto);
  }

  @Post('bulk-generate')
  @ApiOperation({ summary: 'Bulk generate invoices from template for multiple customers' })
  @ApiResponse({ status: 201, description: 'Invoices generated', type: BulkGenerateResponseDto })
  async bulkGenerate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BulkGenerateInvoiceDto,
  ): Promise<BulkGenerateResponseDto> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.bulkGenerateInvoices(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all invoices for current user' })
  @ApiResponse({ status: 200, description: 'List of invoices', type: [InvoiceResponseDto] })
  async getInvoices(@Req() req: AuthenticatedRequest): Promise<InvoiceResponseDto[]> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.getInvoicesByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice details', type: InvoiceResponseDto })
  async getInvoiceById(@Param('id') id: string): Promise<InvoiceResponseDto> {
    return this.invoicesService.getInvoiceById(id);
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview invoice before generation' })
  @ApiResponse({ status: 200, description: 'Invoice preview', type: InvoiceResponseDto })
  async previewInvoice(
    @Req() req: AuthenticatedRequest,
    @Query('templateId') templateId: string,
    @Query('customerId') customerId: string,
    @Query('dueDate') dueDate?: string,
  ): Promise<InvoiceResponseDto> {
    const userId = req.user?.sub || 'test-user-id';
    return this.invoicesService.previewInvoice(templateId, customerId, userId, dueDate);
  }
}

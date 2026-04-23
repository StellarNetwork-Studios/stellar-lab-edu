import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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
  LineItemDto,
} from './dto/invoice.dto';
import { InvoicesRepository, DbInvoiceTemplate, DbCustomer, DbInvoice } from './invoices.repository';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly repository: InvoicesRepository) {}

  // ---------------------------------------------------------------------------
  // Invoice Templates
  // ---------------------------------------------------------------------------

  async createTemplate(
    userId: string,
    dto: CreateInvoiceTemplateDto,
  ): Promise<InvoiceTemplateResponseDto> {
    try {
      const template = await this.repository.createTemplate({
        userId,
        name: dto.name,
        description: dto.description,
        lineItems: dto.lineItems,
        taxRate: dto.taxRate ?? 0,
        taxLabel: dto.taxLabel || 'Tax',
        notes: dto.notes,
        currency: dto.currency || 'USDC',
      });

      this.logger.log(`Created invoice template: ${template.id}`);
      return this.mapTemplateToDto(template);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating template: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException(`Failed to create invoice template: ${errorMessage}`);
    }
  }

  async getTemplateById(id: string): Promise<InvoiceTemplateResponseDto> {
    const template = await this.repository.findTemplateById(id);

    if (!template) {
      throw new NotFoundException(`Invoice template not found: ${id}`);
    }

    return this.mapTemplateToDto(template);
  }

  async getTemplatesByUserId(userId: string): Promise<InvoiceTemplateResponseDto[]> {
    const templates = await this.repository.findTemplatesByUserId(userId);
    return templates.map((t) => this.mapTemplateToDto(t));
  }

  async updateTemplate(
    id: string,
    userId: string,
    dto: UpdateInvoiceTemplateDto,
  ): Promise<InvoiceTemplateResponseDto> {
    const existing = await this.repository.findTemplateById(id);

    if (!existing) {
      throw new NotFoundException(`Invoice template not found: ${id}`);
    }

    if (existing.user_id !== userId) {
      throw new BadRequestException('Unauthorized to update this template');
    }

    const updated = await this.repository.updateTemplate(id, {
      name: dto.name,
      description: dto.description,
      lineItems: dto.lineItems,
      taxRate: dto.taxRate,
      taxLabel: dto.taxLabel,
      notes: dto.notes,
      currency: dto.currency,
    });

    this.logger.log(`Updated invoice template: ${id}`);
    return this.mapTemplateToDto(updated);
  }

  async deleteTemplate(id: string, userId: string): Promise<void> {
    const existing = await this.repository.findTemplateById(id);

    if (!existing) {
      throw new NotFoundException(`Invoice template not found: ${id}`);
    }

    if (existing.user_id !== userId) {
      throw new BadRequestException('Unauthorized to delete this template');
    }

    await this.repository.deleteTemplate(id);
    this.logger.log(`Deleted invoice template: ${id}`);
  }

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------

  async createCustomer(
    userId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    try {
      const customer = await this.repository.createCustomer({
        userId,
        name: dto.name,
        email: dto.email,
        address: dto.address,
        username: dto.username,
        stellarAddress: dto.stellarAddress,
        notes: dto.notes,
      });

      this.logger.log(`Created customer: ${customer.id}`);
      return this.mapCustomerToDto(customer);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating customer: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException(`Failed to create customer: ${errorMessage}`);
    }
  }

  async getCustomerById(id: string): Promise<CustomerResponseDto> {
    const customer = await this.repository.findCustomerById(id);

    if (!customer) {
      throw new NotFoundException(`Customer not found: ${id}`);
    }

    return this.mapCustomerToDto(customer);
  }

  async getCustomersByUserId(userId: string): Promise<CustomerResponseDto[]> {
    const customers = await this.repository.findCustomersByUserId(userId);
    return customers.map((c) => this.mapCustomerToDto(c));
  }

  async updateCustomer(
    id: string,
    userId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const existing = await this.repository.findCustomerById(id);

    if (!existing) {
      throw new NotFoundException(`Customer not found: ${id}`);
    }

    if (existing.user_id !== userId) {
      throw new BadRequestException('Unauthorized to update this customer');
    }

    const updated = await this.repository.updateCustomer(id, {
      name: dto.name,
      email: dto.email,
      address: dto.address,
      username: dto.username,
      stellarAddress: dto.stellarAddress,
      notes: dto.notes,
    });

    this.logger.log(`Updated customer: ${id}`);
    return this.mapCustomerToDto(updated);
  }

  async deleteCustomer(id: string, userId: string): Promise<void> {
    const existing = await this.repository.findCustomerById(id);

    if (!existing) {
      throw new NotFoundException(`Customer not found: ${id}`);
    }

    if (existing.user_id !== userId) {
      throw new BadRequestException('Unauthorized to delete this customer');
    }

    await this.repository.deleteCustomer(id);
    this.logger.log(`Deleted customer: ${id}`);
  }

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  async createInvoice(
    userId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const lineItems = dto.lineItems;
    const subtotal = this.calculateSubtotal(lineItems);
    const taxAmount = dto.taxAmount ?? 0;
    const totalAmount = dto.totalAmount ?? (subtotal + taxAmount);

    try {
      const invoice = await this.repository.createInvoice({
        userId,
        templateId: dto.templateId,
        customerId: dto.customerId,
        invoiceNumber: dto.invoiceNumber,
        lineItems,
        subtotal,
        taxAmount,
        totalAmount,
        currency: dto.currency || 'USDC',
        notes: dto.notes,
        dueDate: dto.dueDate,
      });

      this.logger.log(`Created invoice: ${invoice.id}`);
      return this.mapInvoiceToDto(invoice);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating invoice: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException(`Failed to create invoice: ${errorMessage}`);
    }
  }

  async bulkGenerateInvoices(
    userId: string,
    dto: BulkGenerateInvoiceDto,
  ): Promise<BulkGenerateResponseDto> {
    const template = await this.repository.findTemplateById(dto.templateId);

    if (!template) {
      throw new NotFoundException(`Invoice template not found: ${dto.templateId}`);
    }

    if (template.user_id !== userId) {
      throw new BadRequestException('Unauthorized to use this template');
    }

    const invoices: InvoiceResponseDto[] = [];

    for (const customerId of dto.customerIds) {
      const customer = await this.repository.findCustomerById(customerId);

      if (!customer) {
        this.logger.warn(`Customer not found: ${customerId}, skipping`);
        continue;
      }

      if (customer.user_id !== userId) {
        this.logger.warn(`Unauthorized customer: ${customerId}, skipping`);
        continue;
      }

      const invoiceNumber = this.generateInvoiceNumber();
      const lineItems = template.line_items;
      const subtotal = this.calculateSubtotal(lineItems);
      const taxRate = template.tax_rate / 100;
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

      const invoice = await this.repository.createInvoice({
        userId,
        templateId: dto.templateId,
        customerId,
        invoiceNumber,
        lineItems,
        subtotal,
        taxAmount,
        totalAmount,
        currency: template.currency,
        notes: dto.notes || template.notes,
        dueDate: dto.dueDate,
      });

      invoices.push(this.mapInvoiceToDto(invoice));
    }

    this.logger.log(`Bulk generated ${invoices.length} invoices from template ${dto.templateId}`);

    return {
      success: true,
      count: invoices.length,
      invoices,
    };
  }

  async getInvoiceById(id: string): Promise<InvoiceResponseDto> {
    const invoice = await this.repository.findInvoiceById(id);

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${id}`);
    }

    return this.mapInvoiceToDto(invoice);
  }

  async getInvoicesByUserId(userId: string): Promise<InvoiceResponseDto[]> {
    const invoices = await this.repository.findInvoicesByUserId(userId);
    return invoices.map((i) => this.mapInvoiceToDto(i));
  }

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------

  async previewInvoice(
    templateId: string,
    customerId: string,
    userId: string,
    dueDate?: string,
  ): Promise<InvoiceResponseDto> {
    const template = await this.repository.findTemplateById(templateId);

    if (!template) {
      throw new NotFoundException(`Invoice template not found: ${templateId}`);
    }

    if (template.user_id !== userId) {
      throw new BadRequestException('Unauthorized to use this template');
    }

    const customer = await this.repository.findCustomerById(customerId);

    if (!customer) {
      throw new NotFoundException(`Customer not found: ${customerId}`);
    }

    if (customer.user_id !== userId) {
      throw new BadRequestException('Unauthorized to access this customer');
    }

    const lineItems = template.line_items;
    const subtotal = this.calculateSubtotal(lineItems);
    const taxRate = template.tax_rate / 100;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    return {
      id: 'preview',
      userId,
      templateId,
      customerId,
      invoiceNumber: 'PREVIEW',
      status: 'draft',
      lineItems,
      subtotal,
      taxAmount,
      totalAmount,
      currency: template.currency,
      notes: template.notes || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helper Methods
  // ---------------------------------------------------------------------------

  private calculateSubtotal(lineItems: LineItemDto[]): number {
    return lineItems.reduce((sum, item) => {
      const total = item.total ?? (item.quantity * item.unitPrice);
      return sum + total;
    }, 0);
  }

  private generateInvoiceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${timestamp}-${random}`;
  }

  private mapTemplateToDto(template: DbInvoiceTemplate): InvoiceTemplateResponseDto {
    return {
      id: template.id,
      userId: template.user_id,
      name: template.name,
      description: template.description || undefined,
      lineItems: template.line_items,
      taxRate: template.tax_rate,
      taxLabel: template.tax_label,
      notes: template.notes || undefined,
      currency: template.currency,
      createdAt: new Date(template.created_at),
      updatedAt: new Date(template.updated_at),
    };
  }

  private mapCustomerToDto(customer: DbCustomer): CustomerResponseDto {
    return {
      id: customer.id,
      userId: customer.user_id,
      name: customer.name,
      email: customer.email || undefined,
      address: customer.address || undefined,
      username: customer.username || undefined,
      stellarAddress: customer.stellar_address || undefined,
      notes: customer.notes || undefined,
      createdAt: new Date(customer.created_at),
      updatedAt: new Date(customer.updated_at),
    };
  }

  private mapInvoiceToDto(invoice: DbInvoice): InvoiceResponseDto {
    return {
      id: invoice.id,
      userId: invoice.user_id,
      templateId: invoice.template_id || undefined,
      customerId: invoice.customer_id || undefined,
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      lineItems: invoice.line_items,
      subtotal: invoice.subtotal,
      taxAmount: invoice.tax_amount,
      totalAmount: invoice.total_amount,
      currency: invoice.currency,
      notes: invoice.notes || undefined,
      dueDate: invoice.due_date ? new Date(invoice.due_date) : undefined,
      createdAt: new Date(invoice.created_at),
      updatedAt: new Date(invoice.updated_at),
    };
  }
}

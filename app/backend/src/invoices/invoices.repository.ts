import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

export interface DbInvoiceTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  line_items: any[];
  tax_rate: number;
  tax_label: string;
  notes: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface DbCustomer {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  address: string | null;
  username: string | null;
  stellar_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbInvoice {
  id: string;
  user_id: string;
  template_id: string | null;
  customer_id: string | null;
  invoice_number: string;
  status: string;
  line_items: any[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class InvoicesRepository {
  private readonly client: SupabaseClient;

  constructor(private readonly supabase: SupabaseService) {
    this.client = supabase.getClient();
  }

  // ---------------------------------------------------------------------------
  // Invoice Templates
  // ---------------------------------------------------------------------------

  async createTemplate(data: {
    userId: string;
    name: string;
    description?: string;
    lineItems: any[];
    taxRate?: number;
    taxLabel?: string;
    notes?: string;
    currency?: string;
  }): Promise<DbInvoiceTemplate> {
    const { data: template, error } = await this.client
      .from('invoice_templates')
      .insert({
        user_id: data.userId,
        name: data.name,
        description: data.description || null,
        line_items: data.lineItems,
        tax_rate: data.taxRate ?? 0,
        tax_label: data.taxLabel || 'Tax',
        notes: data.notes || null,
        currency: data.currency || 'USDC',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return template;
  }

  async findTemplateById(id: string): Promise<DbInvoiceTemplate | null> {
    const { data, error } = await this.client
      .from('invoice_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async findTemplatesByUserId(userId: string): Promise<DbInvoiceTemplate[]> {
    const { data, error } = await this.client
      .from('invoice_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      lineItems?: any[];
      taxRate?: number;
      taxLabel?: string;
      notes?: string;
      currency?: string;
    },
  ): Promise<DbInvoiceTemplate> {
    const { data: template, error } = await this.client
      .from('invoice_templates')
      .update({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.lineItems !== undefined && { line_items: data.lineItems }),
        ...(data.taxRate !== undefined && { tax_rate: data.taxRate }),
        ...(data.taxLabel !== undefined && { tax_label: data.taxLabel }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.currency !== undefined && { currency: data.currency }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await this.client
      .from('invoice_templates')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------

  async createCustomer(data: {
    userId: string;
    name: string;
    email?: string;
    address?: string;
    username?: string;
    stellarAddress?: string;
    notes?: string;
  }): Promise<DbCustomer> {
    const { data: customer, error } = await this.client
      .from('customers')
      .insert({
        user_id: data.userId,
        name: data.name,
        email: data.email || null,
        address: data.address || null,
        username: data.username || null,
        stellar_address: data.stellarAddress || null,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return customer;
  }

  async findCustomerById(id: string): Promise<DbCustomer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async findCustomersByUserId(userId: string): Promise<DbCustomer[]> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async updateCustomer(
    id: string,
    data: {
      name?: string;
      email?: string;
      address?: string;
      username?: string;
      stellarAddress?: string;
      notes?: string;
    },
  ): Promise<DbCustomer> {
    const { data: customer, error } = await this.client
      .from('customers')
      .update({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.stellarAddress !== undefined && { stellar_address: data.stellarAddress }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await this.client
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  async createInvoice(data: {
    userId: string;
    templateId?: string;
    customerId?: string;
    invoiceNumber: string;
    lineItems: any[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency?: string;
    notes?: string;
    dueDate?: string;
  }): Promise<DbInvoice> {
    const { data: invoice, error } = await this.client
      .from('invoices')
      .insert({
        user_id: data.userId,
        template_id: data.templateId || null,
        customer_id: data.customerId || null,
        invoice_number: data.invoiceNumber,
        line_items: data.lineItems,
        subtotal: data.subtotal,
        tax_amount: data.taxAmount,
        total_amount: data.totalAmount,
        currency: data.currency || 'USDC',
        notes: data.notes || null,
        due_date: data.dueDate || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return invoice;
  }

  async findInvoiceById(id: string): Promise<DbInvoice | null> {
    const { data, error } = await this.client
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async findInvoicesByUserId(userId: string): Promise<DbInvoice[]> {
    const { data, error } = await this.client
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async findInvoicesByCustomerId(customerId: string): Promise<DbInvoice[]> {
    const { data, error } = await this.client
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }
}

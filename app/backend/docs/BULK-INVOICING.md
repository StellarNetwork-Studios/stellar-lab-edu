# Bulk Invoicing with Templates & Customer Profiles

## Overview

This feature upgrades the invoicing system with reusable templates and saved customer profiles, enabling efficient bulk invoice generation.

## Features

### 1. Invoice Templates CRUD
- **Create** reusable templates with line items, tax settings, and notes
- **Read** all templates for the current user
- **Update** existing templates
- **Delete** templates no longer needed

**Template Structure:**
- Name and description
- Line items (name, quantity, unit price)
- Tax rate (%) and tax label
- Default notes
- Currency (USDC, XLM, USD)

### 2. Customer Directory
- **Add** customers with contact information
- **Search** customers by name, email, or username
- **Update** customer details
- **Delete** customers

**Customer Profile:**
- Name (required)
- Email
- Physical address
- Username (@handle)
- Stellar wallet address
- Notes

### 3. Bulk Invoice Generator
- Select a template
- Choose multiple customers
- Set optional due date
- Preview invoice before generation
- Generate invoices for all selected customers in one click

### 4. Invoice Preview
- Preview how an invoice will look before generation
- Shows line items, subtotal, tax, and total
- Uses real template and customer data
- Helps verify accuracy before bulk generation

## File Structure

### Backend
```
app/backend/
├── supabase/migrations/
│   └── 20260423000000_create_invoice_templates_and_customers.sql
├── src/invoices/
│   ├── dto/
│   │   └── invoice.dto.ts              # DTOs for templates, customers, invoices
│   ├── invoices.repository.ts          # Database operations
│   ├── invoices.service.ts             # Business logic
│   ├── invoices.controller.ts          # API endpoints
│   └── invoices.module.ts              # Module registration
└── src/app.module.ts                   # Updated with InvoicesModule
```

### Frontend
```
app/frontend/src/app/
└── invoices/
    ├── page.tsx                        # Invoice management dashboard
    ├── templates/
    │   └── page.tsx                    # Template CRUD UI
    ├── customers/
    │   └── page.tsx                    # Customer directory UI
    └── bulk/
        └── page.tsx                    # Bulk generator with preview
```

## API Endpoints

### Invoice Templates
- `POST /invoices/templates` - Create template
- `GET /invoices/templates` - List all templates
- `GET /invoices/templates/:id` - Get template by ID
- `PUT /invoices/templates/:id` - Update template
- `DELETE /invoices/templates/:id` - Delete template

### Customers
- `POST /invoices/customers` - Create customer
- `GET /invoices/customers` - List all customers
- `GET /invoices/customers/:id` - Get customer by ID
- `PUT /invoices/customers/:id` - Update customer
- `DELETE /invoices/customers/:id` - Delete customer

### Invoices
- `POST /invoices` - Create single invoice
- `POST /invoices/bulk-generate` - Bulk generate invoices
- `GET /invoices` - List all invoices
- `GET /invoices/:id` - Get invoice by ID
- `GET /invoices/preview?templateId=&customerId=&dueDate=` - Preview invoice

## Database Schema

### invoice_templates
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `name` (VARCHAR)
- `description` (TEXT)
- `line_items` (JSONB)
- `tax_rate` (DECIMAL)
- `tax_label` (VARCHAR)
- `notes` (TEXT)
- `currency` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMP)

### customers
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `name` (VARCHAR)
- `email` (VARCHAR)
- `address` (TEXT)
- `username` (VARCHAR)
- `stellar_address` (VARCHAR)
- `notes` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

### invoices
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `template_id` (UUID, references invoice_templates)
- `customer_id` (UUID, references customers)
- `invoice_number` (VARCHAR)
- `status` (VARCHAR)
- `line_items` (JSONB)
- `subtotal`, `tax_amount`, `total_amount` (DECIMAL)
- `currency` (VARCHAR)
- `notes` (TEXT)
- `due_date` (TIMESTAMP)
- `created_at`, `updated_at` (TIMESTAMP)

**Security:** All tables have Row Level Security (RLS) enabled with policies ensuring users can only access their own data.

## Usage Flow

### Creating Your First Bulk Invoice

1. **Create a Template**
   - Navigate to `/invoices/templates`
   - Click "New Template"
   - Add line items (e.g., "Consulting Hours", "Setup Fee")
   - Set tax rate and currency
   - Save template

2. **Add Customers**
   - Navigate to `/invoices/customers`
   - Click "New Customer"
   - Fill in customer details
   - Save customer
   - Repeat for all customers

3. **Preview Invoice**
   - Navigate to `/invoices/bulk`
   - Select your template
   - Select a customer for preview
   - Click "Preview Invoice"
   - Review the invoice details

4. **Generate Bulk Invoices**
   - In `/invoices/bulk`, select multiple customers
   - Set optional due date
   - Click "Generate X Invoices"
   - View generated invoices list

## Acceptance Criteria Met

✅ Users can create a template once and reuse it in bulk generation  
✅ Preview matches generated output  
✅ Customer directory with name, email, address/username  
✅ Bulk generator with template + customer mapping  
✅ Preview of final invoices before generation  

## Testing

### Manual Testing Steps

1. **Template CRUD**
   - Create a template with multiple line items
   - Verify it appears in the list
   - Edit the template and save
   - Delete the template and verify removal

2. **Customer CRUD**
   - Add a customer with all fields
   - Search for the customer
   - Edit customer details
   - Delete customer

3. **Bulk Generation**
   - Create template and 3 customers
   - Select template and all 3 customers
   - Preview invoice for one customer
   - Generate invoices
   - Verify 3 invoices created

4. **Preview Accuracy**
   - Preview invoice with template
   - Generate invoice for same template
   - Compare preview vs generated (should match)

## Future Enhancements

- PDF invoice generation
- Email invoices to customers
- Invoice status tracking (draft, sent, paid, overdue)
- Payment integration with Stellar
- Invoice analytics and reporting
- Template categories/tags
- Bulk customer import (CSV)

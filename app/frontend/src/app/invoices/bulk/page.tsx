"use client";

import { useState, useEffect } from "react";
import { getQuickexApiBase } from "@/lib/api";

type InvoiceTemplate = {
  id: string;
  name: string;
  description?: string;
  lineItems: Array<{ name: string; quantity: number; unitPrice: number }>;
  taxRate: number;
  taxLabel: string;
  notes?: string;
  currency: string;
};

type Customer = {
  id: string;
  name: string;
  email?: string;
  username?: string;
};

type InvoicePreview = {
  id: string;
  templateId: string;
  customerId: string;
  invoiceNumber: string;
  lineItems: Array<{ name: string; quantity: number; unitPrice: number; total?: number }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string;
  dueDate?: string;
};

export default function BulkInvoiceGeneratorPage() {
  const apiBase = getQuickexApiBase();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [previewCustomer, setPreviewCustomer] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatedInvoices, setGeneratedInvoices] = useState<InvoicePreview[]>([]);

  useEffect(() => {
    fetchTemplates();
    fetchCustomers();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${apiBase}/invoices/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${apiBase}/invoices/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const toggleCustomer = (customerId: string) => {
    const newSelection = new Set(selectedCustomers);
    if (newSelection.has(customerId)) {
      newSelection.delete(customerId);
    } else {
      newSelection.add(customerId);
    }
    setSelectedCustomers(newSelection);
  };

  const selectAllCustomers = () => {
    setSelectedCustomers(new Set(customers.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedCustomers(new Set());
  };

  const handlePreview = async () => {
    if (!selectedTemplate || !previewCustomer) {
      alert("Please select a template and customer for preview");
      return;
    }

    try {
      const params = new URLSearchParams({
        templateId: selectedTemplate,
        customerId: previewCustomer,
      });
      if (dueDate) {
        params.append("dueDate", dueDate);
      }

      const res = await fetch(`${apiBase}/invoices/preview?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch (error) {
      console.error("Failed to preview invoice:", error);
    }
  };

  const handleBulkGenerate = async () => {
    if (!selectedTemplate || selectedCustomers.size === 0) {
      alert("Please select a template and at least one customer");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`${apiBase}/invoices/bulk-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          customerIds: Array.from(selectedCustomers),
          dueDate: dueDate || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedInvoices(data.invoices);
        alert(`Successfully generated ${data.count} invoices!`);
      }
    } catch (error) {
      console.error("Failed to generate invoices:", error);
      alert("Failed to generate invoices");
    } finally {
      setGenerating(false);
    }
  };

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="relative min-h-screen text-white">
      <main className="relative z-10 px-4 sm:px-6 md:px-12 pt-10">
        <header className="mb-10 max-w-5xl">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Bulk Invoice Generator
          </h1>
          <p className="text-neutral-500 text-lg max-w-xl">
            Generate multiple invoices from a template for selected customers
          </p>
        </header>

        <div className="max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Template & Customer Selection */}
          <div className="space-y-8">
            {/* Template Selection */}
            <div className="bg-neutral-900/50 border border-white/10 rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-4">1. Select Template</h2>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value="">Choose a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {selectedTemplateData && (
                <div className="mt-4 p-4 bg-black/30 rounded-2xl">
                  <p className="text-sm text-neutral-400 mb-2">
                    {selectedTemplateData.description || "No description"}
                  </p>
                  <div className="space-y-1 text-sm">
                    <p className="text-neutral-500">
                      {selectedTemplateData.lineItems.length} line items
                    </p>
                    <p className="text-neutral-500">
                      Tax: {selectedTemplateData.taxRate}% ({selectedTemplateData.taxLabel})
                    </p>
                    <p className="text-neutral-500">
                      Currency: {selectedTemplateData.currency}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Customer Selection */}
            <div className="bg-neutral-900/50 border border-white/10 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">2. Select Customers</h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllCustomers}
                    className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-bold transition"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-bold transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customers.map((customer) => {
                  const isSelected = selectedCustomers.has(customer.id);
                  return (
                    <button
                      key={customer.id}
                      onClick={() => toggleCustomer(customer.id)}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        isSelected
                          ? "bg-indigo-500/20 border-indigo-500/50"
                          : "bg-neutral-900/30 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "bg-indigo-500 border-indigo-500"
                              : "border-white/30"
                          }`}
                        >
                          {isSelected && <span className="text-xs">✓</span>}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{customer.name}</p>
                          {customer.email && (
                            <p className="text-xs text-neutral-500">{customer.email}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-sm text-neutral-500">
                {selectedCustomers.size} customer(s) selected
              </p>
            </div>

            {/* Due Date */}
            <div className="bg-neutral-900/50 border border-white/10 rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-4">3. Due Date (Optional)</h2>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Right Column - Preview & Generate */}
          <div className="space-y-8">
            {/* Preview Section */}
            <div className="bg-neutral-900/50 border border-white/10 rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-4">Preview Invoice</h2>
              <div className="space-y-4 mb-4">
                <select
                  value={previewCustomer}
                  onChange={(e) => setPreviewCustomer(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select customer for preview...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handlePreview}
                  disabled={!selectedTemplate || !previewCustomer}
                  className="w-full py-3 bg-white/10 hover:bg-white/15 rounded-xl font-bold transition disabled:opacity-50"
                >
                  Preview Invoice
                </button>
              </div>

              {preview && (
                <div className="bg-black/30 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-black">INVOICE PREVIEW</h3>
                      <p className="text-sm text-neutral-500">
                        {preview.invoiceNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neutral-500">Customer ID</p>
                      <p className="font-mono text-xs">{preview.customerId.slice(0, 8)}...</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-3">
                      Line Items
                    </h4>
                    <div className="space-y-2">
                      {preview.lineItems.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>
                            {item.name} (x{item.quantity})
                          </span>
                          <span className="font-mono">
                            {(item.quantity * item.unitPrice).toFixed(2)} {preview.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Subtotal</span>
                      <span className="font-mono">{preview.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Tax</span>
                      <span className="font-mono">{preview.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black border-t border-white/10 pt-2">
                      <span>Total</span>
                      <span className="text-indigo-400">
                        {preview.totalAmount.toFixed(2)} {preview.currency}
                      </span>
                    </div>
                  </div>

                  {preview.notes && (
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-xs text-neutral-500 mb-1">Notes:</p>
                      <p className="text-sm text-neutral-400">{preview.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleBulkGenerate}
              disabled={generating || !selectedTemplate || selectedCustomers.size === 0}
              className="w-full py-6 bg-indigo-500 hover:bg-indigo-600 text-2xl font-black rounded-3xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating
                ? "Generating..."
                : `Generate ${selectedCustomers.size} Invoice${selectedCustomers.size !== 1 ? "s" : ""}`}
            </button>

            {/* Generated Invoices */}
            {generatedInvoices.length > 0 && (
              <div className="bg-neutral-900/50 border border-white/10 rounded-3xl p-6">
                <h2 className="text-2xl font-bold mb-4">
                  Generated Invoices ({generatedInvoices.length})
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {generatedInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="bg-black/30 rounded-xl p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-mono text-xs">{invoice.id}</p>
                        <p className="text-sm font-bold text-indigo-400">
                          {invoice.totalAmount.toFixed(2)} {invoice.currency}
                        </p>
                      </div>
                      <p className="text-xs text-neutral-500">
                        Customer: {invoice.customerId.slice(0, 8)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

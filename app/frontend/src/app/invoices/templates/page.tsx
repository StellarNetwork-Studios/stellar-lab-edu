"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { getQuickexApiBase } from "@/lib/api";

type LineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total?: number;
};

type InvoiceTemplate = {
  id: string;
  name: string;
  description?: string;
  lineItems: LineItem[];
  taxRate: number;
  taxLabel: string;
  notes?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export default function InvoiceTemplatesPage() {
  const apiBase = getQuickexApiBase();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);

  const { loading, callApi } = useApi();

  useEffect(() => {
    fetchTemplates();
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const res = await fetch(`${apiBase}/invoices/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  return (
    <div className="relative min-h-screen text-white">
      <main className="relative z-10 px-4 sm:px-6 md:px-12 pt-10">
        <header className="mb-10 max-w-5xl">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Invoice Templates
          </h1>
          <p className="text-neutral-500 text-lg max-w-xl">
            Create and manage reusable invoice templates for bulk invoicing
          </p>
        </header>

        <div className="max-w-7xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Your Templates</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition"
            >
              + New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-20 bg-neutral-900/30 border border-white/10 rounded-3xl">
              <p className="text-neutral-500 text-lg">
                No templates yet. Create your first template to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-neutral-900/50 border border-white/10 rounded-2xl p-6 hover:border-indigo-500/50 transition"
                >
                  <h3 className="text-xl font-bold mb-2">{template.name}</h3>
                  {template.description && (
                    <p className="text-neutral-400 text-sm mb-4">
                      {template.description}
                    </p>
                  )}
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-neutral-500">
                      {template.lineItems.length} line items
                    </p>
                    <p className="text-sm text-neutral-500">
                      Tax: {template.taxRate}% ({template.taxLabel})
                    </p>
                    <p className="text-sm text-neutral-500">
                      Currency: {template.currency}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingTemplate(template)}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-bold transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <TemplateFormModal
          apiBase={apiBase}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTemplates();
          }}
        />
      )}

      {editingTemplate && (
        <TemplateFormModal
          apiBase={apiBase}
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSuccess={() => {
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

type TemplateFormModalProps = {
  apiBase: string;
  template?: InvoiceTemplate;
  onClose: () => void;
  onSuccess: () => void;
};

function TemplateFormModal({ apiBase, template, onClose, onSuccess }: TemplateFormModalProps) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [lineItems, setLineItems] = useState<LineItem[]>(
    template?.lineItems || [{ name: "", quantity: 1, unitPrice: 0 }]
  );
  const [taxRate, setTaxRate] = useState(template?.taxRate || 0);
  const [taxLabel, setTaxLabel] = useState(template?.taxLabel || "Tax");
  const [notes, setNotes] = useState(template?.notes || "");
  const [currency, setCurrency] = useState(template?.currency || "USDC");
  const [saving, setSaving] = useState(false);

  const addLineItem = () => {
    setLineItems([...lineItems, { name: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = template
        ? `${apiBase}/invoices/templates/${template.id}`
        : `${apiBase}/invoices/templates`;
      const method = template ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          lineItems,
          taxRate,
          taxLabel,
          notes,
          currency,
        }),
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-3xl font-black mb-6">
          {template ? "Edit Template" : "Create Template"}
        </h2>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="e.g., Monthly Consulting"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="Template description..."
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Line Items
            </label>
            <div className="space-y-3 mt-2">
              {lineItems.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateLineItem(index, "name", e.target.value)}
                    className="flex-1 bg-neutral-900/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Item name"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, "quantity", Number(e.target.value))}
                    className="w-24 bg-neutral-900/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Qty"
                    min="1"
                  />
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(index, "unitPrice", Number(e.target.value))}
                    className="w-32 bg-neutral-900/50 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Price"
                    min="0"
                    step="0.01"
                  />
                  <button
                    onClick={() => removeLineItem(index)}
                    className="px-3 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addLineItem}
              className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold transition"
            >
              + Add Line Item
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
                Tax Label
              </label>
              <input
                type="text"
                value={taxLabel}
                onChange={(e) => setTaxLabel(e.target.value)}
                className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
                placeholder="Tax"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="USDC">USDC</option>
                <option value="XLM">XLM</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="Default notes for invoices..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white/10 hover:bg-white/15 rounded-2xl font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name}
            className="flex-1 py-4 bg-indigo-500 hover:bg-indigo-600 rounded-2xl font-bold transition disabled:opacity-50"
          >
            {saving ? "Saving..." : template ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

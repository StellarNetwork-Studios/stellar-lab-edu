"use client";

import { useState, useEffect } from "react";
import { getQuickexApiBase } from "@/lib/api";

type Customer = {
  id: string;
  name: string;
  email?: string;
  address?: string;
  username?: string;
  stellarAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export default function CustomersPage() {
  const apiBase = getQuickexApiBase();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      const res = await fetch(`${apiBase}/invoices/customers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCustomers();
      }
    } catch (error) {
      console.error("Failed to delete customer:", error);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.username?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="relative min-h-screen text-white">
      <main className="relative z-10 px-4 sm:px-6 md:px-12 pt-10">
        <header className="mb-10 max-w-5xl">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Customer Directory
          </h1>
          <p className="text-neutral-500 text-lg max-w-xl">
            Manage your customer profiles for quick invoice generation
          </p>
        </header>

        <div className="max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold">
              Your Customers ({filteredCustomers.length})
            </h2>
            <div className="flex gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 sm:w-64 bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition whitespace-nowrap"
              >
                + New Customer
              </button>
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="text-center py-20 bg-neutral-900/30 border border-white/10 rounded-3xl">
              <p className="text-neutral-500 text-lg">
                {searchQuery
                  ? "No customers match your search"
                  : "No customers yet. Add your first customer to get started."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-neutral-900/50 border border-white/10 rounded-2xl p-6 hover:border-indigo-500/50 transition"
                >
                  <h3 className="text-xl font-bold mb-2">{customer.name}</h3>
                  <div className="space-y-2 mb-4">
                    {customer.email && (
                      <p className="text-sm text-neutral-400">📧 {customer.email}</p>
                    )}
                    {customer.username && (
                      <p className="text-sm text-neutral-400">👤 @{customer.username}</p>
                    )}
                    {customer.stellarAddress && (
                      <p className="text-sm text-neutral-400 font-mono text-xs">
                        ⭐ {customer.stellarAddress.slice(0, 8)}...{customer.stellarAddress.slice(-6)}
                      </p>
                    )}
                    {customer.address && (
                      <p className="text-sm text-neutral-400">📍 {customer.address}</p>
                    )}
                  </div>
                  {customer.notes && (
                    <p className="text-xs text-neutral-500 mb-4 line-clamp-2">
                      {customer.notes}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCustomer(customer)}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id)}
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
        <CustomerFormModal
          apiBase={apiBase}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchCustomers();
          }}
        />
      )}

      {editingCustomer && (
        <CustomerFormModal
          apiBase={apiBase}
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={() => {
            setEditingCustomer(null);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}

type CustomerFormModalProps = {
  apiBase: string;
  customer?: Customer;
  onClose: () => void;
  onSuccess: () => void;
};

function CustomerFormModal({ apiBase, customer, onClose, onSuccess }: CustomerFormModalProps) {
  const [name, setName] = useState(customer?.name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [username, setUsername] = useState(customer?.username || "");
  const [stellarAddress, setStellarAddress] = useState(customer?.stellarAddress || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Customer name is required");
      return;
    }

    setSaving(true);
    try {
      const url = customer
        ? `${apiBase}/invoices/customers/${customer.id}`
        : `${apiBase}/invoices/customers`;
      const method = customer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          address: address || undefined,
          username: username || undefined,
          stellarAddress: stellarAddress || undefined,
          notes: notes || undefined,
        }),
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to save customer:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-3xl font-black mb-6">
          {customer ? "Edit Customer" : "Add Customer"}
        </h2>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="Customer or company name"
              required
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="@username"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Stellar Address
            </label>
            <input
              type="text"
              value={stellarAddress}
              onChange={(e) => setStellarAddress(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-mono text-sm mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="G..."
              maxLength={56}
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="Physical address..."
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 ml-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-4 font-bold mt-2 focus:outline-none focus:border-indigo-500"
              placeholder="Additional notes..."
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
            {saving ? "Saving..." : customer ? "Update" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

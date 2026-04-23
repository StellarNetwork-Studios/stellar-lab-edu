import Link from "next/link";

export default function InvoicesHomePage() {
  return (
    <div className="relative min-h-screen text-white">
      <main className="relative z-10 px-4 sm:px-6 md:px-12 pt-10">
        <header className="mb-16 max-w-5xl">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-6">
            Invoice Management
          </h1>
          <p className="text-neutral-500 text-xl max-w-2xl">
            Create reusable templates, manage customers, and generate bulk invoices with ease
          </p>
        </header>

        <div className="max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Templates Card */}
          <Link
            href="/invoices/templates"
            className="group bg-neutral-900/50 border border-white/10 rounded-3xl p-8 hover:border-indigo-500/50 transition-all hover:scale-105"
          >
            <div className="text-5xl mb-6">📄</div>
            <h2 className="text-2xl font-black mb-3 group-hover:text-indigo-400 transition">
              Templates
            </h2>
            <p className="text-neutral-500 mb-6">
              Create and manage reusable invoice templates with line items, tax settings, and notes
            </p>
            <div className="text-indigo-400 font-bold group-hover:translate-x-2 transition-transform">
              Manage Templates →
            </div>
          </Link>

          {/* Customers Card */}
          <Link
            href="/invoices/customers"
            className="group bg-neutral-900/50 border border-white/10 rounded-3xl p-8 hover:border-purple-500/50 transition-all hover:scale-105"
          >
            <div className="text-5xl mb-6">👥</div>
            <h2 className="text-2xl font-black mb-3 group-hover:text-purple-400 transition">
              Customers
            </h2>
            <p className="text-neutral-500 mb-6">
              Build your customer directory with contact info, addresses, and Stellar wallets
            </p>
            <div className="text-purple-400 font-bold group-hover:translate-x-2 transition-transform">
              View Customers →
            </div>
          </Link>

          {/* Bulk Generator Card */}
          <Link
            href="/invoices/bulk"
            className="group bg-neutral-900/50 border border-white/10 rounded-3xl p-8 hover:border-emerald-500/50 transition-all hover:scale-105"
          >
            <div className="text-5xl mb-6">⚡</div>
            <h2 className="text-2xl font-black mb-3 group-hover:text-emerald-400 transition">
              Bulk Generator
            </h2>
            <p className="text-neutral-500 mb-6">
              Generate multiple invoices at once using templates and customer selections
            </p>
            <div className="text-emerald-400 font-bold group-hover:translate-x-2 transition-transform">
              Generate Invoices →
            </div>
          </Link>
        </div>

        {/* Features Section */}
        <div className="mt-20 max-w-5xl">
          <h2 className="text-3xl font-black mb-8">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-2 text-indigo-400">
                ✓ Reusable Templates
              </h3>
              <p className="text-neutral-500">
                Create a template once with line items, tax rates, and notes. Reuse it for unlimited invoices.
              </p>
            </div>
            <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-2 text-purple-400">
                ✓ Customer Directory
              </h3>
              <p className="text-neutral-500">
                Save customer profiles with email, address, username, and Stellar wallet for quick access.
              </p>
            </div>
            <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-2 text-emerald-400">
                ✓ Invoice Preview
              </h3>
              <p className="text-neutral-500">
                Preview invoices before generation to ensure accuracy. See line items, tax, and totals.
              </p>
            </div>
            <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-2 text-amber-400">
                ✓ Bulk Generation
              </h3>
              <p className="text-neutral-500">
                Select multiple customers and generate invoices for all of them in one click.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-50 to-white" />

      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left content */}
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border px-4 py-1 text-sm font-medium text-gray-600">
              🚧 Built for Construction Supply Chains
            </span>

            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Milestone-Based Escrow
              <br />
              <span className="text-gray-500">
                for Trustless Procurement
              </span>
            </h1>

            <p className="max-w-xl text-lg text-gray-600">
              SupplyGuarantee enables buyers, sellers, banks, and inspectors
              to collaborate through secure, role-based smart contracts —
              releasing payments only when milestones are approved.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="/app"
                className="rounded-2xl bg-black px-6 py-3 text-base font-medium text-white hover:opacity-90 transition"
              >
                Launch App
              </a>
              <a
                href="#how-it-works"
                className="rounded-2xl border px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Learn how it works
              </a>
            </div>
          </div>

          {/* Right visual */}
          <div className="relative">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Order #1024
                  </span>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    In Milestones
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="h-2 w-full rounded bg-gray-100">
                    <div className="h-2 w-2/3 rounded bg-black" />
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Advance Paid</span>
                    <span>2 / 3 Milestones</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-gray-500">Total Value</div>
                    <div className="font-semibold">$1,000,000</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-gray-500">Escrowed</div>
                    <div className="font-semibold">$300,000</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HowItWorks() {
  const steps = [
    {
      k: "01",
      title: "Create an Order",
      desc: "Define buyer, seller, bank, and optional carrier/inspector. Set price, advance %, and milestone splits.",
      chips: ["Buyer", "Seller", "Bank", "Configurator"],
    },
    {
      k: "02",
      title: "Lock Milestones",
      desc: "Freeze milestone amounts so the escrow schedule can’t be changed after funding.",
      chips: ["Buyer", "Seller", "Owner"],
    },
    {
      k: "03",
      title: "Fund Escrow (ERC-20)",
      desc: "Buyer deposits tokens into the contract. Once fully funded, the order becomes active.",
      chips: ["Buyer", "ERC-20"],
    },
    {
      k: "04",
      title: "Advance + Approvals",
      desc: "Seller requests advance, buyer approves, then only the bank releases the advance payment.",
      chips: ["Seller", "Buyer", "Bank"],
    },
    {
      k: "05",
      title: "Milestones → Delivery → Pay",
      desc: "For each milestone: plan → plan approval → delivery → inspection → buyer final approval → bank payout.",
      chips: ["Seller/Carrier", "Buyer", "Inspector", "Bank"],
    },
  ];

  const flowPills = [
    "Fund",
    "Request Advance",
    "Approve",
    "Bank Pays",
    "Plan",
    "Deliver",
    "Inspect",
    "Approve",
    "Bank Pays",
    "Finalize",
  ];

  return (
    <section id="how-it-works" className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20">
        {/* Heading */}
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            A milestone-based escrow flow with role-based approvals — designed
            for construction procurement, and adaptable to any supply chain.
          </p>
        </div>

        {/* Content */}
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* Left: Steps */}
          <div className="space-y-4">
            {steps.map((s, i) => (
              <div
                key={s.k}
                className="group rounded-3xl border bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  {/* Step number */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-gray-50 text-sm font-semibold text-gray-900">
                    {s.k}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-gray-900">
                        {s.title}
                      </h3>
                      <span className="text-xs text-gray-500">
                        Step {i + 1}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {s.desc}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {s.chips.map((c) => (
                        <span
                          key={`${s.k}-${c}`}
                          className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Summary / Visual */}
          <div className="relative">
            <div className="sticky top-24 rounded-3xl border bg-white p-8 shadow-sm">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Role-based escrow you can audit
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Every step stores a compact proof (bytes32 doc hash) and
                    emits events for transparent tracking.
                  </p>
                </div>

                {/* Flow pills */}
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-xs font-medium text-gray-500">
                    Typical flow
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flowPills.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-gray-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Guarantees */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-gray-500">Safety</div>
                    <div className="mt-1 font-semibold text-gray-900">
                      Bank-only payouts
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      Even after approvals, funds move only when the bank
                      executes payment.
                    </p>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-gray-500">Accountability</div>
                    <div className="mt-1 font-semibold text-gray-900">
                      Document hash proofs
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      Pin plans, delivery, inspection, and approvals with
                      bytes32 hashes for full audit trails.
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/app"
                    className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white hover:opacity-90 transition"
                  >
                    Launch Dashboard
                  </a>
                  <a
                    href="#features"
                    className="rounded-2xl border px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Explore features
                  </a>
                </div>
              </div>
            </div>

            {/* Background accents */}
            <div className="pointer-events-none absolute -right-10 -top-10 -z-10 h-56 w-56 rounded-full bg-gray-100 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 -z-10 h-56 w-56 rounded-full bg-gray-50 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

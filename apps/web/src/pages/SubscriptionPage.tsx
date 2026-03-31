import { NavLink } from "react-router";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

const billingHistory = [
  { date: "Mar 27, 2026", description: "Pro Plan - Monthly", amount: "IDR 299,000", status: "Paid" },
  { date: "Feb 27, 2026", description: "Pro Plan - Monthly", amount: "IDR 299,000", status: "Paid" },
  { date: "Jan 27, 2026", description: "Pro Plan - Monthly", amount: "IDR 299,000", status: "Paid" },
];

const sidebarLinks = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/subscription", icon: "subscriptions", label: "Subscriptions" },
  { to: "/plans", icon: "sell", label: "Plans" },
  { to: "/settings", icon: "settings", label: "Settings" },
];

export function SubscriptionPage() {
  return (
    <div className="bg-surface text-on-surface min-h-dvh">
      <Header />

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-16 py-8 px-4 border-r border-zinc-200 h-[calc(100vh-4rem)] w-64 hidden md:flex flex-col bg-surface-container-low">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant">
              person
            </span>
          </div>
          <div>
            <p className="font-manrope text-sm font-bold text-on-surface">
              Merchant Admin
            </p>
            <p className="text-[10px] text-on-surface-variant">Premium Account</p>
          </div>
        </div>
        <nav className="space-y-1">
          {sidebarLinks.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ${
                  isActive
                    ? "bg-white text-primary font-bold shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`
              }
            >
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="pt-24 pb-32 md:pb-12 px-6 md:ml-64 max-w-5xl mx-auto">
        {/* Header */}
        <section className="mb-10">
          <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight mb-2">
            Subscription Settings
          </h1>
          <p className="text-on-surface-variant text-sm max-w-lg leading-relaxed">
            Manage your premium features, billing cycle, and connected payment
            methods across the PayFlow ecosystem.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Current Plan Card */}
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0_24px_48px_-12px_rgba(17,24,39,0.06)] flex flex-col justify-between border-b-4 border-primary">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Active Membership
                  </span>
                  <h2 className="text-2xl font-headline font-bold text-on-surface">
                    Pro Plan
                  </h2>
                </div>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                  Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs text-on-surface-variant mb-1">
                    Monthly Billing
                  </p>
                  <p className="font-mono text-xl font-semibold">
                    IDR 299,000{" "}
                    <span className="text-sm font-normal text-on-surface-variant font-body">
                      / month
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant mb-1">
                    Next Renewal
                  </p>
                  <p className="font-mono text-xl font-semibold">
                    April 27, 2026
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-6 border-t border-surface-container">
              <button className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm">
                <span className="material-symbols-outlined text-sm">
                  swap_horiz
                </span>
                Change Plan
              </button>
              <button className="text-error text-sm font-semibold hover:bg-error/5 px-4 py-2.5 rounded-lg transition-colors">
                Cancel Subscription
              </button>
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="lg:col-span-4 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-headline font-bold mb-6">
                Payment Method
              </h3>
              <div className="bg-surface-container-lowest p-5 rounded-lg mb-6 border border-outline-variant/20">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-white flex items-center justify-center rounded-lg shadow-sm border border-zinc-100">
                    <span className="material-symbols-outlined text-primary text-2xl">
                      qr_code_2
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">QRIS Auto-pay</p>
                    <p className="text-[10px] text-on-surface-variant uppercase font-medium">
                      via Xendit Gateway
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-on-surface-variant italic">
                  Auto-renewed on the 27th of every month.
                </p>
              </div>
            </div>
            <button className="w-full border-2 border-outline-variant/30 text-on-surface px-4 py-2.5 rounded-lg text-sm font-semibold hover:border-primary/50 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">
                credit_card
              </span>
              Update Payment Method
            </button>
          </div>

          {/* Billing History */}
          <div className="lg:col-span-12 mt-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-headline font-bold">
                Billing History
              </h3>
              <button className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline">
                View All Invoices
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead className="hidden md:table-header-group">
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <th className="pb-2 px-4">Date</th>
                    <th className="pb-2 px-4">Description</th>
                    <th className="pb-2 px-4 text-right">Amount</th>
                    <th className="pb-2 px-4 text-center">Status</th>
                    <th className="pb-2 px-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((row, i) => (
                    <tr
                      key={i}
                      className="bg-surface-container-lowest md:hover:bg-surface-container-low transition-colors rounded-xl md:table-row flex flex-col p-4 md:p-0 mb-4 md:mb-0"
                    >
                      <td className="px-4 py-4 md:py-5 font-mono text-sm md:table-cell flex justify-between items-center">
                        <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">
                          Date
                        </span>
                        {row.date}
                      </td>
                      <td className="px-4 py-2 md:py-5 md:table-cell flex justify-between items-center">
                        <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">
                          Plan
                        </span>
                        <span className="font-medium">{row.description}</span>
                      </td>
                      <td className="px-4 py-2 md:py-5 text-right font-mono font-bold md:table-cell flex justify-between items-center">
                        <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">
                          Amount
                        </span>
                        {row.amount}
                      </td>
                      <td className="px-4 py-2 md:py-5 text-center md:table-cell flex justify-between items-center">
                        <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">
                          Status
                        </span>
                        <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 md:py-5 text-right md:table-cell flex justify-end">
                        <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 text-xs font-semibold">
                          <span className="material-symbols-outlined text-lg">
                            download
                          </span>
                          <span className="md:hidden">Download Invoice</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="lg:col-span-12 mt-12 bg-error/5 border-2 border-dashed border-error/20 rounded-xl p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-headline font-bold text-error mb-1">
                  Cancel Subscription
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Terminating your subscription will immediately downgrade your
                  access to the free tier at the end of the current billing
                  cycle.
                </p>
              </div>
              <button className="border border-error text-error px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-error hover:text-white transition-all whitespace-nowrap self-start md:self-center">
                Cancel Plan
              </button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

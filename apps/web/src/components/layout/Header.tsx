import { NavLink } from "react-router";

type HeaderVariant = "default" | "checkout" | "status";

interface HeaderProps {
  variant?: HeaderVariant;
}

export function Header({ variant = "default" }: HeaderProps) {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm h-16">
      <div className="flex items-center justify-between px-6 h-full max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 text-2xl">
            account_balance_wallet
          </span>
          <span className="font-manrope font-black tracking-tight text-xl text-on-surface">
            PayFlow
          </span>
        </div>

        {/* Right side */}
        {variant === "checkout" && (
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">
              lock
            </span>
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">
              Secure Checkout
            </span>
          </div>
        )}

        {variant === "status" && (
          <span className="text-sm font-medium text-on-surface-variant">
            Status Checker
          </span>
        )}

        {variant === "default" && (
          <nav className="hidden md:flex items-center gap-1">
            {[
              { to: "/", label: "Dashboard" },
              { to: "/subscription", label: "Subscriptions" },
              { to: "/plans", label: "Plans" },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-primary font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

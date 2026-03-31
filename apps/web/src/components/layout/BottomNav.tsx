import { NavLink } from "react-router";

const navItems = [
  { to: "/", icon: "home", label: "Home" },
  { to: "/plans", icon: "sell", label: "Plans" },
  { to: "/status", icon: "history", label: "History" },
  { to: "/profile", icon: "person", label: "Profile" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 md:hidden glass-nav border-t border-zinc-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-2xl">
      <div className="flex justify-around items-center pt-3 pb-6 px-4">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-primary" : "text-zinc-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined"
                  style={
                    isActive
                      ? { fontVariationSettings: "'FILL' 1" }
                      : undefined
                  }
                >
                  {icon}
                </span>
                <span className="font-manrope text-[10px] font-medium">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

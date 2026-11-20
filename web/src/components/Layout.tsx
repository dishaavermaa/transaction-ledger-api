import { NavLink, Outlet } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-sky-500 text-white' : 'text-cocoa-600 hover:bg-cream-200'
  }`;

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-200 bg-cream-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cocoa-700 text-cream-50 font-bold">
              ₹
            </span>
            <span className="font-bold text-cocoa-800">Transaction Ledger</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Accounts
            </NavLink>
            <NavLink to="/transfer" className={linkClass}>
              Transfer
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

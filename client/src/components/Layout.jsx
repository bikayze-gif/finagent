import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Calendar,
  PiggyBank,
  Target,
  Landmark,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transacciones' },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/budgets', icon: PiggyBank, label: 'Presupuestos' },
  { to: '/goals', icon: Target, label: 'Metas' },
  { to: '/accounts', icon: Landmark, label: 'Cuentas' },
];

const mobileNavItems = navItems.slice(0, 5);

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen" style={{ background: '#0b1326' }}>
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex md:flex-col md:w-64 terminal-grid relative"
        style={{ background: '#131b2e', borderRight: '1px solid #2d3449' }}
      >
        {/* Logo */}
        <div className="px-6 py-6" style={{ borderBottom: '1px solid #2d3449' }}>
          <h1
            className="font-headline text-xl font-bold tracking-tight"
            style={{ color: '#98da27' }}
          >
            Fin<span style={{ color: '#5de6ff' }}>Agent</span>
          </h1>
          <p className="text-xs mt-0.5 uppercase tracking-widest" style={{ color: '#8b93a8' }}>
            Gestión financiera
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'border-r-2 scale-100'
                    : 'scale-95 opacity-70 hover:opacity-100 hover:scale-100'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      color: '#98da27',
                      borderRight: '2px solid #98da27',
                      background: 'rgba(45,52,73,0.3)',
                    }
                  : {
                      color: '#8b93a8',
                    }
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} style={{ color: isActive ? '#98da27' : undefined }} />
                  <span className="uppercase tracking-wider text-xs font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 space-y-0.5" style={{ borderTop: '1px solid #2d3449' }}>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive ? 'border-r-2 scale-100' : 'scale-95 opacity-70 hover:opacity-100 hover:scale-100'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? { color: '#98da27', borderRight: '2px solid #98da27', background: 'rgba(45,52,73,0.3)' }
                : { color: '#8b93a8' }
            }
          >
            {({ isActive }) => (
              <>
                <Settings size={18} style={{ color: isActive ? '#98da27' : undefined }} />
                <span className="uppercase tracking-wider text-xs font-medium">Configuración</span>
              </>
            )}
          </NavLink>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 scale-95 opacity-70 hover:opacity-100 hover:scale-100 cursor-pointer"
            style={{ color: '#8b93a8' }}
          >
            <LogOut size={18} />
            <span className="uppercase tracking-wider text-xs font-medium">Cerrar sesión</span>
          </button>

          {/* User pill */}
          {user && (
            <div
              className="mx-1 mt-3 px-3 py-2 rounded-full text-xs text-center truncate"
              style={{ background: 'rgba(152,218,39,0.08)', color: '#98da27', border: '1px solid rgba(152,218,39,0.2)' }}
            >
              {user.name || user.email}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Glassmorphic header */}
        <header
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-30"
          style={{
            background: 'rgba(11,19,38,0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(45,52,73,0.6)',
          }}
        >
          <h2
            className="font-headline text-lg font-bold tracking-tight md:hidden"
            style={{ color: '#98da27' }}
          >
            Fin<span style={{ color: '#5de6ff' }}>Agent</span>
          </h2>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider hidden md:block" style={{ color: '#8b93a8' }}>
              {user?.name || user?.email}
            </span>
            <NavLink
              to="/settings"
              className="p-2 transition-colors md:hidden"
              style={{ color: '#8b93a8' }}
            >
              <Settings size={18} />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden z-40"
        style={{
          background: 'rgba(19,27,46,0.95)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid #2d3449',
        }}
      >
        <div className="flex justify-around py-2">
          {mobileNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200 ${
                  isActive ? 'scale-100' : 'scale-90 opacity-60'
                }`
              }
              style={({ isActive }) => ({ color: isActive ? '#98da27' : '#8b93a8' })}
            >
              <Icon size={20} />
              <span className="text-xs uppercase tracking-wider" style={{ fontSize: '9px' }}>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

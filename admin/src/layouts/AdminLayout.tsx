import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Avatar } from '../components/ui';
import { hostApi } from '../api/host';
import {
  LayoutDashboard, Users, UserCheck, Store, FileText, Tag, Package,
  CreditCard, BarChart3, Layers, Activity, Settings, Search, MessageSquare,
  ChevronDown, LogOut, Menu, X, Settings as Cog, Shield
} from 'lucide-react';

const navItems = [
  { to: '/admin/overview', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/clients', icon: UserCheck, label: 'Clients' },
  { to: '/admin/sellers', icon: Store, label: 'Sellers' },
  { to: '/admin/requests', icon: FileText, label: 'Requests' },
  { to: '/admin/offers', icon: Tag, label: 'Offers' },
  { to: '/admin/orders', icon: Package, label: 'Orders' },
  { to: '/admin/transactions', icon: CreditCard, label: 'Transactions' },
  { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { to: '/admin/categories', icon: Layers, label: 'Categories' },
  { to: '/admin/activity', icon: Activity, label: 'Activity Logs' },
  { to: '/admin/support', icon: MessageSquare, label: 'Client Support' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export const AdminLayout: React.FC = () => {
  const { logout, addToast } = useStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try { await hostApi('/auth/logout', { method: 'POST' }); logout(); navigate('/'); }
    catch (error) { addToast('error', error instanceof Error ? `Could not end your server session: ${error.message}` : 'Could not end your server session. Please try again.'); }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <aside className="hidden lg:flex flex-col w-[240px] bg-navy-900 shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Cog size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">AutoParts <span className="text-primary">Pro</span></span>
        </div>

        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Shield size={14} className="text-amber-400" />
          <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-border px-4 lg:px-6 h-16 flex items-center justify-between shrink-0 z-30">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-lg hover:bg-surface-secondary">
            <Menu size={20} />
          </button>

          <div className="hidden md:flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input type="text" placeholder="Search platform..." className="input-field pl-10" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg hover:bg-surface-secondary transition-colors">
                <Avatar name="Super Admin" size="sm" />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-text-primary">Super Admin</p>
                  <p className="text-xs text-text-secondary">Admin</p>
                </div>
                <ChevronDown size={16} className="text-text-secondary" />
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-border z-50 py-1">
                    <button onClick={() => { navigate('/admin/settings'); setProfileMenuOpen(false); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-text-primary hover:bg-surface-secondary">
                      <Settings size={16} /> Settings
                    </button>
                    <hr className="border-border my-1" />
                    <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-danger hover:bg-surface-secondary">
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="page-enter"><Outlet /></div>
        </main>
      </div>

      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-[280px] bg-navy-900 z-50 lg:hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><Cog size={18} className="text-white" /></div>
                <span className="text-white font-bold text-lg">AutoParts <span className="text-primary">Pro</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400"><X size={20} /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
                  <item.icon size={18} /><span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
};


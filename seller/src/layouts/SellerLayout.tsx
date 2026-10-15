import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import { Avatar } from '../components/ui';
import {
  LayoutDashboard, FileText, Tag, Package, Box, BarChart3,
  MessageSquare, Bell, Store, Search, ChevronDown, LogOut, Menu, X,
  Settings as Cog
} from 'lucide-react';

const navItems = [
  { to: '/seller/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/seller/requests', icon: FileText, label: 'Requests' },
  { to: '/seller/offers', icon: Tag, label: 'My Offers' },
  { to: '/seller/orders', icon: Package, label: 'Orders' },
  { to: '/seller/inventory', icon: Box, label: 'Inventory' },
  { to: '/seller/sales', icon: BarChart3, label: 'Sales' },
  { to: '/seller/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/seller/notifications', icon: Bell, label: 'Notifications' },
  { to: '/seller/profile', icon: Store, label: 'Shop Profile' },
];

export const SellerLayout: React.FC = () => {
  const { currentSeller, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  useEffect(() => {
    api.get<{ data: unknown[] }>('/seller/notifications?unread=true').then(({ data }) => setUnreadNotifs(data.length)).catch(() => setUnreadNotifs(0));
  }, [location.pathname]);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } finally {
    logout();
    navigate('/');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] bg-navy-900 shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Cog size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">AutoParts <span className="text-primary">Pro</span></span>
        </div>

        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Seller Panel</p>
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
              <span className="flex-1">{item.label}</span>
              {item.label === 'Notifications' && unreadNotifs > 0 && (
                <span className="bg-danger text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unreadNotifs}
                </span>
              )}
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
              <input type="text" placeholder="Search requests, orders..." className="input-field pl-10" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/seller/notifications')} className="relative p-2 rounded-lg hover:bg-surface-secondary transition-colors">
              <Bell size={20} className="text-text-secondary" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadNotifs}
                </span>
              )}
            </button>

            <div className="relative">
              <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg hover:bg-surface-secondary transition-colors">
                <Avatar name={currentSeller.shopName} size="sm" />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-text-primary">{currentSeller.name}</p>
                  <p className="text-xs text-text-secondary">Seller</p>
                </div>
                <ChevronDown size={16} className="text-text-secondary" />
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-border z-50 py-1">
                    <button onClick={() => { navigate('/seller/profile'); setProfileMenuOpen(false); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-text-primary hover:bg-surface-secondary">
                      <Store size={16} /> Shop Profile
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

      {/* Mobile */}
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

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around py-2 z-30">
        {[navItems[0], navItems[1], navItems[3], navItems[4], navItems[6]].map((item) => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${isActive ? 'text-accent' : 'text-text-secondary'}`}>
            <item.icon size={20} /><span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};


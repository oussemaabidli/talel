import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Avatar } from '../components/ui';
import {
  LayoutDashboard, FileText, Tag, Package, MessageSquare,
  Bell, User, Search, ChevronDown, LogOut, Menu, X, Settings as Cog
} from 'lucide-react';

const navItems = [
  { to: '/client/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/client/requests', icon: FileText, label: 'My Requests' },
  { to: '/client/offers', icon: Tag, label: 'Offers' },
  { to: '/client/orders', icon: Package, label: 'Orders' },
  { to: '/client/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/client/notifications', icon: Bell, label: 'Notifications' },
  { to: '/client/profile', icon: User, label: 'Profile' },
];

export const ClientLayout: React.FC = () => {
  const { currentClient, clientNotifications, conversations, logout } = useStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const unreadNotifs = clientNotifications.filter(n => !n.isRead).length;
  const unreadMessages = conversations.filter(c =>
    c.participants.some(p => p.id === currentClient.id) && c.unreadCount > 0
  ).length;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-[240px] bg-navy-900 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Cog size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">AutoParts <span className="text-primary">Pro</span></span>
        </div>

        {/* Nav */}
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
              {item.label === 'Messages' && unreadMessages > 0 && (
                <span className="bg-danger text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unreadMessages}
                </span>
              )}
              {item.label === 'Notifications' && unreadNotifs > 0 && (
                <span className="bg-danger text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unreadNotifs}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom promo */}
        <div className="px-4 py-4">
          <div className="bg-navy-700 rounded-xl p-4">
            <p className="text-white font-bold text-sm mb-1">Better Parts</p>
            <p className="text-white font-bold text-sm">Keep You Moving</p>
            <p className="text-gray-400 text-xs mt-2">Quality parts. Trusted suppliers.<br/>For a smoother journey.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-border px-4 lg:px-6 h-16 flex items-center justify-between shrink-0 z-30">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-surface-secondary"
          >
            <Menu size={20} />
          </button>

          {/* Search */}
          <div className="hidden md:flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search for parts, vehicles, or suppliers..."
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Notifications bell */}
            <button
              onClick={() => navigate('/client/notifications')}
              className="relative p-2 rounded-lg hover:bg-surface-secondary transition-colors"
            >
              <Bell size={20} className="text-text-secondary" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadNotifs}
                </span>
              )}
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg hover:bg-surface-secondary transition-colors"
              >
                <Avatar name={currentClient.name} size="sm" />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-text-primary">{currentClient.name}</p>
                  <p className="text-xs text-text-secondary">Client</p>
                </div>
                <ChevronDown size={16} className="text-text-secondary" />
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-border z-50 py-1">
                    <button
                      onClick={() => { navigate('/client/profile'); setProfileMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-text-primary hover:bg-surface-secondary"
                    >
                      <User size={16} /> Profile
                    </button>
                    <hr className="border-border my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-danger hover:bg-surface-secondary"
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-[280px] bg-navy-900 z-50 lg:hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Cog size={18} className="text-white" />
                </div>
                <span className="text-white font-bold text-lg">AutoParts <span className="text-primary">Pro</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
                  }
                >
                  <item.icon size={18} />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around py-2 z-30">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
                isActive ? 'text-accent' : 'text-text-secondary'
              }`
            }
          >
            <item.icon size={20} />
            <span>{item.label.replace('My ', '')}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};


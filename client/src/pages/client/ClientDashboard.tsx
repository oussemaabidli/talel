import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { StatusBadge, Avatar } from '../../components/ui';
import { formatDate, formatCurrency } from '../../utils/helpers';
import {
  PlusCircle, FileText, Tag, Package, CheckCircle2,
  ArrowRight, Search, MessagesSquare, HelpCircle,
  Truck, ArrowUpRight, Box
} from 'lucide-react';

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentClient, requests, orders, offers, addToast } = useStore();

  // Filter client's own data
  const myRequests = requests.filter(r => r.clientId === currentClient.id);
  const myOrders = orders.filter(o => o.clientId === currentClient.id);
  const myOffers = offers.filter(o => myRequests.some(r => r.id === o.requestId));

  const activeRequestsCount = myRequests.filter(r => ['published', 'offers_received', 'in_progress'].includes(r.status)).length;
  const offersReceivedCount = myOffers.length;
  const ordersInProgressCount = myOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
  const completedOrdersCount = myOrders.filter(o => o.status === 'completed').length;

  const recentRequests = myRequests.slice(0, 4);
  const recentOrders = myOrders.slice(0, 4);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Section: Welcome Banner & Promotional Promo Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Welcome Hero Banner (matching image) */}
        <div className="lg:col-span-8 bg-gradient-to-r from-white via-slate-50 to-blue-50/40 rounded-2xl border border-border p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden shadow-sm">
          <div className="max-w-xl z-10">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-navy-900 tracking-tight">
              Welcome back, {currentClient.name.split(' ')[0]}
            </h1>
            <p className="text-text-secondary text-sm lg:text-base mt-2 leading-relaxed">
              Find the right spare parts, get the best offers, and keep your vehicles running smoothly.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/client/requests/new')}
                className="btn-primary shadow-sm hover:shadow transition-all inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold"
              >
                <PlusCircle size={18} />
                Request a Spare Part
              </button>
            </div>
          </div>

          {/* Decorative Car Illustration Container */}
          <div className="hidden md:flex absolute right-4 bottom-2 top-2 w-72 items-center justify-center pointer-events-none opacity-90">
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="w-56 h-36 bg-gradient-to-tr from-slate-200/80 to-slate-100 rounded-2xl flex flex-col items-center justify-center border border-slate-200/60 shadow-inner p-4 text-center">
                <Box size={40} className="text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-600">Automotive Parts Hub</span>
                <span className="text-[11px] text-slate-400">Genuine & Aftermarket</span>
              </div>
            </div>
          </div>
        </div>

        {/* Promo Card: Quality Spare Parts for Every Journey (matching image) */}
        <div className="lg:col-span-4 bg-navy-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="z-10">
            <span className="inline-block px-2.5 py-1 bg-white/10 text-xs font-medium text-blue-200 rounded-full mb-3">
              Verified Network
            </span>
            <h2 className="text-xl font-bold leading-tight">
              Quality Spare Parts for Every Journey
            </h2>
            <ul className="text-xs text-slate-300 mt-3 space-y-1.5">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Seller business documents reviewed before marketplace access
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Competitive direct offers
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                View order status updates in your account
              </li>
            </ul>
          </div>
          <div className="mt-6 z-10">
            <button
              onClick={() => navigate('/client/requests/new')}
              className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              Browse Parts <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric Stats Cards (matching image layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Requests */}
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-accent flex items-center justify-center">
              <FileText size={20} />
            </div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Active Requests
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-navy-900">{activeRequestsCount}</span>
          </div>
        </div>

        {/* Offers Received */}
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Tag size={20} />
            </div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Offers Received
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-navy-900">{offersReceivedCount}</span>
          </div>
        </div>

        {/* Orders in Progress */}
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package size={20} />
            </div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Orders in Progress
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-navy-900">{ordersInProgressCount}</span>
          </div>
        </div>

        {/* Completed Orders */}
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-primary flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Completed Orders
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-navy-900">{completedOrdersCount}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Tables & Cards) vs Right (Quick Actions & Support) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Recent Requests & Recent Orders */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent Requests Section */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-navy-900">Recent Requests</h2>
              <button
                onClick={() => navigate('/client/requests')}
                className="text-xs font-semibold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
              >
                View All <ArrowUpRight size={14} />
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase">
                    <th className="pb-3 px-3">Vehicle</th>
                    <th className="pb-3 px-3">Spare part</th>
                    <th className="pb-3 px-3">Date</th>
                    <th className="pb-3 px-3 text-center">Offers</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {recentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-surface-secondary/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center text-text-secondary text-xs font-bold">
                            🚗
                          </div>
                          <span className="font-medium text-navy-900">
                            {req.vehicle.brand} {req.vehicle.model} {req.vehicle.year}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-text-primary font-medium">{req.partName}</td>
                      <td className="py-3 px-3 text-text-secondary text-xs">{formatDate(req.createdAt)}</td>
                      <td className="py-3 px-3 text-center font-bold text-navy-900">{req.offersCount}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => navigate(`/client/requests/${req.id}`)}
                          className="px-3 py-1 border border-border text-xs font-semibold rounded-lg text-accent hover:bg-accent-light transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {recentRequests.map((req) => (
                <div key={req.id} className="p-3 border border-border rounded-xl bg-surface-secondary/40 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-navy-900 text-sm">{req.partName}</p>
                      <p className="text-xs text-text-secondary">{req.vehicle.brand} {req.vehicle.model} {req.vehicle.year}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border">
                    <span>{req.offersCount} offers received</span>
                    <button
                      onClick={() => navigate(`/client/requests/${req.id}`)}
                      className="text-accent font-semibold text-xs"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders Section (matching card layout) */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-navy-900">Recent Orders</h2>
              <button
                onClick={() => navigate('/client/orders')}
                className="text-xs font-semibold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
              >
                View All <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/client/orders/${order.id}`)}
                  className="p-4 border border-border rounded-xl hover:shadow-md transition-all cursor-pointer bg-white flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[11px] font-bold text-navy-900">#{order.id}</span>
                      <StatusBadge status={order.status} className="scale-90 origin-right" />
                    </div>
                    <p className="text-xs text-text-secondary truncate">{order.partName}</p>
                    <p className="text-[11px] text-text-tertiary truncate">From {order.sellerShop}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-end justify-between">
                    <div>
                      <p className="text-xs text-text-tertiary">{formatDate(order.createdAt)}</p>
                      <p className="text-sm font-bold text-navy-900">{formatCurrency(order.totalAmount)}</p>
                    </div>
                    <span className="text-xs font-semibold text-accent group-hover:translate-x-0.5 transition-transform">
                      View →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Quick Actions, Need Help, Notifications Preview */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions (matching image) */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-navy-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/client/requests/new')}
                className="p-3.5 rounded-xl border border-border hover:border-accent hover:bg-accent-light/40 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 text-accent flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <PlusCircle size={20} />
                </div>
                <span className="text-xs font-semibold text-navy-900">Request a Part</span>
              </button>

              <button
                onClick={() => navigate('/client/offers')}
                className="p-3.5 rounded-xl border border-border hover:border-purple-300 hover:bg-purple-50 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Tag size={20} />
                </div>
                <span className="text-xs font-semibold text-navy-900">View Offers</span>
              </button>

              <button
                onClick={() => navigate('/client/orders')}
                className="p-3.5 rounded-xl border border-border hover:border-amber-300 hover:bg-amber-50 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Package size={20} />
                </div>
                <span className="text-xs font-semibold text-navy-900">Track Orders</span>
              </button>

              <button
                onClick={() => navigate('/client/messages')}
                className="p-3.5 rounded-xl border border-border hover:border-blue-300 hover:bg-blue-50 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 text-accent flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <MessagesSquare size={20} />
                </div>
                <span className="text-xs font-semibold text-navy-900">Messages</span>
              </button>
            </div>
          </div>

          {/* Need Help Support Card */}
          <div className="card p-5 bg-gradient-to-b from-blue-50/50 to-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-accent flex items-center justify-center">
                <HelpCircle size={18} />
              </div>
              <h3 className="text-sm font-bold text-navy-900">Need Help?</h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed mb-4">
              Our marketplace support team is here to help you with any questions or order inquiries.
            </p>
            <button
              onClick={() => addToast('info', 'Support requests are not available in the app yet.')}
              className="w-full btn-secondary text-xs font-semibold py-2"
            >
              Contact Support
            </button>
          </div>

          {/* Notifications Preview Box (matching image empty state) */}
          <div className="card p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-tertiary flex items-center justify-center text-text-tertiary mb-3">
              <Box size={24} />
            </div>
            <p className="text-xs font-bold text-navy-900">No new alerts</p>
            <p className="text-[11px] text-text-secondary mt-0.5">You're all caught up with your orders!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;


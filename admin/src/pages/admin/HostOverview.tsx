import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { StatusBadge, Avatar } from '../../components/ui';
import { formatCurrency, formatDate, formatTimeAgo } from '../../utils/helpers';
import {
  Users, UserCheck, Store, FileText, Package, CheckCircle2,
  DollarSign, TrendingUp, ArrowRight, Shield, Layers, Activity
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export const HostOverview: React.FC = () => {
  const navigate = useNavigate();
  const { clients, sellers, requests, orders, transactions, activityLogs } = useStore();

  const totalClients = clients.length;
  const totalSellers = sellers.filter((seller) => seller.isVerified).length;
  const totalUsers = totalClients + totalSellers;
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;

  // Platform GMV & Revenue
  const totalPlatformGMV = transactions.reduce((sum, t) => sum + t.amount, 0);

  const revenueChartData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(); date.setMonth(date.getMonth() - 5 + index);
    const name = date.toLocaleString('en', { month: 'short' });
    const value = orders.filter(order => { const created = new Date(order.createdAt); return created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear(); }).reduce((sum, order) => sum + order.totalAmount, 0);
    return { name, value };
  });
  const partsByCategory = requests.reduce<Record<string, number>>((totals, request) => ({ ...totals, [request.category]: (totals[request.category] ?? 0) + 1 }), {});
  const popularPartsData = Object.entries(partsByCategory).map(([name, value]) => ({ name, value }));

  const recentOrders = orders.slice(0, 5);
  const recentLogs = activityLogs.slice(0, 6);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 rounded-2xl p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-amber-400" />
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Host Master Control
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            AutoParts Pro Platform Overview
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Real-time overview of marketplace activity, seller verification, and platform operations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => navigate('/admin/transactions')}
            className="btn-primary py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <DollarSign size={15} /> Platform Ledger
          </button>
          <button
            onClick={() => navigate('/admin/reports')}
            className="px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
          >
            Full Analytics
          </button>
        </div>
      </div>

      {/* 8 Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="stat-card !p-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Total Users</span>
          <p className="text-xl font-extrabold text-navy-900 mt-2">{totalUsers}</p>
          <span className="text-[10px] text-primary font-semibold">Accounts in database</span>
        </div>

        <div className="stat-card !p-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Active Clients</span>
          <p className="text-xl font-extrabold text-navy-900 mt-2">{totalClients}</p>
          <span className="text-[10px] text-accent font-semibold">Car owners</span>
        </div>

        <div className="stat-card !p-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Verified Sellers</span>
          <p className="text-xl font-extrabold text-navy-900 mt-2">{totalSellers}</p>
          <span className="text-[10px] text-green-700 font-semibold">Approved seller accounts</span>
        </div>

        <div className="stat-card !p-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Total Requests</span>
          <p className="text-xl font-extrabold text-navy-900 mt-2">{requests.length}</p>
          <span className="text-[10px] text-purple-600 font-semibold">High intent</span>
        </div>

        <div className="stat-card !p-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Total Orders</span>
          <p className="text-xl font-extrabold text-navy-900 mt-2">{totalOrders}</p>
          <span className="text-[10px] text-accent font-semibold">Gross matched</span>
        </div>

        <div className="stat-card !p-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Completed</span>
          <p className="text-xl font-extrabold text-navy-900 mt-2">{completedOrders}</p>
          <span className="text-[10px] text-primary font-semibold">Recorded completed orders</span>
        </div>

        <div className="stat-card !p-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Platform GMV</span>
          <p className="text-sm font-extrabold text-navy-900 mt-2.5 truncate">
            {formatCurrency(totalPlatformGMV)}
          </p>
          <span className="text-[10px] text-text-secondary">Gross GMV</span>
        </div>

        <div className="stat-card !p-4 bg-green-50/50 border-green-200">
          <span className="text-[10px] font-bold text-green-800 uppercase">Recorded Platform Fees</span>
          <p className="text-sm font-extrabold text-green-900 mt-2.5 truncate">Not connected</p>
          <span className="text-[10px] text-primary font-bold">Payment ledger not connected</span>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Platform Revenue & GMV Trajectory */}
        <div className="lg:col-span-8 card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-navy-900">Platform GMV Growth Trajectory</h2>
              <p className="text-xs text-text-secondary">Monthly gross merchandise value across recorded orders (TND)</p>
            </div>
            <button
              onClick={() => navigate('/admin/reports')}
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
            >
              Details <ArrowRight size={13} />
            </button>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="hostRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [`${val.toLocaleString()} TND`, 'GMV']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fill="url(#hostRevenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Requested Parts */}
        <div className="lg:col-span-4 card p-6">
          <h2 className="text-base font-bold text-navy-900 mb-1">Most Requested Parts</h2>
          <p className="text-xs text-text-secondary mb-4">Volume by product category</p>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularPartsData.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} width={90} />
                <Tooltip
                  formatter={(val: any) => [`${val} requests`, 'Volume']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="#22C55E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Orders Lifecycle & Platform Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Orders Overview */}
        <div className="lg:col-span-7 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900">Recent Marketplace Orders</h2>
            <button
              onClick={() => navigate('/admin/orders')}
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase">
                  <th className="pb-2.5 px-2">Order</th>
                  <th className="pb-2.5 px-2">Client / Seller</th>
                  <th className="pb-2.5 px-2">Amount</th>
                  <th className="pb-2.5 px-2">Status</th>
                  <th className="pb-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-surface-secondary/40">
                    <td className="py-3 px-2 font-bold text-navy-900">
                      #{ord.id}
                      <span className="block text-[11px] font-normal text-text-secondary truncate max-w-[120px]">
                        {ord.partName}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="font-semibold text-navy-900">{ord.clientName}</span>
                      <span className="block text-[11px] text-text-secondary truncate">
                        {ord.sellerShop}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-bold text-navy-900">
                      {formatCurrency(ord.totalAmount)}
                    </td>
                    <td className="py-3 px-2">
                      <StatusBadge status={ord.status} className="scale-90 origin-left" />
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => navigate('/admin/orders')}
                        className="text-accent font-semibold hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Activity Audit Feed */}
        <div className="lg:col-span-5 card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <Activity size={18} className="text-accent" /> Live Activity Feed
              </h2>
              <button
                onClick={() => navigate('/admin/activity')}
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                All Logs <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-surface-secondary border border-border text-xs flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.userRole === 'seller' ? 'bg-primary' : log.userRole === 'client' ? 'bg-accent' : 'bg-amber-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-bold text-navy-900 truncate">{log.userName}</span>
                      <span className="text-[10px] text-text-tertiary shrink-0">
                        {formatTimeAgo(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-primary mt-0.5">{log.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostOverview;


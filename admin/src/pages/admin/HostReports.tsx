import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../utils/helpers';
import {
  BarChart3, TrendingUp, Users, Package, FileText,
  DollarSign, Award, Layers
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#64748B'];

export const HostReports: React.FC = () => {
  const { clients, sellers, requests, orders } = useStore();
  const [activeTab, setActiveTab] = useState<'revenue' | 'orders' | 'categories' | 'parts'>('revenue');
  const [dateFilter, setDateFilter] = useState<'30d' | '90d' | '1y'>('30d');
  const monthCount = dateFilter === '30d' ? 1 : dateFilter === '90d' ? 3 : 12;
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(); date.setMonth(date.getMonth() - (monthCount - index - 1));
    return { date, name: date.toLocaleString('en', { month: 'short' }) };
  });
  const revenueChartData = months.map(({ date, name }) => ({ name, value: orders.filter((order) => { const created = new Date(order.createdAt); return created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear(); }).reduce((total, order) => total + order.totalAmount, 0) }));
  const ordersChartData = months.map(({ date, name }) => ({ name, value: orders.filter((order) => { const created = new Date(order.createdAt); return created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear(); }).length }));
  const categoryCounts = requests.reduce<Record<string, number>>((counts, request) => ({ ...counts, [request.category]: (counts[request.category] ?? 0) + 1 }), {});
  const requestsByCategory = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
  const popularPartsData = Object.entries(requests.reduce<Record<string, number>>((counts, request) => ({ ...counts, [request.partName]: (counts[request.partName] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Platform Analytics & Intelligence</h1>
          <p className="text-sm text-text-secondary">
            Cross-marketplace analytics covering revenue trends, liquidity, conversion rates, and catalog popularity.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-surface-secondary rounded-xl border border-border self-start sm:self-auto">
          {(['30d', '90d', '1y'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors ${
                dateFilter === d ? 'bg-white shadow text-navy-900' : 'text-text-secondary hover:text-navy-900'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Report Category Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'revenue', label: 'GMV & Revenue', icon: DollarSign },
          { id: 'orders', label: 'Order Volume', icon: Package },
          { id: 'categories', label: 'Categories Share', icon: Layers },
          { id: 'parts', label: 'Top Requested Parts', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                isActive
                  ? 'border-accent bg-accent-light/20 shadow-sm ring-1 ring-accent'
                  : 'card hover:border-slate-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                isActive ? 'bg-accent text-white' : 'bg-surface-secondary text-text-secondary'
              }`}>
                <Icon size={18} />
              </div>
              <span className={`text-xs font-bold ${isActive ? 'text-navy-900' : 'text-text-secondary'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Report Content */}
      <div className="card p-6 sm:p-8">
        {activeTab === 'revenue' && (
          <div>
            <div className="flex justify-between items-baseline mb-6">
              <div>
                <h2 className="text-base font-bold text-navy-900">Gross Platform Volume (TND)</h2>
                <p className="text-xs text-text-secondary">Gross sales processed across all supplier quotations</p>
              </div>
              <span className="text-sm font-extrabold text-navy-900">Recorded: {orders.reduce((total, order) => total + order.totalAmount, 0).toLocaleString()} TND</span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(val: any) => [`${val.toLocaleString()} TND`, 'Volume']} />
                  <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-baseline mb-6">
              <div>
                <h2 className="text-base font-bold text-navy-900">Orders Transacted</h2>
                <p className="text-xs text-text-secondary">Monthly volume of completed part orders</p>
              </div>
              <span className="text-sm font-extrabold text-navy-900">Total: {orders.length} Orders</span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip formatter={(val: any) => [`${val} orders`, 'Count']} />
                  <Bar dataKey="value" fill="#22C55E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            <div className="flex justify-between items-baseline mb-6">
              <div>
                <h2 className="text-base font-bold text-navy-900">Request Share by Category</h2>
                <p className="text-xs text-text-secondary">Distribution of inbound buyer searches</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={requestsByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {requestsByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {requestsByCategory.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-semibold text-navy-900">{cat.name}</span>
                    </div>
                    <span className="font-bold text-text-secondary">{cat.value} requests</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'parts' && (
          <div>
            <div className="flex justify-between items-baseline mb-6">
              <div>
                <h2 className="text-base font-bold text-navy-900">Most In-Demand Spare Parts</h2>
                <p className="text-xs text-text-secondary">Ranked by requests submitted in platform</p>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularPartsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#94A3B8" />
                  <YAxis dataKey="name" type="category" stroke="#64748B" width={110} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HostReports;


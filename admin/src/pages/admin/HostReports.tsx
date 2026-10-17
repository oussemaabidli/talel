import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../utils/helpers';
import { hostApi } from '../../api/host';
import {
  BarChart3, TrendingUp, Users, Package, FileText,
  DollarSign, Award, Layers
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#64748B'];

type HostReport = {
  orders: {
    count: number; completedCount: number; cancelledCount: number;
    nonCancelledOrderValueTnd: string; completedOrderValueTnd: string; cancelledOrderValueTnd: string;
  };
  monthlyOrders: Array<{ month: string; orderCount: number; nonCancelledOrderValueTnd: string }>;
  requestsByCategory: Array<{ name: string; count: number }>;
  popularParts: Array<{ name: string; count: number }>;
};

export const HostReports: React.FC = () => {
  const addToast = useStore((state) => state.addToast);
  const [report, setReport] = useState<HostReport | null>(null);
  const [activeTab, setActiveTab] = useState<'revenue' | 'orders' | 'categories' | 'parts'>('revenue');
  const [dateFilter, setDateFilter] = useState<'30d' | '90d' | '1y'>('30d');
  useEffect(() => {
    let active = true;
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (dateFilter === '30d' ? 30 : dateFilter === '90d' ? 90 : 365));
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    hostApi<HostReport>(`/host/reports?${query}`).then((data) => { if (active) setReport(data); })
      .catch((error) => { if (active) addToast('error', error instanceof Error ? error.message : 'Unable to load reports.'); });
    return () => { active = false; };
  }, [dateFilter, addToast]);

  const revenueChartData = (report?.monthlyOrders ?? []).map((row) => ({
    name: new Date(`${row.month}-01T00:00:00Z`).toLocaleString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    value: Number(row.nonCancelledOrderValueTnd),
  }));
  const ordersChartData = (report?.monthlyOrders ?? []).map((row) => ({
    name: new Date(`${row.month}-01T00:00:00Z`).toLocaleString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    value: row.orderCount,
  }));
  const requestsByCategory = (report?.requestsByCategory ?? []).map((row) => ({ name: row.name, value: row.count }));
  const popularPartsData = (report?.popularParts ?? []).map((row) => ({ name: row.name, value: row.count }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Platform Analytics & Intelligence</h1>
          <p className="text-sm text-text-secondary">
            Order value is not payment revenue. No payments, commissions, refunds, or settlements are processed by Talel.
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
          { id: 'revenue', label: 'Order Value', icon: DollarSign },
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
                <h2 className="text-base font-bold text-navy-900">Non-cancelled Order Value (TND)</h2>
                <p className="text-xs text-text-secondary">Recorded value of marketplace orders, excluding cancelled orders. This is not collected revenue.</p>
              </div>
              <span className="text-sm font-extrabold text-navy-900">{formatCurrency(Number(report?.orders?.nonCancelledOrderValueTnd ?? 0))}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="rounded-lg bg-surface-secondary p-3">
                <span className="text-xs font-semibold text-text-secondary">Completed order value</span>
                <p className="mt-1 font-bold text-navy-900">{formatCurrency(Number(report?.orders?.completedOrderValueTnd ?? 0))}</p>
              </div>
              <div className="rounded-lg bg-surface-secondary p-3">
                <span className="text-xs font-semibold text-text-secondary">Cancelled order value (excluded above)</span>
                <p className="mt-1 font-bold text-navy-900">{formatCurrency(Number(report?.orders?.cancelledOrderValueTnd ?? 0))}</p>
              </div>
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
                  <Tooltip formatter={(val: any) => [`${val.toLocaleString()} TND`, 'Order value']} />
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
                <p className="text-xs text-text-secondary">Orders created in the selected date range, including cancelled orders</p>
              </div>
              <span className="text-sm font-extrabold text-navy-900">Total: {report?.orders?.count ?? 0} Orders</span>
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


import React, { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { api, ApiError } from '../../api/client';
import { BarChart3, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Sale = { id: string; totalAmount: string; updatedAt: string; offer: { partName: string } };
type SalesResponse = { completedSales: number; revenueTnd: string; averageOrderValueTnd: string; history: Sale[] };

export const SellerSales: React.FC = () => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [report, setReport] = useState<SalesResponse | null>(null);
  const [chart, setChart] = useState<Array<{ name: string; value: number }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const end = new Date();
    const start = new Date(end);
    if (dateRange === '7d') start.setDate(end.getDate() - 7);
    if (dateRange === '30d') start.setDate(end.getDate() - 30);
    if (dateRange === '90d') start.setDate(end.getDate() - 90);
    const range = dateRange === 'all' ? '' : `?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`;
    setLoading(true);
    api.get<{ data: SalesResponse }>(`/seller/sales${range}`).then(({ data }) => {
      if (!active) return;
      setReport(data);
      const monthly = new Map<string, number>();
      for (const sale of data.history) {
        const month = new Date(sale.updatedAt).toLocaleDateString('fr-TN', { month: 'short', year: '2-digit' });
        monthly.set(month, (monthly.get(month) ?? 0) + Number(sale.totalAmount));
      }
      setChart([...monthly].reverse().map(([name, value]) => ({ name, value })));
      setError('');
    }).catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Unable to load sales data.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dateRange]);

  if (loading) return <div className="card p-8 text-sm text-text-secondary">Loading sales report…</div>;
  if (!report || error) return <div className="card p-8"><p role="alert" className="text-sm text-danger">{error || 'Sales data is unavailable.'}</p><button className="btn-secondary mt-4" onClick={() => window.location.reload()}>Retry</button></div>;

  const topParts = new Map<string, number>();
  report.history.forEach((sale) => topParts.set(sale.offer.partName, (topParts.get(sale.offer.partName) ?? 0) + Number(sale.totalAmount)));
  const topPerformers = [...topParts].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return <div className="mx-auto max-w-7xl space-y-6 pb-16">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-extrabold text-navy-900">Sales & Revenue Reports</h1><p className="text-sm text-text-secondary">Completed orders only · TND</p></div><div className="flex items-center gap-1.5 self-start rounded-xl border border-border bg-surface-secondary p-1 sm:self-auto">{(['7d', '30d', '90d', 'all'] as const).map((range) => <button key={range} onClick={() => setDateRange(range)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase ${dateRange === range ? 'bg-white text-navy-900 shadow' : 'text-text-secondary'}`}>{range}</button>)}</div></div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="stat-card"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-text-secondary">Completed Revenue</span><DollarSign className="text-primary" size={18} /></div><p className="mt-3 text-2xl font-extrabold text-navy-900">{formatCurrency(Number(report.revenueTnd))}</p></div><div className="stat-card"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-text-secondary">Completed Orders</span><ShoppingCart className="text-accent" size={18} /></div><p className="mt-3 text-2xl font-extrabold text-navy-900">{report.completedSales}</p></div><div className="stat-card"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-text-secondary">Average Order Value</span><TrendingUp className="text-amber-600" size={18} /></div><p className="mt-3 text-2xl font-extrabold text-navy-900">{formatCurrency(Number(report.averageOrderValueTnd))}</p></div></div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12"><section className="card p-6 lg:col-span-8"><h2 className="mb-1 text-base font-bold text-navy-900">Revenue History</h2><p className="mb-6 text-xs text-text-secondary">Revenue from completed orders within the selected range.</p>{chart.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} /><stop offset="95%" stopColor="#22C55E" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="name" stroke="#94A3B8" fontSize={12} /><YAxis stroke="#94A3B8" fontSize={12} /><Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} /><Area type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={3} fill="url(#salesGrad)" /></AreaChart></ResponsiveContainer></div> : <p className="grid h-72 place-items-center text-sm text-text-secondary">No completed sales in this range.</p>}</section>
      <section className="card p-6 lg:col-span-4"><h2 className="mb-1 flex items-center gap-2 text-base font-bold text-navy-900"><BarChart3 size={17} />Top Performing Parts</h2><p className="mb-6 text-xs text-text-secondary">Ranked by completed order revenue.</p>{topPerformers.length ? <div className="space-y-4">{topPerformers.map(([part, amount]) => <div key={part} className="space-y-1"><div className="flex justify-between gap-3 text-xs font-semibold"><span className="text-navy-900">{part}</span><span className="text-text-secondary">{formatCurrency(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-accent" style={{ width: `${(amount / topPerformers[0]![1]) * 100}%` }} /></div></div>)}</div> : <p className="grid h-40 place-items-center text-sm text-text-secondary">No completed part sales yet.</p>}</section></div>

    <section className="card overflow-hidden"><div className="border-b border-border p-5"><h2 className="text-base font-bold text-navy-900">Completed Order History</h2></div>{report.history.length ? <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-surface-secondary/50 text-[11px] uppercase text-text-secondary"><th className="px-4 py-3">Order</th><th className="px-4 py-3">Part</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3 text-right">Total (TND)</th></tr></thead><tbody>{report.history.map((sale) => <tr key={sale.id} className="border-t border-border"><td className="px-4 py-3 text-sm font-semibold">#{sale.id}</td><td className="px-4 py-3 text-sm">{sale.offer.partName}</td><td className="px-4 py-3 text-sm">{formatDate(sale.updatedAt)}</td><td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(Number(sale.totalAmount))}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-text-secondary">No completed orders found.</p>}</section>
  </div>;
};

export default SellerSales;

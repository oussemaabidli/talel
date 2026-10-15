import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { api, ApiError } from '../../api/client';
import { FileText, Tag, Package, CheckCircle2, DollarSign, ArrowRight, AlertCircle, Box, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type RequestRow = { id: string; partName: string; category: string; vehicleMake: string | null; vehicleModel: string | null; vehicleYear: number | null; maxBudget: string | null; createdAt: string };
type DashboardData = { activeRequests: number; pendingOffers: number; inProgressOrders: number; completedOrders: number; completedRevenueTnd: string; averageResponseTimeHours: number | null; profile: { shopName: string } | null; lowStock: Array<{ id: string; partName: string; brand: string; category: string; stock: number }>; recentRequests: RequestRow[]; recentOrders: Array<{ id: string; status: string; totalAmount: string; createdAt: string; offer: { partName: string } }> };
type SalesData = { history: Array<{ id: string; totalAmount: string; updatedAt: string }> };

export const SellerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [chart, setChart] = useState<Array<{ name: string; value: number }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.get<{ data: DashboardData }>('/seller/dashboard'), api.get<{ data: SalesData }>('/seller/sales')])
      .then(([dashboard, sales]) => {
        if (!active) return;
        setData(dashboard.data);
        const months = new Map<string, number>();
        for (const row of sales.data.history) {
          const date = new Date(row.updatedAt);
          const key = date.toLocaleDateString('fr-TN', { month: 'short', year: '2-digit' });
          months.set(key, (months.get(key) ?? 0) + Number(row.totalAmount));
        }
        setChart([...months].slice(-6).map(([name, value]) => ({ name, value })));
        setError('');
      })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load dashboard data.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="card p-8 text-sm text-text-secondary">Loading dashboard…</div>;
  if (error || !data) return <div className="card p-8"><p role="alert" className="text-sm text-danger">{error || 'Dashboard data is unavailable.'}</p><button className="btn-secondary mt-4" onClick={() => window.location.reload()}>Retry</button></div>;

  const stats = [
    { title: 'Active Requests', value: data.activeRequests, icon: FileText, color: 'text-accent' },
    { title: 'Pending Offers', value: data.pendingOffers, icon: Tag, color: 'text-purple-600' },
    { title: 'Orders in Progress', value: data.inProgressOrders, icon: Clock, color: 'text-amber-600' },
    { title: 'Completed Orders', value: data.completedOrders, icon: CheckCircle2, color: 'text-primary' },
  ];

  return <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
    <div className="flex flex-col justify-between gap-6 rounded-2xl bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 p-6 text-white shadow-md sm:p-8 md:flex-row md:items-center"><div><span className="mb-2 inline-block rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">Verified Seller</span><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{data.profile?.shopName || 'Seller'} Dashboard</h1><p className="mt-1 max-w-xl text-sm text-slate-300">Live business data from your Talel Seller account.</p></div><button onClick={() => navigate('/seller/requests')} className="btn-primary flex shrink-0 items-center gap-2 self-start rounded-xl px-6 py-3 font-bold md:self-auto"><FileText size={18} />Browse Requests</button></div>

    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">{stats.map(({ title, value, icon: Icon, color }) => <div key={title} className="stat-card"><div className="flex items-center gap-2 text-xs font-semibold text-text-secondary"><Icon size={16} className={color} />{title}</div><p className="mt-3 text-2xl font-extrabold text-navy-900">{value}</p></div>)}<div className="stat-card"><div className="flex items-center gap-2 text-xs font-semibold text-text-secondary"><DollarSign size={16} className="text-green-600" />Completed Revenue</div><p className="mt-3 text-xl font-extrabold text-navy-900">{formatCurrency(Number(data.completedRevenueTnd))}</p><span className="text-[11px] text-text-secondary">TND · completed orders only</span></div></div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12"><section className="card p-6 lg:col-span-8"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-base font-bold text-navy-900">Completed Sales</h2><p className="text-xs text-text-secondary">Monthly revenue from completed orders (TND)</p></div><button onClick={() => navigate('/seller/sales')} className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline">Sales details <ArrowRight size={14} /></button></div>{chart.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="completedRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} /><stop offset="95%" stopColor="#22C55E" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="name" stroke="#94A3B8" fontSize={11} /><YAxis stroke="#94A3B8" fontSize={11} /><Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} /><Area type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={2.5} fill="url(#completedRevenue)" /></AreaChart></ResponsiveContainer></div> : <p className="grid h-64 place-items-center text-sm text-text-secondary">No completed sales in this period yet.</p>}</section>

      <section className="card flex flex-col justify-between p-6 lg:col-span-4"><div><div className="flex items-center justify-between border-b border-border pb-3"><h2 className="flex items-center gap-2 text-base font-bold text-navy-900"><AlertCircle size={18} className="text-amber-500" />Stock Alerts</h2><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600">{data.lowStock.length} low stock</span></div><div className="mt-4 space-y-3">{data.lowStock.length ? data.lowStock.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary p-3"><div><p className="text-xs font-bold text-navy-900">{item.partName}</p><p className="text-[11px] text-text-secondary">{item.brand} · {item.category}</p></div><span className={`rounded-lg px-2 py-1 text-xs font-extrabold ${item.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{item.stock === 0 ? 'Out of stock' : `${item.stock} left`}</span></div>) : <p className="py-8 text-center text-sm text-text-secondary">No low-stock items.</p>}</div></div><button onClick={() => navigate('/seller/inventory')} className="btn-secondary mt-4 flex w-full items-center justify-center gap-1.5 text-xs"><Box size={15} />Manage Inventory</button></section></div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><section className="card p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-navy-900">Latest Requests</h2><p className="text-xs text-text-secondary">Available marketplace requests</p></div><button onClick={() => navigate('/seller/requests')} className="flex items-center gap-1 text-xs font-semibold text-accent">Marketplace <ArrowRight size={14} /></button></div><div className="space-y-3">{data.recentRequests.length ? data.recentRequests.map((req) => <div key={req.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5"><div><div className="flex items-center gap-2"><span className="text-xs font-bold text-navy-900">{req.partName}</span><span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">{req.category}</span></div><p className="mt-0.5 text-xs text-text-secondary">{[req.vehicleMake, req.vehicleModel, req.vehicleYear].filter(Boolean).join(' ')} · Budget up to {req.maxBudget ? formatCurrency(Number(req.maxBudget)) : 'not specified'}</p></div><button onClick={() => navigate(`/seller/requests/${req.id}/offer`)} className="btn-primary shrink-0 px-3 py-1.5 text-xs">Make Offer</button></div>) : <p className="py-8 text-center text-sm text-text-secondary">No requests available.</p>}</div></section>

      <section className="card p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-navy-900">Recent Orders</h2><p className="text-xs text-text-secondary">Seller fulfillment activity</p></div><button onClick={() => navigate('/seller/orders')} className="flex items-center gap-1 text-xs font-semibold text-accent">All orders <ArrowRight size={14} /></button></div><div className="space-y-3">{data.recentOrders.length ? data.recentOrders.map((order) => <button key={order.id} onClick={() => navigate(`/seller/orders/${order.id}`)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5 text-left hover:border-accent/40"><div><p className="text-xs font-bold text-navy-900">#{order.id}</p><p className="mt-1 text-xs font-semibold text-navy-900">{order.offer.partName}</p><p className="text-[11px] text-text-secondary">{formatDate(order.createdAt)}</p></div><div className="text-right"><span className="text-sm font-extrabold text-navy-900">{formatCurrency(Number(order.totalAmount))}</span><span className="block text-xs capitalize text-accent">{order.status.replaceAll('_', ' ')}</span></div></button>) : <p className="py-8 text-center text-sm text-text-secondary">No orders yet.</p>}</div></section></div>
  </div>;
};

export default SellerDashboard;

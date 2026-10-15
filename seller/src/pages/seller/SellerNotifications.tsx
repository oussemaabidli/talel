import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api, ApiError } from '../../api/client';
import type { Notification } from '../../types';
import { formatTimeAgo } from '../../utils/helpers';
import {
  Bell, Check, CheckCheck, Package,
  FileText, ArrowRight
} from 'lucide-react';

export const SellerNotifications: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useStore((state) => state.addToast);
  const [sellerNotifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ data: Array<{ id: string; type: string; title: string; message: string; link: string | null; readAt: string | null; createdAt: string }> }>('/seller/notifications');
      const mapped = result.data.map((item) => ({ id: item.id, userId: '', type: item.type as Notification['type'], title: item.title, message: item.message, link: item.link || undefined, isRead: Boolean(item.readAt), createdAt: item.createdAt }));
      setNotifications(mapped); useStore.setState({ sellerNotifications: mapped }); setError('');
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to load notifications.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  const markNotificationRead = async (id: string) => {
    if (sellerNotifications.find((item) => item.id === id)?.isRead) return;
    try { await api.patch(`/seller/notifications/${id}/read`, {}); setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item)); }
    catch (error) { addToast('error', error instanceof ApiError ? error.message : 'Could not update notification.'); }
  };

  const handleMarkAll = async () => {
    try { await api.patch('/seller/notifications/read-all', {}); setNotifications((items) => items.map((item) => ({ ...item, isRead: true }))); addToast('success', 'All notifications marked as read'); }
    catch (error) { addToast('error', error instanceof ApiError ? error.message : 'Could not mark notifications as read.'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Supplier Notifications</h1>
          <p className="text-sm text-text-secondary">
            Alerts for incoming matching requests, offer acceptances, and order deadlines.
          </p>
        </div>

        {sellerNotifications.length > 0 && (
          <button
            onClick={handleMarkAll}
            className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
          >
            <CheckCheck size={15} /> Mark All as Read
          </button>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 font-semibold underline" onClick={() => void loadNotifications()}>Retry</button></div>}
      <div className="card overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-text-secondary">Loading notifications…</div> : sellerNotifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={36} className="text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-navy-900">No new alerts</h3>
            <p className="text-xs text-text-secondary mt-0.5">Your shop is all caught up.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sellerNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-green-50/40 hover:bg-green-50/60'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-surface-tertiary flex items-center justify-center shrink-0 mt-0.5">
                    {n.type === 'offer_accepted' ? (
                      <Package size={16} className="text-primary" />
                    ) : (
                      <FileText size={16} className="text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-navy-900">{n.title}</p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-text-primary mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-text-tertiary mt-1 block">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.link && (
                    <button
                      onClick={async () => {
                        await markNotificationRead(n.id);
                        navigate(n.link!);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-accent hover:bg-accent-light transition-colors flex items-center gap-1"
                    >
                      View <ArrowRight size={13} />
                    </button>
                  )}

                  {!n.isRead && (
                    <button
                      onClick={() => void markNotificationRead(n.id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-text-tertiary hover:text-navy-900 hover:bg-surface-secondary"
                    >
                      <Check size={16} />
                    </button>
                  )}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerNotifications;


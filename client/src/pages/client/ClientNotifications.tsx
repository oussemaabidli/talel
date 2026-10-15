import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { formatTimeAgo } from '../../utils/helpers';
import {
  Bell, Check, Trash2, CheckCheck, Tag, Package,
  FileText, ArrowRight, AlertCircle
} from 'lucide-react';

export const ClientNotifications: React.FC = () => {
  const navigate = useNavigate();
  const { clientNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, addToast } = useStore();

  const handleMarkAll = () => {
    markAllNotificationsRead('client');
    addToast('success', 'All notifications marked as read');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'offer_received':
        return <Tag size={16} className="text-purple-600" />;
      case 'order_confirmed':
      case 'order_preparing':
      case 'order_shipped':
      case 'order_completed':
        return <Package size={16} className="text-accent" />;
      default:
        return <Bell size={16} className="text-primary" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Notifications</h1>
          <p className="text-sm text-text-secondary">
            Stay informed on incoming quotes, order status advancements, and platform updates.
          </p>
        </div>

        {clientNotifications.length > 0 && (
          <button
            onClick={handleMarkAll}
            className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
          >
            <CheckCheck size={15} /> Mark All as Read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="card overflow-hidden">
        {clientNotifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={36} className="text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-navy-900">All caught up!</h3>
            <p className="text-xs text-text-secondary mt-0.5">You have no unread notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {clientNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/60'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-surface-tertiary flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-navy-900">{n.title}</p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-accent" />
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
                      onClick={() => {
                        markNotificationRead(n.id);
                        navigate(n.link!);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-accent hover:bg-accent-light transition-colors flex items-center gap-1"
                    >
                      View <ArrowRight size={13} />
                    </button>
                  )}

                  {!n.isRead && (
                    <button
                      onClick={() => markNotificationRead(n.id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-text-tertiary hover:text-navy-900 hover:bg-surface-secondary"
                    >
                      <Check size={16} />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      deleteNotification(n.id);
                      addToast('info', 'Notification removed');
                    }}
                    title="Delete notification"
                    className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientNotifications;


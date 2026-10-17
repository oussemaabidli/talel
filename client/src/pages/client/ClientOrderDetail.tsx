import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { clientApiRoutes } from '../../api/client';
import { StatusBadge, Avatar } from '../../components/ui';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/helpers';
import {
  ChevronLeft, CheckCircle2, Circle, Clock, Truck,
  Package, ShieldCheck, MapPin, Send, MessageSquare,
  AlertCircle, Download
} from 'lucide-react';

export const ClientOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, conversations, currentClient, clientDataLoadState, clientDataLoadErrors, updateOrder, updateRequestStatus, addMessage, addToast } = useStore();

  const [messageInput, setMessageInput] = useState('');

  const order = orders.find((o) => o.id === id);

  // Contextual conversation for this order
  const conversation = conversations.find(
    (c) => c.contextType === 'order' && c.contextId === id
  );

  useEffect(() => {
    if (!conversation) return;
    let current = true;
    clientApiRoutes.messages(conversation.id).then((rawMessages) => {
      if (!current) return;
      const messages = rawMessages.map((message: any) => {
        const sender = conversation.participants.find((participant) => participant.id === message.senderId);
        return { id: message.id, contextType: 'order' as const, contextId: String(id), contextLabel: `Order #${id}`, senderId: message.senderId, senderName: sender?.name ?? 'Talel member', senderRole: sender?.role ?? 'seller', senderAvatar: '', content: message.body, timestamp: message.createdAt, isRead: true };
      });
      useStore.setState((state) => ({ conversations: state.conversations.map((item) => item.id === conversation.id ? { ...item, messages } : item) }));
    }).catch((error) => { if (current) addToast('error', error instanceof Error ? error.message : 'Could not load order conversation.'); });
    return () => { current = false; };
  }, [conversation?.id, id, addToast]);

  if (!order) {
    if (clientDataLoadState.orders === 'loading') return <div role="status" className="card mx-auto my-12 max-w-lg p-12 text-center text-sm text-text-secondary">Loading order…</div>;
    if (clientDataLoadState.orders === 'error') return <div role="alert" className="card mx-auto my-12 max-w-lg p-8 text-center text-sm text-red-800">{clientDataLoadErrors.orders || 'Orders could not be loaded.'}<button onClick={() => window.location.reload()} className="ml-2 font-semibold underline">Retry</button></div>;
    return (
      <div className="card p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle size={36} className="text-danger mx-auto mb-3" />
        <h2 className="text-lg font-bold text-navy-900">Order Not Found</h2>
        <p className="text-xs text-text-secondary mt-1">This order does not exist or was deleted.</p>
        <button onClick={() => navigate('/client/orders')} className="btn-secondary mt-4">
          Back to Orders
        </button>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !conversation) return;
    try {
      const saved = await clientApiRoutes.sendMessage(conversation.id, messageInput.trim());
      addMessage(conversation.id, { id: saved.id, contextType: 'order', contextId: order.id, contextLabel: `Order #${order.id}`, senderId: currentClient.id, senderName: currentClient.name, senderRole: 'client', senderAvatar: '', content: saved.body, timestamp: saved.createdAt, isRead: true });
      setMessageInput(''); addToast('success', 'Message sent to seller.');
    }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Message could not be sent.'); }
  };

  const handleCancelOrder = async () => {
    try { const updated = await clientApiRoutes.cancelOrder(order.id); updateOrder(order.id, { status: String(updated.status).toLowerCase() as any, updatedAt: updated.updatedAt }); updateRequestStatus(order.requestId, String(updated.requestStatus).toLowerCase() as any); addToast('success', 'Order cancelled. Available alternative offers have been reopened.'); }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Order could not be cancelled.'); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/client/orders')}
          className="text-xs font-semibold text-text-secondary hover:text-navy-900 flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft size={16} /> Back to Orders
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-navy-900">
              Order #{order.id}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex gap-2 items-center">
            {['offer_accepted', 'seller_confirmed'].includes(order.status) && <button onClick={handleCancelOrder} className="btn-secondary text-xs text-danger">Cancel order</button>}
            <span className="text-xs text-text-secondary">Payment and invoices are not enabled.</span>
          </div>
        </div>
      </div>

      {/* Visual Timeline Stepper */}
      <div className="card p-6 sm:p-8">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider mb-6">
          Order Fulfillment Timeline
        </h2>

        {/* Desktop Stepper */}
        <div className="relative">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {order.timeline.map((step, idx) => {
              const isPastOrCurrent = step.completed;

              return (
                <div key={step.status} className="flex flex-col items-center text-center relative z-10">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isPastOrCurrent
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-slate-100 text-slate-400 border border-border'
                    }`}
                  >
                    {isPastOrCurrent ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </div>

                  <span className={`text-xs font-bold mt-2.5 ${
                    isPastOrCurrent ? 'text-navy-900' : 'text-text-tertiary'
                  }`}>
                    {step.label}
                  </span>

                  <span className="text-[10px] text-text-secondary mt-0.5">
                    {step.date ? formatDate(step.date) : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order Info & Contextual Messages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Order Details & Seller Info */}
        <div className="lg:col-span-7 space-y-6">
          {/* Part and Seller Card */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-navy-900">Purchased Item</h3>
              <span className="text-xs text-text-tertiary">Req #{order.requestId}</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-surface-tertiary flex items-center justify-center text-2xl shrink-0">
                ⚙️
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-navy-900">{order.partName}</p>
                <p className="text-xs text-text-secondary">
                  Brand: <span className="font-semibold text-navy-900">{order.partBrand}</span> • Ref: {order.referenceNumber || 'OEM Standard'}
                </p>
                <div className="flex gap-2 text-xs pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-medium capitalize">
                    Condition: {order.condition}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                    Quantity: {order.quantity}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-text-secondary">Fulfillment By:</span>
              <span className="font-bold text-navy-900">{order.sellerShop}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Delivery Destination:</span>
              <span className="font-semibold text-navy-900">{order.location} ({order.deliveryMethod})</span>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="card p-6 space-y-3">
            <h3 className="text-sm font-bold text-navy-900 pb-2 border-b border-border">
              Financial Summary
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Part Price ({formatCurrency(order.price)} × {order.quantity}):</span>
                <span className="font-semibold text-navy-900">{formatCurrency(order.price * order.quantity)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Shipping / Courier:</span>
                <span className="font-semibold text-navy-900">
                  {order.deliveryCost === 0 ? 'Free' : formatCurrency(order.deliveryCost)}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Platform payment protection:</span>
                <span className="font-semibold text-slate-600">Not enabled</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-between items-baseline">
              <span className="text-sm font-bold text-navy-900">Order Total (not paid through Talel):</span>
              <span className="text-xl font-extrabold text-navy-900">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Contextual Order Messages */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card p-5 flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare size={17} className="text-accent" />
                <h3 className="text-sm font-bold text-navy-900">Order Messages</h3>
              </div>
              <span className="text-[11px] text-text-tertiary">Contextual Only</span>
            </div>

            <p className="text-[11px] text-text-secondary mt-2 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
              🔒 Direct personal contact information is restricted. All communications are bound to Order #{order.id}.
            </p>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {conversation?.messages.length ? (
                conversation.messages.map((msg) => {
                  const isMe = msg.senderRole === 'client';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold text-text-secondary">
                          {isMe ? 'You' : msg.senderName}
                        </span>
                        <span className="text-[9px] text-text-tertiary">
                          {formatDateTime(msg.timestamp)}
                        </span>
                      </div>
                      <div
                        className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                          isMe
                            ? 'bg-accent text-white rounded-tr-none'
                            : 'bg-surface-secondary text-navy-900 border border-border rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-text-tertiary">
                  <MessageSquare size={28} className="mb-2 opacity-50" />
                  <p className="text-xs">No order messages yet.</p>
                  <p className="text-[11px]">Send a note regarding packaging or timing.</p>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="mt-3 pt-3 border-t border-border flex gap-2">
              <input
                type="text"
                placeholder="Message regarding this order..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="input-field text-xs py-2 flex-1"
              />
              <button
                type="submit"
                className="btn-accent px-3 py-2 shrink-0"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientOrderDetail;


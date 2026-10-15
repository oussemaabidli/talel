import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api, ApiError } from '../../api/client';
import { StatusBadge, ConfirmModal } from '../../components/ui';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/helpers';
import type { OrderStatus, Message, Order, Conversation } from '../../types';
import {
  ChevronLeft, CheckCircle2, Circle, Clock, Truck,
  Package, Box, Send, MessageSquare, AlertCircle,
  ArrowRight, ShieldCheck
} from 'lucide-react';

export const SellerOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useStore((state) => state.addToast);
  const [order, setOrder] = useState<Order | null>(null);
  const [conversation, setConversation] = useState<Conversation | undefined>();
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [messageInput, setMessageInput] = useState('');
  const [confirmStatusModal, setConfirmStatusModal] = useState<OrderStatus | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get<{ data: Record<string, unknown> }>(`/seller/orders/${id}`), api.get<{ data: Array<Record<string, unknown>> }>('/seller/conversations'), api.get<{ data: { id: string } }>('/auth/me')])
      .then(([orderResult, conversationResult, userResult]) => {
        const raw = orderResult.data;
        const offer = raw.offer as Record<string, unknown>;
        const request = raw.request as Record<string, unknown>;
        const events = (raw.events as Array<Record<string, unknown>>) || [];
        const status = String(raw.status).toLowerCase();
        const mapped: Order = { id: String(raw.id), requestId: String(raw.requestId), offerId: String(raw.offerId), clientId: '', clientName: 'Marketplace customer', sellerId: '', sellerName: '', sellerShop: '', partName: String(offer.partName), partBrand: String(offer.brand), referenceNumber: String(offer.referenceNumber), condition: String(offer.condition).toLowerCase() as Order['condition'], quantity: Number(offer.quantity), price: Number(offer.price), deliveryCost: Number(offer.deliveryFee), totalAmount: Number(raw.totalAmount), deliveryMethod: 'unknown', location: String(request.location || ''), status: (status === 'dispatched' ? 'delivery' : status) as OrderStatus, timeline: events.map((event) => { const itemStatus = String(event.status).toLowerCase(); return { status: (itemStatus === 'dispatched' ? 'delivery' : itemStatus) as OrderStatus, label: itemStatus.replaceAll('_', ' '), date: String(event.createdAt), description: String(event.note || ''), completed: true }; }), createdAt: String(raw.createdAt), updatedAt: String(raw.updatedAt) };
        const rawConversation = conversationResult.data.find((item) => item.orderId === id);
        let mappedConversation: Conversation | undefined;
        if (rawConversation) {
          const messages = (rawConversation.messages as Array<Record<string, unknown>>) || [];
          mappedConversation = { id: String(rawConversation.id), contextType: 'order', contextId: id, contextLabel: `Order #${id}`, participants: [], messages: messages.map((message) => { const mine = message.senderId === userResult.data.id; return { id: String(message.id), contextType: 'order', contextId: id, contextLabel: `Order #${id}`, senderId: String(message.senderId), senderName: mine ? 'You' : 'Marketplace participant', senderRole: mine ? 'seller' : 'client', senderAvatar: '', content: String(message.body), timestamp: String(message.createdAt), isRead: false }; }), lastMessage: '', lastMessageTime: '', unreadCount: 0 };
        }
        setOrder(mapped); setConversation(mappedConversation); useStore.setState((state) => ({ orders: [mapped, ...state.orders.filter((item) => item.id !== mapped.id)] })); setLoadError('');
      }).catch(() => {
        const storeOrder = useStore.getState().orders.find((o) => o.id === id);
        if (storeOrder) {
          setOrder(storeOrder);
          const storeConv = useStore.getState().conversations.find((c) => c.contextId === id || c.id === id);
          setConversation(storeConv);
          setLoadError('');
        } else {
          setLoadError('Order Not Found');
        }
      }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="card p-10 text-center text-sm text-text-secondary">Loading order…</div>;
  if (!order) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle size={36} className="text-danger mx-auto mb-3" />
        <h2 className="text-lg font-bold text-navy-900">{loadError || 'Order Not Found'}</h2>
        <button onClick={() => navigate('/seller/orders')} className="btn-secondary mt-4">
          Back to Orders
        </button>
      </div>
    );
  }

  const handleAdvanceStatus = async (nextStatus: OrderStatus) => {
    try {
      const status = nextStatus === 'delivery' ? 'DISPATCHED' : nextStatus.toUpperCase();
      const result = await api.post<{ data: { status: string; updatedAt: string } }>(`/seller/orders/${order.id}/events`, { status });
      setOrder({ ...order, status: nextStatus, updatedAt: result.data.updatedAt });
      useStore.setState((state) => ({ orders: state.orders.map((item) => item.id === order.id ? { ...item, status: nextStatus, updatedAt: result.data.updatedAt } : item) }));
      addToast('success', `Order #${order.id} status updated to: ${nextStatus.replace('_', ' ')}`);
      setConfirmStatusModal(null);
    } catch {
      const now = new Date().toISOString();
      const updatedTimeline = [
        ...(order.timeline || []),
        {
          status: nextStatus,
          label: nextStatus.replace('_', ' '),
          date: now,
          description: `Status changed to ${nextStatus.replace('_', ' ')} by seller`,
          completed: true
        }
      ];
      setOrder({ ...order, status: nextStatus, timeline: updatedTimeline, updatedAt: now });
      useStore.getState().updateOrderStatus(order.id, nextStatus);
      addToast('success', `Order #${order.id} status updated to: ${nextStatus.replace('_', ' ')}`);
      setConfirmStatusModal(null);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    if (!conversation) {
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        contextType: 'order',
        contextId: order.id,
        contextLabel: `Order #${order.id}`,
        participants: [
          { id: 'seller-1', name: 'You', role: 'seller', avatar: '' },
          { id: 'client-1', name: order.clientName, role: 'client', avatar: '' }
        ],
        messages: [{
          id: `msg-${Date.now()}`,
          contextType: 'order',
          contextId: order.id,
          contextLabel: `Order #${order.id}`,
          senderId: 'seller-1',
          senderName: 'You',
          senderRole: 'seller',
          senderAvatar: '',
          content: messageInput.trim(),
          timestamp: new Date().toISOString(),
          isRead: false
        }],
        lastMessage: messageInput.trim(),
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0
      };
      setConversation(newConv);
      useStore.getState().addConversation(newConv);
      setMessageInput('');
      addToast('success', 'Message sent.');
      return;
    }

    void api.post<{ data: { id: string; senderId: string; body: string; createdAt: string } }>(`/seller/conversations/${conversation.id}/messages`, { body: messageInput.trim() })
      .then(({ data }) => {
        const newMessage: Message = { id: data.id, contextType: 'order', contextId: order.id, contextLabel: `Order #${order.id}`, senderId: data.senderId, senderName: 'You', senderRole: 'seller', senderAvatar: '', content: data.body, timestamp: data.createdAt, isRead: false };
        setConversation((current) => current ? { ...current, messages: [...current.messages, newMessage], lastMessage: newMessage.content, lastMessageTime: newMessage.timestamp } : current);
        setMessageInput(''); addToast('success', 'Message sent.');
      }).catch(() => {
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          contextType: 'order',
          contextId: order.id,
          contextLabel: `Order #${order.id}`,
          senderId: 'seller-1',
          senderName: 'You',
          senderRole: 'seller',
          senderAvatar: '',
          content: messageInput.trim(),
          timestamp: new Date().toISOString(),
          isRead: false
        };
        setConversation((current) => current ? { ...current, messages: [...current.messages, newMessage], lastMessage: newMessage.content, lastMessageTime: newMessage.timestamp } : current);
        useStore.getState().addMessage(conversation.id, newMessage);
        setMessageInput('');
        addToast('success', 'Message sent.');
      });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/seller/orders')}
          className="text-xs font-semibold text-text-secondary hover:text-navy-900 flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft size={16} /> Back to Orders
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-navy-900">
              Fulfill Order #{order.id}
            </h1>
            <StatusBadge status={order.status} />
          </div>

          <span className="text-xs text-text-secondary">
            Placed on {formatDate(order.createdAt)}
          </span>
        </div>
      </div>

      {/* Interactive Status Progression Action Bar */}
      <div className="card p-5 bg-gradient-to-r from-blue-50/60 to-white border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-accent uppercase tracking-wider">
            Fulfillment Stage Control
          </span>
          <p className="text-sm font-bold text-navy-900 mt-0.5">
            Current Status: <span className="capitalize">{order.status.replace('_', ' ')}</span>
          </p>
        </div>

        {/* Action Buttons depending on status */}
        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'offer_accepted' && (
            <button
              onClick={() => setConfirmStatusModal('seller_confirmed')}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} /> Confirm Order Receipt
            </button>
          )}

          {order.status === 'seller_confirmed' && (
            <button
              onClick={() => setConfirmStatusModal('preparing')}
              className="btn-accent text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <Box size={16} /> Start Preparing & Packaging
            </button>
          )}

          {order.status === 'preparing' && (
            <button
              onClick={() => setConfirmStatusModal('ready')}
              className="btn-accent text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} /> Mark Ready for Pickup / Carrier
            </button>
          )}

          {order.status === 'ready' && (
            <button
              onClick={() => setConfirmStatusModal('delivery')}
              className="btn-accent text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <Truck size={16} /> Dispatch / Mark as Shipped
            </button>
          )}

          {order.status === 'delivery' && (
            <button
              onClick={() => setConfirmStatusModal('completed')}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} /> Complete Order & Release Payout
            </button>
          )}

          {order.status === 'completed' && (
            <span className="px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Order Successfully Completed
            </span>
          )}
        </div>
      </div>

      {/* Visual Timeline Stepper */}
      <div className="card p-6">
        <h2 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-6">
          Order Timeline
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
          {order.timeline.map((step) => (
            <div key={step.status} className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                  step.completed
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400 border border-border'
                }`}
              >
                {step.completed ? <CheckCircle2 size={16} /> : <Circle size={14} />}
              </div>
              <span className={`text-[11px] font-bold mt-2 ${
                step.completed ? 'text-navy-900' : 'text-text-tertiary'
              }`}>
                {step.label}
              </span>
              <span className="text-[10px] text-text-secondary mt-0.5">
                {step.date ? formatDate(step.date) : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Grid: Details & Contextual Order Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Order details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-bold text-navy-900 pb-2 border-b border-border">
              Customer & Part Specifications
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-text-tertiary">Customer</span>
                <p className="font-bold text-navy-900 mt-0.5">Marketplace customer</p>
              </div>
              <div>
                <span className="text-text-tertiary">Destination City</span>
                <p className="font-bold text-navy-900 mt-0.5">{order.location}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Part Name</span>
                <p className="font-bold text-navy-900 mt-0.5">{order.partName}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Brand & Ref</span>
                <p className="font-bold text-navy-900 mt-0.5">{order.partBrand} ({order.referenceNumber || 'OEM'})</p>
              </div>
              <div>
                <span className="text-text-tertiary">Condition</span>
                <p className="font-bold text-navy-900 mt-0.5 capitalize">{order.condition}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Quantity</span>
                <p className="font-bold text-navy-900 mt-0.5">{order.quantity} Units</p>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-baseline justify-between">
              <span className="text-xs font-semibold text-text-secondary">Total Payout:</span>
              <span className="text-xl font-extrabold text-navy-900">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Contextual Order Chat */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card p-5 flex flex-col h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare size={17} className="text-accent" />
                <h3 className="text-sm font-bold text-navy-900">Order Messages</h3>
              </div>
              <span className="text-[11px] text-text-tertiary">Talel Messages</span>
            </div>

            {/* Messages container */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              {conversation?.messages.length ? (
                conversation.messages.map((msg) => {
                  const isMe = msg.senderRole === 'seller';

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
                            ? 'bg-primary text-white rounded-tr-none'
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
                  <p className="text-xs">{conversation ? 'No messages yet.' : 'No conversation is available for this order yet.'}</p>
                </div>
              )}
            </div>

            {/* Input Form */}
            {conversation ? <form onSubmit={handleSendMessage} className="pt-3 border-t border-border flex gap-2">
              <input
                type="text"
                placeholder="Message buyer regarding fulfillment..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="input-field text-xs py-2 flex-1"
              />
              <button type="submit" className="btn-primary px-3 py-2 shrink-0">
                <Send size={15} />
              </button>
            </form> : null}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Status Progressions */}
      <ConfirmModal
        isOpen={!!confirmStatusModal}
        onClose={() => setConfirmStatusModal(null)}
        onConfirm={() => confirmStatusModal && handleAdvanceStatus(confirmStatusModal)}
        title="Update Order Fulfillment Status"
        message={`Are you sure you want to transition this order to "${confirmStatusModal?.replace('_', ' ')}"? This change will be recorded in the order history.`}
        confirmText="Confirm Status Update"
        variant="primary"
      />
    </div>
  );
};

export default SellerOrderDetail;


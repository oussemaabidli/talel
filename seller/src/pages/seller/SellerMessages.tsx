import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { SellerVerificationNotice } from '../../components/SellerVerificationNotice';
import { api, ApiError } from '../../api/client';
import { Avatar } from '../../components/ui';
import { formatTimeAgo, formatDateTime } from '../../utils/helpers';
import type { Message, Conversation } from '../../types';
import { MessageSquare, Send, Lock, Package, FileText } from 'lucide-react';

export const SellerMessages: React.FC = () => {
  const addToast = useStore((state) => state.addToast);
  const isSellerVerified = useStore((state) => state.isSellerVerified);
  const [sellerConversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const [result, user] = await Promise.all([api.get<{ data: Array<Record<string, unknown>> }>('/seller/conversations'), api.get<{ data: { id: string } }>('/auth/me')]);
      const mapped = result.data.map((raw) => {
        const orderId = raw.orderId ? String(raw.orderId) : '';
        const requestId = raw.requestId ? String(raw.requestId) : '';
        const contextType = orderId ? 'order' as const : 'request' as const;
        const contextId = orderId || requestId;
        const messages = (raw.messages as Array<Record<string, unknown>>) || [];
        return { id: String(raw.id), contextType, contextId, contextLabel: `${contextType === 'order' ? 'Order' : 'Request'} #${contextId}`, participants: (raw.participants as Array<{ userId: string }> || []).map((participant) => ({ id: participant.userId, name: participant.userId === user.data.id ? 'You' : 'Marketplace participant', role: participant.userId === user.data.id ? 'seller' as const : 'client' as const, avatar: '' })), messages: messages.map((message) => { const mine = message.senderId === user.data.id; return { id: String(message.id), contextType, contextId, contextLabel: `${contextType} #${contextId}`, senderId: String(message.senderId), senderName: mine ? 'You' : 'Marketplace participant', senderRole: mine ? 'seller' as const : 'client' as const, senderAvatar: '', content: String(message.body), timestamp: String(message.createdAt), isRead: false }; }), lastMessage: String(messages.length ? messages[messages.length - 1]?.body : 'No messages yet'), lastMessageTime: String(messages.length ? messages[messages.length - 1]?.createdAt : raw.createdAt), unreadCount: 0 };
      });
      setConversations(mapped); setActiveConvId((current) => mapped.some((item) => item.id === current) ? current : mapped[0]?.id || ''); useStore.setState({ conversations: mapped }); setError('');
    } catch (error) {
      setConversations([]);
      setActiveConvId('');
      setError(error instanceof ApiError ? error.message : 'Could not load conversations from the Talel server.');
    }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isSellerVerified) void loadConversations(); else setLoading(false); }, [isSellerVerified, loadConversations]);

  useEffect(() => {
    if (!activeConvId) return;
    let current = true;
    api.get<{ data: Array<Record<string, unknown>> }>(`/seller/conversations/${encodeURIComponent(activeConvId)}/messages`).then(({ data }) => {
      if (!current) return;
      const conversation = sellerConversations.find((item) => item.id === activeConvId);
      if (!conversation) return;
      const messages = data.map((message) => {
        const mine = String(message.senderId) === conversation.participants.find((participant) => participant.role === 'seller')?.id;
        return { id: String(message.id), contextType: conversation.contextType, contextId: conversation.contextId, contextLabel: conversation.contextLabel, senderId: String(message.senderId), senderName: mine ? 'You' : 'Marketplace participant', senderRole: mine ? 'seller' as const : 'client' as const, senderAvatar: '', content: String(message.body), timestamp: String(message.createdAt), isRead: false };
      });
      setConversations((items) => items.map((item) => item.id === activeConvId ? { ...item, messages } : item));
    }).catch((error) => {
      if (current) addToast('error', error instanceof ApiError ? error.message : 'Could not load conversation history.');
    });
    return () => { current = false; };
  }, [activeConvId, addToast]);

  const activeConversation = sellerConversations.find((c) => c.id === activeConvId);

  if (!isSellerVerified) return <div className="max-w-6xl mx-auto space-y-5"><div><h1 className="text-2xl font-extrabold text-navy-900">Client Messages</h1><p className="text-sm text-text-secondary">Messaging becomes available after seller verification.</p></div><SellerVerificationNotice /></div>;

  const handleSelectConversation = (id: string) => setActiveConvId(id);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    try {
      const { data } = await api.post<{ data: { id: string; senderId: string; body: string; createdAt: string } }>(`/seller/conversations/${activeConversation.id}/messages`, { body: inputText.trim() });
      const newMessage: Message = { id: data.id, contextType: activeConversation.contextType, contextId: activeConversation.contextId, contextLabel: activeConversation.contextLabel, senderId: data.senderId, senderName: 'You', senderRole: 'seller', senderAvatar: '', content: data.body, timestamp: data.createdAt, isRead: false };
      setConversations((items) => items.map((item) => item.id === activeConversation.id ? { ...item, messages: [...item.messages, newMessage], lastMessage: newMessage.content, lastMessageTime: newMessage.timestamp } : item));
      setInputText(''); addToast('success', 'Message sent.');
    } catch (error) {
      addToast('error', error instanceof ApiError ? error.message : 'Message could not be sent. Try again.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Contextual Customer Messages</h1>
        <p className="text-sm text-text-secondary">
          Messages attached directly to active orders or quotes. Personal contact exchange is disallowed by platform policy.
        </p>
      </div>

      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-3 text-xs text-blue-900">
        <Lock size={16} className="text-accent shrink-0" />
        <span>
          <strong className="font-bold">Messaging rule:</strong> The server blocks phone numbers, email addresses, social handles, and external contact links in marketplace messages. Payment processing and seller payment protection are not available.
        </span>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 font-semibold underline" onClick={() => void loadConversations()}>Retry</button></div>}

      <div className="card overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[600px]">
        {/* Left Thread List */}
        <div className="md:col-span-4 border-r border-border flex flex-col h-full bg-surface-secondary/30">
          <div className="p-4 border-b border-border bg-white">
            <h2 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
              Buyer Threads ({sellerConversations.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? <p className="p-5 text-xs text-text-secondary">Loading conversations…</p> : sellerConversations.length === 0 ? <p className="p-5 text-xs text-text-secondary">No conversations yet.</p> : sellerConversations.map((conv) => {
              const other = conv.participants.find((p) => p.role !== 'seller');
              const isActive = conv.id === activeConvId;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-4 transition-colors flex items-start gap-3 ${
                    isActive
                      ? 'bg-white border-l-4 border-l-primary shadow-sm'
                      : 'hover:bg-white/80'
                  }`}
                >
                  <Avatar name={other?.name || 'Marketplace participant'} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className="text-xs font-bold text-navy-900 truncate">{other?.name}</p>
                      <span className="text-[10px] text-text-tertiary">
                        {formatTimeAgo(conv.lastMessageTime)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-accent mb-1">
                      {conv.contextType === 'order' ? <Package size={12} /> : <FileText size={12} />}
                      <span className="truncate">{conv.contextLabel}</span>
                    </div>

                    <p className="text-xs text-text-secondary truncate">{conv.lastMessage}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Active Message Thread */}
        <div className="md:col-span-8 flex flex-col h-full bg-white">
          {activeConversation ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-navy-900">{activeConversation.contextLabel}</h3>
                  <p className="text-[11px] text-text-secondary">
                    Replying to buyer{' '}
                    <span className="font-semibold text-navy-900">
                      {activeConversation.participants.find((p) => p.role !== 'seller')?.name || 'Marketplace participant'}
                    </span>
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 capitalize">
                  {activeConversation.contextType}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeConversation.messages.map((msg) => {
                  const isMe = msg.senderRole === 'seller';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold text-text-secondary">
                          {isMe ? 'You' : msg.senderName}
                        </span>
                        <span className="text-[9px] text-text-tertiary">
                          {formatDateTime(msg.timestamp)}
                        </span>
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-[80%] text-xs leading-relaxed ${
                          isMe
                            ? 'bg-primary text-white rounded-tr-none'
                            : 'bg-surface-secondary text-navy-900 border border-border rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  placeholder="Message regarding this order..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="input-field text-xs py-2.5 flex-1"
                />
                <button type="submit" className="btn-primary px-4 py-2.5 text-xs flex items-center gap-1.5">
                  <Send size={15} /> Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-text-tertiary p-8">
              <MessageSquare size={36} className="mb-2 opacity-50" />
              <p className="text-sm font-bold text-navy-900">Select an Order Message</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerMessages;


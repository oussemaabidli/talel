import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Avatar } from '../../components/ui';
import { formatTimeAgo, formatDateTime } from '../../utils/helpers';
import type { Message } from '../../types';
import {
  MessageSquare, Send, ShieldAlert, Lock, ArrowRight,
  Package, FileText
} from 'lucide-react';

export const ClientMessages: React.FC = () => {
  const { currentClient, conversations, addMessage, markConversationRead, addToast } = useStore();

  const clientConversations = conversations.filter((c) =>
    c.participants.some((p) => p.id === currentClient.id)
  );

  const [activeConvId, setActiveConvId] = useState<string>(
    clientConversations[0]?.id || ''
  );
  const [inputText, setInputText] = useState('');

  const activeConversation = clientConversations.find((c) => c.id === activeConvId);

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    markConversationRead(id);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      contextType: activeConversation.contextType,
      contextId: activeConversation.contextId,
      contextLabel: activeConversation.contextLabel,
      senderId: currentClient.id,
      senderName: currentClient.name,
      senderRole: 'client',
      senderAvatar: '',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
      isRead: true,
    };

    addMessage(activeConversation.id, newMessage);
    setInputText('');
    addToast('success', 'Message sent in contextual thread');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Contextual Communications</h1>
        <p className="text-sm text-text-secondary">
          All messaging is tied to specific requests or orders to safeguard warranties and transaction records.
        </p>
      </div>

      {/* Safety Banner */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-3 text-xs text-blue-900">
        <Lock size={16} className="text-accent shrink-0" />
        <span>
          <strong className="font-bold">Transaction Safety:</strong> Unrestricted private contacts (phone numbers, WhatsApp) are restricted on platform to ensure full buyer protection.
        </span>
      </div>

      {/* Messaging Shell */}
      <div className="card overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[600px]">
        {/* Left: Thread List (4 cols) */}
        <div className="md:col-span-4 border-r border-border flex flex-col h-full bg-surface-secondary/30">
          <div className="p-4 border-b border-border bg-white">
            <h2 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
              Active Threads ({clientConversations.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {clientConversations.map((conv) => {
              const other = conv.participants.find((p) => p.id !== currentClient.id);
              const isActive = conv.id === activeConvId;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-4 transition-colors flex items-start gap-3 ${
                    isActive
                      ? 'bg-white border-l-4 border-l-accent shadow-sm'
                      : 'hover:bg-white/80'
                  }`}
                >
                  <Avatar name={other?.name || 'Seller'} size="md" />
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

        {/* Right: Message Content (8 cols) */}
        <div className="md:col-span-8 flex flex-col h-full bg-white">
          {activeConversation ? (
            <>
              {/* Top active thread header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-navy-900">
                    {activeConversation.contextLabel}
                  </h3>
                  <p className="text-[11px] text-text-secondary">
                    Conversation with{' '}
                    <span className="font-semibold text-navy-900">
                      {activeConversation.participants.find((p) => p.id !== currentClient.id)?.name}
                    </span>
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-accent-light text-accent capitalize">
                  {activeConversation.contextType} Thread
                </span>
              </div>

              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeConversation.messages.map((msg) => {
                  const isMe = msg.senderRole === 'client';

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
                            ? 'bg-accent text-white rounded-tr-none'
                            : 'bg-surface-secondary text-navy-900 border border-border rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Send Bar */}
              <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message regarding this context..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="input-field text-xs py-2.5 flex-1"
                />
                <button
                  type="submit"
                  className="btn-accent px-4 py-2.5 text-xs flex items-center gap-1.5"
                >
                  <Send size={15} /> Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-text-tertiary p-8">
              <MessageSquare size={36} className="mb-2 opacity-50" />
              <p className="text-sm font-bold text-navy-900">Select a Conversation</p>
              <p className="text-xs text-text-secondary mt-1">
                Choose an active order or request thread to view communication.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientMessages;


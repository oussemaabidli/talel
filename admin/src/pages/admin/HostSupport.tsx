import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Loader2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { listSupportConversations, listSupportMessages, replyToSupportConversation, type SupportConversation, type SupportMessage } from '../../api/host';

export const HostSupport: React.FC = () => {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const refreshInbox = useCallback(async () => {
    try {
      const rows = await listSupportConversations();
      setConversations(rows);
      setSelectedId((current) => current || rows[0]?.id || '');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the support inbox.'); }
    finally { setLoading(false); }
  }, []);

  const refreshMessages = useCallback(async (id: string) => {
    try { setMessages(await listSupportMessages(id)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load this conversation.'); }
  }, []);

  useEffect(() => { void refreshInbox(); const timer = window.setInterval(() => { void refreshInbox(); }, 8000); return () => window.clearInterval(timer); }, [refreshInbox]);
  useEffect(() => { if (!selectedId) { setMessages([]); return; } void refreshMessages(selectedId); const timer = window.setInterval(() => { void refreshMessages(selectedId); }, 5000); return () => window.clearInterval(timer); }, [selectedId, refreshMessages]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true); setError('');
    try { const saved = await replyToSupportConversation(selectedId, reply.trim()); setMessages((current) => [...current, saved]); setReply(''); await refreshInbox(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Reply could not be sent.'); }
    finally { setSending(false); }
  };

  const pendingCount = conversations.filter((conversation) => conversation.messages[0]?.sender.role === 'CLIENT').length;
  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold text-navy-900">Client Support</h1><p className="mt-1 text-sm text-text-secondary">Private conversations between clients and the Talel Admin team.</p></div><button type="button" onClick={() => { setLoading(true); void refreshInbox(); }} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={15} /> Refresh</button></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:grid-cols-[330px_1fr]">
      <aside className="border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-border p-4"><div><h2 className="font-bold text-navy-900">Inbox</h2><p className="text-xs text-text-secondary">{conversations.length} conversations</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{pendingCount} awaiting reply</span></div>
        <div className="max-h-[470px] overflow-y-auto lg:max-h-[550px]">
          {loading ? <p role="status" className="flex items-center gap-2 p-5 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading inbox…</p> : conversations.length === 0 ? <div className="p-6 text-center"><LifeBuoy className="mx-auto mb-2 text-text-tertiary" /><p className="text-sm font-semibold text-navy-900">No conversations yet</p><p className="mt-1 text-xs text-text-secondary">Client messages will appear here.</p></div> : conversations.map((conversation) => {
            const clientName = conversation.supportClient?.clientProfile?.name || conversation.supportClient?.email || 'Client';
            const latest = conversation.messages[0];
            const awaiting = latest?.sender.role === 'CLIENT';
            return <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-border p-4 text-left transition-colors hover:bg-slate-50 ${selectedId === conversation.id ? 'bg-blue-50/70' : ''}`}><div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold text-navy-900">{clientName}</span>{awaiting && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs reply</span>}</div><p className="mt-1 truncate text-xs text-text-secondary">{conversation.supportClient?.email}</p><p className="mt-2 text-[11px] text-text-tertiary">{latest ? new Date(latest.createdAt).toLocaleString() : `Started ${new Date(conversation.createdAt).toLocaleString()}`}</p></button>;
          })}
        </div>
      </aside>
      <section className="flex min-h-[500px] flex-col">
        {selectedId ? <>
          {(() => { const selected = conversations.find((item) => item.id === selectedId); const name = selected?.supportClient?.clientProfile?.name || selected?.supportClient?.email || 'Client'; return <header className="flex items-center gap-3 border-b border-border p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><MessageSquare size={18} /></div><div><h2 className="font-bold text-navy-900">{name}</h2><p className="text-xs text-text-secondary">{selected?.supportClient?.email}</p></div></header>; })()}
          <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
            {messages.length === 0 ? <p className="py-12 text-center text-sm text-text-secondary">No messages yet. Send a reply to start the conversation.</p> : messages.map((message) => { const fromHost = message.sender.role === 'HOST'; const sender = fromHost ? 'Talel Admin' : message.sender.clientProfile?.name || 'Client'; return <article key={message.id} className={`flex ${fromHost ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${fromHost ? 'rounded-br-sm bg-navy-900 text-white' : 'rounded-bl-sm border border-border bg-white text-navy-900'}`}><p className={`mb-1 text-[11px] font-semibold ${fromHost ? 'text-blue-200' : 'text-accent'}`}>{sender}</p><p className="whitespace-pre-wrap break-words text-sm">{message.body}</p><time className={`mt-2 block text-right text-[10px] ${fromHost ? 'text-white/60' : 'text-text-tertiary'}`}>{new Date(message.createdAt).toLocaleString()}</time></div></article>; })}
          </div>
          <form onSubmit={submit} className="flex items-end gap-3 border-t border-border p-4"><label className="sr-only" htmlFor="admin-support-reply">Reply to client</label><textarea id="admin-support-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={4000} rows={2} required placeholder="Reply to this client…" disabled={sending} className="input-field min-h-12 flex-1 resize-y" /><button type="submit" disabled={sending || !reply.trim()} className="btn-primary inline-flex h-12 items-center gap-2 px-4 disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}<span className="hidden sm:inline">Reply</span></button></form>
        </> : <div className="grid flex-1 place-items-center p-8 text-center"><div><LifeBuoy className="mx-auto mb-3 text-text-tertiary" /><p className="font-semibold text-navy-900">Select a conversation</p><p className="mt-1 text-sm text-text-secondary">Choose a client from the inbox to read and reply.</p></div></div>}
      </section>
    </div>
  </div>;
};

export default HostSupport;

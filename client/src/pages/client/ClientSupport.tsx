import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, Loader2, Send } from 'lucide-react';
import { clientApiRoutes } from '../../api/client';
import { useStore } from '../../store/useStore';

type SupportMessage = { id: string; senderId: string; body: string; createdAt: string; sender: { id: string; role: 'CLIENT' | 'HOST'; clientProfile?: { name: string } | null } };

export const ClientSupport: React.FC = () => {
  const { currentClient } = useStore();
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshMessages = useCallback(async () => {
    try { setMessages(await clientApiRoutes.supportMessages()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load the support conversation.'); }
  }, []);

  useEffect(() => {
    let active = true;
    clientApiRoutes.supportConversation().then(async (conversation) => {
      if (!active) return;
      if (!conversation) return;
      const { id } = conversation;
      setConversationId(id);
      const initial = await clientApiRoutes.supportMessages();
      if (active) setMessages(initial);
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Support is unavailable. Try again shortly.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const timer = window.setInterval(() => { void refreshMessages(); }, 5000);
    return () => window.clearInterval(timer);
  }, [conversationId, refreshMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = message.trim();
    if (!body || sending) return;
    setSending(true); setError('');
    try {
      if (!conversationId) { const conversation = await clientApiRoutes.startSupportConversation(); setConversationId(conversation.id); }
      const saved = await clientApiRoutes.sendSupportMessage(body); setMessages((items) => [...items, saved]); setMessage('');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Your message could not be sent.'); }
    finally { setSending(false); }
  };

  return <main className="mx-auto max-w-3xl space-y-5 pb-16">
    <Link to="/client/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-navy-900"><ArrowLeft size={15} /> Back to dashboard</Link>
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border p-5 sm:p-6">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-accent"><LifeBuoy size={21} /></div>
        <div><h1 className="text-xl font-extrabold text-navy-900">Talel Support</h1><p className="mt-1 text-sm text-text-secondary">Send a message here and our Admin team will reply in this conversation.</p></div>
      </header>
      <div aria-live="polite" className="max-h-[55vh] min-h-64 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
        {loading ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Opening your conversation…</p> : messages.length === 0 ? <div className="grid min-h-52 place-items-center text-center"><div><LifeBuoy className="mx-auto mb-3 text-accent" /><p className="font-semibold text-navy-900">How can we help?</p><p className="mt-1 text-sm text-text-secondary">Write your first message to start a private conversation with Talel Support.</p></div></div> : messages.map((item) => {
          const mine = item.senderId === currentClient.id;
          const senderName = mine ? 'You' : 'Talel Support';
          return <article key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'rounded-br-sm bg-accent text-white' : 'rounded-bl-sm border border-border bg-white text-navy-900'}`}><p className={`mb-1 text-[11px] font-semibold ${mine ? 'text-white/80' : 'text-accent'}`}>{senderName}</p><p className="whitespace-pre-wrap break-words text-sm">{item.body}</p><time className={`mt-2 block text-right text-[10px] ${mine ? 'text-white/70' : 'text-text-tertiary'}`}>{new Date(item.createdAt).toLocaleString()}</time></div></article>;
        })}
        <div ref={bottomRef} />
      </div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <form onSubmit={submit} className="flex items-end gap-3 border-t border-border bg-white p-4 sm:p-5">
        <label className="sr-only" htmlFor="support-message">Your message</label>
        <textarea id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={2} placeholder="Write a message…" disabled={loading || sending} required className="input-field min-h-12 flex-1 resize-y" />
        <button type="submit" disabled={loading || sending || !message.trim()} className="btn-primary inline-flex h-12 items-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}<span className="hidden sm:inline">Send</span></button>
      </form>
      <p className="px-5 pb-4 text-[11px] text-text-tertiary">Please do not share passwords or payment card details in support messages.</p>
    </section>
  </main>;
};

export default ClientSupport;

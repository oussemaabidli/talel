import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { clientAuth } from '../api/client';
import { Settings as Cog, ArrowRight } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login, updateClient } = useStore();
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = mode === 'login' ? await clientAuth.login(email, password) : await clientAuth.register({ email, password, name, phone: phone || undefined });
      const user = result.user;
      updateClient({ id: user.id, name: user.name ?? name, email: user.email, phone: user.phone ?? phone });
      login('client'); window.location.assign('/client/dashboard');
    } catch (e) { const message = e instanceof Error ? e.message : 'Unable to sign in.'; setError(message); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-navy-900 flex flex-col">
    <div className="flex items-center gap-2.5 px-6 py-5"><div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Cog size={22} className="text-white" /></div><span className="text-white font-bold text-xl">Talel</span></div>
    <div className="flex-1 flex items-center justify-center p-6"><div className="max-w-md w-full">
      <div className="text-center mb-8"><h1 className="text-3xl font-bold text-white mb-3">Client Portal</h1><p className="text-gray-400">Request auto spare parts, review offers, and manage orders.</p></div>
      <form onSubmit={submit} className="bg-navy-800 border border-white/10 rounded-2xl p-7 space-y-4">
        <div className="flex gap-3"><button type="button" onClick={() => setMode('login')} className={`flex-1 py-2 rounded-lg ${mode==='login'?'bg-blue-600 text-white':'text-gray-300'}`}>Sign in</button><button type="button" onClick={() => setMode('register')} className={`flex-1 py-2 rounded-lg ${mode==='register'?'bg-blue-600 text-white':'text-gray-300'}`}>Create account</button></div>
        {mode==='register' && <><label className="block text-sm text-gray-200">Full name<input required value={name} onChange={e=>setName(e.target.value)} className="input-field mt-1" autoComplete="name" /></label><label className="block text-sm text-gray-200">Phone (optional)<input value={phone} onChange={e=>setPhone(e.target.value)} className="input-field mt-1" autoComplete="tel" /></label></>}
        <label className="block text-sm text-gray-200">Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="input-field mt-1" autoComplete="email" /></label>
        <label className="block text-sm text-gray-200">Password<input type="password" required minLength={mode==='register'?10:1} value={password} onChange={e=>setPassword(e.target.value)} className="input-field mt-1" autoComplete={mode==='register'?'new-password':'current-password'} />{mode==='register'&&<span className="text-xs text-gray-400">At least 10 characters.</span>}</label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button disabled={busy} className="w-full btn-primary flex justify-center items-center gap-2 disabled:opacity-60">{busy?'Please wait':mode==='login'?'Sign in':'Create account'} <ArrowRight size={16}/></button>
      </form>
    </div></div>
  </div>;
};
export default LoginPage;

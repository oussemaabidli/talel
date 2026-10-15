import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Settings as Cog, Shield, ArrowRight } from 'lucide-react';
import { hostLogin, hydrateHostStore } from '../api/host';

const LoginPage: React.FC = () => {
  const { login } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await hostLogin(email, password);
      await hydrateHostStore();
      login('host');
      navigate('/admin/overview');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      <div className="flex items-center gap-2.5 px-6 py-5">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Cog size={22} className="text-white" />
        </div>
        <span className="text-white font-bold text-xl">AutoParts <span className="text-primary">Pro</span></span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white mb-3">Admin Portal</h1>
            <p className="text-gray-400 text-base">Sign in to access platform management and system operations.</p>
          </div>

          <form onSubmit={handleLogin} className="w-full bg-navy-800 border-2 border-white/10 rounded-2xl p-6 text-left">
            <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center mb-5">
              <Shield size={26} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Platform Administrator</h2>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">Sign in with an account provisioned with the Host role.</p>
            <label className="block text-xs text-gray-300 mb-1" htmlFor="host-email">Email</label>
            <input id="host-email" autoComplete="username" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg bg-white px-3 py-2.5 text-sm text-slate-900 mb-4" />
            <label className="block text-xs text-gray-300 mb-1" htmlFor="host-password">Password</label>
            <input id="host-password" autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg bg-white px-3 py-2.5 text-sm text-slate-900 mb-4" />
            {error && <p role="alert" className="text-sm text-red-300 mb-3">{error}</p>}
            <button disabled={busy} type="submit" className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;


import React from 'react';
import { Navigate } from 'react-router-dom';
import { Clock3, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

const SellerStatusPage: React.FC = () => {
  const { isAuthenticated, isSellerVerified, logout } = useStore();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isSellerVerified) return <Navigate to="/seller/dashboard" replace />;
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700"><Clock3 size={26} /></div><p className="mt-5 text-sm font-semibold text-emerald-700">Talel Seller</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Vérification en cours</h1><p className="mt-3 leading-7 text-slate-600">Votre compte a été créé. Les fonctions commerciales seront disponibles une fois votre entreprise vérifiée par un processus autorisé.</p><div className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-left text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={19} /><span>Le statut d’approbation est contrôlé par le serveur. Il ne peut pas être modifié depuis votre profil.</span></div><div className="mt-7"><button onClick={async () => { try { await api.post('/auth/logout'); } finally { logout(); window.location.assign('/'); } }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">Se déconnecter</button></div></section></main>;
};

export default SellerStatusPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Settings as Cog, User, ArrowRight } from 'lucide-react';
import type { UserRole } from '../types';

const LoginPage: React.FC = () => {
  const { login } = useStore();
  const navigate = useNavigate();

  const handleLogin = (role: UserRole) => {
    login(role);
    navigate('/client/dashboard');
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
            <h1 className="text-3xl font-bold text-white mb-3">Client Portal</h1>
            <p className="text-gray-400 text-base">Request auto spare parts, review incoming offers, and manage orders.</p>
          </div>

          <button
            onClick={() => handleLogin('client')}
            className="w-full group bg-navy-800 border-2 border-white/10 hover:border-blue-500 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1"
          >
            <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mb-5">
              <User size={26} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Customer Account</h2>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">Search parts, get competitive quotes from certified sellers, and track deliveries.</p>
            <div className="bg-navy-700 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm text-white font-medium">Ahmed Benali</p>
            </div>
            <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
              Enter Client Portal <ArrowRight size={16} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

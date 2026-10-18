import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const SellerVerificationNotice: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 ${className}`} role="status">
    <div className="flex items-start gap-3">
      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-700" />
      <div>
        <p className="font-semibold">Seller verification required</p>
        <p className="mt-1 text-amber-900">You can browse the seller workspace while your account is under review. Submitting offers, messaging clients, and updating client orders unlock after verification.</p>
      </div>
    </div>
  </div>
);

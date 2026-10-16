import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, Avatar, ConfirmModal } from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import { UserCheck, Search, CheckCircle, Car } from 'lucide-react';
import { hostApi } from '../../api/host';
import RegistrationDetailsModal from '../../components/RegistrationDetailsModal';

export const HostClients: React.FC = () => {
  const { clients, toggleUserStatus, addToast } = useStore();
  const [search, setSearch] = useState('');
  const [toggleId, setToggleId] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  const filteredClients = clients.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Client Directory</h1>
        <p className="text-sm text-text-secondary">
          Monitor registered vehicle owners, garage sizes, and transaction activity.
        </p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search client name, email..." />
        </div>
        <span className="text-xs text-text-secondary font-medium">
          Total Buyers: <strong className="text-navy-900 font-bold">{clients.length}</strong>
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Saved Vehicles</th>
                <th className="py-3 px-4">Total Requests</th>
                <th className="py-3 px-4">Total Orders</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={client.name} size="sm" />
                      <div>
                        <p className="font-bold text-navy-900 text-xs">{client.name}</p>
                        <p className="text-[11px] text-text-secondary">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-navy-900">{client.city}</td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-accent">
                      <Car size={13} /> {client.savedVehicles.length} vehicles
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-bold text-navy-900">{client.totalRequests}</td>
                  <td className="py-3.5 px-4 text-xs font-bold text-navy-900">{client.totalOrders}</td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                      client.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {client.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button onClick={() => setRegistrationId(client.id)} className="mr-2 text-xs font-semibold text-accent hover:underline">View registration</button>
                    <button
                      onClick={() => setToggleId(client.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${
                        client.isActive ? 'border-border text-danger hover:bg-red-50' : 'border-green-200 text-green-700 bg-green-50'
                      }`}
                    >
                      {client.isActive ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!toggleId}
        onClose={() => setToggleId(null)}
        onConfirm={async () => {
          if (toggleId) {
            const client = clients.find((entry) => entry.id === toggleId);
            try {
              await hostApi(`/host/users/${encodeURIComponent(toggleId)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !client?.isActive }) });
              toggleUserStatus(toggleId); addToast('success', 'Client status updated'); setToggleId(null);
            } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to update account.'); }
          }
        }}
        title="Toggle Client Status"
        message="Are you sure you want to alter this client's marketplace access?"
        confirmText="Confirm"
      />
      {registrationId ? <RegistrationDetailsModal userId={registrationId} role="CLIENT" onClose={() => setRegistrationId(null)} onSellerVerified={() => undefined} /> : null}
    </div>
  );
};

export default HostClients;


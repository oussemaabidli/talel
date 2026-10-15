import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput } from '../../components/ui';
import { formatDateTime, formatTimeAgo } from '../../utils/helpers';
import { Activity, Search, Filter, Clock, ShieldCheck, User, Store } from 'lucide-react';

export const HostActivity: React.FC = () => {
  const { activityLogs } = useStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'seller'>('all');

  const filteredLogs = activityLogs.filter(log => {
    if (roleFilter !== 'all' && log.userRole !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return log.userName.toLowerCase().includes(q) || log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Platform Activity Audit Logs</h1>
        <p className="text-sm text-text-secondary">
          Audit trail of Host moderation, seller verification, category, and platform setting changes.
        </p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search user, action, details..." />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'client', 'seller'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                roleFilter === r ? 'bg-navy-900 text-white' : 'bg-surface-secondary text-text-secondary hover:text-navy-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">Event Type / Action</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Transaction / Context Details</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        log.userRole === 'seller' ? 'bg-primary' : 'bg-accent'
                      }`} />
                      <span className="font-bold text-navy-900">{log.action}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-navy-900">
                    {log.userName}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      log.userRole === 'seller' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-text-secondary">
                    {log.details}
                  </td>
                  <td className="py-3.5 px-4 text-right text-text-tertiary">
                    <span className="block font-medium text-navy-900">{formatTimeAgo(log.timestamp)}</span>
                    <span className="text-[10px]">{formatDateTime(log.timestamp)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HostActivity;


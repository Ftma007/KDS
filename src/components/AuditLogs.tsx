import React from 'react';
import { AuditLog } from '../types';
import { Shield, Search, Trash2, Database, Download } from 'lucide-react';

interface AuditLogsProps {
  logs: AuditLog[];
  onClearLogs: () => void;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ logs, onClearLogs }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterRole, setFilterRole] = React.useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.orderId && log.orderId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = filterRole === 'all' || log.userRole === filterRole;

    return matchesSearch && matchesRole;
  });

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'bg-purple-50 border-purple-200 text-purple-750';
      case 'manager':
        return 'bg-amber-50 border-amber-200 text-amber-755';
      case 'expeditor':
        return 'bg-indigo-50 border-indigo-200 text-indigo-750';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-750';
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Timestamp', 'User ID', 'Role', 'Action', 'Station', 'Order ID', 'Details'];
    const rows = logs.map(l => [
      l.timestamp,
      l.userId,
      l.userRole,
      l.action,
      l.station || '',
      l.orderId || '',
      l.details.replace(/"/g, '""')
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KDS_Audit_Logs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-stone-50 border border-stone-200 rounded-xl p-5 gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-display font-bold text-stone-900 flex items-center gap-2">
            <Database className="h-4.5 w-4.5 text-brand-orange" />
            Security & Compliance Audit Logs
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            A permanent record of kitchen actions including order bumps, supervisor recalls, system failures, and configuration adjustments.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            id="btn-export-csv"
            onClick={handleDownloadCSV}
            className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            id="btn-clear-audit-logs"
            onClick={onClearLogs}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear Logs
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
          <input
            id="input-log-search"
            type="text"
            placeholder="Search by Action, Details, or SQ-Order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 pl-9 text-xs text-stone-850 focus:outline-hidden focus:border-brand-orange font-sans shadow-xs"
          />
        </div>

        <div className="flex gap-2 text-xs">
          <select
            id="select-log-role-filter"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 focus:outline-hidden focus:border-brand-orange shadow-xs font-semibold"
          >
            <option value="all">All Roles</option>
            <option value="administrator">Administrator</option>
            <option value="manager">Manager</option>
            <option value="kitchen_staff">Kitchen Staff</option>
            <option value="expeditor">Expeditor</option>
          </select>
        </div>
      </div>

      {/* Logs Table / Log Terminal */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 overflow-hidden shadow-sm">
        <div className="overflow-y-auto max-h-[450px] font-mono text-[11px] leading-relaxed text-stone-600 space-y-1.5 pr-2">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-stone-400 font-semibold">
              No audit logs match current query filters.
            </div>
          ) : (
            filteredLogs.slice().reverse().map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-1.5 border-b border-stone-100 hover:bg-stone-50/50 px-2 rounded-lg">
                {/* Timestamp */}
                <span className="text-stone-400 shrink-0 select-none font-bold">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>

                {/* Role Badge */}
                <span className={`px-1.5 py-0.5 rounded-lg border uppercase font-extrabold text-[9px] shrink-0 text-center w-24 block ${getRoleBadgeStyle(log.userRole)}`}>
                  {log.userRole.replace('_', ' ')}
                </span>

                {/* Action Descriptor */}
                <span className="text-stone-800 font-extrabold shrink-0">
                  {log.action}:
                </span>

                {/* Details */}
                <span className="text-stone-600 font-medium">
                  {log.details}
                </span>

                {/* Optional Order reference */}
                {log.orderId && (
                  <span className="sm:ml-auto text-[9px] bg-amber-50 border border-amber-200 text-brand-orange font-extrabold px-2 py-0.5 rounded-lg font-mono select-none">
                    {log.orderId}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

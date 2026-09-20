'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils/format';
import { FileText, ShieldAlert } from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/audit-logs')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setLogs(data.logs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">System Audit Logs</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Complete audit trail of admin mutations, fee changes, and configuration updates.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity Type</th>
                <th className="px-6 py-4">Entity ID</th>
                <th className="px-6 py-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">{log.action}</td>
                    <td className="px-6 py-4 font-semibold text-white">{log.entity_type}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{log.entity_id}</td>
                    <td className="px-6 py-4 text-slate-400">{formatDate(log.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

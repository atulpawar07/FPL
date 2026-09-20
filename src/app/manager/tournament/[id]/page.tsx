'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPaiseToINR, formatDate } from '@/lib/utils/format';
import {
  Users,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Check,
  FileImage,
  Loader2,
  Briefcase,
} from 'lucide-react';

export default function SingleTournamentManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = use(params);

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'approval' | 'payments' | 'registrations'>('approval');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchSummary = () => {
    setLoading(true);
    fetch(`/api/admin/tournament/${tournamentId}/summary`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setData(resData);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSummary();
  }, [tournamentId]);

  const handleApprovalAction = async (regId: string, action: 'APPROVE' | 'REJECT') => {
    setActionLoadingId(regId);
    try {
      const res = await fetch(`/api/admin/registrations/${regId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchSummary();
      }
    } catch (err) {} finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
        <span>Loading tournament data...</span>
      </div>
    );
  }

  const tournament = data?.tournament;
  const registrations: any[] = data?.registrations || [];
  const stats = data?.stats;

  return (
    <div className="space-y-6 animate-fadeIn">
      <Link href="/manager">
        <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
          Back to Manager Dashboard
        </Button>
      </Link>

      <Card className="space-y-4 border-2 border-teal-500/30 bg-slate-900/90">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider px-2 py-0.5 rounded bg-teal-950 border border-teal-500/40 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                Manager Workspace
              </span>
              <Badge status={tournament?.registration_open ? 'ACTIVE' : 'INACTIVE'}>
                {tournament?.registration_open ? 'Open' : 'Closed'}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{tournament?.name}</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Date: {formatDate(tournament?.tournament_date)} | Player Fee: {formatPaiseToINR(tournament?.registration_fee || 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('approval')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${activeTab === 'approval' ? 'bg-teal-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
          >
            Player Approval Queue
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${activeTab === 'payments' ? 'bg-teal-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
          >
            Verify Payments ({stats?.pendingPayments || 0})
          </button>
          <button
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${activeTab === 'registrations' ? 'bg-teal-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
          >
            All Registered Players ({registrations.length})
          </button>
        </div>
      </Card>

      {/* APPROVAL QUEUE */}
      {activeTab === 'approval' && (
        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-white">Player Approval Queue</h2>

          {registrations.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-6 text-center">No registrations found.</p>
          ) : (
            <div className="space-y-3">
              {registrations.map((r) => (
                <div key={r.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={r.registered_image_snapshot || '/logo.png'}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover bg-slate-800 border border-slate-700"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-base">{r.registered_name_snapshot}</span>
                        <Badge status={r.registration_status}>{r.registration_status}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Ref: <code className="text-teal-400 font-bold">{r.registration_number}</code> | Role: {r.registered_role_snapshot}
                      </p>
                      <p className="text-[11px] text-slate-500">Email: {r.players?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="danger"
                      size="sm"
                      isLoading={actionLoadingId === r.id}
                      onClick={() => handleApprovalAction(r.id, 'REJECT')}
                      leftIcon={<XCircle className="w-4 h-4" />}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={actionLoadingId === r.id}
                      onClick={() => handleApprovalAction(r.id, 'APPROVE')}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Approve Player
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* PAYMENTS VERIFICATION */}
      {activeTab === 'payments' && (
        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-white">Payment Proof Verification</h2>

          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950 overflow-hidden">
            {registrations.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{r.registered_name_snapshot}</span>
                    <Badge status={r.payment?.payment_status || 'PENDING'}>
                      {r.payment?.payment_status || 'PENDING'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Ref: {r.registration_number}</p>
                </div>

                <div className="flex items-center gap-2">
                  {r.payment?.payment_screenshot_url && (
                    <a href={r.payment.payment_screenshot_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" leftIcon={<FileImage className="w-3.5 h-3.5 text-sky-400" />}>
                        View Proof
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprovalAction(r.id, 'APPROVE')}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Mark Verified
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ALL REGISTRATIONS */}
      {activeTab === 'registrations' && (
        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-white">Registered Players Directory</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Ref #</th>
                  <th className="p-3">Player Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-mono text-teal-400 font-semibold">{r.registration_number}</td>
                    <td className="p-3 font-bold text-white">{r.registered_name_snapshot}</td>
                    <td className="p-3">{r.registered_role_snapshot}</td>
                    <td className="p-3"><Badge status={r.registration_status}>{r.registration_status}</Badge></td>
                    <td className="p-3"><Badge status={r.payment?.payment_status || 'PENDING'}>{r.payment?.payment_status || 'PENDING'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

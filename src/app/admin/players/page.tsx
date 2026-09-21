'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatPaiseToINR, formatDate, cricketRoleLabels } from '@/lib/utils/format';
import { Search, Download, Eye, CheckCircle2, ShieldCheck, Trophy, History, User, Trash2 } from 'lucide-react';

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [tournamentFilter, setTournamentFilter] = useState('ALL');

  // Manual Payment / Approval Modal State
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState<any | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<any | null>(null);

  const [txRefInput, setTxRefInput] = useState('');
  const [verifyNoteInput, setVerifyNoteInput] = useState('');
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [modalMessage, setModalMessage] = useState<string | null>(null);

  const fetchPlayers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter !== 'ALL') params.set('role', roleFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (tournamentFilter !== 'ALL') params.set('tournamentId', tournamentFilter);

    fetch(`/api/admin/players?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          let list = data.players || [];
          if (paymentStatusFilter !== 'ALL') {
            list = list.filter((item: any) => {
              const payStatus = Array.isArray(item.payments)
                ? item.payments[0]?.payment_status || item.payments[0]?.status
                : item.payments?.payment_status || item.payments?.status;
              return payStatus === paymentStatusFilter;
            });
          }
          setPlayers(list);
          setTournaments(data.tournaments || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlayers();
  }, [search, roleFilter, statusFilter, paymentStatusFilter, tournamentFilter]);

  const handleDeletePlayerRegistration = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete registration entry for "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: 'DELETE',
      });
      const resData = await res.json();
      if (res.ok) {
        fetchPlayers();
      } else {
        alert(resData.error || 'Failed to delete entry');
      }
    } catch (err) {
      alert('Network error deleting entry');
    }
  };

  const handleOpenPaymentModal = (playerItem: any) => {
    setSelectedPlayerForPayment(playerItem);
    setTxRefInput('');
    setVerifyNoteInput('');
    setModalMessage(null);
  };

  const handleApprovePlayer = async (playerItem: any) => {
    try {
      const res = await fetch(`/api/admin/registrations/${playerItem.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationNote: 'Approved & Verified by Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPlayers();
      }
    } catch (e) {}
  };

  const handleConfirmManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerForPayment) return;

    setVerifyingPayment(true);
    setModalMessage(null);

    try {
      const res = await fetch(`/api/admin/registrations/${selectedPlayerForPayment.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionReference: txRefInput,
          verificationNote: verifyNoteInput,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setModalMessage(data.error || 'Failed to update payment status');
      } else {
        setModalMessage('Player Registration & Payment Approved Successfully!');
        setTimeout(() => {
          setSelectedPlayerForPayment(null);
          fetchPlayers();
        }, 1200);
      }
    } catch (err: any) {
      setModalMessage('Network error updating payment');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleExportCsv = () => {
    window.open(`/api/admin/export?tournamentId=${tournamentFilter}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
            <Trophy className="w-7 h-7 text-emerald-400" />
            <span>Player Directory & Tournament Approvals</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Filter player registrations by tournament, inspect individual history timelines, and approve registrations.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={handleExportCsv}
          leftIcon={<Download className="w-4 h-4 text-emerald-400" />}
        >
          Export Tournament CSV
        </Button>
      </div>

      {/* Search & Filter Controls */}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Input
              placeholder="Search Name, Ref ID, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <Select
              value={tournamentFilter}
              onChange={(e) => setTournamentFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Tournaments' },
                ...tournaments.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>

          <div>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Cricket Roles' },
                { value: 'BATSMAN', label: 'Batsman' },
                { value: 'BOWLER', label: 'Bowler' },
                { value: 'ALL_ROUNDER', label: 'All-rounder' },
                { value: 'BATSMAN_WICKETKEEPER', label: 'Batsman + Wicketkeeper' },
                { value: 'BOWLER_WICKETKEEPER', label: 'Bowler + Wicketkeeper' },
              ]}
            />
          </div>

          <div>
            <Select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Payment Statuses' },
                { value: 'SUCCESSFUL', label: 'Paid & Approved' },
                { value: 'PENDING', label: 'Pending Verification' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* MOBILE RESPONSIVE CARD VIEW (< 768px) */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-10 text-slate-400 text-sm">Loading player directory...</div>
        ) : players.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">No registered players found.</div>
        ) : (
          players.map((item) => {
            const p = item.player || {};
            const pay = Array.isArray(item.payments) ? item.payments[0] : item.payments || {};
            const isPaid = (pay.payment_status || pay.status) === 'SUCCESSFUL';

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {item.registration_number || item.registration_reference}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge status={isPaid ? 'CONFIRMED' : 'WAITING_LIST'}>
                      {isPaid ? 'Approved & Paid' : 'Pending Verification'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {item.registered_image_snapshot ? (
                    <img src={item.registered_image_snapshot} alt="Avatar" className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                  ) : null}
                  <div>
                    <h3 className="font-bold text-base text-white">{item.registered_name_snapshot || p.full_name}</h3>
                    <p className="text-xs text-slate-400">{p.email}</p>
                    <span className="text-[11px] text-emerald-400 font-medium block mt-0.5">
                      Tournament: {item.tournament?.name || 'FairPlay Premier League 2026'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Role</span>
                    <span className="font-medium text-slate-200">
                      {cricketRoleLabels[item.registered_role_snapshot as keyof typeof cricketRoleLabels] || item.registered_role_snapshot}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Jersey</span>
                    <span className="font-bold text-amber-400">
                      {item.registered_jersey_size_snapshot || 'M'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Played</span>
                    <span className="font-bold text-sky-400">
                      {item.tournamentHistoryCount || 1} Tournaments
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                  {!isPaid ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenPaymentModal(item)}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Approve & Mark Paid
                    </Button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Approved
                    </span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedPlayerHistory(item)}
                      leftIcon={<History className="w-3.5 h-3.5 text-sky-400" />}
                    >
                      History
                    </Button>
                    <Link href={`/registration/${item.id}`}>
                      <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                        Pass
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP RESPONSIVE TABLE VIEW (>= 768px) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Reg Number</th>
                <th className="px-6 py-4">Player Details</th>
                <th className="px-6 py-4">Tournament</th>
                <th className="px-6 py-4">Role & Jersey</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading player directory...
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No matching player registrations found.
                  </td>
                </tr>
              ) : (
                players.map((item) => {
                  const p = item.player || {};
                  const pay = Array.isArray(item.payments) ? item.payments[0] : item.payments || {};
                  const isPaid = (pay.payment_status || pay.status) === 'SUCCESSFUL';

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {item.registration_number || item.registration_reference}
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          {item.registered_image_snapshot ? (
                            <img src={item.registered_image_snapshot} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                          ) : null}
                          <div>
                            <span className="block font-bold text-slate-100">{item.registered_name_snapshot || p.full_name}</span>
                            <span className="text-xs text-slate-400 font-normal">{p.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-medium">
                        {item.tournament?.name || 'FairPlay Premier League 2026'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="block font-semibold text-slate-200">
                          {cricketRoleLabels[item.registered_role_snapshot as keyof typeof cricketRoleLabels] || item.registered_role_snapshot}
                        </span>
                        <span className="text-xs text-amber-400 font-bold">
                          Jersey: {item.registered_jersey_size_snapshot || 'M'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={isPaid ? 'CONFIRMED' : 'WAITING_LIST'}>
                          {isPaid ? 'Approved & Paid' : 'Pending Verification'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        {!isPaid ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenPaymentModal(item)}
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Approve & Mark Paid
                          </Button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1 mr-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Approved
                          </span>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedPlayerHistory(item)}
                          leftIcon={<History className="w-3.5 h-3.5 text-sky-400" />}
                        >
                          History ({item.tournamentHistoryCount || 1})
                        </Button>
                        <Link href={`/registration/${item.id}`}>
                          <Button variant="ghost" size="sm" leftIcon={<Eye className="w-4 h-4 text-emerald-400" />}>
                            Pass
                          </Button>
                        </Link>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeletePlayerRegistration(item.id, item.registered_name_snapshot || item.player?.full_name || 'Player')}
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PLAYER TOURNAMENT HISTORY MODAL */}
      <Modal
        isOpen={Boolean(selectedPlayerHistory)}
        onClose={() => setSelectedPlayerHistory(null)}
        title="Player Directory Profile & Tournament History"
      >
        {selectedPlayerHistory && (
          <div className="space-y-6 text-xs sm:text-sm">
            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              {selectedPlayerHistory.registered_image_snapshot ? (
                <img
                  src={selectedPlayerHistory.registered_image_snapshot}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                />
              ) : null}
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedPlayerHistory.registered_name_snapshot || selectedPlayerHistory.player?.full_name}
                </h3>
                <p className="text-xs text-slate-400">{selectedPlayerHistory.player?.email}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="text-emerald-400 font-bold">
                    Role: {cricketRoleLabels[selectedPlayerHistory.registered_role_snapshot as keyof typeof cricketRoleLabels] || selectedPlayerHistory.registered_role_snapshot}
                  </span>
                  <span className="text-amber-400 font-bold">
                    Jersey: {selectedPlayerHistory.registered_jersey_size_snapshot || 'M'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                <History className="w-4 h-4 text-sky-400" />
                <span>Tournament Participation Timeline ({selectedPlayerHistory.tournamentHistoryCount || 1})</span>
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(selectedPlayerHistory.tournamentHistory || []).map((t: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{t.tournamentName}</span>
                      <span className="font-mono text-[11px] text-slate-400">Ref: {t.registrationNumber}</span>
                    </div>
                    <div className="text-right">
                      <Badge status={t.paymentStatus === 'SUCCESSFUL' ? 'CONFIRMED' : 'WAITING_LIST'}>
                        {t.paymentStatus === 'SUCCESSFUL' ? 'Paid & Approved' : 'Pending'}
                      </Badge>
                      <span className="text-[10px] text-slate-400 block mt-1">{formatDate(t.registeredAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedPlayerHistory(null)}>
                Close Directory Profile
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ADMIN MANUAL PAYMENT CONFIRMATION / APPROVAL MODAL */}
      <Modal
        isOpen={Boolean(selectedPlayerForPayment)}
        onClose={() => setSelectedPlayerForPayment(null)}
        title="Step 2: Admin Player Registration & Payment Approval"
      >
        {selectedPlayerForPayment && (
          <form onSubmit={handleConfirmManualPayment} className="space-y-4 text-xs sm:text-sm">
            {modalMessage && (
              <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs">
                {modalMessage}
              </div>
            )}

            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Player Name:</span>
                <span className="font-bold text-white">
                  {selectedPlayerForPayment.registered_name_snapshot || selectedPlayerForPayment.player?.full_name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Tournament:</span>
                <span className="font-bold text-emerald-400">
                  {selectedPlayerForPayment.tournament?.name || 'FairPlay Premier League 2026'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Registration Reference:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {selectedPlayerForPayment.registration_number || selectedPlayerForPayment.registration_reference}
                </span>
              </div>
            </div>

            {/* PAYMENT SCREENSHOT PREVIEW & STEP 1 VALIDATION INFO */}
            {selectedPlayerForPayment.payments?.[0]?.payment_screenshot_url || selectedPlayerForPayment.payment_screenshot_url ? (
              <div className="p-4 bg-slate-950/90 border border-emerald-500/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                    Uploaded Payment Receipt Screenshot
                  </span>
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40">
                    Step 1 Passed ✔️
                  </span>
                </div>
                <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <img
                    src={selectedPlayerForPayment.payments?.[0]?.payment_screenshot_url || selectedPlayerForPayment.payment_screenshot_url}
                    alt="Payment Receipt Screenshot"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                💡 Player has not attached a payment screenshot yet. You can still verify and approve manually.
              </div>
            )}

            <Input
              label="Transaction Reference / UTR Number"
              placeholder="e.g. 429381048201"
              value={txRefInput}
              onChange={(e) => setTxRefInput(e.target.value)}
            />

            <Input
              label="Admin Approval Note (Optional)"
              placeholder="e.g. Confirmed entry & verified UPI statement"
              value={verifyNoteInput}
              onChange={(e) => setVerifyNoteInput(e.target.value)}
            />

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setSelectedPlayerForPayment(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={verifyingPayment} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                Approve Player & Confirm Squad Slot
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

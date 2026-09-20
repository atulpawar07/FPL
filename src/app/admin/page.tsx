'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatPaiseToINR, formatDate } from '@/lib/utils/format';
import { AdminDashboardMetrics, DbTournament } from '@/types';
import {
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Copy,
  Trash2,
  Edit,
  ExternalLink,
  QrCode,
  Upload,
  AlertTriangle,
  Download,
  Check,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [tournament, setTournament] = useState<DbTournament | null>(null);
  const [loading, setLoading] = useState(true);

  // Tournament Create/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [tName, setTName] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tDate, setTDate] = useState('');
  const [tFeeRupees, setTFeeRupees] = useState(500);
  const [tMaxPlayers, setTMaxPlayers] = useState(100);
  const [tUpiId, setTUpiId] = useState('');
  const [tPaymentQrUrl, setTPaymentQrUrl] = useState('');
  const [tRegistrationOpen, setTRegistrationOpen] = useState(true);
  const [savingTournament, setSavingTournament] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchDashboard = () => {
    setLoading(true);
    fetch('/api/admin/dashboard')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setMetrics(data);
          if (data.tournament) {
            setTournament(data.tournament);
            setTName(data.tournament.name);
            setTDescription(data.tournament.description || '');
            setTDate(data.tournament.tournament_date ? data.tournament.tournament_date.slice(0, 10) : '');
            setTFeeRupees(data.tournament.registration_fee / 100);
            setTMaxPlayers(data.tournament.max_players);
            setTUpiId(data.tournament.upi_id || '');
            setTPaymentQrUrl(data.tournament.payment_qr_url || '');
            setTRegistrationOpen(data.tournament.registration_open);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCopyShareableLink = () => {
    if (!tournament) return;
    const shareUrl = `${window.location.origin}/tournament/${tournament.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setModalError('Please upload a JPG, PNG or WebP QR image');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTPaymentQrUrl(reader.result as string);
      setModalError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTournament(true);
    setModalError(null);

    try {
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournament?.id,
          name: tName,
          description: tDescription,
          tournamentDate: tDate,
          registrationFeeRupees: tFeeRupees,
          maxPlayers: tMaxPlayers,
          upiId: tUpiId,
          paymentQrUrl: tPaymentQrUrl,
          registrationOpen: tRegistrationOpen,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setModalError(data.error || 'Failed to save tournament');
        setSavingTournament(false);
        return;
      }

      setIsModalOpen(false);
      fetchDashboard();
    } catch (err: any) {
      setModalError('Network error saving tournament');
    } finally {
      setSavingTournament(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    try {
      const res = await fetch(`/api/admin/tournaments/${tournament.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsDeletingModalOpen(false);
        setTournament(null);
        fetchDashboard();
      }
    } catch (err) {}
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tournament capacity control, waitlist monitoring, and payment verification console.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tournament && (
            <Button
              variant="outline"
              size="md"
              onClick={handleCopyShareableLink}
              leftIcon={copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
            >
              {copiedLink ? 'Link Copied!' : 'Copy Shareable Link'}
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {tournament ? 'Edit Tournament' : 'Create Tournament'}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid (5 Specified Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Total Registered Players */}
        <Card className="space-y-2 border-l-4 border-l-emerald-500">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Registered
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {loading ? '...' : metrics?.totalRegisteredPlayers || 0}
          </p>
          <span className="text-[11px] text-slate-400 block">All player submissions</span>
        </Card>

        {/* 2. Available Regular Slots */}
        <Card className="space-y-2 border-l-4 border-l-teal-500">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Available Slots
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-teal-300">
            {loading ? '...' : metrics?.availableRegularSlots || 0}
          </p>
          <span className="text-[11px] text-slate-400 block">
            Capacity: {tournament?.max_players || 100}
          </span>
        </Card>

        {/* 3. Total Waitlisted Players */}
        <Card className="space-y-2 border-l-4 border-l-sky-500">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Waitlisted Players
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-sky-300">
            {loading ? '...' : metrics?.totalWaitlistedPlayers || 0}
          </p>
          <span className="text-[11px] text-slate-400 block">Queue slot #101+</span>
        </Card>

        {/* 4. Successful Payments */}
        <Card className="space-y-2 border-l-4 border-l-emerald-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Paid (Successful)
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
            {loading ? '...' : metrics?.successfulPayments || 0}
          </p>
          <span className="text-[11px] text-slate-400 block">Verified payments</span>
        </Card>

        {/* 5. Pending Payments */}
        <Card className="space-y-2 border-l-4 border-l-amber-500">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Pending Payments
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-300">
            {loading ? '...' : metrics?.pendingPayments || 0}
          </p>
          <span className="text-[11px] text-slate-400 block">Awaiting admin review</span>
        </Card>
      </div>

      {/* Active Tournament & Shareable URL Card */}
      {tournament ? (
        <Card className="space-y-6 border-2 border-emerald-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{tournament.name}</h2>
                <Badge status={tournament.registration_open ? 'ACTIVE' : 'INACTIVE'}>
                  {tournament.registration_open ? 'Open' : 'Closed'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Date: {formatDate(tournament.tournament_date)} | Fee: {formatPaiseToINR(tournament.registration_fee)} | Capacity: {tournament.max_players} Players
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/tournament/${tournament.id}`} target="_blank">
                <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                  Public Link
                </Button>
              </Link>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDeletingModalOpen(true)}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete
              </Button>
            </div>
          </div>

          {/* TWO PRIMARY ADMIN OPTIONS FOR THIS TOURNAMENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPTION 1: EDIT TOURNAMENT DETAILS */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Option 1</span>
                <h3 className="font-bold text-white text-base">Edit Tournament Details</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Update title, date, fee (INR), player capacity limit, UPI payment ID, QR image, or open/close status.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                leftIcon={<Edit className="w-4 h-4 text-amber-400" />}
                className="w-full sm:w-auto self-start"
              >
                Edit Tournament Details
              </Button>
            </div>

            {/* OPTION 2: VIEW REGISTRATIONS & APPROVE PLAYERS */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-emerald-500/40 space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Option 2</span>
                <h3 className="font-bold text-white text-base">View Registrations & Approve Players</h3>
                <p className="text-xs text-slate-400 mt-1">
                  View all registered players for this tournament, inspect details, and approve registrations to confirm squad entry.
                </p>
              </div>
              <Link href={`/admin/players?tournamentId=${tournament.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Users className="w-4 h-4" />}
                  className="w-full sm:w-auto"
                >
                  View Registered Players ({metrics?.totalRegisteredPlayers || 0}) & Approve
                </Button>
              </Link>
            </div>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                Shareable Player Registration URL
              </span>
              <p className="font-mono text-xs text-slate-300 break-all">
                {`${window.location.origin}/tournament/${tournament.id}`}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={handleCopyShareableLink} leftIcon={<Copy className="w-4 h-4" />}>
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="text-center p-8 space-y-4">
          <h2 className="text-lg font-bold text-white">No Active Tournament Created</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click "Create Tournament" to set up tournament details, player capacity (e.g., 50, 100, 500), registration fee, and UPI QR code.
          </p>
          <Button variant="primary" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Create Tournament Now
          </Button>
        </Card>
      )}

      {/* CREATE / EDIT TOURNAMENT MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={tournament ? 'Edit Tournament Parameters' : 'Create New Tournament'} maxWidth="lg">
        <form onSubmit={handleSaveTournament} className="space-y-4 text-xs sm:text-sm">
          {modalError && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
              {modalError}
            </div>
          )}

          <Input
            label="Tournament Name"
            required
            value={tName}
            onChange={(e) => setTName(e.target.value)}
            placeholder="e.g. Premier Cricket Championship 2026"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tournament Date"
              type="date"
              required
              value={tDate}
              onChange={(e) => setTDate(e.target.value)}
            />

            <Input
              label="Registration Fee (₹ INR)"
              type="number"
              required
              value={tFeeRupees}
              onChange={(e) => setTFeeRupees(parseFloat(e.target.value) || 0)}
              helperText="Fee collected via personal UPI QR"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Maximum Player Capacity"
              type="number"
              required
              min={1}
              value={tMaxPlayers}
              onChange={(e) => setTMaxPlayers(parseInt(e.target.value, 10) || 100)}
              helperText="Any positive capacity (e.g. 50, 100, 500). Player N+1 goes to waitlist!"
            />

            <Input
              label="Admin UPI ID (Optional)"
              value={tUpiId}
              onChange={(e) => setTUpiId(e.target.value)}
              placeholder="organizer@upi"
            />
          </div>

          {/* QR Code Upload */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">Personal UPI QR Code Image</label>
            <div className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
              {tPaymentQrUrl ? (
                <img src={tPaymentQrUrl} alt="UPI QR Preview" className="w-14 h-14 object-contain bg-white rounded" />
              ) : (
                <div className="w-14 h-14 bg-slate-800 rounded flex items-center justify-center text-slate-500 text-[10px]">
                  No QR
                </div>
              )}
              <div>
                <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors inline-block">
                  Choose QR Image
                  <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tRegistrationOpen}
                onChange={(e) => setTRegistrationOpen(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-700"
              />
              <span className="text-xs font-semibold text-slate-200">Registration Status: OPEN for new submissions</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={savingTournament}>
              Save Tournament
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE TOURNAMENT CONFIRMATION MODAL */}
      <Modal isOpen={isDeletingModalOpen} onClose={() => setIsDeletingModalOpen(false)} title="Confirm Tournament Deletion">
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Permanent Tournament Data Deletion</span>
              <p>
                Deleting this tournament removes its tournament registrations & payment logs. Reusable player profiles in the persistent <strong>players</strong> database will be safely preserved.
              </p>
            </div>
          </div>

          <p className="text-slate-300">
            We recommend downloading a CSV backup before proceeding with deletion.
          </p>

          <div className="flex justify-between items-center pt-3 border-t border-slate-800">
            <a href="/api/admin/export" target="_blank">
              <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                Export CSV Backup
              </Button>
            </a>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsDeletingModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteTournament}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

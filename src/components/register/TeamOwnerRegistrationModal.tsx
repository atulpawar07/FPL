'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatPaiseToINR } from '@/lib/utils/format';
import { Crown, Upload, CheckCircle2, ShieldAlert, Image as ImageIcon } from 'lucide-react';

interface TeamOwnerRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: any;
  currentUser?: any;
}

export const TeamOwnerRegistrationModal: React.FC<TeamOwnerRegistrationModalProps> = ({
  isOpen,
  onClose,
  tournament,
  currentUser,
}) => {
  const [ownerName, setOwnerName] = useState(
    currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || ''
  );
  const [contactEmail, setContactEmail] = useState(currentUser?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');

  // Owner playing state
  const [ownerIsPlaying, setOwnerIsPlaying] = useState(true);
  const [ownerCricketRole, setOwnerCricketRole] = useState('BATSMAN');

  // Icon Player state
  const [iconPlayerName, setIconPlayerName] = useState('');
  const [iconPlayerMobile, setIconPlayerMobile] = useState('');
  const [iconPlayerRole, setIconPlayerRole] = useState('BATSMAN');
  const [iconPlayerBattingStyle, setIconPlayerBattingStyle] = useState('RIGHT_HAND');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName || !contactEmail) {
      setErrorMsg('Owner Name and Contact Email are required');
      return;
    }

    if (!tournament?.id) {
      setErrorMsg('Tournament ID missing. Please reload the page.');
      return;
    }

    if (tournament?.icon_player_enabled && !iconPlayerName.trim()) {
      setErrorMsg('Icon Player Name is required for this tournament');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/registrations/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          ownerName,
          contactEmail,
          contactPhone,
          playerId: currentUser?.id,
          paymentScreenshotUrl: screenshotUrl,
          ownerIsPlaying,
          ownerCricketRole,
          iconPlayerName,
          iconPlayerMobile,
          iconPlayerRole,
          iconPlayerBattingStyle,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to register as Team Owner');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(data.message || 'Registered as Team Owner successfully!');
      setSubmitting(false);
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1800);
    } catch (err: any) {
      setErrorMsg('Network error submitting Team Owner registration');
      setSubmitting(false);
    }
  };

  const ownerFeeDisplay = tournament?.owner_registration_fee
    ? formatPaiseToINR(tournament.owner_registration_fee)
    : '₹0';

  const isIconRequired = Boolean(tournament?.icon_player_enabled);
  const isOwnerPlayingAllowed = tournament?.owner_is_playing_enabled !== false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="👑 Team Owner Registration" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="font-extrabold text-amber-300 text-sm block">{tournament?.name}</span>
            <span className="text-[11px] text-slate-300">
              Team Owner Fee: <strong className="text-amber-400">{ownerFeeDisplay}</strong>
            </span>
          </div>
          <Crown className="w-7 h-7 text-amber-400" />
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <Input
          label="Team Owner Full Name"
          required
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="e.g. Vikram Sharma"
        />

        <Input
          label="Contact Email"
          type="email"
          required
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="owner@example.com"
        />

        <Input
          label="Contact Phone / Mobile (10 Digits)"
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="9876543210"
        />

        {/* OWNER PLAYING PREFERENCE */}
        {isOwnerPlayingAllowed && (
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ownerIsPlaying}
                onChange={(e) => setOwnerIsPlaying(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <div>
                <span className="font-extrabold text-amber-300 text-xs block">
                  🏏 Register Team Owner as a Playing Player in Tournament
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Checked: You will be registered into the player list as a playing Team Owner.
                </span>
              </div>
            </label>

            {ownerIsPlaying && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Owner Playing Role
                </label>
                <select
                  value={ownerCricketRole}
                  onChange={(e) => setOwnerCricketRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-amber-500"
                >
                  <option value="BATSMAN">Batsman</option>
                  <option value="BOWLER">Bowler</option>
                  <option value="ALL_ROUNDER">All-Rounder</option>
                  <option value="BATSMAN_WICKETKEEPER">Wicketkeeper-Batsman</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* ICON PLAYER SECTION */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              Icon Player Details {isIconRequired ? '*' : '(Optional)'}
            </span>
            {isIconRequired && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full">
                Required
              </span>
            )}
          </div>

          <Input
            label="Icon Player Full Name"
            required={isIconRequired}
            value={iconPlayerName}
            onChange={(e) => setIconPlayerName(e.target.value)}
            placeholder="e.g. Rohit Sharma"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Icon Player Mobile"
              type="tel"
              value={iconPlayerMobile}
              onChange={(e) => setIconPlayerMobile(e.target.value)}
              placeholder="9876543210"
            />

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Playing Role</label>
              <select
                value={iconPlayerRole}
                onChange={(e) => setIconPlayerRole(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-emerald-500"
              >
                <option value="BATSMAN">Batsman</option>
                <option value="BOWLER">Bowler</option>
                <option value="ALL_ROUNDER">All-Rounder</option>
                <option value="BATSMAN_WICKETKEEPER">Wicketkeeper-Batsman</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payment Proof for Owner Registration */}
        {tournament?.owner_registration_fee > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">
              Payment Receipt Screenshot ({ownerFeeDisplay})
            </label>
            <div className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
              {screenshotUrl ? (
                <img src={screenshotUrl} alt="Screenshot" className="w-16 h-16 object-contain rounded bg-slate-900 border border-emerald-500" />
              ) : (
                <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-500">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1">
                <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 inline-block">
                  Upload Payment Proof
                  <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotUpload} />
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting} variant="primary">
            Register as Team Owner
          </Button>
        </div>
      </form>
    </Modal>
  );
};

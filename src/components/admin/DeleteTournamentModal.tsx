import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { DbTournament } from '@/types';

interface DeleteTournamentModalProps {
  isOpen: boolean;
  tournament: DbTournament | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteTournamentModal({
  isOpen,
  tournament,
  onClose,
  onDeleted,
}: DeleteTournamentModalProps) {
  const [typedName, setTypedName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tournament) return null;

  const exactName = tournament.name.trim();
  const isMatch = typedName.trim() === exactName;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/tournaments/${tournament.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: typedName }),
      });

      const resData = await res.json();

      if (!res.ok || resData.error) {
        setError(resData.error || 'Failed to delete tournament');
        setDeleting(false);
        return;
      }

      setTypedName('');
      onClose();
      onDeleted();
    } catch (err: any) {
      setError(err.message || 'Network error deleting tournament');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setTypedName('');
        setError(null);
        onClose();
      }}
      title="Delete Tournament?"
      maxWidth="md"
    >
      <form onSubmit={handleDelete} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-950/90 border border-rose-500/50 rounded-xl text-rose-200 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-2xl space-y-2 text-rose-200">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Warning: Permanent Deletion</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Tournament: <strong className="text-white">{tournament.name}</strong>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            This action will permanently delete this tournament and its tournament-specific registrations, payments, teams and related records.
          </p>
          <p className="text-xs text-rose-400 font-bold">This cannot be undone.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Type the tournament name to confirm:
          </label>
          <Input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={tournament.name}
            className="font-mono text-xs"
          />
          <span className="text-[11px] text-slate-500 block">
            Must match exact name: <code className="text-slate-300">{tournament.name}</code>
          </span>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setTypedName('');
              setError(null);
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!isMatch || deleting}
            isLoading={deleting}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete Tournament
          </Button>
        </div>
      </form>
    </Modal>
  );
}

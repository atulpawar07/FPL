'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Settings, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState({
    id: '',
    name: 'FPL Premier League',
    registrationFeeRupees: 500,
    maxRegistrations: 500,
    contactEmail: '',
    contactPhone: '+91 86525 26186',
    termsAndConditions: 'By registering, players agree to abide by all FPL rules.',
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tournaments/current')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setFormData({
            id: data.id || '',
            name: data.name || 'FPL Premier League',
            registrationFeeRupees: data.registration_fee ? data.registration_fee / 100 : 500,
            maxRegistrations: data.max_players || data.max_registrations || 500,
            contactEmail: data.contact_email || '',
            contactPhone: data.contact_phone || '+91 86525 26186',
            termsAndConditions: data.terms_and_conditions || 'By registering, players agree to abide by rules.',
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to update settings');
      } else {
        setSuccessMsg('Tournament settings updated & audit log saved successfully!');
      }
    } catch (err: any) {
      setErrorMsg('Network error updating settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Tournament Settings</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure tournament title, registration fees (in ₹), player capacity, and contact information.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <Card className="space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-lg text-white">General Parameters</h2>
          </div>

          {successMsg && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs sm:text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Tournament Name"
                required
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <Input
                label="Registration Fee (₹ INR)"
                type="number"
                required
                value={formData.registrationFeeRupees}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, registrationFeeRupees: parseFloat(e.target.value) || 0 }))
                }
                helperText="Stored internally as integer paise"
              />
            </div>

            <div>
              <Input
                label="Maximum Player Capacity"
                type="number"
                required
                value={formData.maxRegistrations}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, maxRegistrations: parseInt(e.target.value, 10) || 500 }))
                }
                helperText="Cap on confirmed player applications"
              />
            </div>

            <div>
              <Input
                label="Helpdesk Contact Email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
              />
            </div>

            <div>
              <Input
                label="Helpdesk Contact Phone"
                value={formData.contactPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs md:text-sm font-medium text-slate-300">
                Terms & Conditions / Code of Conduct
              </label>
              <textarea
                rows={4}
                value={formData.termsAndConditions}
                onChange={(e) => setFormData((prev) => ({ ...prev, termsAndConditions: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <Button type="submit" size="lg" isLoading={loading} leftIcon={<Save className="w-5 h-5" />}>
              Save Tournament Configurations
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

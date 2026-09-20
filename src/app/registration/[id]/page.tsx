'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatPaiseToINR, formatDate, cricketRoleLabels } from '@/lib/utils/format';
import { FullPlayerRegistrationProfile } from '@/types';
import { Trophy, CheckCircle2, Clock, QrCode, ArrowLeft, Printer, ShieldCheck, Edit3, Upload, Image as ImageIcon, ShieldAlert, Check } from 'lucide-react';
import { Input } from '@/components/ui/Input';

export default function RegistrationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<FullPlayerRegistrationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Payment Screenshot State
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/registrations/${id}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.error) {
          setErrorMsg(result.error);
        } else {
          setData({
            registration: result.registration,
            player: result.player,
            tournament: result.tournament,
            payment: result.latestPayment || null,
          });
          if (result.latestPayment?.transaction_reference) {
            setTransactionRef(result.latestPayment.transaction_reference);
          }
          if (result.latestPayment?.payment_screenshot_url) {
            setScreenshotUrl(result.latestPayment.payment_screenshot_url);
          }
        }
      })
      .catch(() => setErrorMsg('Failed to load registration details'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const compressImage = (file: File, maxWidth = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => resolve(event.target?.result as string);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        const fallbackReader = new FileReader();
        fallbackReader.onloadend = () => resolve(fallbackReader.result as string);
        fallbackReader.readAsDataURL(file);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleScreenshotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Please select a valid JPG, PNG, or WebP screenshot image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10 MB. Please select a smaller screenshot image.');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setScreenshotUrl(compressed);
      setUploadError(null);
    } catch {
      setUploadError('Failed to process image file. Please try another image.');
    }
  };

  const handleSubmitScreenshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotUrl) {
      setUploadError('Please upload your payment screenshot before submitting.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const res = await fetch(`/api/registrations/${id}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotUrl,
          transactionReference: transactionRef,
          paymentDate: new Date().toISOString(),
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setUploadError(result.error || 'Failed to submit payment screenshot');
        setUploading(false);
        return;
      }

      setUploadSuccess(true);
      setUploading(false);

      // Redirect to Home Page after 1st Step Automated Validation passes
      setTimeout(() => {
        const tName = data?.tournament?.name || 'Tournament';
        router.push(`/?submitted=true&tName=${encodeURIComponent(tName)}`);
      }, 1200);
    } catch (err: any) {
      setUploadError('Network error uploading screenshot');
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {loading ? (
            <div className="text-center py-20 text-slate-400">Loading registration details...</div>
          ) : errorMsg || !data ? (
            <Card className="text-center p-8 space-y-3">
              <h2 className="text-xl font-bold text-white">Registration Record Not Found</h2>
              <p className="text-xs text-slate-400">{errorMsg}</p>
            </Card>
          ) : (
            <>
              {/* Action Bar (No Print) */}
              <div className="no-print flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <Link href={`/tournament/${data.tournament.id}`}>
                  <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Back to Tournament
                  </Button>
                </Link>
                <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-4 h-4" />}>
                  Print Receipt
                </Button>
              </div>

              {/* Printable Receipt Card */}
              <div className="printable-receipt-card bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
                {/* Header */}
                <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                      <Trophy className="w-8 h-8" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                        {data.tournament.name}
                      </h1>
                      <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                        Official Tournament Registration Pass
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl px-4 py-2 self-start sm:self-auto">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Registration Reference
                    </span>
                    <span className="text-lg font-mono font-extrabold text-emerald-300">
                      {data.registration.registration_number}
                    </span>
                  </div>
                </div>

                {/* Registration Status Banner */}
                {data.registration.registration_status === 'CONFIRMED' ? (
                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-emerald-300">Slot Confirmed 🎉</h3>
                      <p className="text-xs text-slate-300">
                        Regular tournament slot assigned. Complete payment below to finalize entry.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-sky-950/40 border border-sky-500/30 rounded-2xl p-4 flex items-center gap-3">
                    <Clock className="w-6 h-6 text-sky-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-sky-300">
                        Waitlist Position #{data.registration.waitlist_position || 1}
                      </h3>
                      <p className="text-xs text-slate-300">
                        Tournament regular slots are currently full. You will be automatically promoted if a slot opens!
                      </p>
                    </div>
                  </div>
                )}

                {/* Player Profile Snapshot Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
                  <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                    <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
                      Registered Player Snapshot
                    </h4>
                    <div className="flex items-center gap-4 py-2 border-b border-slate-900">
                      {data.registration.registered_image_snapshot ? (
                        <img
                          src={data.registration.registered_image_snapshot}
                          alt="Snapshot"
                          className="w-14 h-14 rounded-full object-cover border border-emerald-500 shrink-0"
                        />
                      ) : null}
                      <div>
                        <span className="text-slate-400 text-xs block">Player Name</span>
                        <span className="font-bold text-white text-base">
                          {data.registration.registered_name_snapshot}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Email:</span>
                      <span className="font-semibold text-slate-200">{data.player.email}</span>
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                    <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
                      Cricket Attributes
                    </h4>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Primary Role:</span>
                      <span className="font-bold text-emerald-300">
                        {cricketRoleLabels[data.registration.registered_role_snapshot]}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Batting Style:</span>
                      <span className="font-semibold text-slate-200">
                        {data.registration.registered_batting_style_snapshot
                          ? data.registration.registered_batting_style_snapshot.replace('_', ' ')
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Jersey Size:</span>
                      <span className="font-bold text-amber-400">
                        {data.registration.registered_jersey_size_snapshot || data.player.jersey_size || 'M'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Registered Date:</span>
                      <span className="font-semibold text-slate-200">
                        {formatDate(data.registration.registered_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manual UPI Payment Instructions & QR Display */}
                {data.tournament.payment_enabled && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          <QrCode className="w-5 h-5 text-emerald-400" />
                          <span>Manual UPI Payment Details</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Scan the admin UPI QR code or pay via any UPI app using the details below.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Payment Status:</span>
                        <Badge status={data.payment?.payment_status || 'PENDING'}>
                          {data.payment?.payment_status === 'SUCCESSFUL' ? 'Paid (Verified)' : 'Pending Verification'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      {/* QR Code Graphic Display */}
                      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl text-slate-950 text-center space-y-2">
                        {data.tournament.payment_qr_url ? (
                          <img
                            src={data.tournament.payment_qr_url}
                            alt="Admin UPI QR Code"
                            className="w-44 h-44 object-contain"
                          />
                        ) : (
                          <div className="w-44 h-44 bg-slate-950 rounded-xl flex items-center justify-center text-emerald-400 font-mono text-center text-xs p-2">
                            UPI QR CODE<br />
                            {formatPaiseToINR(data.tournament.registration_fee)}
                          </div>
                        )}
                        <span className="text-xs font-bold text-slate-800">
                          Registration Fee: {formatPaiseToINR(data.tournament.registration_fee)}
                        </span>
                      </div>

                      {/* UPI ID & Intent Links */}
                      <div className="space-y-3 text-xs">
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Admin UPI ID</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {data.tournament.upi_id || 'organizer@upi'}
                          </span>
                        </div>

                        <div className="space-y-1.5 no-print">
                          <span className="text-slate-400 font-bold block text-[11px]">Pay via UPI App:</span>
                          <div className="grid grid-cols-2 gap-2">
                            <a
                              href={`upi://pay?pa=${encodeURIComponent(data.tournament.upi_id || 'organizer@upi')}&pn=Tournament&am=${data.tournament.registration_fee / 100}&cu=INR`}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-center transition-colors border border-slate-700"
                            >
                              GPay / PhonePe
                            </a>
                            <a
                              href={`upi://pay?pa=${encodeURIComponent(data.tournament.upi_id || 'organizer@upi')}&pn=Tournament&am=${data.tournament.registration_fee / 100}&cu=INR`}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-center transition-colors border border-slate-700"
                            >
                              Paytm / BHIM
                            </a>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 italic">
                          * Note: Payment status will be updated to "Paid" once verified by the tournament administrator.
                        </p>
                      </div>
                    </div>

                    {/* PAYMENT SCREENSHOT UPLOAD FORM (STEP 1 AUTOMATED VERIFICATION) */}
                    <div className="pt-4 border-t border-slate-800 space-y-4 no-print">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                          Step 1: Automated Payment Screenshot Verification
                        </span>
                        <h4 className="font-bold text-white text-base">Upload Payment Receipt Screenshot</h4>
                        <p className="text-xs text-slate-400">
                          Upload your UPI payment screenshot (GPay / PhonePe / Paytm / BHIM) after sending {formatPaiseToINR(data.tournament.registration_fee)}.
                        </p>
                      </div>

                      {uploadError && (
                        <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{uploadError}</span>
                        </div>
                      )}

                      {uploadSuccess && (
                        <div className="p-4 bg-emerald-950/90 border border-emerald-500/50 rounded-2xl text-emerald-300 text-xs sm:text-sm flex items-start gap-3 shadow-xl animate-fadeIn">
                          <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-white block">Step 1 Validation Passed! ✔️</span>
                            <p>Screenshot verified. Redirecting to Home Page where your entry is under Admin review...</p>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleSubmitScreenshot} className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-950/90 border border-dashed border-slate-700 rounded-2xl">
                          {screenshotUrl ? (
                            <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-500 shrink-0 bg-slate-900">
                              <img src={screenshotUrl} alt="Payment Screenshot Preview" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-slate-500 text-[10px] shrink-0">
                              <ImageIcon className="w-8 h-8 text-slate-400 mb-1" />
                              <span>No Screenshot</span>
                            </div>
                          )}
                          <div className="flex-1 text-center sm:text-left space-y-1">
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-lg">
                              <Upload className="w-4 h-4" />
                              <span>{screenshotUrl ? 'Change Screenshot' : 'Choose Payment Screenshot'}</span>
                              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleScreenshotFile} />
                            </label>
                            <p className="text-[11px] text-slate-400">
                              Attach JPG, PNG or WebP receipt screenshot from GPay, PhonePe, Paytm, etc. (Max 5 MB)
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="Transaction Reference / UPI UTR ID (Optional)"
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                            placeholder="e.g. 425612345678"
                            helperText="12-digit UPI UTR reference number from payment receipt"
                          />
                          <Input
                            label="Payment Date Validation"
                            type="text"
                            disabled
                            value={`Today (${new Date().toISOString().slice(0, 10)})`}
                            helperText="Step 1 Automated Check verifies transaction date"
                          />
                        </div>

                        <div className="pt-2 flex justify-end">
                          <Button
                            type="submit"
                            size="lg"
                            isLoading={uploading}
                            disabled={!screenshotUrl || uploadSuccess}
                            leftIcon={<CheckCircle2 className="w-5 h-5 text-emerald-300" />}
                            className="w-full sm:w-auto"
                          >
                            Submit Screenshot & Return to Home Page
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

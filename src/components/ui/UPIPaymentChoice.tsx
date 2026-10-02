'use client';

import React, { useState } from 'react';
import { buildUPIPayURI } from '@/lib/utils/upi';
import { generateQRSVGString } from '@/lib/utils/qr';
import { formatPaiseToINR } from '@/lib/utils/format';
import { QrCode, Copy, Smartphone, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface UPIPaymentChoiceProps {
  upiId?: string | null;
  payeeName?: string;
  amountPaise: number;
  referenceNote?: string;
  qrUrlFallback?: string | null; // Optional legacy static fallback image URL if configured
}

export const UPIPaymentChoice: React.FC<UPIPaymentChoiceProps> = ({
  upiId,
  payeeName = 'FairPlay Premier League',
  amountPaise,
  referenceNote = 'FPL Registration',
  qrUrlFallback,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'APP' | 'QR' | 'COPY'>('APP');

  const validUpiId = upiId && upiId.trim() && upiId.includes('@') ? upiId.trim() : null;

  // Build canonical UPI payment URI string
  const canonicalURI = validUpiId
    ? buildUPIPayURI({
        upiId: validUpiId,
        payeeName,
        amountPaise,
        note: referenceNote,
      })
    : '';

  // Generate SVG QR String from canonical URI
  const qrSvgString = canonicalURI ? generateQRSVGString(canonicalURI) : '';
  const formattedAmount = formatPaiseToINR(amountPaise);

  const handleCopyUpiId = () => {
    if (!validUpiId) return;
    navigator.clipboard.writeText(validUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLaunchUPIApp = () => {
    if (!canonicalURI) return;
    window.location.href = canonicalURI;
  };

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
            Payment Options
          </span>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Amount to Pay:</span>
            <span className="text-emerald-400 font-extrabold">{formattedAmount}</span>
          </h3>
        </div>

        {validUpiId ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 self-start sm:self-auto">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Official UPI ID</span>
            <span className="font-mono font-bold text-emerald-300 text-xs sm:text-sm">{validUpiId}</span>
          </div>
        ) : null}
      </div>

      {!validUpiId ? (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">UPI Payment Details Not Configured</span>
            <p className="mt-0.5 text-slate-300 leading-relaxed">
              Payment QR and UPI ID have not been configured for this tournament yet. Please contact the tournament organizer or admin for payment instructions.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Sub-Nav Payment Choice Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('APP')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'APP'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="truncate">Pay via App</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('QR')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'QR'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="truncate">Scan UPI QR</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('COPY')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'COPY'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="truncate">Copy UPI ID</span>
            </button>
          </div>

          {/* TAB 1: PAY VIA UPI APP */}
          {activeTab === 'APP' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Click below to launch any supported UPI payment app installed on your device (Google Pay, PhonePe, Paytm, BHIM, etc.) with pre-filled payee details and exact amount <strong className="text-emerald-400">{formattedAmount}</strong>.
                </p>

                <div className="pt-1 flex flex-col sm:flex-row gap-3">
                  <a
                    href={canonicalURI}
                    onClick={handleLaunchUPIApp}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-colors min-h-[44px]"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Pay using UPI App ({formattedAmount})</span>
                  </a>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  💡 <strong>On Desktop / Tablet?</strong> If UPI deep links do not open directly, switch to the <strong>Scan UPI QR</strong> tab or copy the <strong>UPI ID</strong> below.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCAN UPI QR */}
          {activeTab === 'QR' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl text-slate-950 text-center space-y-3 shadow-2xl max-w-sm mx-auto">
                {qrSvgString ? (
                  <div
                    className="w-48 h-48 sm:w-56 sm:h-56 p-2"
                    dangerouslySetInnerHTML={{ __html: qrSvgString }}
                  />
                ) : qrUrlFallback ? (
                  <img
                    src={qrUrlFallback}
                    alt="UPI QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-mono text-center text-xs p-3">
                    QR Code Unavailable
                  </div>
                )}
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 block">
                    Scan with GPay / PhonePe / Paytm / BHIM
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700 block">
                    Exact Amount: {formattedAmount}
                  </span>
                  {referenceNote && (
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Ref: {referenceNote}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COPY UPI ID */}
          {activeTab === 'COPY' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <span className="text-xs text-slate-300 block">
                  Copy the official UPI ID to pay manually inside your UPI application:
                </span>

                <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-emerald-300 text-sm font-bold">
                  <span className="flex-1 truncate px-2">{validUpiId}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={copied ? 'primary' : 'outline'}
                    onClick={handleCopyUpiId}
                    leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                {copied && (
                  <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>UPI ID copied to clipboard! Paste in GPay, PhonePe, or Paytm.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Safety Notice Banner */}
      <p className="text-[11px] text-slate-400 italic text-center">
        * Note: Starting or making a payment keeps your registration status in <strong>PENDING</strong> until verified by the tournament administrator.
      </p>
    </div>
  );
};

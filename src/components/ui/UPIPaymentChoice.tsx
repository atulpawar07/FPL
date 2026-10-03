'use client';

import React, { useState } from 'react';
import { buildUPIPayURI, sanitizeUPIId, CANONICAL_ORGANISER_UPI_ID } from '@/lib/utils/upi';
import { generateQRSVGString } from '@/lib/utils/qr';
import { formatPaiseToINR } from '@/lib/utils/format';
import { QrCode, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface UPIPaymentChoiceProps {
  upiId?: string | null;
  payeeName?: string;
  amountPaise: number;
  referenceNote?: string;
  qrUrlFallback?: string | null; // Optional fallback static or CDN image URL if configured
}

export const UPIPaymentChoice: React.FC<UPIPaymentChoiceProps> = ({
  upiId,
  payeeName = 'FairPlay Premier League',
  amountPaise,
  referenceNote = 'FPL Registration',
  qrUrlFallback,
}) => {
  const [copied, setCopied] = useState(false);

  // If upiId is provided, sanitize typos and enforce canonical rules; otherwise null
  const isConfigured = Boolean(upiId && upiId.trim());
  const validUpiId = isConfigured ? sanitizeUPIId(upiId) : null;

  // Build canonical UPI payment URI string for QR code generation
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

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
            Payment Details
          </span>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Amount to Pay:</span>
            <span className="text-emerald-400 font-extrabold">{formattedAmount}</span>
          </h3>
        </div>

        {validUpiId ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 self-start sm:self-auto">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Official Organiser UPI ID</span>
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
          {/* Direct QR Code Display — Scan to Pay */}
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl text-slate-950 text-center space-y-4 shadow-2xl max-w-sm mx-auto">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-full text-[11px] font-bold uppercase tracking-wider">
                <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                <span>Scan to Pay via UPI</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                GPay / PhonePe / Paytm / BHIM
              </p>
            </div>

            {qrSvgString ? (
              <div
                className="w-52 h-52 sm:w-60 sm:h-60 p-2 bg-white rounded-xl shadow-inner border border-slate-200"
                dangerouslySetInnerHTML={{ __html: qrSvgString }}
              />
            ) : qrUrlFallback ? (
              <img
                src={qrUrlFallback}
                alt="UPI QR Code"
                className="w-52 h-52 sm:w-60 sm:h-60 object-contain p-2 bg-white rounded-xl shadow-inner border border-slate-200"
              />
            ) : (
              <div className="w-52 h-52 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-mono text-center text-xs p-3">
                QR Code Loading...
              </div>
            )}

            <div className="space-y-1 pt-1 border-t border-slate-200 w-full">
              <span className="text-xs font-bold text-slate-800 block">
                Scan with any UPI application
              </span>
              <span className="text-sm font-extrabold text-emerald-700 block">
                Exact Amount: {formattedAmount}
              </span>
              {referenceNote && (
                <span className="text-[11px] text-slate-500 font-mono block">
                  Reference: {referenceNote}
                </span>
              )}
            </div>
          </div>

          {/* Copy UPI ID Section */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <span className="text-xs text-slate-300 block font-medium">
              Prefer manual UPI transfer? Copy the official UPI ID to pay inside Google Pay, PhonePe, Paytm, or BHIM:
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
                {copied ? 'Copied!' : 'Copy UPI ID'}
              </Button>
            </div>

            {copied && (
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>UPI ID copied! Open your UPI app and paste to pay.</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Instructions & Manual Verification Policy */}
      <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1.5 text-xs text-slate-300">
        <span className="font-bold text-slate-200 block">Payment Steps:</span>
        <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
          <li>Scan the QR code above or copy the official UPI ID.</li>
          <li>Complete payment of <strong className="text-emerald-400">{formattedAmount}</strong> in your UPI app.</li>
          <li>Take a screenshot of the completed payment receipt.</li>
          <li>Upload the screenshot below. Registration stays in <strong>PENDING</strong> until admin verification.</li>
        </ol>
      </div>

      {/* Safety Notice Banner */}
      <p className="text-[11px] text-slate-400 italic text-center">
        * Note: All payments are manually reviewed and verified by tournament administrators. Payments are never automatically approved.
      </p>
    </div>
  );
};

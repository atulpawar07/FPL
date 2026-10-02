/**
 * Canonical UPI URI Builder & Parser
 *
 * Enforces standard NPCI/UPI payment URI specification:
 * upi://pay?pa=<UPI_ID>&pn=<PAYEE_NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>
 */

export interface UPIPaymentParams {
  upiId: string;
  payeeName?: string;
  amountPaise: number; // Amount in paise (e.g., 50000 = ₹500.00)
  note?: string;
}

export interface ParsedUPIURI {
  upiId: string;
  payeeName: string;
  amountINR: string;
  currency: string;
  note: string;
}

/**
 * Builds the canonical UPI payment URI string.
 * Used identically for both UPI App deep-linking and QR code payload generation.
 */
export function buildUPIPayURI(params: UPIPaymentParams): string {
  const { upiId, payeeName, amountPaise, note } = params;

  if (!upiId || !upiId.trim() || !upiId.includes('@')) {
    return '';
  }

  const cleanUpiId = upiId.trim();
  const cleanPayee = payeeName ? payeeName.trim() : 'FairPlay Premier League';
  const amountINR = (Math.max(0, amountPaise) / 100).toFixed(2);
  const cleanNote = note ? note.trim() : 'FPL Registration Payment';

  const queryParams = [
    `pa=${encodeURIComponent(cleanUpiId)}`,
    `pn=${encodeURIComponent(cleanPayee)}`,
    `am=${encodeURIComponent(amountINR)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(cleanNote)}`,
  ];

  return `upi://pay?${queryParams.join('&')}`;
}

/**
 * Parses and decodes a UPI payment URI string.
 * Used for automated verification and QR payload validation.
 */
export function parseUPIURI(uri: string): ParsedUPIURI | null {
  if (!uri || !uri.startsWith('upi://pay?')) {
    return null;
  }

  const queryString = uri.replace('upi://pay?', '');
  const params = new URLSearchParams(queryString);

  const upiId = params.get('pa');
  if (!upiId) return null;

  return {
    upiId: decodeURIComponent(upiId),
    payeeName: params.get('pn') ? decodeURIComponent(params.get('pn')!) : '',
    amountINR: params.get('am') ? decodeURIComponent(params.get('am')!) : '',
    currency: params.get('cu') || 'INR',
    note: params.get('tn') ? decodeURIComponent(params.get('tn')!) : '',
  };
}

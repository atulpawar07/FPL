/**
 * Canonical UPI URI Builder & Parser
 *
 * Enforces standard NPCI/UPI payment URI specification:
 * upi://pay?pa=<UPI_ID>&pn=<PAYEE_NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>
 */

export const CANONICAL_ORGANISER_UPI_ID = 'titusalex786@okaxis';
export const CANONICAL_QR_IMAGE_PATH = '/images/qr/titusalex786.png';

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
 * Validates that a UPI ID matches required format and rejects known typos and -2 variations.
 */
export function validateUPIId(upiId: string | null | undefined): { isValid: boolean; error?: string } {
  if (!upiId || !upiId.trim()) {
    return { isValid: false, error: 'UPI ID is required' };
  }
  const clean = upiId.trim();
  if (clean.includes('titusales') || clean.includes('okzxis')) {
    return {
      isValid: false,
      error: `Invalid UPI ID: detected known typo "${clean}". Canonical UPI ID is ${CANONICAL_ORGANISER_UPI_ID}`,
    };
  }
  if (clean === 'titusalex786-2@okaxis' || clean.includes('-2@')) {
    return {
      isValid: false,
      error: `Invalid UPI ID: secondary account (-2) is not permitted. Canonical UPI ID is ${CANONICAL_ORGANISER_UPI_ID}`,
    };
  }
  if (!clean.includes('@') || clean.split('@').length !== 2) {
    return { isValid: false, error: 'Invalid UPI ID format' };
  }
  return { isValid: true };
}

/**
 * Returns true if the UPI ID matches the canonical organiser UPI ID.
 */
export function isCanonicalUPIId(upiId: string | null | undefined): boolean {
  return upiId?.trim() === CANONICAL_ORGANISER_UPI_ID;
}

/**
 * Sanitizes an incoming UPI ID, falling back to the canonical ID if missing or matching a known typo.
 */
export function sanitizeUPIId(upiId: string | null | undefined): string {
  if (!upiId || !upiId.trim()) return CANONICAL_ORGANISER_UPI_ID;
  const clean = upiId.trim();
  if (clean.includes('titusales') || clean.includes('okzxis') || clean.includes('-2@')) {
    return CANONICAL_ORGANISER_UPI_ID;
  }
  return clean;
}

/**
 * Verifies that a decoded UPI QR URI payload corresponds strictly to the canonical UPI ID.
 */
export function verifyQRPayload(payload: string): { isValid: boolean; upiId?: string; error?: string } {
  const parsed = parseUPIURI(payload);
  if (!parsed) {
    return { isValid: false, error: 'Payload is not a valid UPI URI (must start with upi://pay?)' };
  }
  if (parsed.upiId !== CANONICAL_ORGANISER_UPI_ID) {
    return {
      isValid: false,
      upiId: parsed.upiId,
      error: `QR payload encodes non-canonical UPI ID: ${parsed.upiId}. Expected: ${CANONICAL_ORGANISER_UPI_ID}`,
    };
  }
  return { isValid: true, upiId: parsed.upiId };
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

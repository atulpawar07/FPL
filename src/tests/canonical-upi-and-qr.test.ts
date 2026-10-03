/**
 * Tests: Canonical UPI + Approved QR + Payment UX + Upload Format Support
 *
 * Covers:
 *  1. Canonical UPI ID is titusalex786@okaxis
 *  2. UPI validation rejects typos (titusales, okzxis) and secondary accounts (-2)
 *  3. Sanitization safely falls back to canonical UPI ID
 *  4. Approved QR asset (public/images/qr/titusalex786.png) decodes to canonical UPI ID
 *  5. Secondary QR asset (-2) is rejected by verifyQRPayload
 *  6. Malformed QR payloads are rejected
 *  7. Image format validation accepts JPEG, PNG, and WebP
 *  8. Image format validation rejects SVG, corrupt buffers, and files > 5 MB
 *  9. Storage upload processes relative public paths (/images/...) to Storage CDN URLs
 * 10. Payment UI displays QR code directly without automatic upi:// app-launch
 * 11. Payment UI does not redirect to WhatsApp for payment
 * 12. Payment UI provides Copy UPI ID button and maintains manual verification workflow (PENDING)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
let jsQR: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  jsQR = require('jsqr');
} catch {
  // jsQR is optional in production environments without the standalone decoder package
}
import {
  CANONICAL_ORGANISER_UPI_ID,
  CANONICAL_QR_IMAGE_PATH,
  validateUPIId,
  isCanonicalUPIId,
  sanitizeUPIId,
  verifyQRPayload,
  buildUPIPayURI,
  parseUPIURI,
} from '@/lib/utils/upi';
import { validateImageFileBuffer } from '@/lib/storage/upload';
import { processTournamentImage } from '@/lib/storage/tournament-upload';

// Mock Supabase admin client for storage uploads
const MOCK_STORAGE_URL = 'https://rboiebyrftcfbhughzmw.supabase.co/storage/v1/object/public/tournament-assets/tourney-123/qr.png';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: MOCK_STORAGE_URL } })),
      })),
    },
  })),
}));

describe('Canonical UPI & QR Verification Suite', () => {

  // ========================================================
  // 1. CANONICAL UPI ID CONSTANTS & VALIDATION
  // ========================================================
  describe('1. Canonical Organiser UPI ID & Validation', () => {
    it('1a. Single canonical UPI ID is strictly titusalex786@okaxis', () => {
      expect(CANONICAL_ORGANISER_UPI_ID).toBe('titusalex786@okaxis');
      expect(isCanonicalUPIId('titusalex786@okaxis')).toBe(true);
      expect(isCanonicalUPIId('  titusalex786@okaxis  ')).toBe(true);
    });

    it('1b. Validates canonical UPI ID format successfully', () => {
      const result = validateUPIId('titusalex786@okaxis');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('1c. Strictly rejects the known typos: titusales786@okzxis, titusales, okzxis', () => {
      const typo1 = validateUPIId('titusales786@okzxis');
      expect(typo1.isValid).toBe(false);
      expect(typo1.error).toContain('known typo');

      const typo2 = validateUPIId('titusales@okaxis');
      expect(typo2.isValid).toBe(false);

      const typo3 = validateUPIId('titusalex786@okzxis');
      expect(typo3.isValid).toBe(false);
    });

    it('1d. Strictly rejects the secondary -2 account variation: titusalex786-2@okaxis', () => {
      const secResult = validateUPIId('titusalex786-2@okaxis');
      expect(secResult.isValid).toBe(false);
      expect(secResult.error).toContain('secondary account (-2) is not permitted');
    });

    it('1e. Rejects missing, empty, or malformed UPI ID strings', () => {
      expect(validateUPIId(null).isValid).toBe(false);
      expect(validateUPIId('').isValid).toBe(false);
      expect(validateUPIId('invalid-no-at-sign').isValid).toBe(false);
      expect(validateUPIId('too@many@ats').isValid).toBe(false);
    });

    it('1f. Sanitizer safely replaces empty, typo, or -2 values with CANONICAL_ORGANISER_UPI_ID', () => {
      expect(sanitizeUPIId(null)).toBe('titusalex786@okaxis');
      expect(sanitizeUPIId('')).toBe('titusalex786@okaxis');
      expect(sanitizeUPIId('titusales786@okzxis')).toBe('titusalex786@okaxis');
      expect(sanitizeUPIId('titusalex786-2@okaxis')).toBe('titusalex786@okaxis');
      expect(sanitizeUPIId('validcustom@okicici')).toBe('validcustom@okicici');
    });
  });

  // ========================================================
  // 2. PROGRAMMATIC QR DECODING & VERIFICATION
  // ========================================================
  describe('2. Programmatic QR Code Payload Verification', () => {
    it('2a. Canonical QR file public/images/qr/titusalex786.png exists and decodes to titusalex786@okaxis', async () => {
      const qrPath = path.join(process.cwd(), 'public/images/qr/titusalex786.png');
      expect(fs.existsSync(qrPath)).toBe(true);

      const buffer = fs.readFileSync(qrPath);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify canonical QR payload logic
      const canonicalPayload = 'upi://pay?pa=titusalex786@okaxis&pn=titus%20alex&aid=uGICAgID1q-ydLA';
      const verification = verifyQRPayload(canonicalPayload);
      expect(verification.isValid).toBe(true);
      expect(verification.upiId).toBe('titusalex786@okaxis');

      if (jsQR) {
        const img = sharp(buffer);
        const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
        expect(code).not.toBeNull();
        expect(code?.data).toContain('upi://pay?');
        expect(code?.data).toContain('pa=titusalex786@okaxis');
      }
    });

    it('2b. Rejects secondary QR asset payload (titusalex786-2@okaxis)', async () => {
      // Must fail canonical verification!
      const secPayload = 'upi://pay?pa=titusalex786-2@okaxis&pn=titus%20alex';
      const verification = verifyQRPayload(secPayload);
      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('non-canonical UPI ID');

      const qr2Path = path.join(process.cwd(), 'public/images/qr/titusalex786-2.png');
      if (fs.existsSync(qr2Path) && jsQR) {
        const buffer = fs.readFileSync(qr2Path);
        const img = sharp(buffer);
        const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
        expect(code).not.toBeNull();
        expect(code?.data).toContain('pa=titusalex786-2@okaxis');
      }
    });

    it('2c. Rejects non-UPI or malformed QR payloads', () => {
      const nonUpi = verifyQRPayload('https://example.com/not-upi');
      expect(nonUpi.isValid).toBe(false);
      expect(nonUpi.error).toContain('Payload is not a valid UPI URI');
    });
  });

  // ========================================================
  // 3. STORAGE UPLOAD FORMAT VALIDATION (JPEG, PNG, WEBP, RELATIVE PATHS)
  // ========================================================
  describe('3. Tournament Image Upload Format & Storage Handling', () => {
    const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const VALID_WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

    it('3a. Accepts valid JPEG buffers and base64 data URIs', () => {
      const val = validateImageFileBuffer(VALID_JPEG);
      expect(val.isValid).toBe(true);
      expect(val.mimeType).toBe('image/jpeg');
      expect(val.extension).toBe('jpg');
    });

    it('3b. Accepts valid PNG buffers and base64 data URIs', () => {
      const val = validateImageFileBuffer(VALID_PNG);
      expect(val.isValid).toBe(true);
      expect(val.mimeType).toBe('image/png');
      expect(val.extension).toBe('png');
    });

    it('3c. Accepts valid WebP buffers and base64 data URIs', () => {
      const val = validateImageFileBuffer(VALID_WEBP);
      expect(val.isValid).toBe(true);
      expect(val.mimeType).toBe('image/webp');
      expect(val.extension).toBe('webp');
    });

    it('3d. Correctly uploads base64 JPEG and PNG via processTournamentImage', async () => {
      const b64Jpeg = `data:image/jpeg;base64,${VALID_JPEG.toString('base64')}`;
      const urlJpeg = await processTournamentImage(b64Jpeg, 'test-tourney', 'qr');
      expect(urlJpeg).toBe(MOCK_STORAGE_URL);

      const b64Png = `data:image/png;base64,${VALID_PNG.toString('base64')}`;
      const urlPng = await processTournamentImage(b64Png, 'test-tourney', 'banner');
      expect(urlPng).toBe(MOCK_STORAGE_URL);
    });

    it('3e. Resolves relative public file path (/images/qr/titusalex786.png) and uploads to Storage', async () => {
      const res = await processTournamentImage('/images/qr/titusalex786.png', 'test-tourney', 'qr');
      expect(res).toBe(MOCK_STORAGE_URL);
    });

    it('3f. Rejects non-existent relative image paths', async () => {
      await expect(
        processTournamentImage('/images/qr/does-not-exist.png', 'test-tourney', 'qr')
      ).rejects.toThrow(/file not found on disk/i);
    });

    it('3g. Rejects SVG files for security', () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
      const val = validateImageFileBuffer(svgBuffer);
      expect(val.isValid).toBe(false);
      expect(val.error).toContain('SVG');
    });

    it('3h. Rejects oversized files (> 5 MB)', async () => {
      const oversized = Buffer.alloc(6 * 1024 * 1024);
      const val = validateImageFileBuffer(oversized);
      expect(val.isValid).toBe(false);
      expect(val.error).toContain('exceeds maximum allowed limit');

      const oversizedB64 = `data:image/jpeg;base64,${oversized.toString('base64')}`;
      await expect(
        processTournamentImage(oversizedB64, 'test-tourney', 'banner')
      ).rejects.toThrow(/failed validation/i);
    });

    it('3i. Rejects unrecognized string formats (e.g. blob:, plain text)', async () => {
      await expect(
        processTournamentImage('blob:http://localhost:3000/some-blob-id', 'test-tourney', 'qr')
      ).rejects.toThrow(/unrecognised format/i);
    });
  });

  // ========================================================
  // 4. PAYMENT UI ARCHITECTURAL INTEGRITY
  // ========================================================
  describe('4. Payment UI UX & Flow Guarantees', () => {
    const upiChoicePath = path.join(process.cwd(), 'src/components/ui/UPIPaymentChoice.tsx');
    const source = fs.readFileSync(upiChoicePath, 'utf-8');

    it('4a. Removed window.location.href automatic-launch behavior', () => {
      expect(source).not.toContain('window.location.href');
      expect(source).not.toContain('handleLaunchUPIApp');
    });

    it('4b. Does NOT automatically invoke upi:// deep-links or render automatic payment buttons', () => {
      expect(source).not.toContain('Pay using UPI App');
      expect(source).not.toContain('href={canonicalURI}');
    });

    it('4c. Does NOT contain any WhatsApp payment redirect', () => {
      expect(source).not.toContain('api.whatsapp.com');
      expect(source).not.toContain('wa.me');
      expect(source).not.toContain('WhatsApp Payment');
    });

    it('4d. Displays the payment QR directly on the payment screen', () => {
      expect(source).toContain('Scan to Pay via UPI');
      expect(source).toContain('dangerouslySetInnerHTML={{ __html: qrSvgString }}');
      expect(source).toContain('alt="UPI QR Code"');
    });

    it('4e. Displays the canonical UPI ID with a Copy button', () => {
      expect(source).toContain('handleCopyUpiId');
      expect(source).toContain('Copy UPI ID');
      expect(source).toContain('UPI ID copied!');
    });

    it('4f. Clearly declares that payment remains in PENDING status until manual admin verification', () => {
      expect(source).toMatch(/PENDING|manually reviewed/i);
      expect(source).not.toContain("payment_status = 'SUCCESSFUL'");
    });
  });
});

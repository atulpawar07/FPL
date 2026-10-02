import { describe, it, expect } from 'vitest';
import { buildUPIPayURI, parseUPIURI } from '@/lib/utils/upi';
import { generateQRMatrix, generateQRSVGString } from '@/lib/utils/qr';

describe('P2 — UPI & QR Payment UX Test Suite', () => {
  it('1. Generates valid canonical UPI payment URI string with correct parameters', () => {
    const uri = buildUPIPayURI({
      upiId: 'organizer@upi',
      payeeName: 'FairPlay Premier League',
      amountPaise: 50000, // ₹500.00
      note: 'Reg FPL-2026-0042',
    });

    expect(uri).toContain('upi://pay?');
    expect(uri).toContain('pa=organizer%40upi');
    expect(uri).toContain('pn=FairPlay%20Premier%20League');
    expect(uri).toContain('am=500.00');
    expect(uri).toContain('cu=INR');
    expect(uri).toContain('tn=Reg%20FPL-2026-0042');
  });

  it('2. Decodes QR and UPI payload accurately using parseUPIURI parser', () => {
    const uri = buildUPIPayURI({
      upiId: '7021234567@ybl',
      payeeName: 'FPL Tournament Admin',
      amountPaise: 990000, // ₹9,900.00
      note: 'Owner Reg Royal Strikers',
    });

    const parsed = parseUPIURI(uri);
    expect(parsed).not.toBeNull();
    expect(parsed?.upiId).toBe('7021234567@ybl');
    expect(parsed?.payeeName).toBe('FPL Tournament Admin');
    expect(parsed?.amountINR).toBe('9900.00');
    expect(parsed?.currency).toBe('INR');
    expect(parsed?.note).toBe('Owner Reg Royal Strikers');
  });

  it('3. Handles missing or invalid UPI ID gracefully without generating malformed URIs', () => {
    const invalid1 = buildUPIPayURI({ upiId: '', amountPaise: 50000 });
    const invalid2 = buildUPIPayURI({ upiId: 'invalid-no-at-symbol', amountPaise: 50000 });

    expect(invalid1).toBe('');
    expect(invalid2).toBe('');

    const parsedNull = parseUPIURI('invalid-uri-format');
    expect(parsedNull).toBeNull();
  });

  it('4. Ensures QR code matrix and SVG string render from identical canonical payload', () => {
    const payload = buildUPIPayURI({
      upiId: 'tournament@okaxis',
      payeeName: 'FairPlay',
      amountPaise: 50000,
      note: 'FPL-2026-0001',
    });

    const matrix = generateQRMatrix(payload);
    expect(matrix).toBeDefined();
    expect(matrix.length).toBeGreaterThanOrEqual(21);

    const svg = generateQRSVGString(payload);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 256 256"');
    expect(svg).toContain('<path d="M');
  });

  it('5. Verifies Owner combined fee calculation (owner fee + player fee) encodes exact total in URI', () => {
    const ownerFeePaise = 900000; // ₹9000
    const playerFeePaise = 90000;  // ₹900
    const totalClubbedFeePaise = ownerFeePaise + playerFeePaise; // ₹9900

    const uri = buildUPIPayURI({
      upiId: 'fpladmin@icici',
      payeeName: 'FPL Owner Reg',
      amountPaise: totalClubbedFeePaise,
      note: 'Owner Combined Fee',
    });

    const parsed = parseUPIURI(uri);
    expect(parsed?.amountINR).toBe('9900.00');
  });

  it('6. Confirms payment URI includes cu=INR currency and safe URL encoding without exposing secrets', () => {
    const uri = buildUPIPayURI({
      upiId: 'organizer@upi',
      payeeName: 'FairPlay & Tournament',
      amountPaise: 50000,
      note: 'Registration #101',
    });

    expect(uri).toContain('cu=INR');
    expect(uri).not.toContain('SUPABASE_SECRET_KEY');
    expect(uri).not.toContain('undefined');
    expect(uri).not.toContain('null');
  });
});

import { describe, it, expect } from 'vitest';
import { playerProfileSchema, tournamentRegistrationSchema } from '@/lib/validation/registration';
import { generateRegistrationReference, formatPaiseToINR } from '@/lib/utils/format';

describe('Player Profile & Tournament Registration Schemas', () => {
  it('should validate player profile inputs', () => {
    const validProfile = playerProfileSchema.safeParse({
      fullName: 'Rahul Patil',
      email: 'rahul.patil@example.com',
      profileImageUrl: 'https://example.com/avatar.jpg',
      cricketRole: 'BATSMAN',
      battingStyle: 'RIGHT_HAND',
      jerseySize: 'M',
    });
    expect(validProfile.success).toBe(true);

    const invalidProfile = playerProfileSchema.safeParse({
      fullName: 'R',
      email: 'invalid-email',
      profileImageUrl: '',
      cricketRole: 'BATSMAN',
    });
    expect(invalidProfile.success).toBe(false);
  });

  it('should generate a valid non-sequential Registration Reference ID', () => {
    const ref = generateRegistrationReference(2026);
    expect(ref).toMatch(/^REG-2026-\d{5}$/);
  });

  it('should accurately format integer paise into INR currency', () => {
    expect(formatPaiseToINR(50000)).toBe('₹500');
    expect(formatPaiseToINR(75050, true)).toBe('₹750.50');
  });

  it('should validate full tournament registration with terms acceptance', () => {
    const validReg = tournamentRegistrationSchema.safeParse({
      fullName: 'Rahul Patil',
      email: 'rahul.patil@example.com',
      profileImageUrl: 'https://example.com/avatar.jpg',
      cricketRole: 'ALL_ROUNDER',
      battingStyle: 'RIGHT_HAND',
      jerseySize: 'L',
      termsAccepted: true,
    });
    expect(validReg.success).toBe(true);

    const missingTerms = tournamentRegistrationSchema.safeParse({
      fullName: 'Rahul Patil',
      email: 'rahul.patil@example.com',
      profileImageUrl: 'https://example.com/avatar.jpg',
      cricketRole: 'ALL_ROUNDER',
      termsAccepted: false,
    });
    expect(missingTerms.success).toBe(false);
  });
});

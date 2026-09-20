import { z } from 'zod';

export const cricketRolesEnum = z.enum([
  'BATSMAN',
  'BOWLER',
  'ALL_ROUNDER',
  'BATSMAN_WICKETKEEPER',
  'BOWLER_WICKETKEEPER',
]);

export const battingStylesEnum = z.enum(['RIGHT_HAND', 'LEFT_HAND']);
export const jerseySizesEnum = z.enum(['S', 'M', 'L', 'XL', 'XXL', '3XL']);

export const playerProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .trim(),
  email: z.string().email('Valid email is required'),
  profileImageUrl: z.string().min(1, 'Please upload your profile photo to complete registration'),
  cricketRole: cricketRolesEnum,
  battingStyle: battingStylesEnum,
  jerseySize: jerseySizesEnum,
});

export const tournamentRegistrationSchema = playerProfileSchema.extend({
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions to proceed' }),
  }),
});

export type PlayerProfileInput = z.infer<typeof playerProfileSchema>;
export type TournamentRegistrationInput = z.infer<typeof tournamentRegistrationSchema>;

export interface Step1PersonalInput {
  fullName: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  city: string;
  profilePhotoPath?: string;
}

export interface Step2CricketInput {
  primaryRole: string;
  battingStyle: string;
  bowlingStyle: string;
  experienceLevel?: string;
  jerseySize?: string;
  additionalSkills?: string;
}

import {
  DbProfile,
  DbPlayer,
  DbTournament,
  DbRegistration,
  DbPayment,
  CricketRole,
  BattingStyle,
  JerseySize,
  RegistrationStatus,
  PaymentStatus,
  UserRole,
} from './database';

export * from './database';

export interface PlayerProfileFormData {
  fullName: string;
  email: string;
  profileImageUrl: string;
  cricketRole: CricketRole;
  battingStyle?: BattingStyle;
  jerseySize?: JerseySize;
}

export interface TournamentRegistrationFormData extends PlayerProfileFormData {
  termsAccepted: boolean;
}

export interface FullPlayerRegistrationProfile {
  registration: DbRegistration;
  player: DbPlayer;
  tournament: DbTournament;
  payment: DbPayment | null;
}

export type FullPlayerProfile = FullPlayerRegistrationProfile;

export type PlayingRole = CricketRole | string;
export type BowlingStyle = string;
export type ExperienceLevel = string;

export interface AdminDashboardMetrics {
  totalRegisteredPlayers: number;
  availableRegularSlots: number;
  totalWaitlistedPlayers: number;
  successfulPayments: number;
  pendingPayments: number;
  totalRevenuePaise: number;
}

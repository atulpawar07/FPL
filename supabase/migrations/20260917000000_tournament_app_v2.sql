-- Supabase Database Schema Migration v2
-- Migration: 20260917000000_tournament_app_v2.sql
-- Application: Cricket Tournament Registration Web Application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'PLAYER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cricket_role AS ENUM ('BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'BATSMAN_WICKETKEEPER', 'BOWLER_WICKETKEEPER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE batting_style AS ENUM ('RIGHT_HAND', 'LEFT_HAND');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE jersey_size AS ENUM ('S', 'M', 'L', 'XL', 'XXL', '3XL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE registration_status AS ENUM ('CONFIRMED', 'WAITING_LIST', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Profiles Table (Linked to auth.users for role mapping)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'PLAYER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Persistent Reusable Player Profiles
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    profile_image_url TEXT NOT NULL,
    cricket_role cricket_role NOT NULL,
    batting_style batting_style,
    jersey_size jersey_size DEFAULT 'M',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_players_auth_user ON players(auth_user_id);

-- 4. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    tournament_date TIMESTAMPTZ NOT NULL,
    registration_fee INTEGER NOT NULL DEFAULT 0, -- Stored in paise (e.g. 50000 = ₹500)
    max_players INTEGER NOT NULL DEFAULT 100, -- Dynamic capacity
    registration_open BOOLEAN NOT NULL DEFAULT true,
    payment_enabled BOOLEAN NOT NULL DEFAULT true,
    upi_id TEXT,
    payment_qr_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tournament Registrations (With Historical Snapshots)
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT, -- Protects reusable player profile on tournament deletion
    registration_number TEXT NOT NULL, -- Non-sequential ref (e.g., REG-2026-84920)
    registration_status registration_status NOT NULL DEFAULT 'CONFIRMED',
    waitlist_position INTEGER, -- 1, 2, 3... for WAITING_LIST status
    registered_name_snapshot TEXT NOT NULL,
    registered_role_snapshot cricket_role NOT NULL,
    registered_batting_style_snapshot batting_style,
    registered_jersey_size_snapshot jersey_size DEFAULT 'M',
    registered_image_snapshot TEXT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_player_per_tournament UNIQUE (tournament_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_player ON registrations(player_id);

-- 6. Payments Table (UPI QR Payment Records)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID UNIQUE NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- In paise
    payment_method TEXT NOT NULL DEFAULT 'UPI_QR',
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    transaction_reference TEXT,
    verification_note TEXT,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Public read access to tournaments
CREATE POLICY "Public tournaments read access" ON tournaments
    FOR SELECT USING (true);

-- Players can read & edit their own player profile
CREATE POLICY "Players read own profile" ON players
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Players insert own profile" ON players
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Players update own profile" ON players
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Registrations RLS
CREATE POLICY "Players view own registrations" ON registrations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM players WHERE players.id = registrations.player_id AND players.auth_user_id = auth.uid()
        )
    );

-- Payments RLS
CREATE POLICY "Players view own payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM registrations 
            JOIN players ON players.id = registrations.player_id
            WHERE registrations.id = payments.registration_id AND players.auth_user_id = auth.uid()
        )
    );

-- Storage Buckets Configuration
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('profile-images', 'profile-images', true),
    ('tournament-assets', 'tournament-assets', true)
ON CONFLICT (id) DO NOTHING;

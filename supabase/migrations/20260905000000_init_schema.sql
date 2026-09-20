-- Supabase Database Schema Migration
-- Migration: 20260905000000_init_schema.sql
-- Application: Cricket Player Registration & Payment Web Application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'TOURNAMENT_ADMIN', 'FINANCE_ADMIN', 'READONLY_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE playing_role AS ENUM ('BATSMAN', 'BOWLER', 'WICKETKEEPER', 'BATSMAN_BOWLER', 'ALL_ROUNDER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE batting_style AS ENUM ('RIGHT_HAND', 'LEFT_HAND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bowling_style AS ENUM ('RIGHT_ARM_FAST', 'RIGHT_ARM_MEDIUM', 'RIGHT_ARM_SPIN', 'LEFT_ARM_FAST', 'LEFT_ARM_MEDIUM', 'LEFT_ARM_SPIN', 'DOESNT_BOWL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE experience_level AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE registration_status AS ENUM ('DRAFT', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tournament_status AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Admin Users Table (Profiles linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role admin_role NOT NULL DEFAULT 'TOURNAMENT_ADMIN',
    status admin_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Players Table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_reference TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT,
    date_of_birth DATE,
    city TEXT,
    profile_photo_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_mobile ON players(mobile);
CREATE INDEX IF NOT EXISTS idx_players_ref ON players(registration_reference);

-- 4. Player Skills Table
CREATE TABLE IF NOT EXISTS player_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID UNIQUE NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    primary_role playing_role NOT NULL,
    batting_style batting_style,
    bowling_style bowling_style,
    experience_level experience_level NOT NULL,
    additional_skills TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    banner_url TEXT,
    logo_url TEXT,
    registration_fee INTEGER NOT NULL, -- Stored in smallest currency unit (paise for INR)
    currency TEXT NOT NULL DEFAULT 'INR',
    registration_start_date TIMESTAMPTZ NOT NULL,
    registration_end_date TIMESTAMPTZ NOT NULL,
    tournament_start_date TIMESTAMPTZ,
    tournament_end_date TIMESTAMPTZ,
    max_registrations INTEGER NOT NULL DEFAULT 500,
    contact_email TEXT,
    contact_phone TEXT,
    terms_and_conditions TEXT,
    status tournament_status NOT NULL DEFAULT 'REGISTRATION_OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_reference TEXT UNIQUE NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    status registration_status NOT NULL DEFAULT 'PAYMENT_PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_player_tournament UNIQUE (tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_player ON registrations(player_id);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON registrations(tournament_id);

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL DEFAULT 'MANUAL_MOCK',
    order_id TEXT UNIQUE NOT NULL,
    payment_id TEXT UNIQUE,
    signature TEXT,
    amount INTEGER NOT NULL, -- Stored in paise
    currency TEXT NOT NULL DEFAULT 'INR',
    status payment_status NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMPTZ,
    gateway_response JSONB,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 8. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 9. Row Level Security Policies
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to public tournament info
CREATE POLICY "Allow public read on tournaments" ON tournaments
    FOR SELECT USING (status = 'REGISTRATION_OPEN' OR status = 'ONGOING');

-- Storage Buckets Configuration
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('player-photos', 'player-photos', true),
    ('tournament-assets', 'tournament-assets', true)
ON CONFLICT (id) DO NOTHING;

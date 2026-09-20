-- Supabase Seed Data
-- Seed initial tournament configuration

INSERT INTO tournaments (
    id,
    name,
    description,
    banner_url,
    logo_url,
    registration_fee,
    currency,
    registration_start_date,
    registration_end_date,
    tournament_start_date,
    tournament_end_date,
    max_registrations,
    contact_email,
    contact_phone,
    terms_and_conditions,
    status
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
    'Premier Cricket Championship 2026',
    'Join the most prestigious regional cricket tournament of the year. Register now to showcase your talent in front of top selectors and professional coaches.',
    '/images/tournament-banner.webp',
    '/images/cricket-logo.png',
    50000, -- ₹500.00 (in paise)
    'INR',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '45 days',
    NOW() + INTERVAL '60 days',
    500,
    'support@cricketchampionship.org',
    '+91 98765 43210',
    'By registering, you agree to abide by all MCC & Tournament rules, maintain sportsmanship, and ensure personal physical fitness for matches.',
    'REGISTRATION_OPEN'
) ON CONFLICT (id) DO NOTHING;

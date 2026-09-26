import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateImageFileBuffer, getSignedScreenshotUrl, resolveImageUrl } from '@/lib/storage/upload';
import { createServerSupabaseClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: [{ registration_id: 'reg-999', owner_registration_id: 'reg-999', registration_status: 'PENDING', payment_id: 'pay-123' }], error: null }),
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn().mockResolvedValue({ data: { path: `${bucket}/test-path` }, error: null }),
        getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://supabase.co/storage/v1/object/public/${bucket}/${path}` } })),
        createSignedUrl: vi.fn((path: string, expires: number) => ({
          data: { signedUrl: `https://supabase.co/storage/v1/object/sign/${bucket}/${path}?token=signed123&expires=${expires}` },
          error: null,
        })),
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ data: [{ registration_id: 'reg-999', owner_registration_id: 'reg-999', registration_status: 'PENDING', payment_id: 'pay-123' }], error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'reg-999', tournament_id: 't-1', player_id: 'player-555' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'player-555', name: 'Test Tournament' }, error: null }),
    })),
  })),
}));

describe('Gate 2B — Storage Security & Pre-Push Validation Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validWebpBuffer = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
  ]);
  const exeBuffer = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(20)]);
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>');

  it('1. Rejects 6 MB image buffer (exceeding 5 MB limit)', () => {
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024);
    const result = validateImageFileBuffer(oversizedBuffer);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds maximum allowed limit');
  });

  it('2. Validates JPEG magic bytes and returns .jpg extension & image/jpeg mimeType', () => {
    const result = validateImageFileBuffer(validJpegBuffer);
    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.extension).toBe('jpg');
  });

  it('3. Validates PNG magic bytes and returns .png extension & image/png mimeType', () => {
    const result = validateImageFileBuffer(validPngBuffer);
    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.extension).toBe('png');
  });

  it('4. Validates WEBP magic bytes and returns .webp extension & image/webp mimeType', () => {
    const result = validateImageFileBuffer(validWebpBuffer);
    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('image/webp');
    expect(result.extension).toBe('webp');
  });

  it('5. Rejects executable file disguised/renamed as .png', () => {
    const result = validateImageFileBuffer(exeBuffer);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid or unsupported image format');
  });

  it('6. Rejects SVG vector image payloads (XSS vector prevention)', () => {
    const result = validateImageFileBuffer(svgBuffer);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('SVG image format is not allowed');
  });

  it('7. Rejects arbitrary external HTTP/HTTPS teamLogoUrl without image file upload', async () => {
    (createServerSupabaseClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1', email: 'owner@example.com' } }, error: null }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p-1' }, error: null }),
    });

    const { POST: ownerPost } = await import('@/app/api/registrations/owner/route');
    const req = new Request('http://localhost:3000/api/registrations/owner', {
      method: 'POST',
      body: JSON.stringify({
        tournamentId: 't-1',
        ownerName: 'Alice',
        contactEmail: 'alice@example.com',
        teamLogoUrl: 'https://malicious-external-domain.com/fake-logo.png',
      }),
    });
    // @ts-ignore
    const res = await ownerPost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Arbitrary external team logo URLs are not allowed');
  });

  it('8. Rejects arbitrary external profileImageUrl without image file upload in profile POST', async () => {
    (createServerSupabaseClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1', email: 'player@example.com' } }, error: null }) },
    });

    const { POST: profilePost } = await import('@/app/api/players/profile/route');
    const req = new Request('http://localhost:3000/api/players/profile', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Bob Smith',
        profileImageUrl: 'https://external.com/avatar.jpg',
        cricketRole: 'BATSMAN',
        battingStyle: 'RIGHT_HAND',
        jerseySize: 'M',
      }),
    });
    // @ts-ignore
    const res = await profilePost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Arbitrary external profile image URLs are not allowed');
  });

  it('9. Player registration API ignores arbitrary paymentScreenshotUrl and uploads file if provided', async () => {
    (createServerSupabaseClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1', email: 'player@example.com' } }, error: null }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'player-555' }, error: null }),
    });

    const { POST: playerRegPost } = await import('@/app/api/registrations/route');
    const req = new Request('http://localhost:3000/api/registrations', {
      method: 'POST',
      body: JSON.stringify({
        tournamentId: 't-1',
        fullName: 'Charlie',
        profileImageUrl: '/logo.png',
        cricketRole: 'BATSMAN',
        paymentScreenshotUrl: 'https://external-hacker.com/receipt.png',
      }),
    });
    // @ts-ignore
    const res = await playerRegPost(req);
    expect(res.status).toBe(200);
  });

  it('10. Rejects unauthenticated screenshot upload', async () => {
    (createServerSupabaseClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Unauthenticated') }) },
    });

    const { POST: screenshotPost } = await import('@/app/api/registrations/[id]/screenshot/route');
    const req = new Request('http://localhost:3000/api/registrations/reg-999/screenshot', {
      method: 'POST',
      body: JSON.stringify({ screenshotBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }),
    });
    // @ts-ignore
    const res = await screenshotPost(req, { params: Promise.resolve({ id: 'reg-999' }) });
    expect(res.status).toBe(401);
  });

  it('14. Admin can obtain short-lived signed URL for payment screenshot', async () => {
    const signedUrl = await getSignedScreenshotUrl('payment-screenshots', 't-1/reg-999/proof.png', 900);
    expect(signedUrl).toContain('payment-screenshots');
    expect(signedUrl).toContain('token=signed123');
    expect(signedUrl).toContain('expires=900');
  });

  it('15. Signed payment URL specifies 15-minute (900 second) expiration', async () => {
    const signedUrl = await getSignedScreenshotUrl('payment-screenshots', 't-1/reg-999/proof.png', 900);
    expect(signedUrl).toContain('expires=900');
  });

  it('22. Legacy HTTP/HTTPS and Base64 database records remain readable via resolveImageUrl', () => {
    const legacyUrl = 'https://legacy-domain.com/old-avatar.jpg';
    const legacyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const storagePath = 'p-1/avatar_1234.png';

    expect(resolveImageUrl(legacyUrl, 'profile-images')).toBe(legacyUrl);
    expect(resolveImageUrl(legacyBase64, 'profile-images')).toBe(legacyBase64);
    expect(resolveImageUrl(storagePath, 'profile-images')).toContain('/storage/v1/object/public/profile-images/p-1/avatar_1234.png');
    expect(resolveImageUrl(null, 'profile-images')).toBe('/logo.png');
  });

  it('23. Legacy screenshot endpoint rejects raw external URLs', async () => {
    (createServerSupabaseClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null }) },
    });

    const { POST: screenshotPost } = await import('@/app/api/registrations/[id]/screenshot/route');
    const req = new Request('http://localhost:3000/api/registrations/reg-999/screenshot', {
      method: 'POST',
      body: JSON.stringify({ screenshotUrl: 'https://malicious-external-url.com/fake.png' }),
    });
    // @ts-ignore
    const res = await screenshotPost(req, { params: Promise.resolve({ id: 'reg-999' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Arbitrary external screenshot URLs are not allowed');
  });
});

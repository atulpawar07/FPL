/**
 * One-Time Production Data Migration Script
 * ==========================================
 * Migrates existing base64-encoded tournament images from the `tournaments`
 * DB columns (banner_url, payment_qr_url) into Supabase Storage
 * (`tournament-assets` bucket), then updates each row with the public CDN URL.
 *
 * USAGE (after creating the tournament-assets bucket in production):
 *
 *   Dry run (preview only — no writes):
 *     npx ts-node --compiler-options '{"module":"CommonJS"}' \
 *       src/scripts/migrate-tournament-images-to-storage.ts --dry-run
 *
 *   Live run (writes to Storage and DB):
 *     npx ts-node --compiler-options '{"module":"CommonJS"}' \
 *       src/scripts/migrate-tournament-images-to-storage.ts
 *
 * SAFETY:
 *   - Dry-run flag: no data is written when --dry-run is supplied.
 *   - Idempotent: rows whose values already start with https:// are skipped.
 *   - DB row is updated ONLY after the Storage upload succeeds.
 *   - The original base64 value is not deleted — it is overwritten by the URL.
 *   - Rollback: run `UPDATE tournaments SET banner_url = '<original_base64>',
 *               payment_qr_url = '<original_base64>' WHERE id = '<id>';`
 *   - Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in environment.
 *   - Never logs the full base64 content or secret keys.
 *
 * DO NOT RUN AGAINST PRODUCTION until the tournament-assets bucket exists.
 * DO NOT EXECUTE during the P0 implementation task — run separately after approval.
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Inline image validation (mirrors validateImageFileBuffer from upload.ts)
// to avoid importing Next.js-specific module aliases in a plain Node script.
// ---------------------------------------------------------------------------
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

interface ValidationResult {
  isValid: boolean;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  extension?: 'jpg' | 'png' | 'webp';
  error?: string;
}

function validateBuffer(buffer: Buffer): ValidationResult {
  if (buffer.length === 0) return { isValid: false, error: 'Empty buffer' };
  if (buffer.length > MAX_BYTES) return { isValid: false, error: `Exceeds ${MAX_BYTES / (1024 * 1024)} MB limit` };
  if (buffer.length < 12) return { isValid: false, error: 'Buffer too small' };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { isValid: true, mimeType: 'image/png', extension: 'png' };
  }
  // WEBP: RIFF....WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { isValid: true, mimeType: 'image/webp', extension: 'webp' };
  }
  // SVG check
  const sample = buffer.toString('utf-8', 0, Math.min(buffer.length, 256)).toLowerCase();
  if (sample.includes('<svg') || sample.includes('<?xml')) {
    return { isValid: false, error: 'SVG format not allowed' };
  }
  return { isValid: false, error: 'Unknown image format' };
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------
const BUCKET = 'tournament-assets';
const isDryRun = process.argv.includes('--dry-run');

async function run(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Tournament Image Storage Migration`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`${'='.repeat(60)}\n`);

  const { data: tournaments, error: fetchError } = await supabase
    .from('tournaments')
    .select('id, name, banner_url, payment_qr_url')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Failed to fetch tournaments:', fetchError.message);
    process.exit(1);
  }

  if (!tournaments || tournaments.length === 0) {
    console.log('ℹ️  No tournaments found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${tournaments.length} tournament(s).\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const t of tournaments) {
    console.log(`📋 "${t.name}" (${t.id})`);

    const fields: Array<{ key: 'banner_url' | 'payment_qr_url'; imageType: 'banner' | 'qr' }> = [
      { key: 'banner_url', imageType: 'banner' },
      { key: 'payment_qr_url', imageType: 'qr' },
    ];

    const updates: Record<string, string> = {};

    for (const { key, imageType } of fields) {
      const value: string | null = t[key];

      if (!value) {
        console.log(`  ${key}: null — skip`);
        totalSkipped++;
        continue;
      }

      if (value.startsWith('http://') || value.startsWith('https://')) {
        console.log(`  ${key}: already a URL — skip`);
        totalSkipped++;
        continue;
      }

      if (!value.startsWith('data:image/')) {
        console.log(`  ${key}: unrecognised format — skip`);
        totalSkipped++;
        continue;
      }

      // Report size without logging the content
      const approxKb = Math.round(value.length / 1024);
      console.log(`  ${key}: base64 (~${approxKb} KB) → processing...`);

      // Decode
      const base64Data = value.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch {
        console.log(`  ${key}: ❌ malformed base64`);
        totalFailed++;
        continue;
      }

      // Validate
      const validation = validateBuffer(buffer);
      if (!validation.isValid || !validation.mimeType || !validation.extension) {
        console.log(`  ${key}: ❌ validation failed — ${validation.error}`);
        totalFailed++;
        continue;
      }

      const objectPath = `${t.id}/${imageType}.${validation.extension}`;
      console.log(`  ${key}: ${buffer.length} bytes (${validation.mimeType}) → ${BUCKET}/${objectPath}`);

      if (isDryRun) {
        console.log(`  ${key}: [DRY RUN] would upload → ${BUCKET}/${objectPath}`);
        totalMigrated++;
        continue;
      }

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, buffer, {
          contentType: validation.mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.log(`  ${key}: ❌ upload failed — ${uploadError.message}`);
        totalFailed++;
        continue;
      }

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      if (!publicData?.publicUrl) {
        console.log(`  ${key}: ❌ upload succeeded but could not get public URL`);
        totalFailed++;
        continue;
      }

      updates[key] = publicData.publicUrl;
      console.log(`  ${key}: ✅ uploaded → ${publicData.publicUrl}`);
      totalMigrated++;
    }

    // Only update the DB row if at least one field was successfully uploaded
    if (!isDryRun && Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', t.id);

      if (updateError) {
        console.log(`  DB update: ❌ failed — ${updateError.message}`);
        totalFailed++;
      } else {
        console.log(`  DB update: ✅ row updated`);
      }
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log('Migration Summary:');
  console.log(`  Migrated : ${totalMigrated}`);
  console.log(`  Skipped  : ${totalSkipped}`);
  console.log(`  Failed   : ${totalFailed}`);
  if (isDryRun) {
    console.log('\n  ⚠️  DRY RUN — no data was written.');
  }
  console.log('='.repeat(60));

  if (totalFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});

import { createAdminClient } from '@/lib/supabase/admin';
import { validateImageFileBuffer } from '@/lib/storage/upload';

export type TournamentImageType = 'banner' | 'qr';

const TOURNAMENT_ASSETS_BUCKET = 'tournament-assets';
// 5 MB — consistent with the bucket's configured file_size_limit
const TOURNAMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Processes a tournament image field (banner_url or payment_qr_url) before DB persistence.
 *
 * Rules:
 *   - null / empty string  → returns null (no image)
 *   - http:// or https://  → returns the URL unchanged (already migrated or static asset)
 *   - data:image/...;base64,...
 *       1. Strips the data-URI prefix
 *       2. Decodes from base64 to a binary Buffer
 *       3. Validates magic bytes, MIME type, and size via validateImageFileBuffer()
 *       4. Uploads to the `tournament-assets` bucket (upsert — same path = overwrite)
 *       5. Returns the public CDN URL
 *
 * IMPORTANT — No silent fallback:
 *   If decode, validation, or upload fails, this function THROWS.
 *   Callers must NOT catch and silently substitute the original base64 value.
 *   The caller should surface a controlled API error instead.
 *
 * @param input       Raw value from the admin form (base64 data-URI, https URL, or null).
 * @param tournamentId UUID of the tournament (used as the Storage path prefix).
 * @param imageType   'banner' or 'qr' — determines the object path filename.
 * @returns Public CDN URL string, or null.
 */
export async function processTournamentImage(
  input: string | null | undefined,
  tournamentId: string,
  imageType: TournamentImageType
): Promise<string | null> {
  // Rule A: null / empty
  if (!input || input.trim() === '') {
    return null;
  }

  // Rule B: already an HTTP/HTTPS URL — pass through unchanged
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  // Rule C: base64 data URI
  if (!input.startsWith('data:image/')) {
    // Unknown format — reject explicitly rather than silently ignoring
    throw new Error(
      `Tournament ${imageType} image has an unrecognised format. ` +
      `Only base64 data URIs (data:image/...) and HTTPS URLs are accepted.`
    );
  }

  // Strip the "data:image/jpeg;base64," prefix (or png / webp)
  const base64Data = input.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  if (!base64Data || base64Data.trim() === '') {
    throw new Error(`Tournament ${imageType} image has an empty base64 payload.`);
  }

  // Decode to Buffer
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch {
    throw new Error(`Tournament ${imageType} image contains malformed base64 data.`);
  }

  if (buffer.length === 0) {
    throw new Error(`Tournament ${imageType} image decoded to an empty buffer.`);
  }

  // Validate: magic bytes, MIME type, size
  const validation = validateImageFileBuffer(buffer, TOURNAMENT_IMAGE_MAX_BYTES);
  if (!validation.isValid || !validation.mimeType || !validation.extension) {
    throw new Error(
      `Tournament ${imageType} image failed validation: ${validation.error ?? 'Unknown error'}`
    );
  }

  const objectPath = `${tournamentId}/${imageType}.${validation.extension}`;

  // Upload to Supabase Storage via service-role admin client
  const supabase = createAdminClient();

  const { error: uploadError } = await supabase.storage
    .from(TOURNAMENT_ASSETS_BUCKET)
    .upload(objectPath, buffer, {
      contentType: validation.mimeType,
      upsert: true, // Safe: same tournament always maps to the same object path
    });

  if (uploadError) {
    throw new Error(
      `Failed to upload tournament ${imageType} to Storage (${TOURNAMENT_ASSETS_BUCKET}/${objectPath}): ` +
      uploadError.message
    );
  }

  // Retrieve the public CDN URL
  const { data: publicData } = supabase.storage
    .from(TOURNAMENT_ASSETS_BUCKET)
    .getPublicUrl(objectPath);

  if (!publicData?.publicUrl) {
    throw new Error(
      `Storage upload succeeded but failed to retrieve public URL for ` +
      `${TOURNAMENT_ASSETS_BUCKET}/${objectPath}.`
    );
  }

  return publicData.publicUrl;
}

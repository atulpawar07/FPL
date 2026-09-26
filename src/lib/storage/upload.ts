import { createAdminClient } from '@/lib/supabase/admin';

export interface StorageUploadResult {
  bucket: string;
  objectPath: string;
  publicUrl?: string;
}

export interface ValidationResult {
  isValid: boolean;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  extension?: 'jpg' | 'png' | 'webp';
  error?: string;
}

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Shared server-side image validator inspecting buffer magic bytes and size limits.
 * SVG, executables, and arbitrary non-image buffers are strictly rejected.
 */
export function validateImageFileBuffer(
  bufferInput: Buffer | ArrayBuffer | Uint8Array,
  maxSizeBytes: number = MAX_FILE_SIZE_BYTES
): ValidationResult {
  if (!bufferInput) {
    return { isValid: false, error: 'No image file data provided' };
  }

  const buffer = Buffer.isBuffer(bufferInput)
    ? bufferInput
    : Buffer.from(bufferInput as ArrayBuffer);

  if (buffer.length === 0) {
    return { isValid: false, error: 'Image file buffer is empty' };
  }

  if (buffer.length > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed limit of ${Math.round(maxSizeBytes / (1024 * 1024))} MB`,
    };
  }

  if (buffer.length < 12) {
    return { isValid: false, error: 'File is too small to be a valid image' };
  }

  // Check Magic Bytes:
  // 1. JPEG: FF D8 FF -> .jpg
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // 2. PNG: 89 50 4E 47 -> .png
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { isValid: true, mimeType: 'image/png', extension: 'png' };
  }

  // 3. WEBP: RIFF at offset 0, WEBP at offset 8 -> .webp
  const headerRiff = buffer.toString('ascii', 0, 4);
  const headerWebp = buffer.toString('ascii', 8, 12);
  if (headerRiff === 'RIFF' && headerWebp === 'WEBP') {
    return { isValid: true, mimeType: 'image/webp', extension: 'webp' };
  }

  // Explicitly check and reject SVG
  const sample = buffer.toString('utf-8', 0, Math.min(buffer.length, 512)).toLowerCase();
  if (sample.includes('<svg') || sample.includes('<?xml')) {
    return { isValid: false, error: 'SVG image format is not allowed for security reasons' };
  }

  return {
    isValid: false,
    error: 'Invalid or unsupported image format. Allowed formats: JPEG, PNG, WebP',
  };
}

/**
 * Uploads a validated file/buffer to Supabase Storage using server-side admin client
 */
export async function uploadToStorageBucket(
  bucket: string,
  objectPath: string,
  fileData: Buffer | ArrayBuffer | Uint8Array,
  overrideContentType?: string
): Promise<StorageUploadResult> {
  const allowedBuckets = ['payment-screenshots', 'team-logos', 'profile-images'];
  if (!allowedBuckets.includes(bucket)) {
    throw new Error(`Invalid storage bucket requested: ${bucket}`);
  }

  const validation = validateImageFileBuffer(fileData);
  if (!validation.isValid || !validation.mimeType) {
    throw new Error(validation.error || 'Invalid image file provided');
  }

  const contentType = overrideContentType || validation.mimeType;

  const supabase = createAdminClient();

  const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData as ArrayBuffer);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed for ${bucket}/${objectPath}: ${error.message}`);
  }

  let publicUrl: string | undefined;
  if (bucket !== 'payment-screenshots') {
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    publicUrl = publicData.publicUrl;
  }

  return {
    bucket,
    objectPath,
    publicUrl,
  };
}

/**
 * Generates a short-lived (15 min / 900s) signed URL for private payment screenshots
 */
export async function getSignedScreenshotUrl(
  bucket: string = 'payment-screenshots',
  objectPath: string,
  expiresInSeconds: number = 900
): Promise<string> {
  if (!objectPath || objectPath.trim() === '') return '';

  // If historical record is a legacy external URL or Base64 data URL, return as-is
  if (objectPath.startsWith('http://') || objectPath.startsWith('https://') || objectPath.startsWith('data:image/')) {
    return objectPath;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error('Failed to generate signed URL:', error);
    return '';
  }

  return data.signedUrl;
}

/**
 * Universal Storage Resolver for legacy backward compatibility.
 * Safely resolves relative storage paths into public URLs while keeping legacy URLs/Base64 intact.
 */
export function resolveImageUrl(
  input: string | null | undefined,
  bucket: string = 'profile-images',
  fallback: string = '/logo.png'
): string {
  if (!input || input.trim() === '') return fallback;
  if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('data:image/')) {
    return input;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${baseUrl}/storage/v1/object/public/${bucket}/${input}`;
}

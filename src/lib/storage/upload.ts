import { createAdminClient } from '@/lib/supabase/admin';

export interface StorageUploadResult {
  bucket: string;
  objectPath: string;
  publicUrl?: string;
}

/**
 * Uploads a file/buffer to Supabase Storage
 */
export async function uploadToStorageBucket(
  bucket: string,
  objectPath: string,
  fileData: Buffer | ArrayBuffer | Uint8Array,
  contentType: string = 'image/png'
): Promise<StorageUploadResult> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, fileData, {
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
 * Generates a short-lived (15 min) signed URL for private payment screenshots
 */
export async function getSignedScreenshotUrl(
  bucket: string = 'payment-screenshots',
  objectPath: string,
  expiresInSeconds: number = 900
): Promise<string> {
  if (!objectPath) return '';
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

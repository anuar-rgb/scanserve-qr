import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKETS, SUPPORTED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB } from "@/constants";

type Bucket = keyof typeof STORAGE_BUCKETS;

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export function validateImageFile(file: File): void {
  const allowed = SUPPORTED_IMAGE_TYPES.split(",");
  if (!allowed.includes(file.type)) {
    throw new StorageError(`Unsupported file type: ${file.type}. Use PNG, JPG, or WebP.`);
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    throw new StorageError(`File too large. Maximum size is ${MAX_IMAGE_SIZE_MB} MB.`);
  }
}

export async function uploadImage(
  file: File,
  bucket: Bucket,
  prefix: string
): Promise<string> {
  validateImageFile(file);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${prefix}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new StorageError(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .getPublicUrl(data.path);

  return publicUrl;
}

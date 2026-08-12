import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKETS, SUPPORTED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB } from "@/constants";

const SUPPORTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_SIZE_MB = 100;

type Bucket = keyof typeof STORAGE_BUCKETS;

// Maps validated MIME type → safe file extension (never use user-supplied filename extension)
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

// Checks the first bytes of the file against known image magic bytes.
// Prevents MIME spoofing: file.type is browser-reported and can be faked.
async function checkMagicBytes(file: File, mime: string): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  switch (mime) {
    case "image/jpeg":
      return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
    case "image/png":
      return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E &&
             header[3] === 0x47 && header[4] === 0x0D && header[5] === 0x0A &&
             header[6] === 0x1A && header[7] === 0x0A;
    case "image/webp":
      return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
             header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
    case "image/gif":
      return header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 &&
             header[3] === 0x38 && (header[4] === 0x37 || header[4] === 0x39) && header[5] === 0x61;
    default:
      return false;
  }
}

export async function validateImageFile(file: File): Promise<void> {
  const allowed = SUPPORTED_IMAGE_TYPES.split(",");
  if (!allowed.includes(file.type)) {
    throw new StorageError(`Unsupported file type: ${file.type}. Use PNG, JPG, or WebP.`);
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    throw new StorageError(`File too large. Maximum size is ${MAX_IMAGE_SIZE_MB} MB.`);
  }
  if (!(await checkMagicBytes(file, file.type))) {
    throw new StorageError("File content does not match its declared type.");
  }
}

export async function uploadImage(
  file: File,
  bucket: Bucket,
  prefix: string
): Promise<string> {
  await validateImageFile(file);

  const ext = MIME_TO_EXT[file.type] ?? "jpg";
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

const VIDEO_EXT: Record<string, string> = {
  "video/mp4":       "mp4",
  "video/webm":      "webm",
  "video/quicktime": "mov",
};

export async function uploadMedia(
  file: File,
  bucket: Bucket,
  prefix: string
): Promise<{ url: string; type: "image" | "video" }> {
  const isVideo = file.type.startsWith("video/");
  if (isVideo) {
    if (!SUPPORTED_VIDEO_TYPES.includes(file.type)) {
      throw new StorageError(`Unsupported video type: ${file.type}. Use MP4 or WebM.`);
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      throw new StorageError(`Video too large. Maximum size is ${MAX_VIDEO_SIZE_MB} MB.`);
    }
  } else {
    await validateImageFile(file);
  }

  const ext = isVideo ? (VIDEO_EXT[file.type] ?? "mp4") : (MIME_TO_EXT[file.type] ?? "jpg");
  const path = `${prefix}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new StorageError(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .getPublicUrl(data.path);

  return { url: publicUrl, type: isVideo ? "video" : "image" };
}

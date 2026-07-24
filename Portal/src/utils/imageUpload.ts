import { resizeToBase64, ImageFormat } from "@/src/utils/avatarHelper";

export interface ImageUploadOptions {
  /** Maximum file size in bytes. Defaults to 5 MB. */
  maxBytes?: number;
  /** Longest output edge in pixels. */
  maxSide?: number;
  /** Output format. Defaults to "image/jpeg". */
  format?: ImageFormat;
  /** Custom message shown when the file exceeds `maxBytes`. */
  sizeErrorMessage?: string;
}

export class ImageUploadError extends Error {}

/**
 * Validate an image File (type + size) and return a resized base64 data URL.
 * Throws {@link ImageUploadError} with a user-facing Spanish message on failure.
 */
export async function readAndResizeImage(
  file: File,
  opts: ImageUploadOptions = {},
): Promise<string> {
  const {
    maxBytes = 5 * 1024 * 1024,
    maxSide = 256,
    format = "image/jpeg",
    sizeErrorMessage = "La imagen debe ser menor a 5 MB",
  } = opts;

  if (file.size > maxBytes) {
    throw new ImageUploadError(sizeErrorMessage);
  }
  if (!file.type.startsWith("image/")) {
    throw new ImageUploadError("Selecciona un archivo de imagen");
  }

  return resizeToBase64(file, maxSide, format);
}

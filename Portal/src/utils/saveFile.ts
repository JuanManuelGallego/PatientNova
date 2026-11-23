import { isIosHomeScreenApp } from "@/src/utils/standalone";

export type SaveFileResult = "shared" | "downloaded" | "cancelled" | "needs-tap";

/** The classic anchor download. Works in browsers and the Android installed app; not in the iOS home-screen app. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Saves a file. Inside the iOS home-screen app it opens the share sheet; everywhere else it keeps the
 * anchor download. A refused gesture is reported as "needs-tap" so the caller can ask for a second tap.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveFileResult> {
  if (!isIosHomeScreenApp()) {
    downloadBlob(blob, filename);
    return "downloaded";
  }
  const file = new File([ blob ], filename, { type: blob.type });
  if (typeof navigator.share !== "function" || !navigator.canShare?.({ files: [ file ] })) {
    downloadBlob(blob, filename);
    return "downloaded";
  }
  try {
    await navigator.share({ files: [ file ] });
    return "shared";
  } catch (err) {
    const name = err instanceof DOMException ? err.name : undefined;
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "needs-tap";
    downloadBlob(blob, filename);
    return "downloaded";
  }
}

/** Synchronous (a `fetch` of a data URL would lose the tap's gesture and the CSP blocks `data:` in connect-src). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(5, comma);
  const type = meta.split(";")[0] || "application/octet-stream";
  const payload = dataUrl.slice(comma + 1);
  if (!meta.includes(";base64")) return new Blob([ decodeURIComponent(payload) ], { type });
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([ bytes ], { type });
}

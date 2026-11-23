import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataUrlToBlob, saveFile } from "@/src/utils/saveFile";

const blob = new Blob([ "hola" ], { type: "text/plain" });
let click: ReturnType<typeof vi.spyOn>;
const share = vi.fn();
const canShare = vi.fn();

function setStandalone(v: boolean | undefined) {
  Object.defineProperty(navigator, "standalone", { value: v, configurable: true });
}

beforeEach(() => {
  share.mockReset().mockResolvedValue(undefined);
  canShare.mockReset().mockReturnValue(true);
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true });
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(() => {
  click.mockRestore();
  Reflect.deleteProperty(navigator, "standalone");
});

describe("saveFile", () => {
  it("downloads through an anchor outside the iOS home-screen app", async () => {
    setStandalone(undefined);
    expect(await saveFile(blob, "a.txt")).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.contexts[0]).toHaveProperty("download", "a.txt");
  });

  it("shares the file inside the iOS home-screen app", async () => {
    setStandalone(true);
    expect(await saveFile(blob, "a.txt")).toBe("shared");
    const arg = share.mock.calls[0]![0] as { files: File[] };
    expect(arg.files[0]).toBeInstanceOf(File);
    expect(arg.files[0]!.name).toBe("a.txt");
    expect(arg.files[0]!.type).toBe("text/plain");
    expect(click).not.toHaveBeenCalled();
  });

  it("does nothing more when the provider cancels the share sheet", async () => {
    setStandalone(true);
    share.mockRejectedValue(new DOMException("", "AbortError"));
    expect(await saveFile(blob, "a.txt")).toBe("cancelled");
    expect(click).not.toHaveBeenCalled();
  });

  it("asks for a second tap when the share is refused for lack of a gesture", async () => {
    setStandalone(true);
    share.mockRejectedValue(new DOMException("", "NotAllowedError"));
    expect(await saveFile(blob, "a.txt")).toBe("needs-tap");
    expect(click).not.toHaveBeenCalled();
  });

  it("falls back to download when sharing fails otherwise or cannot share files", async () => {
    setStandalone(true);
    share.mockRejectedValue(new TypeError("boom"));
    expect(await saveFile(blob, "a.txt")).toBe("downloaded");
    share.mockClear();
    canShare.mockReturnValue(false);
    expect(await saveFile(blob, "a.txt")).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
  });
});

describe("dataUrlToBlob", () => {
  it("decodes a base64 data URL into a blob with its type and bytes", async () => {
    const b = dataUrlToBlob("data:text/plain;base64,aG9sYQ==");
    expect(b.type).toBe("text/plain");
    expect(await b.text()).toBe("hola");
  });
});

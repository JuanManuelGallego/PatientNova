import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveFile = vi.fn();
vi.mock("@/src/utils/saveFile", () => ({ saveFile: (...a: unknown[]) => saveFile(...a) }));

import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { useSaveFile } from "@/src/hooks/useSaveFile";

const blob = new Blob([ "x" ]);

function Harness() {
  const { save, retryDialog } = useSaveFile();
  return (
    <>
      <button onClick={() => void save(blob, "f.pdf")}>go</button>
      {retryDialog}
    </>
  );
}

beforeEach(() => saveFile.mockReset());

describe("useSaveFile", () => {
  it("asks for a second tap and shares again from the dialog's button", async () => {
    saveFile.mockResolvedValueOnce("needs-tap").mockResolvedValueOnce("shared");
    render(<FocusTrapProvider><Harness /></FocusTrapProvider>);
    await act(async () => { fireEvent.click(screen.getByText("go")); });
    expect(screen.getByText("Tu archivo está listo")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Compartir" })); });
    expect(saveFile).toHaveBeenCalledTimes(2);
    expect(saveFile).toHaveBeenLastCalledWith(blob, "f.pdf");
    expect(screen.queryByText("Tu archivo está listo")).toBeNull();
  });

  it("renders no dialog for other results", async () => {
    for (const r of [ "shared", "downloaded", "cancelled" ]) {
      saveFile.mockResolvedValueOnce(r);
      const { unmount } = render(<FocusTrapProvider><Harness /></FocusTrapProvider>);
      await act(async () => { fireEvent.click(screen.getByText("go")); });
      expect(screen.queryByText("Tu archivo está listo")).toBeNull();
      unmount();
    }
  });
});

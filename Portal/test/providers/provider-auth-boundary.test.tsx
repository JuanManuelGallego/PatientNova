import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/src/providers/Providers";
import ProviderLayout from "@/src/app/(provider)/layout";

vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth probe boundary", () => {
  it("public pages (root providers only) make no API calls", async () => {
    render(
      <Providers>
        <p>public page</p>
      </Providers>,
    );
    // give any effect a chance to run
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the provider area probes the session once on load", async () => {
    render(
      <Providers>
        <ProviderLayout>
          <p>dashboard</p>
        </ProviderLayout>
      </Providers>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/users/me");
  });
});

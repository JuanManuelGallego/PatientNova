import { act, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget, type TurnstileHandle } from "@/src/components/TurnstileWidget";

type Callback = (arg?: string) => void;

const turnstile = {
    render: vi.fn<(container: HTMLElement, options: Record<string, unknown>) => string>(() => "widget-1"),
    reset: vi.fn(),
    remove: vi.fn(),
};
const renderOptions = () => turnstile.render.mock.calls[ 0 ]![ 1 ];
const callback = (name: string) => renderOptions()[ name ] as Callback;

beforeEach(() => {
    vi.clearAllMocks();
    window.turnstile = turnstile;
});

afterEach(() => {
    delete window.turnstile;
});

describe("TurnstileWidget", () => {
    it("renders the widget bound to the action and reports the solved token", async () => {
        const onToken = vi.fn();
        render(<TurnstileWidget action="otp-request" siteKey="site-key" onToken={onToken} />);

        await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
        expect(renderOptions()).toMatchObject({ sitekey: "site-key", action: "otp-request", language: "es" });

        act(() => callback("callback")("token-123"));
        expect(onToken).toHaveBeenLastCalledWith("token-123");

        act(() => callback("expired-callback")());
        expect(onToken).toHaveBeenLastCalledWith(null);
    });

    it("shows an accessible error and clears the token when the challenge errors", async () => {
        const onToken = vi.fn();
        const onError = vi.fn();
        render(<TurnstileWidget action="otp-request" siteKey="site-key" onToken={onToken} onError={onError} />);
        await waitFor(() => expect(turnstile.render).toHaveBeenCalled());
        expect(onError).not.toHaveBeenCalled();

        act(() => callback("error-callback")());
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos verificar");
        expect(onToken).toHaveBeenLastCalledWith(null);
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("resets the single-use token on demand and removes the widget on unmount", async () => {
        const onToken = vi.fn();
        const ref = createRef<TurnstileHandle>();
        const { unmount } = render(<TurnstileWidget ref={ref} action="otp-request" siteKey="site-key" onToken={onToken} />);
        await waitFor(() => expect(turnstile.render).toHaveBeenCalled());

        act(() => ref.current!.reset());
        expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
        expect(onToken).toHaveBeenLastCalledWith(null);

        unmount();
        expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
    });

    it("without a site key shows an error and never yields a token (no bypass)", () => {
        const onToken = vi.fn();
        const onError = vi.fn();
        render(<TurnstileWidget action="otp-request" siteKey="" onToken={onToken} onError={onError} />);
        expect(screen.getByRole("alert")).toHaveTextContent("No pudimos verificar");
        expect(onError).toHaveBeenCalled();
        expect(turnstile.render).not.toHaveBeenCalled();
        expect(onToken).toHaveBeenCalledWith(null);
        expect(onToken).not.toHaveBeenCalledWith(expect.any(String));
    });
});

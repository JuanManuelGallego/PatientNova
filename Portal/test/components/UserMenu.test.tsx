import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "@/src/components/UserMenu";

type TestUser = { firstName: string; lastName: string; displayName: string; avatar: string; jobTitle: string };

let user: TestUser | null;
let isDark = false;
const toggleTheme = vi.fn();
const logout = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user, logout }) }));
vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark, toggleTheme }) }));

beforeEach(() => {
    user = { firstName: "Ana", lastName: "Ruiz", displayName: "Dra. Ana Ruiz", avatar: "", jobTitle: "Psicóloga" };
    isDark = false;
    toggleTheme.mockReset();
    logout.mockReset().mockResolvedValue(undefined);
    replace.mockReset();
});

const trigger = () => screen.getByTestId("sidebar-user-menu-button");

describe("UserMenu", () => {
    it("opens on click and shows account, theme and logout", async () => {
        render(<UserMenu onNavigate={vi.fn()} />);
        expect(screen.queryByTestId("sidebar-logout")).toBeNull();

        await userEvent.click(trigger());

        expect(trigger()).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByTestId("sidebar-account-link")).toBeVisible();
        expect(screen.getByTestId("sidebar-theme-toggle")).toBeVisible();
        expect(screen.getByTestId("sidebar-logout")).toBeVisible();
    });

    it("closes on Escape, refocuses the trigger and keeps Escape from the mobile drawer", async () => {
        const windowKeydown = vi.fn();
        window.addEventListener("keydown", windowKeydown);
        render(<UserMenu onNavigate={vi.fn()} />);
        await userEvent.click(trigger());

        fireEvent.keyDown(screen.getByTestId("sidebar-logout"), { key: "Escape" });

        expect(screen.queryByTestId("sidebar-logout")).toBeNull();
        expect(trigger()).toHaveFocus();
        expect(windowKeydown).not.toHaveBeenCalled();
        window.removeEventListener("keydown", windowKeydown);
    });

    it("lets keyboard users Tab from the trigger into the menu items", async () => {
        render(<UserMenu onNavigate={vi.fn()} />);
        trigger().focus();
        await userEvent.keyboard("{Enter}");

        await userEvent.tab();

        expect(screen.getByTestId("sidebar-account-link")).toHaveFocus();
    });

    it("closes when clicking outside", async () => {
        render(<UserMenu onNavigate={vi.fn()} />);
        await userEvent.click(trigger());

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId("sidebar-logout")).toBeNull();
    });

    it("closes when Tab moves focus out of the menu", async () => {
        render(<><UserMenu onNavigate={vi.fn()} /><button>after</button></>);
        await userEvent.click(trigger());

        await userEvent.tab(); // Mi cuenta
        await userEvent.tab(); // theme
        await userEvent.tab(); // logout
        await userEvent.tab(); // out

        expect(screen.getByText("after")).toHaveFocus();
        expect(screen.queryByTestId("sidebar-logout")).toBeNull();
    });

    it("closes when the mobile drawer closes", async () => {
        const { rerender } = render(<UserMenu onNavigate={vi.fn()} drawerOpen />);
        await userEvent.click(trigger());
        expect(screen.getByTestId("sidebar-logout")).toBeInTheDocument();

        rerender(<UserMenu onNavigate={vi.fn()} drawerOpen={false} />);

        expect(screen.queryByTestId("sidebar-logout")).toBeNull();
    });

    it("links Mi cuenta to settings and closes the drawer", async () => {
        const onNavigate = vi.fn();
        render(<UserMenu onNavigate={onNavigate} />);
        await userEvent.click(trigger());

        const account = screen.getByTestId("sidebar-account-link");
        expect(account).toHaveAttribute("href", "/settings/account");
        await userEvent.click(account);

        expect(onNavigate).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("sidebar-logout")).toBeNull();
    });

    it("falls back to initials and the full name without a photo or display name", () => {
        user = { firstName: "Ana", lastName: "Ruiz", displayName: "", avatar: "", jobTitle: "" };
        render(<UserMenu onNavigate={vi.fn()} />);

        expect(trigger()).toHaveTextContent("AR");
        expect(trigger()).toHaveTextContent("Ana Ruiz");
    });

    it("shows ? when there is no user", () => {
        user = null;
        render(<UserMenu onNavigate={vi.fn()} />);

        expect(trigger()).toHaveTextContent("?");
    });

    it("offers the light theme while dark and toggles it", async () => {
        isDark = true;
        render(<UserMenu onNavigate={vi.fn()} />);
        await userEvent.click(trigger());

        const toggle = screen.getByTestId("sidebar-theme-toggle");
        expect(toggle).toHaveTextContent("Tema claro");
        await userEvent.click(toggle);

        expect(toggleTheme).toHaveBeenCalledTimes(1);
    });

    it("returns focus to the trigger after switching the theme from the keyboard", async () => {
        render(<UserMenu onNavigate={vi.fn()} />);
        trigger().focus();
        await userEvent.keyboard("{Enter}");
        await userEvent.tab();
        await userEvent.tab();
        expect(screen.getByTestId("sidebar-theme-toggle")).toHaveFocus();

        await userEvent.keyboard("{Enter}");

        expect(toggleTheme).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("sidebar-theme-toggle")).toBeNull();
        expect(trigger()).toHaveFocus();
    });

    it("logs out and goes to the login page", async () => {
        render(<UserMenu onNavigate={vi.fn()} />);
        await userEvent.click(trigger());

        await userEvent.click(screen.getByTestId("sidebar-logout"));

        expect(logout).toHaveBeenCalledTimes(1);
        expect(replace).toHaveBeenCalledWith("/login");
    });
});

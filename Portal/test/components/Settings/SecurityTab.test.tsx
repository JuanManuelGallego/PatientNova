import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecurityTab } from "@/src/components/Settings/SecurityTab";
import { ApiMutationError } from "@/src/api/base/useApiMutation";

const changePassword = vi.fn();
const refreshUser = vi.fn();
let lastPasswordChange: string | null;

vi.mock("@/src/api/auth/useChangePassword", () => ({
    useChangePassword: () => ({ changePassword, loading: false, error: null }),
}));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({ user: { lastPasswordChange }, refreshUser }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({
    useDisplayTimezone: () => "America/Bogota",
}));

describe("SecurityTab", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        lastPasswordChange = null;
    });
    
    it("shows the last password change in the provider's timezone", () => {
        lastPasswordChange = "2026-10-20T15:30:00.000Z";
        render(<SecurityTab />);
        const text = screen.getByTestId("security-last-password-change").textContent ?? "";
        expect(text).toContain("Último cambio de contraseña:");
        expect(text).toContain("2026");
        expect(text).toMatch(/10:30/);
    });

    it("refreshes the user after a successful change", async () => {
        changePassword.mockResolvedValue(undefined);
        render(<SecurityTab />);
        await userEvent.type(screen.getByTestId("security-current-password-input"), "OldPass1!");
        await userEvent.type(screen.getByTestId("security-new-password-input"), "NewPass1!");
        await userEvent.type(screen.getByTestId("security-confirm-password-input"), "NewPass1!");
        await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
        expect(changePassword).toHaveBeenCalledWith("OldPass1!", "NewPass1!");
        expect(refreshUser).toHaveBeenCalledTimes(1);
    });

    it("shows the server's message when the change is refused", async () => {
        changePassword.mockRejectedValue(new ApiMutationError("La contraseña actual es incorrecta", 401));
        render(<SecurityTab />);
        await userEvent.type(screen.getByTestId("security-current-password-input"), "OldPass1!");
        await userEvent.type(screen.getByTestId("security-new-password-input"), "NewPass1!");
        await userEvent.type(screen.getByTestId("security-confirm-password-input"), "NewPass1!");
        await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
        expect(screen.getByRole("alert")).toHaveTextContent("La contraseña actual es incorrecta");
    });

    it("says the connection failed instead of the browser's English text", async () => {
        changePassword.mockRejectedValue(new TypeError("Failed to fetch"));
        render(<SecurityTab />);
        await userEvent.type(screen.getByTestId("security-current-password-input"), "OldPass1!");
        await userEvent.type(screen.getByTestId("security-new-password-input"), "NewPass1!");
        await userEvent.type(screen.getByTestId("security-confirm-password-input"), "NewPass1!");
        await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
        expect(screen.getByRole("alert")).toHaveTextContent("No pudimos conectar con el servidor. Revisa tu conexión a internet.");
        expect(screen.getByRole("alert")).not.toHaveTextContent("Failed to fetch");
    });

    it("frames the form as the Contraseña section", () => {
        render(<SecurityTab />);
        expect(screen.getByRole("region", { name: "Contraseña" })).toBeInTheDocument();
    });
});

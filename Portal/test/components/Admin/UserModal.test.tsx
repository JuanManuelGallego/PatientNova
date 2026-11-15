import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserModal } from "@/src/components/Admin/UserModal";
import { ApiClientError } from "@/src/api/base/apiClients";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

const createUser = vi.fn();
const updateUser = vi.fn();
const refreshUser = vi.fn();
const logout = vi.fn();

vi.mock("@/src/api/users/useManageUser", () => ({
    useCreateUser: () => ({ createUser, loading: false, error: null }),
    useUpdateUser: () => ({ updateUser, loading: false, error: null }),
}));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({ user: { id: "u-me", role: "SUPER_ADMIN" }, refreshUser, logout }),
}));

const base = {
    displayName: "", jobTitle: "", timezone: "America/Bogota",
    reminderActive: false, reminderChannel: "EMAIL", isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z", lastLoginAt: null,
};
const me = { ...base, id: "u-me", email: "me@example.com", firstName: "Mía", lastName: "Gómez", role: "SUPER_ADMIN", status: "ACTIVE" };
const ana = { ...base, id: "u-ana", email: "ana@example.com", firstName: "Ana", lastName: "Pérez", role: "ADMIN", status: "ACTIVE" };
const legacy = { ...ana, id: "u-old", role: "VIEWER", status: "PENDING" };

const onClose = vi.fn();
const onSaved = vi.fn();

function open(user: unknown) {
    return render(
        <FocusTrapProvider>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <UserModal user={user as any} onClose={onClose} onSaved={onSaved} />
        </FocusTrapProvider>,
    );
}

beforeEach(() => {
    [ createUser, updateUser, refreshUser, logout, onClose, onSaved ].forEach((m) => m.mockReset());
    createUser.mockResolvedValue({});
    updateUser.mockResolvedValue({});
});

describe("UserModal", () => {
    it("creates a user with the full payload", async () => {
        const u = userEvent.setup();
        open(null);
        await u.type(screen.getByLabelText(/^Nombre\b(?! visible)/), "Ana");
        await u.type(screen.getByLabelText(/Apellido/), "Pérez");
        await u.type(screen.getByLabelText(/Correo/), " ana@x.co ");
        await u.type(screen.getByLabelText(/Contraseña inicial/), "Clave123!");
        await u.click(screen.getByRole("button", { name: "Crear usuario" }));
        await waitFor(() => expect(createUser).toHaveBeenCalledWith({
            firstName: "Ana", lastName: "Pérez", email: "ana@x.co", password: "Clave123!", role: "ADMIN", status: "ACTIVE",
        }));
        expect(onSaved).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it("keeps create disabled until the password meets every rule", async () => {
        const u = userEvent.setup();
        open(null);
        await u.type(screen.getByLabelText(/^Nombre\b(?! visible)/), "Ana");
        await u.type(screen.getByLabelText(/Apellido/), "Pérez");
        await u.type(screen.getByLabelText(/Correo/), "ana@x.co");
        await u.type(screen.getByLabelText(/Contraseña inicial/), "clave");
        expect(screen.getByRole("button", { name: "Crear usuario" })).toBeDisabled();
        expect(screen.getByText("Al menos una mayúscula")).toBeInTheDocument();
        await u.clear(screen.getByLabelText(/Contraseña inicial/));
        await u.type(screen.getByLabelText(/Contraseña inicial/), "Clave123!");
        expect(screen.getByRole("button", { name: "Crear usuario" })).toBeEnabled();
    });

    it("warns about signing in again only when editing your own record", () => {
        const hint = "Si cambias tu correo, se cerrará tu sesión al guardar.";
        const { unmount } = open(me);
        expect(screen.getByLabelText(/Correo/)).toHaveAccessibleDescription(hint);
        unmount();
        open(ana);
        expect(screen.queryByText(hint)).toBeNull();
    });

    it("offers only Administrador and Superadministrador for a new user", () => {
        open(null);
        const roles = Array.from((screen.getByLabelText(/Rol/) as HTMLSelectElement).options).map((o) => o.text);
        expect(roles).toEqual([ "Administrador", "Superadministrador" ]);
        const statuses = Array.from((screen.getByLabelText(/Estado/) as HTMLSelectElement).options).map((o) => o.text);
        expect(statuses).toEqual([ "Activo", "Inactivo" ]);
    });

    it("sends only changed fields on edit", async () => {
        const u = userEvent.setup();
        const { unmount } = open(ana);
        await u.type(screen.getByLabelText(/Cargo/), "Psicóloga");
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(updateUser).toHaveBeenCalledWith("u-ana", { jobTitle: "Psicóloga" }));
        unmount();
        updateUser.mockClear();
        onClose.mockClear();
        open(ana);
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(updateUser).not.toHaveBeenCalled();
    });

    it("falls back to the full name when Nombre visible is cleared", async () => {
        const u = userEvent.setup();
        open({ ...ana, displayName: "Dra. Ana" });
        await u.clear(screen.getByLabelText(/Nombre visible/));
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(updateUser).toHaveBeenCalledWith("u-ana", { displayName: "Ana Pérez" }));
    });

    it("keeps a legacy VIEWER/PENDING row as it is", async () => {
        const u = userEvent.setup();
        open(legacy);
        expect(screen.getByLabelText(/Rol/)).toHaveDisplayValue("Lector");
        expect(screen.getByLabelText(/Estado/)).toHaveDisplayValue("Pendiente");
        const name = screen.getByLabelText(/^Nombre\b(?! visible)/);
        await u.clear(name);
        await u.type(name, "Anita");
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(updateUser).toHaveBeenCalledWith("u-old", { firstName: "Anita" }));
    });

    it("locks your own role and status", async () => {
        const u = userEvent.setup();
        open(me);
        expect(screen.getByLabelText(/Rol/)).toBeDisabled();
        expect(screen.getByLabelText(/Estado/)).toBeDisabled();
        expect(screen.getByText("No puedes cambiar tu propio rol ni estado.")).toBeInTheDocument();
        const name = screen.getByLabelText(/^Nombre\b(?! visible)/);
        await u.clear(name);
        await u.type(name, "Mía2");
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    });

    it("shows the server error in the modal", async () => {
        const u = userEvent.setup();
        updateUser.mockRejectedValue(new ApiClientError("Ya existe un usuario con este correo electrónico.", 409));
        open(ana);
        const email = screen.getByLabelText(/Correo/);
        await u.clear(email);
        await u.type(email, "otra@x.co");
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText("Ya existe un usuario con este correo electrónico.")).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("is a dialog named by its title", () => {
        const { unmount } = open(null);
        expect(screen.getByRole("dialog", { name: "Nuevo usuario" })).toBeInTheDocument();
        unmount();
        open(ana);
        expect(screen.getByRole("dialog", { name: "Editar usuario" })).toBeInTheDocument();
    });

    it("marks each password rule in text, not only in color", async () => {
        const u = userEvent.setup();
        open(null);
        const password = screen.getByLabelText(/Contraseña inicial/);
        expect(password).toHaveAccessibleDescription(/Mínimo 8 caracteres: pendiente/);
        await u.type(password, "Clave123!");
        expect(password).toHaveAccessibleDescription(/Mínimo 8 caracteres: cumplido/);
        expect(password).not.toHaveAccessibleDescription(/pendiente/);
    });

    it("signs you out after you change your own email", async () => {
        const u = userEvent.setup();
        open(me);
        const email = screen.getByLabelText(/Correo/);
        await u.clear(email);
        await u.type(email, "nuevo@example.com");
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(logout).toHaveBeenCalled());
        expect(updateUser).toHaveBeenCalledWith("u-me", { email: "nuevo@example.com" });
        expect(onClose).toHaveBeenCalled();
        expect(refreshUser).not.toHaveBeenCalled();
    });

    it("treats a change of case in the email as no change", async () => {
        const u = userEvent.setup();
        open(me);
        const email = screen.getByLabelText(/Correo/);
        await u.clear(email);
        await u.type(email, "Me@Example.com");
        await u.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(updateUser).not.toHaveBeenCalled();
        expect(logout).not.toHaveBeenCalled();
    });

    it("shows the full name as the Nombre visible fallback", () => {
        open(ana);
        expect(screen.getByLabelText(/Nombre visible/)).toHaveAttribute("placeholder", "Ana Pérez");
    });

    it("links the self-lock hint to the role and status selects", () => {
        open(me);
        const hint = "No puedes cambiar tu propio rol ni estado.";
        expect(screen.getByLabelText(/Rol/)).toHaveAccessibleDescription(hint);
        expect(screen.getByLabelText(/Estado/)).toHaveAccessibleDescription(hint);
    });
});

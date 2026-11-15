import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersView } from "@/src/components/Admin/UsersView";
import { ApiClientError } from "@/src/api/base/apiClients";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

const refetch = vi.fn();
const deleteUser = vi.fn();
const restoreUser = vi.fn();
const fetchArgs: unknown[] = [];
let users: unknown[] = [];

const base = {
    firstName: "", lastName: "", displayName: "", jobTitle: "", timezone: "America/Bogota",
    reminderActive: false, reminderChannel: "EMAIL", isDeleted: false, createdAt: "2026-01-01T00:00:00.000Z",
};
const me = { ...base, id: "u-me", email: "me@example.com", firstName: "Mía", lastName: "Gómez", role: "SUPER_ADMIN", status: "ACTIVE", lastLoginAt: "2026-11-01T15:00:00.000Z" };
const ana = { ...base, id: "u-ana", email: "ana@example.com", firstName: "Ana", lastName: "Pérez", role: "ADMIN", status: "INACTIVE", lastLoginAt: null };

let restoring = false;
vi.mock("@/src/api/users/useFetchUsers", () => ({
    useFetchUsers: (arg: unknown) => {
        fetchArgs.push(arg);
        return { users, loading: false, error: null, refetch };
    },
}));
vi.mock("@/src/api/users/useManageUser", () => ({
    useDeleteUser: () => ({ deleteUser, loading: false, error: null }),
    useRestoreUser: () => ({ restoreUser, loading: restoring, error: null }),
}));
vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user: { id: "u-me", role: "SUPER_ADMIN" } }) }));
vi.mock("@/src/components/Admin/UserModal", () => ({ UserModal: () => null }));

beforeEach(() => {
    fetchArgs.length = 0;
    refetch.mockReset();
    deleteUser.mockReset().mockResolvedValue({});
    restoreUser.mockReset().mockResolvedValue({});
    users = [ me, ana ];
    restoring = false;
});

describe("UsersView", () => {
    it("lists accounts with role and status labels", () => {
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        expect(screen.getByText("Superadministrador")).toBeInTheDocument();
        expect(screen.getByText("Administrador")).toBeInTheDocument();
        expect(screen.getByText("Inactivo")).toBeInTheDocument();
        expect(within(screen.getByTestId("user-row-u-ana")).getByText("Nunca ha iniciado sesión")).toBeInTheDocument();
    });

    it("labels a VIEWER as Lector", () => {
        users = [ me, { ...ana, id: "u-vi", role: "VIEWER", status: "ACTIVE" } ];
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        expect(within(screen.getByTestId("user-row-u-vi")).getByText("Lector")).toBeInTheDocument();
    });

    it("marks your own row and offers no delete on it", () => {
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        const mine = screen.getByTestId("user-row-u-me");
        expect(within(mine).getByText("Tú")).toBeInTheDocument();
        expect(within(mine).queryByRole("button", { name: "Eliminar" })).toBeNull();
        const hers = screen.getByTestId("user-row-u-ana");
        expect(within(hers).getByRole("button", { name: "Editar" })).toBeInTheDocument();
        expect(within(hers).getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    });

    it("asks for deleted users when the filter is on", async () => {
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        expect(fetchArgs[0]).toEqual({ includeDeleted: false });
        await userEvent.click(screen.getByText("Mostrar eliminados"));
        expect(fetchArgs[fetchArgs.length - 1]).toEqual({ includeDeleted: true });
    });

    it("shows a deleted row with only Restaurar", async () => {
        users = [ me, { ...ana, isDeleted: true } ];
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        const row = screen.getByTestId("user-row-u-ana");
        expect(within(row).getByText("Eliminado")).toBeInTheDocument();
        expect(within(row).queryByRole("button", { name: "Editar" })).toBeNull();
        expect(within(row).queryByRole("button", { name: "Eliminar" })).toBeNull();
        await userEvent.click(within(row).getByRole("button", { name: "Restaurar" }));
        await waitFor(() => expect(refetch).toHaveBeenCalled());
        expect(restoreUser).toHaveBeenCalledWith("u-ana");
    });

    it("disables Restaurar while a restore is in flight", () => {
        users = [ me, { ...ana, isDeleted: true } ];
        restoring = true;
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        expect(within(screen.getByTestId("user-row-u-ana")).getByRole("button", { name: "Restaurar" })).toBeDisabled();
    });

    it("shows the error when restore fails", async () => {
        users = [ me, { ...ana, isDeleted: true } ];
        restoreUser.mockRejectedValue(new ApiClientError("No pudimos restaurar", 409));
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        await userEvent.click(within(screen.getByTestId("user-row-u-ana")).getByRole("button", { name: "Restaurar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos restaurar");
        expect(refetch).not.toHaveBeenCalled();
    });

    it("deletes after confirmation", async () => {
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        const open = async () => userEvent.click(within(screen.getByTestId("user-row-u-ana")).getByRole("button", { name: "Eliminar" }));
        await open();
        expect(screen.getByRole("alertdialog", { name: "¿Eliminar a Ana Pérez?" })).toBeInTheDocument();
        expect(screen.getByText("No podrá iniciar sesión y se cerrarán sus sesiones. Sus pacientes y citas se conservan, y puedes restaurar la cuenta después.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Regresar" }));
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(deleteUser).not.toHaveBeenCalled();

        await open();
        await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(deleteUser).toHaveBeenCalledWith("u-ana");
        expect(refetch).toHaveBeenCalled();
    });

    it("keeps the dialog open with the error when delete fails", async () => {
        deleteUser.mockRejectedValue(new ApiClientError("No puedes eliminar esta cuenta", 409));
        render(<FocusTrapProvider><UsersView /></FocusTrapProvider>);
        await userEvent.click(within(screen.getByTestId("user-row-u-ana")).getByRole("button", { name: "Eliminar" }));
        await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
        expect(await screen.findByText("No puedes eliminar esta cuenta")).toBeInTheDocument();
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
});

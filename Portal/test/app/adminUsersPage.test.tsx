import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage from "@/src/app/(provider)/(protected)/admin/users/page";

let role = "ADMIN";
vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user: { id: "u1", role } }) }));
vi.mock("@/src/components/Admin/UsersView", () => ({ UsersView: () => <div data-testid="users-view" /> }));
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

beforeEach(() => { role = "ADMIN"; });

describe("admin users page", () => {
    it("shows the no-access state to an ADMIN", () => {
        render(<AdminUsersPage />);
        expect(screen.getByText("No tienes acceso a esta página")).toBeInTheDocument();
        expect(screen.getByText("Solo un superadministrador puede gestionar usuarios.")).toBeInTheDocument();
        expect(screen.queryByTestId("users-view")).toBeNull();
    });

    it("renders the users view for a SUPER_ADMIN", () => {
        role = "SUPER_ADMIN";
        render(<AdminUsersPage />);
        expect(screen.getByTestId("users-view")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
    });
});

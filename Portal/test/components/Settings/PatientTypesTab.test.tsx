import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientTypesTab } from "@/src/components/Settings/PatientTypesTab";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { AdminRole } from "@/src/types/User";
import type { PatientType } from "@/src/types/PatientType";

const general: PatientType = {
  id: "type-general",
  name: "General",
  isDefault: true,
  patientCount: 3,
  currentVersion: { id: "cv2", version: 2, name: "Consentimiento.pdf", mimeType: "application/pdf", sizeBytes: 20480, createdAt: "2026-11-20T15:00:00.000Z", url: "https://api.example.test/v1/consent-document/public/download/cv2.pdf" },
  familyMembersEnabled: false,
  subsystemRelationsEnabled: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};
const family: PatientType = { ...general, id: "type-family", name: "Familia", isDefault: false, patientCount: 1, currentVersion: null };

let role = AdminRole.ADMIN;
const refetch = vi.fn();
const uploadConsentVersion = vi.fn();
const setDefaultPatientType = vi.fn();
const deletePatientType = vi.fn();

let types: PatientType[] = [ general, family ];
const loadVersions = vi.fn((url: string) => [ { ...general.currentVersion!, url } ]);

vi.mock("@/src/api/patient-types/useFetchPatientTypes", () => ({
  useFetchPatientTypes: () => ({ data: types, patientTypes: types, defaultType: types[ 0 ], loading: false, error: null, refetch }),
}));
vi.mock("@/src/api/base/useApiQuery", async () => {
  const { useEffect, useState } = await import("react");
  return {
    useApiQuery: (url: string) => {
      const [ data, setData ] = useState<unknown>(null);
      useEffect(() => { setData(loadVersions(url)); }, [ url ]);
      return { data, loading: false, error: null, refetch: vi.fn() };
    },
  };
});
vi.mock("@/src/api/patient-types/usePatientTypeMutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/api/patient-types/usePatientTypeMutations")>()),
  useUploadConsentVersion: () => ({ uploadConsentVersion, loading: false, error: null }),
  useSetDefaultPatientType: () => ({ setDefaultPatientType, loading: false, error: null }),
  useDeletePatientType: () => ({ deletePatientType, loading: false, error: null }),
  useCreatePatientType: () => ({ createPatientType: vi.fn(), loading: false, error: null }),
  useRenamePatientType: () => ({ renamePatientType: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user: { role } }) }));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));

const renderTab = () => render(<FocusTrapProvider><PatientTypesTab /></FocusTrapProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  role = AdminRole.ADMIN;
  types = [ general, family ];
  uploadConsentVersion.mockResolvedValue({});
  setDefaultPatientType.mockResolvedValue({});
  deletePatientType.mockResolvedValue(undefined);
});

describe("PatientTypesTab", () => {
  it("lists each type with its default badge, patient count and current consent version", () => {
    renderTab();
    const generalCard = screen.getByTestId("patient-type-card-type-general");
    expect(within(generalCard).getByTestId("patient-type-default-badge-type-general")).toHaveTextContent("Predeterminado");
    expect(generalCard).toHaveTextContent("3 pacientes");
    expect(screen.getByTestId("patient-type-consent-type-general")).toHaveTextContent("Versión 2");
    expect(screen.getByTestId("patient-type-consent-type-family")).toHaveTextContent("Sin formulario de consentimiento");
  });

  it("offers no delete or make-default on the default type", () => {
    renderTab();
    expect(screen.queryByTestId("patient-type-delete-button-type-general")).toBeNull();
    expect(screen.queryByTestId("patient-type-default-button-type-general")).toBeNull();
    expect(screen.getByTestId("patient-type-delete-button-type-family")).toBeInTheDocument();
  });

  it("is read-only for a VIEWER", () => {
    role = AdminRole.VIEWER;
    renderTab();
    expect(screen.queryByTestId("settings-new-patient-type-button")).toBeNull();
    expect(screen.queryByTestId("patient-type-upload-button-type-general")).toBeNull();
    expect(screen.queryByTestId("patient-type-rename-button-type-general")).toBeNull();
    expect(screen.queryByTestId("patient-type-delete-button-type-family")).toBeNull();
  });

  it("uploads a PDF as a new version and refuses anything else before sending it", async () => {
    renderTab();
    const input = screen.getByTestId("patient-type-file-input-type-family");
    await userEvent.upload(input, new File([ "x" ], "foto.png", { type: "image/png" }), { applyAccept: false });
    expect(uploadConsentVersion).not.toHaveBeenCalled();
    expect(screen.getByTestId("patient-type-card-type-family")).toHaveTextContent("Selecciona un archivo PDF.");

    const pdf = new File([ "%PDF-1.4" ], "Familia.pdf", { type: "application/pdf" });
    await userEvent.upload(input, pdf);
    expect(uploadConsentVersion).toHaveBeenCalledWith("type-family", pdf);
    expect(refetch).toHaveBeenCalled();
  });

  it("reloads an open version list when a new version becomes current", async () => {
    const { rerender } = renderTab();
    await userEvent.click(screen.getByRole("button", { name: "Versiones" }));
    expect(loadVersions).toHaveBeenCalledTimes(1);

    types = [ { ...general, currentVersion: { ...general.currentVersion!, id: "cv3", version: 3 } }, family ];
    rerender(<FocusTrapProvider><PatientTypesTab /></FocusTrapProvider>);
    expect(screen.getByTestId("patient-type-consent-type-general")).toHaveTextContent("Versión 3");
    expect(loadVersions).toHaveBeenCalledTimes(2);
  });

  it("opens the name modal with the name field focused", async () => {
    renderTab();
    await userEvent.click(screen.getByTestId("settings-new-patient-type-button"));
    expect(screen.getByTestId("patient-type-name-input")).toHaveFocus();
  });

  it("makes a type the default", async () => {
    renderTab();
    await userEvent.click(screen.getByTestId("patient-type-default-button-type-family"));
    expect(setDefaultPatientType).toHaveBeenCalledWith("type-family");
  });

  it("deletes only after confirmation, and keeps the dialog open with the server's reason when refused", async () => {
    deletePatientType.mockRejectedValueOnce(new Error("Este tipo de paciente lo usa 1 paciente (incluidos los eliminados). Cámbialo de tipo antes de eliminarlo."));
    renderTab();
    await userEvent.click(screen.getByTestId("patient-type-delete-button-type-family"));
    const dialog = screen.getByTestId("delete-patient-type-dialog");
    expect(deletePatientType).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Sí, eliminar" }));
    expect(deletePatientType).toHaveBeenCalledWith("type-family");
    expect(screen.getByTestId("delete-patient-type-dialog")).toHaveTextContent("lo usa 1 paciente");
  });
});

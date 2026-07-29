import { describe, it, expect } from "vitest";
import {
  computeAutoFilledVariables,
  buildPreview,
  selectTemplateForAppointment,
} from "@/src/components/Modals/ReminderModal/utils";
import { TwilioTemplate, TemplateVariableAutoFill } from "@/src/utils/twilioConfig";
import { Appointment, AppointmentType, AppointmentLocation, AppointmentStatus } from "@/src/types/Appointment";
import { AdminRole, AdminStatus, User } from "@/src/types/User";
import { Patient } from "@/src/types/Patient";
import { Channel } from "@/src/types/Reminder";

function makeTemplate(variables: TwilioTemplate["variables"]): TwilioTemplate {
  return {
    label: "Test",
    contentSid: "HXtest",
    template: variables.map((v) => `{{${v.key}}}`).join(" "),
    variables,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appt-1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    startAt: "2024-06-15T10:00:00Z",
    endAt: "2024-06-15T11:00:00Z",
    timezone: "America/Bogota",
    price: 100000,
    currency: "COP",
    paid: false,
    status: AppointmentStatus.SCHEDULED,
    patientId: "patient-1",
    patient: {} as Patient,
    appointmentLocation: {} as AppointmentLocation,
    appointmentType: {} as AppointmentType,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "doctor@test.com",
    firstName: "Juan",
    lastName: "Garcia",
    displayName: "Dr. Garcia",
    avatar: "",
    logo: "",
    altLogo: "",
    jobTitle: "",
    role: AdminRole.ADMIN,
    status: AdminStatus.ACTIVE,
    timezone: "America/Bogota",
    reminderActive: true,
    reminderChannel: Channel.WHATSAPP,
    ...overrides,
  };
}

describe("computeAutoFilledVariables", () => {
  it("resolves patientName", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Patient", autoFill: "patientName" },
    ]);
    const result = computeAutoFilledVariables(tmpl, "Maria", "Dr. Lopez");
    expect(result["1"]).toBe("Maria");
  });

  it("resolves doctorName", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Doctor", autoFill: "doctorName" },
    ]);
    const result = computeAutoFilledVariables(tmpl, "Maria", "Dr. Lopez");
    expect(result["1"]).toBe("Dr. Lopez");
  });

  it("resolves appointmentDate from appointment", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Date", autoFill: "appointmentDate" },
    ]);
    const appt = makeAppointment({ startAt: "2024-06-15T10:00:00Z" });
    const result = computeAutoFilledVariables(tmpl, "", "", appt);
    expect(result["1"]).toBeTruthy();
    expect(result["1"]).not.toBe("");
  });

  it("returns empty string for appointmentDate when no appointment", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Date", autoFill: "appointmentDate" },
    ]);
    const result = computeAutoFilledVariables(tmpl, "", "", null);
    expect(result["1"]).toBe("");
  });

  it("resolves appointmentTime from appointment", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Time", autoFill: "appointmentTime" },
    ]);
    const appt = makeAppointment({ startAt: "2024-06-15T10:00:00Z" });
    const result = computeAutoFilledVariables(tmpl, "", "", appt);
    expect(result["1"]).toBeTruthy();
  });

  it("resolves meetingUrl", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "URL", autoFill: "meetingUrl" },
    ]);
    const appt = makeAppointment({ meetingUrl: "https://meet.google.com/abc" });
    const result = computeAutoFilledVariables(tmpl, "", "", appt);
    expect(result["1"]).toBe("https://meet.google.com/abc");
  });

  it("returns empty string for meetingUrl when null", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "URL", autoFill: "meetingUrl" },
    ]);
    const appt = makeAppointment({ meetingUrl: null });
    const result = computeAutoFilledVariables(tmpl, "", "", appt);
    expect(result["1"]).toBe("");
  });

  it("resolves locationAddress", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Address", autoFill: "locationAddress" },
    ]);
    const appt = makeAppointment({
      appointmentLocation: { id: "loc-1", name: "Office", address: "Calle 123", isVirtual: false, isActive: true },
    });
    const result = computeAutoFilledVariables(tmpl, "", "", appt);
    expect(result["1"]).toBe("Calle 123");
  });

  it("resolves locationInstructions", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Instructions", autoFill: "locationInstructions" },
    ]);
    const appt = makeAppointment({
      appointmentLocation: { id: "loc-1", name: "Office", instructions: "Piso 3", isVirtual: false, isActive: true },
    });
    const result = computeAutoFilledVariables(tmpl, "", "", appt);
    expect(result["1"]).toBe("Piso 3");
  });

  it("resolves bankName from user", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Bank", autoFill: "bankName" },
    ]);
    const user = makeUser({ bankName: "Bancolombia" });
    const result = computeAutoFilledVariables(tmpl, "", "", null, user);
    expect(result["1"]).toBe("Bancolombia");
  });

  it("resolves accountNumber from user", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Account", autoFill: "accountNumber" },
    ]);
    const user = makeUser({ accountNumber: "123456789" });
    const result = computeAutoFilledVariables(tmpl, "", "", null, user);
    expect(result["1"]).toBe("123456789");
  });

  it("resolves accountHolder from user firstName + lastName", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Holder", autoFill: "accountHolder" },
    ]);
    const user = makeUser({ firstName: "Juan", lastName: "Garcia" });
    const result = computeAutoFilledVariables(tmpl, "", "", null, user);
    expect(result["1"]).toBe("Juan Garcia");
  });

  it("resolves nationalId from user", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "ID", autoFill: "nationalId" },
    ]);
    const user = makeUser({ nationalId: "12345678" });
    const result = computeAutoFilledVariables(tmpl, "", "", null, user);
    expect(result["1"]).toBe("12345678");
  });

  it("resolves bankingKey from user", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Key", autoFill: "bankingKey" },
    ]);
    const user = makeUser({ bankingKey: "abc-123" });
    const result = computeAutoFilledVariables(tmpl, "", "", null, user);
    expect(result["1"]).toBe("abc-123");
  });

  it("resolves price from appointment", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Price", autoFill: "price" },
    ]);
    const appt = makeAppointment({ price: 150000 });
    const result = computeAutoFilledVariables(tmpl, "", "", appt);
    expect(result["1"]).toBe("150000");
  });

  it("falls back to appointmentType.defaultPrice when appointment.price is undefined", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Price", autoFill: "price" },
    ]);
    const appt = { ...makeAppointment(), price: undefined as unknown as number };
    const apptType = { defaultPrice: 200000 } as AppointmentType;
    const result = computeAutoFilledVariables(tmpl, "", "", appt, null, apptType);
    expect(result["1"]).toBe("200000");
  });

  it("returns empty string for price when both are null/undefined", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Price", autoFill: "price" },
    ]);
    const result = computeAutoFilledVariables(tmpl, "", "", null, null, null);
    expect(result["1"]).toBe("");
  });

  it("resolves userId from user", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "User ID", autoFill: "userId" },
    ]);
    const user = makeUser({ id: "user-42" });
    const result = computeAutoFilledVariables(tmpl, "", "", null, user);
    expect(result["1"]).toBe("user-42");
  });

  it("returns empty string for userId when user is null", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "User ID", autoFill: "userId" },
    ]);
    const result = computeAutoFilledVariables(tmpl, "", "", null, null);
    expect(result["1"]).toBe("");
  });

  it("returns empty string for unknown autoFill type", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Unknown", autoFill: "nonexistent" as unknown as TemplateVariableAutoFill },
    ]);
    const result = computeAutoFilledVariables(tmpl, "", "");
    expect(result["1"]).toBe("");
  });

  it("returns empty string when autoFill is undefined", () => {
    const tmpl = makeTemplate([{ key: "1", label: "No autoFill" }]);
    const result = computeAutoFilledVariables(tmpl, "", "");
    expect(result["1"]).toBe("");
  });

  it("handles multiple variables in one template", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Patient", autoFill: "patientName" },
      { key: "2", label: "Doctor", autoFill: "doctorName" },
      { key: "3", label: "Bank", autoFill: "bankName" },
    ]);
    const user = makeUser({ bankName: "Davivienda" });
    const result = computeAutoFilledVariables(tmpl, "Ana", "Dr. Luis", null, user);
    expect(result).toEqual({
      "1": "Ana",
      "2": "Dr. Luis",
      "3": "Davivienda",
    });
  });
});

describe("buildPreview", () => {
  it("replaces variable placeholders with values", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Name", autoFill: "patientName" },
      { key: "2", label: "Doctor", autoFill: "doctorName" },
    ]);
    const result = buildPreview(tmpl, { "1": "Maria", "2": "Dr. Lopez" });
    expect(result).toBe("Maria Dr. Lopez");
  });

  it("keeps placeholder when value is missing", () => {
    const tmpl = makeTemplate([
      { key: "1", label: "Name", autoFill: "patientName" },
      { key: "2", label: "Doctor", autoFill: "doctorName" },
    ]);
    const result = buildPreview(tmpl, { "1": "Maria" });
    expect(result).toBe("Maria {{2}}");
  });

  it("handles template with no variables", () => {
    const tmpl: TwilioTemplate = {
      label: "Static",
      contentSid: "HXtest",
      template: "Hello world",
      variables: [],
    };
    const result = buildPreview(tmpl, {});
    expect(result).toBe("Hello world");
  });

  it("replaces all instances of a placeholder", () => {
    const tmpl: TwilioTemplate = {
      label: "Test",
      contentSid: "HXtest",
      template: "{{1}} and {{1}} again",
      variables: [{ key: "1", label: "Name", autoFill: "patientName" }],
    };
    const result = buildPreview(tmpl, { "1": "Ana" });
    expect(result).toBe("Ana and Ana again");
  });
});

describe("selectTemplateForAppointment", () => {
  it("returns VIRTUAL template for virtual location", () => {
    const appt = makeAppointment({
      appointmentLocation: { id: "loc-1", name: "Virtual", isVirtual: true, isActive: true },
    });
    expect(selectTemplateForAppointment(appt)).toBe(
      "PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL",
    );
  });

  it("returns PRESENTIAL template for presential location", () => {
    const appt = makeAppointment({
      appointmentLocation: { id: "loc-1", name: "Office", isVirtual: false, isActive: true },
    });
    expect(selectTemplateForAppointment(appt)).toBe(
      "PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL",
    );
  });

  it("returns PRESENTIAL template when location is undefined", () => {
    const appt = makeAppointment({
      appointmentLocation: undefined as unknown as AppointmentLocation,
    });
    expect(selectTemplateForAppointment(appt)).toBe(
      "PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL",
    );
  });
});

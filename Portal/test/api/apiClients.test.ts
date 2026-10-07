import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, portalApi, publicApi } from "@/src/api/base/apiClients";
import { csrfStore } from "@/src/api/base/csrfStore";
import { toSpanishMessage } from "@/src/api/base/errorMessages";
import { resolveApiHost } from "@/src/config/api";

const fetchMock = vi.fn();

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status, headers: { "content-type": "application/json" } });
const fail = (status: number, error?: string) =>
  new Response(JSON.stringify({ success: false, error }), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  csrfStore.clear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publicApi (anonymous)", () => {
  it("never sends credentials or a CSRF header and unwraps the envelope", async () => {
    csrfStore.set("should-not-be-sent");
    fetchMock.mockResolvedValue(ok({ slots: [] }));
    await expect(publicApi.post("/providers/dra/otp", { email: "a@b.co" })).resolves.toEqual({ slots: [] });
    const [ url, init ] = fetchMock.mock.calls[ 0 ]!;
    expect(String(url)).toMatch(/\/v1\/public\/providers\/dra\/otp$/);
    expect(init.credentials).toBe("omit");
    expect(init.headers[ "X-CSRF-Token" ]).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not refresh tokens or redirect on 401: a single request, Spanish error", async () => {
    fetchMock.mockResolvedValue(fail(401, "Unauthorized"));
    const err = await publicApi.get("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(401);
    expect((err as ApiClientError).message).toBe("Tu sesión expiró. Inicia sesión de nuevo.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("portalApi (patient session)", () => {
  it("includes credentials, stores the CSRF token from a response and sends it on mutations only", async () => {
    fetchMock.mockResolvedValueOnce(ok({ csrfToken: "tok-123", email: "a@b.co" }));
    await portalApi.post("/providers/dra/otp/verify", { code: "123456" });
    expect(csrfStore.get()).toBe("tok-123");
    expect(fetchMock.mock.calls[ 0 ]![ 1 ].credentials).toBe("include");

    fetchMock.mockResolvedValueOnce(ok({ appointments: [] }));
    await portalApi.get("/appointments");
    expect(fetchMock.mock.calls[ 1 ]![ 1 ].headers[ "X-CSRF-Token" ]).toBeUndefined();

    fetchMock.mockResolvedValueOnce(ok({}));
    await portalApi.post("/bookings", { slot: 1 });
    expect(fetchMock.mock.calls[ 2 ]![ 1 ].headers[ "X-CSRF-Token" ]).toBe("tok-123");
  });

  it("clears the CSRF token when the session is gone and never redirects or refreshes", async () => {
    csrfStore.set("tok");
    fetchMock.mockResolvedValue(fail(401));
    await expect(portalApi.delete("/appointments/1")).rejects.toMatchObject({ status: 401 });
    expect(csrfStore.get()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports network failures in Spanish", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(portalApi.get("/session")).rejects.toMatchObject({
      status: 0,
      message: "No pudimos conectar con el servidor. Revisa tu conexión a internet.",
    });
  });
});

describe("toSpanishMessage", () => {
  it("maps known server messages and falls back by status", () => {
    expect(toSpanishMessage(409, "Appointment overlaps with another appointment of this provider")).toBe("Ya existe una cita en ese horario.");
    expect(toSpanishMessage(409, "Appointment overlaps with blocked time \"Lunch\" (x)")).toBe("Ese horario está bloqueado en la agenda.");
    expect(toSpanishMessage(401, "Invalid credentials")).toBe("Correo o contraseña incorrectos.");
    expect(toSpanishMessage(409, undefined)).toMatch(/conflicto/);
    expect(toSpanishMessage(429)).toMatch(/Demasiadas solicitudes/);
    expect(toSpanishMessage(500, "PrismaClientKnownRequestError: secret details")).toBe(
      "Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.",
    );
    expect(toSpanishMessage(418)).toBe("No pudimos completar la acción. Inténtalo de nuevo.");
  });

  it("never echoes unknown English server text", () => {
    expect(toSpanishMessage(400, "name is required")).not.toContain("name is required");
  });
});

describe("resolveApiHost", () => {
  it("uses the configured value, falls back to localhost outside production, and fails loudly in a production browser", () => {
    expect(resolveApiHost("https://api.patientnova.net", "production", true)).toBe("https://api.patientnova.net");
    expect(resolveApiHost(undefined, "development", true)).toBe("http://localhost:3001");
    expect(resolveApiHost(undefined, "production", false)).toBe("http://localhost:3001"); // build / SSR
    expect(() => resolveApiHost(undefined, "production", true)).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});

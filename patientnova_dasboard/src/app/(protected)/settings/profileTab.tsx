import { useUpdateProfile } from "@/src/api/useUpdateProfile";
import { useConsentDocument } from "@/src/api/useConsentDocument";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { User } from "@/src/types/User";
import { getInitials, ImageFormat, resizeToBase64 } from "@/src/utils/AvatarHelper";
import { COMMON_TIMEZONES } from "@/src/utils/TimeUtils";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useAuthContext } from "../../AuthContext";
import { ERR_GENERIC } from "@/src/constants/ui";

// ─── Reusable logo slot ───────────────────────────────────────────────────────

interface LogoSlotProps {
    label: string;
    hint: string;
    value: string | null;
    onSelect: () => void;
    onRemove: () => void;
}

function LogoSlot({ label, hint, value, onSelect, onRemove }: LogoSlotProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
                fontSize: 11, fontWeight: 700, color: "var(--c-gray-400)",
                textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
                {label}
            </div>
            <div style={{
                height: 96,
                borderRadius: "var(--r-md)",
                border: "1.5px dashed var(--c-gray-200)",
                background: "var(--c-gray-50)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}>
                {value ? (
                    <Image
                        src={value}
                        alt={label}
                        width={200}
                        height={88}
                        style={{ objectFit: "contain", maxHeight: 88 }}
                    />
                ) : (
                    <span style={{ fontSize: 12, color: "var(--c-gray-400)" }}>Sin logo</span>
                )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onSelect}>
                    📤 Subir
                </button>
                {value && (
                    <button
                        type="button"
                        className="btn-secondary"
                        style={{ flex: 1, color: "var(--c-error)" }}
                        onClick={onRemove}
                    >
                        🗑 Eliminar
                    </button>
                )}
            </div>
            <p style={{ fontSize: 12, color: "var(--c-gray-400)", margin: 0 }}>{hint}</p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileTab() {
    const { user } = useAuthContext();

    const [ firstName, setFirstName ] = useState(user?.firstName ?? "");
    const [ lastName, setLastName ] = useState(user?.lastName ?? "");
    const [ displayName, setDisplayName ] = useState(user?.displayName ?? "");
    const [ jobTitle, setJobTitle ] = useState(user?.jobTitle ?? "");
    const [ timezone, setTimezone ] = useState(user?.timezone ?? "America/Bogota");
    const [ avatarPreview, setAvatarPreview ] = useState<string | null>(user?.avatarUrl ?? null);
    const [ logo, setLogo ] = useState<string | null>(user?.logo ?? null);
    const [ altLogo, setAltLogo ] = useState<string | null>(user?.altLogo ?? null);
    const [ bankName, setBankName ] = useState<string>(user?.bankName ?? '');
    const [ accountNumber, setAccountNumber ] = useState<string>(user?.accountNumber ?? '');
    const [ nationalId, setNationalId ] = useState<string>(user?.nationalId ?? '');
    const [ bankingKey, setBankingKey ] = useState<string>(user?.bankingKey ?? '');

    const [ userPayload, setUserPayload ] = useState<Partial<User> | null>(null);
    const saveStatus = useUpdateProfile(userPayload);
    const [ error, setError ] = useState<string | null>(null);

    const { document, loading: docLoading, error: docError, fetchDocument, uploadDocument, deleteDocument } = useConsentDocument();
    const [ consentError, setConsentError ] = useState<string | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);
    const logoRef = useRef<HTMLInputElement>(null);
    const altLogoRef = useRef<HTMLInputElement>(null);
    const consentRef = useRef<HTMLInputElement>(null);

    // Fetch consent document on mount
    useEffect(() => {
        fetchDocument();
    }, [fetchDocument]);

    const initials = getInitials(user?.firstName?.[ 0 ] ?? "?", user?.lastName?.[ 0 ] ?? "?");

    // ── File handlers ──────────────────────────────────────────────────────────

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[ 0 ];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError("La imagen debe ser menor a 5 MB"); return; }
        if (!file.type.startsWith("image/")) { setError("Selecciona un archivo de imagen"); return; }
        try {
            setAvatarPreview(await resizeToBase64(file, 256));
            setError(null);
            handleFieldChange();
        } catch {
            setError(ERR_GENERIC);
        }
        e.target.value = "";
    }

    function makeLogoHandler(setter: (v: string | null) => void) {
        return async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[ 0 ];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { setError("El logo debe ser menor a 5 MB"); return; }
            if (!file.type.startsWith("image/")) { setError("Selecciona un archivo de imagen"); return; }
            try {
                // 800px wide — enough for a logo without ballooning the payload
                const format: ImageFormat = file.type === "image/png" ? "image/png" : "image/webp";
                setter(await resizeToBase64(file, 800, format));
                setError(null);
                handleFieldChange();
            } catch {
                setError(ERR_GENERIC);
            }
            e.target.value = "";
        };
    }

    async function handleConsentFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[ 0 ];
        if (!file) return;
        setConsentError(null);
        try {
            await uploadDocument(file);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al subir el documento";
            setConsentError(msg);
        }
        e.target.value = "";
    }

    async function handleConsentDelete() {
        try {
            setConsentError(null);
            await deleteDocument();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al eliminar el documento";
            setConsentError(msg);
        }
    }

    // ── Save ───────────────────────────────────────────────────────────────────

    function handleFieldChange() {
        setError(null);
        const payload: Partial<User> = {
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            displayName: displayName.trim() || undefined,
            jobTitle: jobTitle.trim() || undefined,
            avatarUrl: avatarPreview || undefined,
            logo: logo || undefined,
            altLogo: altLogo || undefined,
            timezone,
            bankName: bankName || undefined,
            accountNumber: accountNumber || undefined,
            nationalId: nationalId || undefined,
            bankingKey: bankingKey || undefined,
        };
        setUserPayload(payload);
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div style={{ display: "grid", gridTemplateColumns: "272px 1fr", gap: 24, maxWidth: 880 }}>
            <div className="dash-card" style={{ height: "fit-content" }}>
                <div className="dash-card__header">
                    <span className="dash-card__title">Foto de perfil</span>
                </div>
                <div className="dash-card__body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                    {avatarPreview ? (
                        <Image
                            src={avatarPreview}
                            alt="Avatar"
                            width={100}
                            height={100}
                            style={{ borderRadius: "50%", objectFit: "cover", border: "3px solid var(--c-gray-200)" }}
                        />
                    ) : (
                        <div style={{
                            width: 100, height: 100, borderRadius: "50%",
                            background: "var(--c-brand-accent)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 30, fontWeight: 700, color: "#fff",
                            border: "3px solid var(--c-gray-200)",
                        }}>
                            {initials}
                        </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                        <button type="button" className="btn-secondary" style={{ width: "100%" }} onClick={() => fileRef.current?.click()}>
                            📷 Seleccionar imagen
                        </button>
                        {avatarPreview && (
                            <button type="button" className="btn-secondary" style={{ width: "100%", color: "var(--c-error)" }} onClick={() => { setAvatarPreview(null); handleFieldChange(); }}>
                                🗑 Eliminar foto
                            </button>
                        )}
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                        <p style={{ fontSize: 12, color: "var(--c-gray-400)", textAlign: "center" }}>JPG, PNG o WebP · Máx. 5 MB</p>
                    </div>
                    <div style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 14, width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Rol</div>
                            <span style={{
                                background: user?.role === "SUPER_ADMIN" ? "#FEF2F2" : user?.role === "ADMIN" ? "var(--c-brand-light)" : "var(--c-gray-100)",
                                color: user?.role === "SUPER_ADMIN" ? "var(--c-error)" : user?.role === "ADMIN" ? "var(--c-brand)" : "var(--c-gray-700)",
                                borderRadius: "var(--r-full)", padding: "3px 12px", fontSize: 12, fontWeight: 600,
                            }}>{user?.role}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Estado</div>
                            <span style={{
                                background: user?.status === "ACTIVE" ? "var(--c-success-bg)" : "var(--c-warning-bg)",
                                color: user?.status === "ACTIVE" ? "var(--c-success)" : "var(--c-warning)",
                                borderRadius: "var(--r-full)", padding: "3px 12px", fontSize: 12, fontWeight: 600,
                            }}>{user?.status}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="dash-card">
                <div className="dash-card__header">
                    <span className="dash-card__title">Información personal</span>
                </div>
                <div className="dash-card__body">
                    <div className="form-stack">
                        <div className="form-grid-2">
                            <label className="form-label">
                                Nombre
                                <input className="form-input" type="text" value={firstName} onChange={e => { setFirstName(e.target.value); handleFieldChange(); }} placeholder="Juan" />
                            </label>
                            <label className="form-label">
                                Apellido
                                <input className="form-input" type="text" value={lastName} onChange={e => { setLastName(e.target.value); handleFieldChange(); }} placeholder="García" />
                            </label>
                        </div>
                        <label className="form-label">
                            Nombre en pantalla
                            <input className="form-input" type="text" value={displayName} onChange={e => { setDisplayName(e.target.value); handleFieldChange(); }} placeholder="Dr. Juan García" />
                            <span className="form-input-hint">Aparece en la barra lateral y en el dashboard</span>
                        </label>
                        <label className="form-label">
                            Cargo
                            <input className="form-input" type="text" value={jobTitle} onChange={e => { setJobTitle(e.target.value); handleFieldChange(); }} placeholder="Médico general" />
                        </label>
                        <label className="form-label">
                            Zona horaria
                            <select className="form-input" value={timezone} onChange={e => { setTimezone(e.target.value); handleFieldChange(); }}>
                                {COMMON_TIMEZONES.map(tz => (
                                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                                ))}
                            </select>
                            <span className="form-input-hint">Afecta el cálculo de &quot;citas de hoy&quot; en el servidor</span>
                        </label>
                        <div style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 16 }}>
                            <label className="form-label" style={{ opacity: 0.7 }}>
                                Correo electrónico
                                <input className="form-input" type="email" value={user?.email} readOnly style={{ background: "var(--c-gray-50)", cursor: "not-allowed" }} />
                                <span className="form-input-hint">El correo no se puede modificar</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
                <div className="dash-card__header">
                    <span className="dash-card__title">Informacion Bancaria</span>
                </div>
                <div className="dash-card__body">
                    <p style={{ fontSize: 13, color: "var(--c-gray-400)", marginTop: 0 }}>
                        Informacion a mandar a tus pacientes para que puedan hacer el pago de sus consultas.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                        <label className="form-label">
                            Nombre del banco
                            <input className="form-input" type="text" value={bankName} onChange={e => { setBankName(e.target.value); handleFieldChange(); }} placeholder="Bancolombia" />
                        </label>
                        <label className="form-label">
                            Numero de cuenta
                            <input className="form-input" type="text" value={accountNumber} onChange={e => { setAccountNumber(e.target.value); handleFieldChange(); }} placeholder="123465789" />
                        </label>
                        <label className="form-label">
                            Cedula
                            <input className="form-input" type="text" value={nationalId} onChange={e => { setNationalId(e.target.value); handleFieldChange(); }} placeholder="123456789" />
                        </label>
                        <label className="form-label">
                            Llave
                            <input className="form-input" type="text" value={bankingKey} onChange={e => { setBankingKey(e.target.value); handleFieldChange(); }} placeholder="@llaveBancolombia" />
                        </label>
                    </div>
                    <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={makeLogoHandler(setLogo)} />
                    <input ref={altLogoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={makeLogoHandler(setAltLogo)} />
                </div>
            </div>
            <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
                <div className="dash-card__header">
                    <span className="dash-card__title">Logos</span>
                </div>
                <div className="dash-card__body">
                    <p style={{ fontSize: 13, color: "var(--c-gray-400)", marginTop: 0 }}>
                        Sube el logo principal y el alternativo (p. ej. versión oscura o monocromática). Formatos admitidos: PNG, SVG, WebP · Máx. 5 MB.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                        <LogoSlot
                            label="Logo principal"
                            hint="Úsalo sobre fondos claros. Recomendado: fondo transparente."
                            value={logo}
                            onSelect={() => logoRef.current?.click()}
                            onRemove={() => { setLogo(null); handleFieldChange(); }}
                        />
                        <LogoSlot
                            label="Logo alternativo (icono)"
                            hint="Úsalo sobre fondos oscuros o de color."
                            value={altLogo}
                            onSelect={() => altLogoRef.current?.click()}
                            onRemove={() => { setAltLogo(null); handleFieldChange(); }}
                        />
                    </div>
                    <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={makeLogoHandler(setLogo)} />
                    <input ref={altLogoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={makeLogoHandler(setAltLogo)} />
                </div>
            </div>
            <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
                <div className="dash-card__header">
                    <span className="dash-card__title">Formulario de Consentimiento</span>
                </div>
                <div className="dash-card__body">
                    <p style={{ fontSize: 13, color: "var(--c-gray-400)", marginTop: 0 }}>
                        Sube un formulario de consentimiento en PDF que tus pacientes deberán completar. Solo se permite un documento por usuario.
                    </p>
                    {document ? (
                        <div style={{
                            padding: 16,
                            borderRadius: "var(--r-md)",
                            border: "1px solid var(--c-gray-200)",
                            background: "var(--c-gray-50)",
                            marginBottom: 16
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 24 }}>📄</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-gray-900)" }}>
                                            {document.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 4 }}>
                                            {(document.sizeBytes / 1024).toFixed(2)} KB · Actualizado {new Date(document.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => consentRef.current?.click()}>
                                    📤 Reemplazar
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ flex: 1, color: "var(--c-error)" }}
                                    onClick={handleConsentDelete}
                                    disabled={docLoading}
                                >
                                    🗑 Eliminar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: 32,
                            borderRadius: "var(--r-md)",
                            border: "2px dashed var(--c-gray-200)",
                            background: "var(--c-gray-50)",
                            textAlign: "center",
                            marginBottom: 16
                        }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                            <p style={{ fontSize: 13, color: "var(--c-gray-500)", margin: "0 0 12px 0" }}>
                                No hay ningún formulario de consentimiento cargado
                            </p>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => consentRef.current?.click()}
                                disabled={docLoading}
                            >
                                📤 Subir PDF
                            </button>
                        </div>
                    )}
                    <input
                        ref={consentRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display: "none" }}
                        onChange={handleConsentFileChange}
                    />
                    <p style={{ fontSize: 12, color: "var(--c-gray-400)", margin: 0 }}>
                        Formato: PDF · Máx. 10 MB
                    </p>
                </div>
            </div>
            {error && <div className="error-inline">⚠️ {error}</div>}
            {consentError && <div className="error-inline">⚠️ {consentError}</div>}
            {saveStatus === "saved" && <SuccessBanner message="Cambios guardados correctamente" />}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: "var(--c-gray-400)", alignSelf: "center", marginRight: 12 }}>
                    {saveStatus === "saved" && "✓ Guardado"}
                    {saveStatus === "error" && "✗ Error al guardar"}
                    {saveStatus === "idle" && ""}
                </span>
            </div>
        </div>
    );
}
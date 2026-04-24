import { useAuthContext } from "@/src/app/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";

export function LoginModal({ onClose }: { onClose: () => void }) {
    const { login, loading, error } = useAuthContext();
    const router = useRouter();
    const { ref: trapRef, handleKeyDown: trapKeyDown } = useFocusTrap<HTMLDivElement>();

    const [ email, setEmail ] = useState("");
    const [ password, setPassword ] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            await login(email, password);
            router.push("/dashboard");
        } catch {
            // error is managed by AuthContext
        }
    }
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [ onClose ]);

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Iniciar sesión" ref={trapRef} onKeyDown={trapKeyDown}>
            <div
                className="modal-panel modal-panel--sm fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div>
                        <div className="landing-modal-title">Inicia sesión en Patient Nova</div>
                        <div className="landing-modal-subtitle">Bienvenido de nuevo</div>
                    </div>
                    <button className="btn-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>
                <form
                    style={{ display: "flex", flexDirection: "column", gap: 16 }}
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <label className="form-label">
                        Correo electrónico
                        <input
                            className="form-input"
                            type="email"
                            placeholder="correo@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            autoFocus
                            required
                        />
                    </label>

                    <label className="form-label">
                        Contraseña
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>

                    {error && (
                        <div className="login-card__error">
                            ⚠️{" "}
                            {error === "Server error: 401" ? "Credenciales incorrectas" : "Error al iniciar sesión. Intenta de nuevo."}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary login-card__submit"
                        style={{ marginTop: 4 }}
                        disabled={loading || !email || !password}
                    >
                        {loading ? "Iniciando sesión…" : "Iniciar sesión"}
                    </button>
                </form>
            </div>
        </div>
    );
}

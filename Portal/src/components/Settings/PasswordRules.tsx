import { ACTION_ICONS } from "@/src/config/icons";

export const PW_RULES = [
    { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
    { label: "Al menos una mayúscula", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Al menos una minúscula", test: (p: string) => /[a-z]/.test(p) },
    { label: "Al menos un número", test: (p: string) => /[0-9]/.test(p) },
    {
        label: "Al menos un símbolo especial",
        test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
    },
];

export const meetsPasswordRules = (p: string) => PW_RULES.every((r) => r.test(p));

export function PasswordRules({ password, id }: { password: string; id?: string }) {
    return (
        <div
            id={id}
            data-testid="password-rules"
            style={{ background: "var(--c-gray-50)", borderRadius: "var(--r-lg)", padding: "12px 14px" }}
        >
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--c-gray-500)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                }}
            >
                Requisitos
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {PW_RULES.map((r) => {
                    const ok = r.test(password);
                    return (
                        <li
                            key={r.label}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                fontSize: 12,
                                color: ok ? "var(--c-success)" : "var(--c-gray-500)",
                                marginBottom: 5,
                            }}
                        >
                            <span style={{ fontWeight: 700 }} aria-hidden="true">
                                {ok ? <ACTION_ICONS.confirm size={12} /> : "○"}
                            </span>
                            <span>
                                {r.label}
                                <span className="sr-only">{ok ? ": cumplido" : ": pendiente"}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

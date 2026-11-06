import { useMemo, useState, type FocusEventHandler, type Ref } from "react";
import Image from 'next/image';

const COUNTRY_CODES = [
    { code: "+57", iso: "co", label: "CO" },
    { code: "+1", iso: "us", label: "US" },
    { code: "+1", iso: "ca", label: "CA" },
    { code: "+52", iso: "mx", label: "MX" },
    { code: "+54", iso: "ar", label: "AR" },
    { code: "+55", iso: "br", label: "BR" },
    { code: "+56", iso: "cl", label: "CL" },
    { code: "+58", iso: "ve", label: "VE" },
    { code: "+34", iso: "es", label: "ES" },
    { code: "+33", iso: "fr", label: "FR" },
    { code: "+44", iso: "gb", label: "GB" },
    { code: "+49", iso: "de", label: "DE" },
    { code: "+39", iso: "it", label: "IT" },
    { code: "+351", iso: "pt", label: "PT" },
    { code: "+41", iso: "ch", label: "CH" },
    { code: "+81", iso: "jp", label: "JP" },
    { code: "+86", iso: "cn", label: "CN" },
    { code: "+91", iso: "in", label: "IN" },
    { code: "+61", iso: "au", label: "AU" },
    { code: "+506", iso: "cr", label: "CR" },
    { code: "+507", iso: "pa", label: "PA" },
    { code: "+51", iso: "pe", label: "PE" },
    { code: "+593", iso: "ec", label: "EC" },
    { code: "+598", iso: "uy", label: "UY" },
    { code: "+595", iso: "py", label: "PY" },
    { code: "+591", iso: "bo", label: "BO" },
    { code: "+503", iso: "sv", label: "SV" },
    { code: "+502", iso: "gt", label: "GT" },
    { code: "+504", iso: "hn", label: "HN" },
    { code: "+505", iso: "ni", label: "NI" },
    { code: "+809", iso: "do", label: "DO" },
    { code: "+53", iso: "cu", label: "CU" },
];

export function flagUrl(iso: string) {
    return `https://flagcdn.com/w40/${iso}.png`;
}

function parsePhone(value: string | undefined): { iso: string; local: string } {
    if (!value) return { iso: "co", local: "" };
    for (const c of [ ...COUNTRY_CODES ].sort((a, b) => b.code.length - a.code.length)) {
        if (value.startsWith(c.code)) {
            return { iso: c.iso, local: value.slice(c.code.length) };
        }
    }
    return { iso: "co", local: value };
}

export function CountryCodeInput({
    value,
    onChange,
    placeholder = "5551234567",
    id,
    name,
    autoComplete,
    onBlur,
    ref,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    "data-testid": testId,
}: {
    value: string | undefined;
    onChange: (fullNumber: string) => void;
    placeholder?: string;
    id?: string;
    name?: string;
    autoComplete?: string;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    ref?: Ref<HTMLInputElement>;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    "data-testid"?: string;
}) {
    const parsed = useMemo(() => parsePhone(value), [ value ]);
    const [ selectedIso, setSelectedIso ] = useState(parsed.iso);
    const [ plusTyped, setPlusTyped ] = useState(false);
    const local = parsed.local;

    const entry = COUNTRY_CODES.find(c => c.iso === selectedIso);
    const countryCode = entry?.code ?? "+57";

    function handleCodeChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const newIso = e.target.value;
        setSelectedIso(newIso);
        const newCode = COUNTRY_CODES.find(c => c.iso === newIso)?.code ?? "+57";
        const digits = local.replace(/\D/g, "");
        onChange(digits ? newCode + digits : "");
    }

    function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = e.target.value.trim();
        const digits = raw.replace(/[^\d]/g, "");
        setPlusTyped(raw === "+");
        if (raw.startsWith("+") && digits) {
            const full = `+${digits}`;
            const typed = parsePhone(full);
            if (!full.startsWith(countryCode)) setSelectedIso(typed.iso);
            onChange(typed.local ? full : "");
            return;
        }
        onChange(digits ? countryCode + digits : "");
    }

    return (
        <div className="phone-input-group" data-testid={testId}>
            <Image
                className="phone-input-flag"
                src={flagUrl(entry?.iso ?? "co")}
                alt={entry?.label ?? ""}
                width={20}
                height={15}
            />
            <div className="phone-input-code-wrapper">
                <span className="phone-input-code-display" aria-hidden>
                    {countryCode}
                </span>
                <select
                    className="phone-input-code"
                    aria-label="Indicativo del país"
                    value={selectedIso}
                    onChange={handleCodeChange}
                    style={{ color: "transparent" }}
                >
                    {COUNTRY_CODES.map(c => (
                        <option key={c.iso} value={c.iso} style={{ color: "initial" }}>
                            {c.code} {c.label}
                        </option>
                    ))}
                </select>
            </div>
            <input
                ref={ref}
                id={id}
                name={name}
                className="phone-input-number"
                type="tel"
                autoComplete={autoComplete}
                value={plusTyped && !value ? "+" : local}
                onChange={handleLocalChange}
                onBlur={onBlur}
                placeholder={placeholder}
                inputMode="tel"
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
            />
        </div>
    );
}
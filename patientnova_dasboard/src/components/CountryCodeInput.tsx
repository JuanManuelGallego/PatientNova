import { useMemo, useState } from "react";
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

function parsePhone(value: string | undefined): { countryCode: string; local: string } {
    if (!value) return { countryCode: "+57", local: "" };
    for (const c of [ ...COUNTRY_CODES ].sort((a, b) => b.code.length - a.code.length)) {
        if (value.startsWith(c.code)) {
            return { countryCode: c.code, local: value.slice(c.code.length) };
        }
    }
    if (value.startsWith("+")) {
        const match = value.match(/^\+(\d{1,3})/);
        if (match) return { countryCode: "+" + match[ 1 ], local: value.slice(match[ 0 ].length) };
    }
    return { countryCode: "+57", local: value };
}

export function CountryCodeInput({
    value,
    onChange,
    placeholder = "5551234567",
}: {
    value: string | undefined;
    onChange: (fullNumber: string) => void;
    placeholder?: string;
}) {
    const parsed = useMemo(() => parsePhone(value), [ value ]);
    const [ countryCode, setCountryCode ] = useState(parsed.countryCode);
    const local = parsed.local;

    function handleCodeChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const newCode = e.target.value;
        setCountryCode(newCode);
        onChange(local ? newCode + local : "");
    }

    function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
        const digits = e.target.value.replace(/[^\d]/g, "");
        onChange(digits ? countryCode + digits : "");
    }

    const entry = COUNTRY_CODES.find(c => c.code === countryCode);

    return (
        <div className="phone-input-group">
            <Image
                className="phone-input-flag"
                src={flagUrl(entry?.iso ?? "co")}
                alt={entry?.label ?? ""}
                width={20}
                height={15}
            />
            <select
                className="phone-input-code"
                value={countryCode}
                onChange={handleCodeChange}
            >
                {COUNTRY_CODES.map(c => (
                    <option key={c.code + c.label} value={c.code}>
                        {c.code}
                    </option>
                ))}
            </select>
            <input
                className="phone-input-number"
                value={local}
                onChange={handleLocalChange}
                placeholder={placeholder}
                inputMode="tel"
            />
        </div>
    );
}

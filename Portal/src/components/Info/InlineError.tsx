import { STATUS_ICONS } from "@/src/config/icons";

/** A save or load error, shown at the bottom of the section it belongs to. */
export function InlineError({ message, testId }: { message: string; testId?: string }) {
    return (
        <div className="error-inline" role="alert" style={{ display: "flex", alignItems: "center", gap: 6 }} data-testid={testId}>
            <STATUS_ICONS.warning size={14} /> {message}
        </div>
    );
}

/** An error under its field; point the field's `aria-describedby` at `id`. */
export function FieldError({ id, message }: { id?: string; message: string }) {
    return (
        <span id={id} role="alert" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-error)" }}>
            <STATUS_ICONS.warning size={12} aria-hidden="true" /> {message}
        </span>
    );
}

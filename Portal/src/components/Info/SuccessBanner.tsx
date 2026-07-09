import { STATUS_ICONS } from "@/src/config/icons";

export function SuccessBanner({ message }: { message: string }) {
  const CheckIcon = STATUS_ICONS.success;
  return (
    <div
      style={{
        background: "var(--c-success-bg)",
        border: "1px solid var(--c-success-light)",
        borderRadius: "var(--r-lg)",
        padding: "10px 14px",
        fontSize: 13,
        color: "var(--c-success)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <CheckIcon size={14} /> {message}
    </div>
  );
}

import { STATUS_ICONS } from "@/src/config/icons";

export function ErrorBanner({
  msg,
  onRetry,
}: {
  msg: string;
  onRetry: () => void;
}) {
  const WarnIcon = STATUS_ICONS.warning;
  return (
    <div className="error-banner">
      <span
        className="error-banner__text"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <WarnIcon size={14} /> {msg}
      </span>
      <button onClick={onRetry} className="btn-danger btn-sm">
        Reintentar
      </button>
    </div>
  );
}

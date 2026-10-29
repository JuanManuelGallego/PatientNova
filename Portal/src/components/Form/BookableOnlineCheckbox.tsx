export function BookableOnlineCheckbox({
  checked,
  onChange,
  disabled = false,
  hint,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint: string;
  testId: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 15, height: 15, marginTop: 2 }}
        data-testid={testId}
      />
      <span>
        Disponible para reserva en línea
        <span
          style={{
            display: "block",
            fontSize: 11,
            color: "var(--c-gray-400)",
            lineHeight: 1.3,
          }}
        >
          {hint}
        </span>
      </span>
    </label>
  );
}

export function OnlineBadge({ testId, label = "En línea" }: { testId: string; label?: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        background: "var(--c-success-light)",
        color: "var(--c-success)",
        borderRadius: "var(--r-full)",
        padding: "2px 8px",
        letterSpacing: "0.03em",
        flexShrink: 0,
      }}
      data-testid={testId}
    >
      {label}
    </span>
  );
}

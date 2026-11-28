export interface ReadOnlyValue {
  key: string;
  label: string;
  value: string;
}

export function ReadOnlyValues({ items }: { items: ReadOnlyValue[] }) {
  return (
    <dl style={{ display: "grid", gap: 14, margin: 0 }}>
      {items.map((item) => (
        <div key={item.key}>
          <dt style={{ fontSize: 13, fontWeight: 600, color: "var(--c-gray-700)" }}>{item.label}</dt>
          <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", color: "var(--c-gray-900)" }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

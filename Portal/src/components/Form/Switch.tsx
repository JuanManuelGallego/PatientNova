// On/off switch for turning a feature on or off. A native checkbox with role="switch",
// so it keeps keyboard, form and screen-reader behavior; the visible text shows the state.
export function Switch({
  checked,
  onChange,
  label,
  onText = "Activada",
  offText = "Desactivada",
  disabled = false,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  onText?: string;
  offText?: string;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="switch" data-disabled={disabled || undefined}>
      <span className="switch__state" aria-hidden="true">{checked ? onText : offText}</span>
      <input
        type="checkbox"
        role="switch"
        className="switch__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        data-testid={testId}
      />
      <span className="switch__track" aria-hidden="true" />
    </label>
  );
}

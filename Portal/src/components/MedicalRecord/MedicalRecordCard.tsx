export const MedicalRecordCard = ({ children, title, icon, actions }: {
  children: React.ReactNode;
  title: string;
  icon?: string;
  /** Right side of the header, e.g. the autosave `SaveStatusIndicator`. */
  actions?: React.ReactNode;
}) => (
  <div style={{
    background: "var(--c-surface)",
    borderRadius: "var(--r-3xl)",
    boxShadow: "var(--shadow-card)",
    padding: 24,
  }} data-testid="medical-record-card">
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 20,
      fontSize: 18,
      fontWeight: 700,
      color: "var(--c-gray-900)"
    }}>
      {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
      {title}
      {actions && <span style={{ marginLeft: "auto" }}>{actions}</span>}
    </div>
    {children}
  </div>
);

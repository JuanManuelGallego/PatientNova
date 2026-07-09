export const MedicalRecordCard = ({ children, title, icon }: { children: React.ReactNode; title: string; icon?: string }) => (
  <div style={{
    background: "var(--c-surface)",
    borderRadius: "var(--r-3xl)",
    boxShadow: "var(--shadow-card)",
    padding: 24,
  }}>
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
    </div>
    {children}
  </div>
);

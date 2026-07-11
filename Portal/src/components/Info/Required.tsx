export const RequiredField = ({ label }: { label: string }) => (
    <span>
        {label}
        <span style={{ color: "var(--c-required)", marginLeft: 4 }}>*</span>
    </span>
);
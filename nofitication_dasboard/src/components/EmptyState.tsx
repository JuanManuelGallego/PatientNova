export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <tr>
            <td colSpan={10} style={{ padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>{sub}</div>
            </td>
        </tr>
    );
}

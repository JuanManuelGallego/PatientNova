export function SkeletonRow() {
    return (
        <tr>
            {[ 180, 120, 200, 140, 140, 80, 60 ].map((w, i) => (
                <td key={i} style={{ padding: "16px 20px" }}>
                    <div style={{
                        height: 14, width: w, borderRadius: 6,
                        background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite",
                    }} />
                </td>
            ))}
        </tr>
    );
}

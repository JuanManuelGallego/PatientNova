export function SkeletonRow() {
    return (
        <tr>
            {[ 180, 120, 200, 140, 140, 80, 60 ].map((w, i) => (
                <td key={i} className="td">
                    <div className="skeleton-bar" style={{ width: w }} />
                </td>
            ))}
        </tr>
    );
}

import { Channel, CHANNEL_ICON, CHANNEL_LABEL } from "../types/Reminder";

export function ChannelIcon({ type, value }: { type: Channel; value: string | null }) {
    if (!value) {
        return (
            <span style={{ fontSize: 11, color: "#828383", display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ textDecoration: "line-through", opacity: 0.5 }}>—</span>
            </span>
        );
    }
    return (
        <span title={value} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 10px", borderRadius: 20,
            background: "#F3F4F6", fontSize: 12, fontWeight: 500, color: "#374151",
        }}>
            {CHANNEL_ICON[ type ]} {value}
        </span>
    );
}

export function ChannelBadge({ channel }: { channel: Channel }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 20,
            background: "#F3F4F6", fontSize: 12, fontWeight: 500, color: "#374151",
        }}>
            {CHANNEL_ICON[ channel ]} {CHANNEL_LABEL[ channel ]}
        </span>
    );
}
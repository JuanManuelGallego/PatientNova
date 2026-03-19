import { useState, useMemo } from "react";
import { btnSecondary } from "../styles/theme";
import { Appointment, AppointmentStatus, LOCATION_CFG, STATUS_CFG } from "../types/Appointment";
import { today, MONTH_NAMES_ES, DAY_NAMES_ES, getDate, getTime } from "../utils/TimeUtils";

export function CalendarView({ appointments, onDayClick, onApptClick }: {
    appointments: Appointment[];
    onDayClick: (date: string) => void;
    onApptClick: (a: Appointment) => void;
}) {
    const [ calYear, setCalYear ] = useState(new Date().getFullYear());
    const [ calMonth, setCalMonth ] = useState(new Date().getMonth());

    const firstDay = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // Monday-based offset
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = startOffset + daysInMonth;
    const rows = Math.ceil(cells / 7);

    const apptByDate = useMemo(() => {
        const map: Record<string, Appointment[]> = {};
        for (const a of appointments) {
            const date = getDate(a.date)
            if (!map[ date ]) map[ date ] = [];
            map[ date ].push(a);
        }
        return map;
    }, [ appointments ]);
    console.log(apptByDate)
    function cellDate(cell: number): string | null {
        const day = cell - startOffset + 1;
        if (day < 1 || day > daysInMonth) return null;
        return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const todayStr = today();

    return (
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Calendar header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                    style={{ ...btnSecondary, padding: "7px 14px", fontSize: 16 }}>‹</button>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#111827", fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {MONTH_NAMES_ES[ calMonth ]} {calYear}
                </span>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                    style={{ ...btnSecondary, padding: "7px 14px", fontSize: 16 }}>›</button>
            </div>

            {/* Day name headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#F9FAFB" }}>
                {DAY_NAMES_ES.map(d => (
                    <div key={d} style={{ padding: "10px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em" }}>{d}</div>
                ))}
            </div>

            {/* Cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {Array.from({ length: rows * 7 }).map((_, i) => {
                    const date = cellDate(i);
                    console.log("cell Date: ", date)
                    const isToday = date === todayStr;
                    const appts = date ? (apptByDate[ date ] ?? []) : [];
                    return (
                        <div key={i} onClick={() => date && onDayClick(date)} style={{
                            minHeight: 90, padding: "8px 10px",
                            borderRight: (i + 1) % 7 !== 0 ? "1px solid #F3F4F6" : "none",
                            borderBottom: i < rows * 7 - 7 ? "1px solid #F3F4F6" : "none",
                            background: !date ? "#FAFAFA" : isToday ? "#F0F9FF" : "#fff",
                            cursor: date ? "pointer" : "default",
                            transition: "background 0.1s",
                        }}
                            onMouseEnter={e => { if (date) (e.currentTarget as HTMLElement).style.background = isToday ? "#E0F2FE" : "#F9FAFB"; }}
                            onMouseLeave={e => { if (date) (e.currentTarget as HTMLElement).style.background = isToday ? "#F0F9FF" : "#fff"; }}
                        >
                            {date && (
                                <>
                                    <div style={{
                                        fontSize: 13, fontWeight: isToday ? 700 : 500,
                                        color: isToday ? "#fff" : "#374151",
                                        background: isToday ? "#1E3A5F" : "transparent",
                                        width: 24, height: 24, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        marginBottom: 4,
                                    }}>
                                        {parseInt(date.slice(8))}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        {appts.slice(0, 3).map(a => (
                                            <div key={a.id} onClick={e => { e.stopPropagation(); onApptClick(a); }} style={{
                                                fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 4,
                                                background: LOCATION_CFG[ a.location ].bg,
                                                color: LOCATION_CFG[ a.location ].color,
                                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                cursor: "pointer",
                                            }}>
                                                {getTime(a.date)} {a.patient.name} - {a.location} {a.status == AppointmentStatus.CONFIRMED && "✅"}
                                            </div>
                                        ))}
                                        {appts.length > 3 && (
                                            <div style={{ fontSize: 10, color: "#9CA3AF", paddingLeft: 4 }}>+{appts.length - 3} más</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

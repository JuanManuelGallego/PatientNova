"use client";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { flagUrl } from "@/src/components/CountryCodeInput";
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import Sidebar from "@/src/components/Navigation/Sidebar";
import { Appointment, APT_LOCATION_CFG, AppointmentStatus } from "@/src/types/Appointment";
import { today, MONTH_NAMES_ES, DAY_NAMES_ES, formatTime, fmtDate, getColombianHolidays } from "@/src/utils/TimeUtils";
import Image from "next/image";
import { useState, useMemo, useEffect, useCallback } from "react";

const TODAY_STR = today();

export default function CalendarPage() {
  const { appointments, loading, fetchAppointments } = useFetchAppointments();
  const { updateAppointment } = useUpdateAppointment();

  const [ calYear, setCalYear ] = useState(new Date().getFullYear());
  const [ calMonth, setCalMonth ] = useState(new Date().getMonth());

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editAppt, setEditAppt ] = useState<Appointment | null>(null);
  const [ viewAppt, setViewAppt ] = useState<Appointment | null>(null);
  const [ deleteAppt, setDeleteAppt ] = useState<Appointment | null>(null);
  const [ prefillDate, setPrefillDate ] = useState<string | null>(null);
  const [ selectedDay, setSelectedDay ] = useState<string | null>(null);

  const { daysInMonth, startOffset, rows } = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const rows = Math.ceil((startOffset + daysInMonth) / 7);
    return { daysInMonth, startOffset, rows };
  }, [ calYear, calMonth ]);

  const apptByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      const date = a.startAt.slice(0, 10);
      if (!map[ date ]) map[ date ] = [];
      map[ date ].push(a);
    }
    return map;
  }, [ appointments ]);

  const holidayMap = useMemo(() => {
    const holidays = getColombianHolidays(calYear);
    const map: Record<string, string> = {};
    for (const h of holidays) map[ h.date ] = h.name;
    return map;
  }, [ calYear ]);

  function cellDate(cell: number): string | null {
    const day = cell - startOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const prevMonth = useCallback(() => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }, [ calMonth ]);

  const nextMonth = useCallback(() => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }, [ calMonth ]);

  const goToday = useCallback(() => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") prevMonth();
      if (e.key === "ArrowRight") nextMonth();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [ prevMonth, nextMonth ]);

  async function handlePay(id: string) {
    try {
      await updateAppointment(id, { paid: true });
    } finally { fetchAppointments(); }
  }

  const selectedDayAppts = selectedDay ? (apptByDate[ selectedDay ] ?? []) : [];

  return (
    <>
      <div className="page-shell">
        <Sidebar />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h1 className="page-title">Agenda</h1>
              <p className="page-subtitle">
                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="page-header__actions">
              <button onClick={() => setShowCreate(true)} className="btn-primary btn-hero">
                <span className="btn-plus-icon">+</span> Nueva Cita
              </button>
            </div>
          </div>

          <div className="table-card">
            <div className="cal-nav-header">
              <button onClick={prevMonth} className="btn-secondary" style={{ padding: "7px 14px", fontSize: 16 }}>&#8249;</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="cal-month-label">{MONTH_NAMES_ES[ calMonth ]} {calYear}</span>
                <button onClick={goToday} className="btn-secondary btn-secondary--sm">Hoy</button>
              </div>
              <button onClick={nextMonth} className="btn-secondary" style={{ padding: "7px 14px", fontSize: 16 }}>&#8250;</button>
            </div>

            <div className="cal-day-headers">
              {DAY_NAMES_ES.map(d => (
                <div key={d} className="cal-day-header">{d}</div>
              ))}
            </div>

            {loading ? (
              <div className="cal-loading">Cargando citas…</div>
            ) : (
              <div className="cal-grid">
                {Array.from({ length: rows * 7 }).map((_, i) => {
                  const date = cellDate(i);
                  const isToday = date === TODAY_STR;
                  const isPast = date !== null && date < TODAY_STR;
                  const appts = date ? (apptByDate[ date ] ?? []) : [];
                  const holiday = date ? holidayMap[ date ] : undefined;
                  const noRightBorder = (i + 1) % 7 === 0;
                  const noBottomBorder = i >= rows * 7 - 7;

                  return (
                    <div
                      key={i}
                      onClick={() => { if (date) setSelectedDay(date); }}
                      className={[
                        "cal-cell",
                        !date ? "cal-cell--empty" : "",
                        isToday ? "cal-cell--today" : "",
                        holiday ? "cal-cell--holiday" : "",
                        isPast && !isToday ? "cal-cell--past" : "",
                        noRightBorder ? "cal-cell--no-right-border" : "",
                        noBottomBorder ? "cal-cell--no-bottom-border" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {date && (
                        <>
                          <div className={`cal-day-number${isToday ? " cal-day-number--today" : ""}`}>
                            {parseInt(date.slice(8))}
                          </div>
                          {holiday && (
                            <div className="cal-holiday-label" title={holiday}>
                              <Image
                                className="phone-input-flag"
                                src={flagUrl("co")}
                                alt={"Colombia"}
                                width={20}
                                height={15}
                              />
                              {" "}{holiday}
                            </div>)
                          }
                          <div className="cal-chips">
                            {appts.slice(0, 3).map(a => {
                              const isCancelled = a.status === AppointmentStatus.CANCELLED;
                              const isNoShow = a.status === AppointmentStatus.NO_SHOW;
                              const isCompleted = a.status === AppointmentStatus.COMPLETED;
                              return (
                                <div
                                  key={a.id}
                                  onClick={e => { e.stopPropagation(); setViewAppt(a); }}
                                  className={[
                                    "cal-chip",
                                    isCancelled ? "cal-chip--cancelled" : "",
                                    isNoShow ? "cal-chip--no-show" : "",
                                    isCompleted ? "cal-chip--completed" : "",
                                  ].filter(Boolean).join(" ")}
                                  style={{
                                    background: APT_LOCATION_CFG[ a.location ]?.bg ?? "var(--c-gray-200)",
                                    color: APT_LOCATION_CFG[ a.location ]?.color ?? "var(--c-gray-700)",
                                  }}
                                  title={`${a.patient.name} ${a.patient.lastName} — ${a.location} — ${a.status}`}
                                >
                                  {formatTime(a.startAt)} {a.patient.name} {a.patient.lastName} — {a.location}
                                  {a.status === AppointmentStatus.CONFIRMED && " ✅"}
                                  {a.status === AppointmentStatus.SCHEDULED && " ⌛"}
                                </div>
                              );
                            })}
                            {appts.length > 3 && (
                              <button
                                className="cal-overflow-btn"
                                onClick={e => { e.stopPropagation(); setSelectedDay(date); }}
                              >
                                +{appts.length - 3} más
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
      {selectedDay && (
        <div className="cal-day-panel-overlay" onClick={() => setSelectedDay(null)}>
          <div className="cal-day-panel" onClick={e => e.stopPropagation()}>
            <div className="cal-day-panel__header">
              <span className="cal-day-panel__title">{fmtDate(selectedDay)}</span>
              <button className="btn-close" onClick={() => setSelectedDay(null)}>✕</button>
            </div>
            {selectedDayAppts.length === 0 ? (
              <p className="cal-day-panel__empty">No hay citas para este día.</p>
            ) : (
              <div className="cal-day-panel__appt-list">
                {selectedDayAppts.map(a => (
                  <div
                    key={a.id}
                    className="cal-day-panel__appt-item"
                    onClick={() => { setViewAppt(a); setSelectedDay(null); }}
                  >
                    <div
                      className="cal-day-panel__appt-dot"
                      style={{ background: APT_LOCATION_CFG[ a.location ]?.dot ?? "var(--c-gray-400)" }}
                    />
                    <span className="cal-day-panel__appt-name">{a.patient.name} {a.patient.lastName}</span>
                    <span className="cal-day-panel__appt-time">{formatTime(a.startAt)}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="btn-primary btn-hero"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => { setPrefillDate(selectedDay); setSelectedDay(null); setShowCreate(true); }}
            >
              <span className="btn-plus-icon">+</span> Nueva Cita
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <AppointmentModal
          appt={undefined}
          prefillDate={prefillDate}
          onClose={() => { setShowCreate(false); setPrefillDate(null); }}
          onSaved={fetchAppointments}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          onClose={() => setEditAppt(null)}
          onSaved={fetchAppointments}
        />
      )}
      {viewAppt && !editAppt && !deleteAppt && (
        <AppointmentDrawer
          appt={viewAppt}
          onClose={() => setViewAppt(null)}
          onEdit={() => { setEditAppt(viewAppt); setViewAppt(null); }}
          onPay={() => { handlePay(viewAppt.id); setViewAppt(null); }}
          onDelete={() => { setDeleteAppt(viewAppt); setViewAppt(null); }}
        />
      )}
      {deleteAppt && (
        <CancelAppointmentModal
          appt={deleteAppt}
          onClose={() => setDeleteAppt(null)}
          onCanceled={fetchAppointments}
        />
      )}
    </>
  );
}



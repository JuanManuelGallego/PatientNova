"use client";
import { useState } from "react";
import { Suspense } from "react";
import { useFetchAppointments } from "@/src/api/appointments/useFetchAppointments";
import { useUpdateAppointment } from "@/src/api/appointments/useUpdateAppointment";
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { Appointment } from "@/src/types/Appointment";
import { todayString } from "@/src/utils/timeUtils";
import { ViewMode } from "./types";
import { useCalendarNavigation } from "./useCalendarNavigation";
import { useCalendarData } from "./useCalendarData";
import { CalendarToolbar } from "./components/CalendarToolbar";
import { CalendarLegend } from "./components/CalendarLegend";
import { MonthView } from "./components/MonthView";
import { WeekView } from "./components/WeekView";
import { DayView } from "./components/DayView";
import { DayPanel } from "./components/DayPanel";

function CalendarContent() {
  const { updateAppointment } = useUpdateAppointment();

  const {
    viewMode,
    setViewMode,
    calYear,
    calMonth,
    weekStart,
    dayDate,
    selectedDay,
    setSelectedDay,
    calendarFilters,
    navPrev,
    navNext,
    goToday,
    drillToDay,
  } = useCalendarNavigation();

  const { appointments, loading, fetchAppointments } =
    useFetchAppointments(calendarFilters);

  const { rows, weekDays, apptByDate, holidayMap, cellDate, navLabel, hourRange } =
    useCalendarData({
      calYear,
      calMonth,
      weekStart,
      dayDate,
      viewMode,
      appointments,
    });

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editAppt, setEditAppt ] = useState<Appointment | null>(null);
  const [ viewAppt, setViewAppt ] = useState<Appointment | null>(null);
  const [ deleteAppt, setDeleteAppt ] = useState<Appointment | null>(null);
  const [ prefillDate, setPrefillDate ] = useState<string | null>(null);

  const [ actionError, setActionError ] = useState<string | null>(null);

  async function handlePay(id: string) {
    setActionError(null);
    try {
      await updateAppointment(id, { paid: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al registrar el pago");
    } finally {
      fetchAppointments();
    }
  }

  const selectedDayAppts = selectedDay ? (apptByDate[ selectedDay ] ?? []) : [];

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Agenda"
          subtitle={todayString()}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary btn-hero"
            >
              Nueva Cita
            </button>
          }
        />
        {actionError && (
          <ErrorBanner msg={actionError} onRetry={() => setActionError(null)} />
        )}
        <div className="table-card">
          <CalendarToolbar
            navLabel={navLabel}
            viewMode={viewMode}
            onPrev={navPrev}
            onNext={navNext}
            onToday={goToday}
            onChangeView={setViewMode}
          />
          {viewMode === ViewMode.Month && (
            <MonthView
              rows={rows}
              cellDate={cellDate}
              apptByDate={apptByDate}
              holidayMap={holidayMap}
              loading={loading}
              onSelectDay={setSelectedDay}
              onDrillToDay={drillToDay}
              onViewAppt={setViewAppt}
            />
          )}
          {viewMode === ViewMode.Week && (
            <WeekView
              weekDays={weekDays}
              apptByDate={apptByDate}
              holidayMap={holidayMap}
              loading={loading}
              hourRange={hourRange}
              onDrillToDay={drillToDay}
              onViewAppt={setViewAppt}
              onCreateAt={(date) => {
                setPrefillDate(date);
                setShowCreate(true);
              }}
            />
          )}
          {viewMode === ViewMode.Day && (
            <DayView
              dayDate={dayDate}
              apptByDate={apptByDate}
              holidayMap={holidayMap}
              loading={loading}
              hourRange={hourRange}
              onViewAppt={setViewAppt}
              onCreateAt={(date) => {
                setPrefillDate(date);
                setShowCreate(true);
              }}
            />
          )}
          <CalendarLegend />
        </div>
      </PageLayout>

      {selectedDay && viewMode === ViewMode.Month && (
        <DayPanel
          selectedDay={selectedDay}
          appts={selectedDayAppts}
          onClose={() => setSelectedDay(null)}
          onViewAppt={setViewAppt}
          onDrillToDay={drillToDay}
          onCreateAt={(date) => {
            setPrefillDate(date);
            setShowCreate(true);
          }}
        />
      )}
      {showCreate && (
        <AppointmentModal
          appt={undefined}
          prefillDate={prefillDate}
          onClose={() => {
            setShowCreate(false);
            setPrefillDate(null);
          }}
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
          onEdit={() => {
            setEditAppt(viewAppt);
            setViewAppt(null);
          }}
          onPay={() => {
            handlePay(viewAppt.id);
            setViewAppt(null);
          }}
          onDelete={() => {
            setDeleteAppt(viewAppt);
            setViewAppt(null);
          }}
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

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarContent />
    </Suspense>
  );
}

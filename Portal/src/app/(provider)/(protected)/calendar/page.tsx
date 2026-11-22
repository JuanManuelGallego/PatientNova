"use client";
import { useState } from "react";
import { Suspense } from "react";
import { useFetchAppointments } from "@/src/api/appointments/useFetchAppointments";
import { useUpdateAppointment } from "@/src/api/appointments/useUpdateAppointment";
import { useFetchBlockedTimes } from "@/src/api/blocked-time/useFetchBlockedTimes";
import { RelatedDrawers } from "@/src/components/Drawers/RelatedDrawers";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import { BlockedTimeModal } from "@/src/components/Modals/BlockedTimeModal";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { Appointment, AppointmentStatus, FetchAppointmentsFilters } from "@/src/types/Appointment";
import { BlockedTime } from "@/src/types/BlockedTime";
import { localDateTimeToUtc, todayFormattedString, todayString } from "@/src/utils/TimeUtils";
import { ViewMode } from "@/src/components/Calendar/types";
import { useCalendarNavigation } from "@/src/components/Calendar/useCalendarNavigation";
import { useCalendarData } from "@/src/components/Calendar/useCalendarData";
import { CalendarToolbar } from "@/src/components/Calendar/CalendarToolbar";
import { CalendarLegend } from "@/src/components/Calendar/CalendarLegend";
import { MonthView } from "@/src/components/Calendar/MonthView";
import { WeekView } from "@/src/components/Calendar/WeekView";
import { DayPanel } from "@/src/components/Calendar/DayPanel";
import { useDrawerNavigation } from "@/src/hooks/useDrawerNavigation";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { useFetchBookingRequests } from "@/src/api/booking-requests/useFetchBookingRequests";
import { usePendingRequests } from "@/src/providers/PendingRequestsContext";
import { RequestDrawer } from "@/src/components/Drawers/RequestDrawer";
import { Agenda, AgendaToolbar, CompactMonth, agendaPeriodLabel } from "@/src/components/Calendar/Agenda";
import { Fab, FAB_REPLACED_CLASS } from "@/src/components/Fab";
import { usePhoneLayout } from "@/src/hooks/usePhoneLayout";

/** The provider cap on live requests is 50, so one page covers any visible range. */
const HOLDS_PAGE_SIZE = 100;

function CalendarContent() {
  // One timezone for the whole calendar: fetch window, day buckets, "today" and click-to-create.
  const timezone = useDisplayTimezone();
  const { updateAppointment } = useUpdateAppointment();
  // Phones get the agenda (Día) and a day-picker month (Mes); wider screens keep Month and Week.
  const phone = usePhoneLayout();

  const {
    viewMode,
    setViewMode,
    calYear,
    calMonth,
    weekStart,
    dayDate,
    selectedDay,
    setSelectedDay,
    selectDay,
    calendarFilters,
    navPrev,
    navNext,
    goToday,
    drillToDay,
  } = useCalendarNavigation(timezone, { phone });

  const apptFilter: FetchAppointmentsFilters = {
    ...calendarFilters,
    status: [ AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED ],
  }

  const { appointments, loading, fetchAppointments } =
    useFetchAppointments(apptFilter);

  const { blockedTimes, loading: loadingBlocked, fetchBlockedTimes } =
    useFetchBlockedTimes(calendarFilters);

  const inbox = usePendingRequests();
  const { requests: holds, fetchRequests: fetchHolds } = useFetchBookingRequests({
    status: "pending",
    from: calendarFilters.dateFrom,
    to: calendarFilters.dateTo,
    pageSize: HOLDS_PAGE_SIZE,
  }, inbox.enabled);
  const [ openRequestId, setOpenRequestId ] = useState<string | null>(null);
  const onSelectHold = inbox.enabled ? setOpenRequestId : undefined;

  const { rows, weekDays, apptByDate, blockedByDate, holdByDate, holidayMap, cellDate, navLabel, hourRange } =
    useCalendarData({
      calYear,
      calMonth,
      weekStart,
      viewMode,
      appointments,
      blockedTimes,
      holds,
      timezone,
    });

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editAppt, setEditAppt ] = useState<Appointment | null>(null);
  const [ deleteAppt, setDeleteAppt ] = useState<Appointment | null>(null);
  const [ prefillDate, setPrefillDate ] = useState<string | null>(null);
  const {
    target: drawerTarget,
    close: closeDrawer,
    openAppointment,
    openPatient,
    openReminder,
  } = useDrawerNavigation();

  const [ showCreateBlockedTime, setShowCreateBlockedTime ] = useState(false);
  const [ editBlockedTime, setEditBlockedTime ] = useState<BlockedTime | null>(null);
  const [ prefillBlockedDate, setPrefillBlockedDate ] = useState<string | null>(null);

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

  async function handleConfirm(id: string) {
    setActionError(null);
    try {
      await updateAppointment(id, { status: AppointmentStatus.CONFIRMED });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al confirmar la cita");
    } finally {
      fetchAppointments();
    }
  }

  /** A past instant is not bookable (the picker disables it), so the modal then opens with its own default. */
  const openCreateAt = (startIso: string) => {
    setPrefillDate(new Date(startIso).getTime() > Date.now() ? startIso : null);
    setShowCreate(true);
  };
  /** Nueva cita on a calendar day: 9:00 that day in the provider's timezone. */
  const openCreateOnDay = (day: string) => openCreateAt(localDateTimeToUtc(day, "09:00:00", timezone));
  const openBlockTimeOn = (day: string) => {
    setPrefillBlockedDate(day);
    setShowCreateBlockedTime(true);
  };
  const loadingEvents = loading || loadingBlocked;

  const selectedDayAppts = selectedDay ? (apptByDate[ selectedDay ] ?? []) : [];
  const selectedDayBlocked = selectedDay ? (blockedByDate[ selectedDay ] ?? []) : [];
  const selectedDayHolds = selectedDay ? (holdByDate[ selectedDay ] ?? []) : [];

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Calendario"
          subtitle={todayString(timezone)}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowCreateBlockedTime(true)}
                className="btn-secondary"
                data-testid="calendar-block-time-button"
              >
                Bloquear horario
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className={`btn-primary btn-hero ${FAB_REPLACED_CLASS}`}
                data-testid="calendar-new-appointment-button"
              >
                Nueva cita
              </button>
            </div>
          }
        />
        {actionError && (
          <ErrorBanner msg={actionError} onRetry={() => setActionError(null)} />
        )}
        <div className="table-card">
          {phone ? (
            <>
              <AgendaToolbar
                label={viewMode === ViewMode.Month ? navLabel : agendaPeriodLabel(dayDate)}
                view={viewMode === ViewMode.Month ? ViewMode.Month : ViewMode.Day}
                onPrev={navPrev}
                onNext={navNext}
                onToday={goToday}
                onChangeView={setViewMode}
              />
              {viewMode === ViewMode.Month ? (
                <CompactMonth
                  timezone={timezone}
                  year={calYear}
                  month={calMonth}
                  selectedDay={dayDate}
                  apptByDate={apptByDate}
                  blockedByDate={blockedByDate}
                  holdByDate={onSelectHold ? holdByDate : undefined}
                  holidayMap={holidayMap}
                  loading={loadingEvents}
                  onSelectDay={selectDay}
                />
              ) : (
                <Agenda
                  timezone={timezone}
                  day={dayDate}
                  apptByDate={apptByDate}
                  blockedByDate={blockedByDate}
                  holdByDate={holdByDate}
                  holidayMap={holidayMap}
                  loading={loadingEvents}
                  onSelectDay={selectDay}
                  onPrevWeek={navPrev}
                  onNextWeek={navNext}
                  onViewAppt={openAppointment}
                  onSelectBlockedTime={setEditBlockedTime}
                  onSelectHold={onSelectHold}
                  onCreateAppointment={openCreateAt}
                  onCreateBlockedTime={openBlockTimeOn}
                />
              )}
            </>
          ) : (
            <>
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
                  timezone={timezone}
                  rows={rows}
                  cellDate={cellDate}
                  apptByDate={apptByDate}
                  blockedByDate={blockedByDate}
                  holidayMap={holidayMap}
                  loading={loading || loadingBlocked}
                  onSelectDay={setSelectedDay}
                  onDrillToDay={drillToDay}
                  onViewAppt={openAppointment}
                  onSelectBlockedTime={setEditBlockedTime}
                  holdByDate={holdByDate}
                  onSelectHold={onSelectHold}
                />
              )}
              {viewMode === ViewMode.Week && (
                <WeekView
                  timezone={timezone}
                  weekDays={weekDays}
                  apptByDate={apptByDate}
                  blockedByDate={blockedByDate}
                  holidayMap={holidayMap}
                  loading={loading || loadingBlocked}
                  hourRange={hourRange}
                  onDrillToDay={drillToDay}
                  onViewAppt={openAppointment}
                  onCreateAt={(date) => {
                    setPrefillDate(date);
                    setShowCreate(true);
                  }}
                  onSelectBlockedTime={setEditBlockedTime}
                  holdByDate={holdByDate}
                  onSelectHold={onSelectHold}
                />
              )}
              <CalendarLegend showHolds={inbox.enabled} />
            </>
          )}
        </div>
        <Fab
          label="Nueva cita"
          // On the agenda's day, unless that is today (the modal's own default fits today better).
          onClick={() => (dayDate === todayFormattedString(timezone) ? setShowCreate(true) : openCreateOnDay(dayDate))}
          testId="calendar-fab-new-appointment"
        />
      </PageLayout>

      {selectedDay && viewMode === ViewMode.Month && !phone && (
        <DayPanel
          selectedDay={selectedDay}
          appts={selectedDayAppts}
          blockedTimes={selectedDayBlocked}
          holds={selectedDayHolds}
          onSelectHold={onSelectHold}
          onClose={() => setSelectedDay(null)}
          onViewAppt={openAppointment}
          onDrillToDay={drillToDay}
          onCreateOnDay={openCreateOnDay}
          onSelectBlockedTime={setEditBlockedTime}
          onCreateBlockedTime={(date) => {
            setPrefillBlockedDate(date);
            setShowCreateBlockedTime(true);
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
      <RelatedDrawers
        target={drawerTarget}
        onClose={closeDrawer}
        onViewAppointment={openAppointment}
        onViewPatient={openPatient}
        onViewReminder={openReminder}
        appointmentActions={{
          onEdit: (appointment) => {
            setEditAppt(appointment);
            closeDrawer();
          },
          onConfirm: (appointment) => {
            handleConfirm(appointment.id);
            closeDrawer();
          },
          onPay: (appointment) => {
            handlePay(appointment.id);
            closeDrawer();
          },
          onDelete: (appointment) => {
            setDeleteAppt(appointment);
            closeDrawer();
          },
        }}
      />
      {openRequestId && (
        <RequestDrawer
          key={openRequestId}
          requestId={openRequestId}
          onClose={() => setOpenRequestId(null)}
          onResolved={() => {
            void fetchHolds();
            void fetchAppointments();
            void inbox.refetch();
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
      {showCreateBlockedTime && (
        <BlockedTimeModal
          prefillDate={prefillBlockedDate}
          onClose={() => {
            setShowCreateBlockedTime(false);
            setPrefillBlockedDate(null);
          }}
          onSaved={() => {
            fetchBlockedTimes();
            fetchAppointments();
          }}
        />
      )}
      {editBlockedTime && (
        <BlockedTimeModal
          blockedTime={editBlockedTime}
          onClose={() => setEditBlockedTime(null)}
          onSaved={() => {
            fetchBlockedTimes();
            fetchAppointments();
          }}
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

"use client";
import { Suspense, useMemo, useState } from "react";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Inbox, RefreshCw } from "lucide-react";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { TabNav } from "@/src/components/TabNav";
import { DataTable, DataTableFooter, type ColumnDef } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { RequestStatusPill } from "@/src/components/Info/RequestStatusPill";
import { RequestDrawer } from "@/src/components/Drawers/RequestDrawer";
import { useFetchBookingRequests } from "@/src/api/booking-requests/useFetchBookingRequests";
import { usePendingRequests } from "@/src/providers/PendingRequestsContext";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fmtDateTime, fmtRelative, todayString } from "@/src/utils/TimeUtils";
import { PAGE_SIZE } from "@/src/utils/listQuery";
import type { BookingRequestTab } from "@/src/types/BookingRequest";

const TABS: { key: BookingRequestTab; label: string }[] = [
  { key: "pending", label: "Pendientes" },
  { key: "resolved", label: "Resueltas" },
  { key: "expired", label: "Vencidas" },
];

const EMPTY: Record<BookingRequestTab, { title: string; sub: string }> = {
  pending: { title: "No hay solicitudes pendientes", sub: "Cuando un paciente solicite una cita en línea, aparecerá aquí." },
  resolved: { title: "Aún no hay solicitudes resueltas", sub: "Las solicitudes aprobadas, rechazadas o canceladas aparecen aquí." },
  expired: { title: "No hay solicitudes vencidas", sub: "Las solicitudes que nadie respondió a tiempo aparecen aquí." },
};

function RequestsPageContent() {
  const timezone = useDisplayTimezone();
  const { refetch: refetchCount } = usePendingRequests();
  const [ tab, setTab ] = useQueryState(
    "tab",
    parseAsStringEnum<BookingRequestTab>(TABS.map((t) => t.key)).withDefault("pending"),
  );
  const [ page, setPage ] = useState(1);
  const [ openId, setOpenId ] = useState<string | null>(null);

  const filters = useMemo(() => ({ status: tab, page, pageSize: PAGE_SIZE }), [ tab, page ]);
  const { requests, total, totalPages, loading, error, fetchRequests } = useFetchBookingRequests(filters);

  const refresh = () => {
    void fetchRequests();
    void refetchCount();
  };

  const columns = useMemo<ColumnDef[]>(() => [
    { label: "Paciente" },
    { label: "Cita solicitada" },
    { label: "Tipo y lugar" },
    ...(tab === "resolved" ? [ { label: "Estado" } ] : []),
    { label: tab === "pending" ? "Vence en" : tab === "resolved" ? "Resuelta" : "Venció" },
  ], [ tab ]);

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Solicitudes"
          subtitle={todayString(timezone)}
          actions={
            <button onClick={refresh} className="btn-secondary" aria-label="Actualizar" data-testid="requests-refresh">
              <RefreshCw size={16} />
            </button>
          }
        />
        <TabNav
          items={TABS}
          active={tab}
          onSelect={(key) => { void setTab(key as BookingRequestTab); setPage(1); }}
          testIdPrefix="requests-tab"
        />
        {error && <ErrorBanner msg={error} onRetry={refresh} />}
        <DataTable
          columns={columns}
          rows={requests}
          loading={loading}
          skeletonCount={4}
          testId="requests-table"
          emptyState={<EmptyState icon={Inbox} {...EMPTY[ tab ]} />}
          renderRow={(r) => (
            <tr key={r.id} className="table-row" onClick={() => setOpenId(r.id)} data-testid={`request-row-${r.id}`}>
              <td className="td">
                <div className="td-name__primary">{r.name} {r.lastName}</div>
                <div className="td-name__secondary">
                  {r.email}
                  {r.kind === "REVIEW" && <> (paciente inactivo o eliminado)</>}
                </div>
              </td>
              <td className="td td--date">{fmtDateTime(r.startAt, timezone)}</td>
              <td className="td">
                <div>{r.type.name}</div>
                <div className="td-name__secondary">{r.location.name}</div>
              </td>
              {tab === "resolved" && (
                <td className="td">
                  <RequestStatusPill status={r.status} />
                </td>
              )}
              {tab === "pending" ? (
                <td className="td td--date" title={fmtDateTime(r.holdExpiresAt, timezone)}>{fmtRelative(r.holdExpiresAt)}</td>
              ) : (
                <td className="td td--subtle">{fmtDateTime(r.resolvedAt ?? r.holdExpiresAt, timezone)}</td>
              )}
            </tr>
          )}
          footer={
            <DataTableFooter
              page={page}
              total={total}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              label="solicitudes"
              onPageChange={setPage}
            />
          }
        />
      </PageLayout>
      {openId && (
        <RequestDrawer requestId={openId} onClose={() => setOpenId(null)} onResolved={refresh} />
      )}
    </>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={null}>
      <RequestsPageContent />
    </Suspense>
  );
}

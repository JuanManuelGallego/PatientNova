"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useFetchBookingRequests } from "@/src/api/booking-requests/useFetchBookingRequests";
import { usePendingRequests } from "@/src/providers/PendingRequestsContext";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fmtDateTime } from "@/src/utils/TimeUtils";

const FILTERS = { status: "pending" as const, page: 1, pageSize: 5 };

/** Dashboard card for admins with the portal on: the next pending booking requests. */
export function PendingRequestsCard() {
  const { enabled, pending } = usePendingRequests();
  const timezone = useDisplayTimezone();
  const { requests, loading } = useFetchBookingRequests(FILTERS, enabled);
  if (!enabled) return null;

  return (
    <div className="dash-card" data-testid="dashboard-pending-requests">
      <div className="dash-card__header">
        <div>
          <h2 className="dash-card__title">Solicitudes pendientes</h2>
          <p className="dash-card__sub">{pending === 1 ? "1 esperando tu respuesta" : `${pending} esperando tu respuesta`}</p>
        </div>
        <Link href="/requests" className="dash-card__link">
          Ver todas →
        </Link>
      </div>
      <div className="dash-card__body">
        {loading && requests.length === 0 ? (
          <div className="dash-skeleton-list">
            {[ 1, 2 ].map((i) => (
              <div key={i} className="dash-skeleton-row">
                <div className="skeleton-bar" style={{ width: "100%" }} />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="dash-empty">
            <span className="dash-empty__icon" role="img" aria-label="completado">
              <CheckCircle size={24} />
            </span>
            <span className="dash-empty__text">No hay solicitudes pendientes</span>
          </div>
        ) : (
          <div className="dash-list">
            {requests.map((r) => (
              <Link key={r.id} href="/requests" className="dash-list-item dash-list-item-link">
                <div className="dash-list-item__left">
                  <div>
                    <div className="dash-list-item__name">{r.name} {r.lastName}</div>
                    <div className="dash-list-item__meta">
                      {fmtDateTime(r.startAt, timezone)} · {r.type.name}
                    </div>
                  </div>
                </div>
                <div className="dash-list-item__right">
                  <span className="dash-list-item__meta">Vence {fmtDateTime(r.holdExpiresAt, timezone)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

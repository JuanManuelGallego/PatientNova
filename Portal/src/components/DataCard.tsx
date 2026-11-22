"use client";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface DataCardProps {
  /** Opens the item, usually the same drawer the table row opens. The whole card is the tap target. */
  onOpen: () => void;
  testId?: string;
  /** Avatar or icon before the text. */
  leading?: ReactNode;
  /** The main line (a name). Wraps at word boundaries, never mid-word. */
  title: ReactNode;
  /** Beside the title, top right: a short status pill. */
  aside?: ReactNode;
  /** Muted lines under the title, one per entry (a time, a type, a contact). Each stays on one line. */
  lines?: ReactNode[];
  /** A row of pills under the lines. */
  badges?: ReactNode;
}

/**
 * One item of a `DataTable` card list (`renderCard`). Like `renderRow`'s `<tr>`, give it a `key`.
 * It renders the `<li>`; keep links and buttons out of it (the card is itself a button): actions live in the
 * drawer that `onOpen` shows.
 */
export function DataCard({ onOpen, testId, leading, title, aside, lines, badges }: DataCardProps) {
  return (
    <li className="data-card-item">
      <button type="button" className="data-card" onClick={onOpen} data-testid={testId}>
        {leading && <span className="data-card__leading">{leading}</span>}
        <span className="data-card__main">
          <span className="data-card__head">
            <span className="data-card__title">{title}</span>
            {aside && <span className="data-card__aside">{aside}</span>}
          </span>
          {lines?.map((line, i) => (
            <span key={i} className="data-card__line">{line}</span>
          ))}
          {badges && <span className="data-card__badges">{badges}</span>}
        </span>
        <ChevronRight size={18} className="data-card__chevron" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Placeholder card while the list loads. */
export function SkeletonCard() {
  return (
    <li className="data-card-item" data-testid="data-card-skeleton" aria-hidden="true">
      <span className="data-card data-card--skeleton">
        <span className="data-card__leading">
          <span className="skeleton-bar data-card__skeleton-avatar" />
        </span>
        <span className="data-card__main">
          <span className="skeleton-bar" style={{ width: "55%" }} />
          <span className="skeleton-bar" style={{ width: "35%", height: 12 }} />
        </span>
      </span>
    </li>
  );
}

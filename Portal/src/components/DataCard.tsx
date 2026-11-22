"use client";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface DataCardProps {
  onOpen: () => void;
  testId?: string;
  leading?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  lines?: ReactNode[];
  badges?: ReactNode;
}

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

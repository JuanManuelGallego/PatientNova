export interface BlockedTime {
  id: string;
  description: string | null;
  startTimeUtc: string;
  endTimeUtc: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedTimeForm {
  description: string;
  startTimeUtc: string;
  endTimeUtc: string;
}

export interface FetchBlockedTimeFilters {
  dateFrom?: string;
  dateTo?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "startTimeUtc" | "endTimeUtc" | "createdAt" | "updatedAt";
  order?: "asc" | "desc";
}

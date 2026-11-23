"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TimeFormat } from "./timeRules";

const TimeFormatContext = createContext<TimeFormat>("24h");

export function TimeFormatProvider({ format, children }: { format: TimeFormat; children: ReactNode }) {
    return <TimeFormatContext.Provider value={format}>{children}</TimeFormatContext.Provider>;
}

export function useTimeFormat(override?: TimeFormat): TimeFormat {
    const format = useContext(TimeFormatContext);
    return override ?? format;
}

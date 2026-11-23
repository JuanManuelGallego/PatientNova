"use client";

import { useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { PickerField } from "./PickerField";
import styles from "./Pickers.module.css";

dayjs.extend(utc);

export type DayRange = [string, string];

const sameRange = (a: DayRange | null, b: DayRange | null) => a?.[0] === b?.[0] && a?.[1] === b?.[1];
const dayValue = (day: string) => dayjs.utc(`${day}T00:00:00`);

interface Draft {
    from: string | null;
    to: string | null;
}

export function DateRangeField({ value, onChange, today, popupContainer, testId }: {
    value: DayRange | null;
    onChange: (range: DayRange | null) => void;
    today: string;
    popupContainer?: () => HTMLElement | null;
    testId?: string;
}) {
    const [ synced, setSynced ] = useState(value);
    const [ draft, setDraft ] = useState<Draft>({ from: value?.[0] ?? null, to: value?.[1] ?? null });
    const [ own, setOwn ] = useState<{ range: DayRange | null } | null>(null);

    if (!sameRange(value, synced)) {
        setSynced(value);
        if (own && sameRange(own.range, value)) {
            setOwn(null);
        } else {
            setDraft({ from: value?.[0] ?? null, to: value?.[1] ?? null });
        }
    }

    const emitOwn = (range: DayRange | null) => {
        setOwn({ range });
        onChange(range);
    };
    const update = (next: Draft) => {
        setDraft(next);
        if (next.from && next.to) emitOwn([ next.from, next.to ]);
        else if (value) emitOwn(null);
    };

    return (
        <div className={styles.range} data-testid={testId}>
            <div className={styles.rangeFields}>
                <label className={styles.rangeField}>
                    Desde
                    <PickerField
                        value={draft.from ? dayValue(draft.from) : null}
                        onChange={(d) => {
                            const from = d ? d.format("YYYY-MM-DD") : null;
                            update({ from, to: from && draft.to && draft.to < from ? null : draft.to });
                        }}
                        today={today}
                        format="DD/MM/YYYY"
                        placeholder="Selecciona fecha"
                        title="Desde"
                        allowClear
                        popupContainer={popupContainer}
                        testId={testId ? `${testId}-from` : undefined}
                    />
                </label>
                <label className={styles.rangeField}>
                    Hasta
                    <PickerField
                        value={draft.to ? dayValue(draft.to) : null}
                        onChange={(d) => update({ from: draft.from, to: d ? d.format("YYYY-MM-DD") : null })}
                        today={today}
                        format="DD/MM/YYYY"
                        placeholder="Selecciona fecha"
                        title="Hasta"
                        allowClear
                        disabledDate={(d) => !!draft.from && d.format("YYYY-MM-DD") < draft.from}
                        minMonth={draft.from ? draft.from.slice(0, 7) : undefined}
                        initialMonth={draft.from ? draft.from.slice(0, 7) : undefined}
                        popupContainer={popupContainer}
                        testId={testId ? `${testId}-to` : undefined}
                    />
                </label>
            </div>
        </div>
    );
}

import { useCallback, useEffect, useRef } from "react";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";
import { ApiClientError } from "@/src/api/base/apiClients";
import { mergePatch, subtractPatch } from "@/src/utils/recordPatch";
import type { RecordPatch } from "@/src/types/MedicalRecord";

const TEMPLATE_MISMATCH = "Los datos de la historia clínica no coinciden con la plantilla";

type Options = {
  save: (id: string, patch: RecordPatch) => Promise<unknown>;
  onRejected: () => void;
  delay: number;
};

/** A failed save is resent with the next change, except one refused for a template change, which would fail forever. */
export function useRecordAutosave(recordId: string | undefined, { save, onRejected, delay }: Options) {
  const pendingRef = useRef<{ id: string; patch: RecordPatch }>({ id: "", patch: {} });
  const saveRef = useRef(save);
  const rejectedRef = useRef(onRejected);
  useEffect(() => {
    saveRef.current = save;
    rejectedRef.current = onRejected;
  });

  const autosave = useDebouncedSave<{ id: string; patch: RecordPatch }>(
    async ({ id, patch }) => {
      const forget = () => {
        if (pendingRef.current.id === id) pendingRef.current = { id, patch: subtractPatch(pendingRef.current.patch, patch) };
      };
      try {
        await saveRef.current(id, patch);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 400 && err.details === TEMPLATE_MISMATCH) {
          forget();
          rejectedRef.current();
        }
        throw err;
      }
      forget();
    },
    { delay, dedupe: false },
  );
  const { schedule } = autosave;

  const change = useCallback((patch: RecordPatch) => {
    if (!recordId) return;
    const pending = pendingRef.current.id === recordId ? pendingRef.current.patch : {};
    pendingRef.current = { id: recordId, patch: mergePatch(pending, patch) };
    schedule({ id: recordId, patch: pendingRef.current.patch });
  }, [ recordId, schedule ]);

  const reset = useCallback((id: string) => {
    pendingRef.current = { id, patch: {} };
  }, []);

  return { change, reset, saving: autosave.saving, status: autosave.status, error: autosave.error };
}

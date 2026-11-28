import type { RecordPatch } from "@/src/types/MedicalRecord";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergePatch(a: RecordPatch, b: RecordPatch): RecordPatch {
  const merged: RecordPatch = { ...a, ...b };
  if (a.data || b.data) merged.data = { ...a.data, ...b.data };
  return merged;
}

/** What is still unsaved after `sent` reached the server: keys whose value changed again since are kept. */
export function subtractPatch(pending: RecordPatch, sent: RecordPatch): RecordPatch {
  const rest: Record<string, unknown> = {};
  for (const [ key, value ] of Object.entries(pending)) {
    if (key === "data") continue;
    if (!(key in sent) || !same(value, sent[ key as keyof RecordPatch ])) rest[ key ] = value;
  }
  const data = Object.fromEntries(Object.entries(pending.data ?? {}).filter(([ k, v ]) => sent.data?.[ k ] !== v));
  if (Object.keys(data).length > 0) rest.data = data;
  return rest as RecordPatch;
}

const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => w.slice(0, 6));

/** "Psicóloga clínica" and "Psicología clínica y sistémica" say the same thing: show the longer once. */
export function providerRole(jobTitle?: string | null, specialty?: string | null): string {
    const title = jobTitle?.trim() ?? "";
    const spec = specialty?.trim() ?? "";
    if (!title || !spec) return title || spec;
    const a = normalize(title);
    const b = normalize(spec);
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    const repeats = (short.length >= 2 || a.join() === b.join()) && short.every((w, i) => long[i] === w);
    return repeats ? (a.length <= b.length ? spec : title) : `${title} · ${spec}`;
}

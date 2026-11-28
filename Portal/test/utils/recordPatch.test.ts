import { describe, expect, it } from "vitest";
import { mergePatch, subtractPatch } from "@/src/utils/recordPatch";

describe("mergePatch", () => {
  it("merges data key by key and replaces the other keys", () => {
    expect(mergePatch({ data: { a: "1" }, name: "x" }, { data: { b: "2" }, name: "n" })).toEqual({ data: { a: "1", b: "2" }, name: "n" });
    expect(mergePatch({ data: { a: "1" } }, { data: { a: "3" } })).toEqual({ data: { a: "3" } });
  });
});

describe("subtractPatch", () => {
  it("drops what was sent unchanged and keeps what changed since", () => {
    expect(subtractPatch({ data: { a: "2", b: "1" }, name: "x" }, { data: { a: "1", b: "1" }, name: "x" })).toEqual({ data: { a: "2" } });
  });

  it("compares relations by value", () => {
    const notes = [ { id: "1", date: "2026-01-01", text: "t" } ];
    expect(subtractPatch({ evolutionNotes: [ { ...notes[ 0 ]! } ] }, { evolutionNotes: notes })).toEqual({});
    expect(subtractPatch({ evolutionNotes: [ { ...notes[ 0 ]!, text: "u" } ] }, { evolutionNotes: notes })).toEqual({ evolutionNotes: [ { id: "1", date: "2026-01-01", text: "u" } ] });
  });

  it("keeps everything when nothing was sent", () => {
    expect(subtractPatch({ data: { a: "1" } }, {})).toEqual({ data: { a: "1" } });
  });
});

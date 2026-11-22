"use client";

import { useMediaQuery } from "@/src/hooks/useMediaQuery";

/** True on touch screens, where pickers use the button trigger instead of a typed input. */
export function useCoarsePointer(): boolean {
    return useMediaQuery("(pointer: coarse)");
}

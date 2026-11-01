"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { API_BASE } from "@/src/config/api";
import type { PublicProvider } from "@/src/types/PublicBooking";

export function providerImageUrl(slug: string, kind: "avatar" | "logo") {
    return `${API_BASE}/public/providers/${encodeURIComponent(slug)}/${kind}`;
}

export function initials(name: string): string {
    const words = name.split(/\s+/).filter((w) => w && !w.endsWith("."));
    return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

/** The provider's photo, or their initials when there is none or it fails to load. Size comes from `className`. */
export function ProviderAvatar({ slug, provider, className }: { slug: string; provider: PublicProvider; className: string }) {
    const [ failed, setFailed ] = useState(false);
    return provider.hasAvatar && !failed
        ? <img className={className} src={providerImageUrl(slug, "avatar")} alt="" onError={() => setFailed(true)} />
        : <div className={className} aria-hidden="true">{initials(provider.displayName)}</div>;
}

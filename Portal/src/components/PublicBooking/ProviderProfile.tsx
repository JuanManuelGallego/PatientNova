"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle, Phone, Video } from "lucide-react";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { fmtPhone, locationDetail, mapUrl, whatsappUrl } from "@/src/utils/publicBooking";
import { ProviderAvatar, providerImageUrl } from "./ProviderAvatar";
import { PublicSheet } from "./PublicSheet";
import styles from "./ProviderProfile.module.css";

const EXTERNAL_LINK = { target: "_blank", rel: "noopener noreferrer" } as const;

interface ProviderProfileProps {
    slug: string;
    provider: PublicProvider;
    /** 1 where the profile is the page itself; 2 inside a sheet, under the page's heading. */
    headingLevel?: 1 | 2;
}

/** The provider's public story: only what they chose to publish, and empty parts simply disappear. */
export function ProviderProfile({ slug, provider, headingLevel = 2 }: ProviderProfileProps) {
    return (
        <div className={styles.profile}>
            <ProviderIdentity slug={slug} provider={provider} headingLevel={headingLevel} />
            {(provider.bio || provider.locations.length > 0) && (
                <div className={styles.details}>
                    {provider.bio && (
                        <section>
                            <h3 className={styles.sectionTitle}>Acerca de</h3>
                            <p className={styles.bio}>{provider.bio}</p>
                        </section>
                    )}
                    {provider.locations.length > 0 && (
                        <section>
                            <h3 className={styles.sectionTitle}>Dónde atiende</h3>
                            <ul className={styles.places} aria-label="Dónde atiende">
                                {provider.locations.map((l) => (
                                    <li key={l.id} className={styles.place}>
                                        {l.isVirtual
                                            ? <Video size={18} aria-hidden="true" className={styles.placeIcon} />
                                            : <MapPin size={18} aria-hidden="true" className={styles.placeIcon} />}
                                        <span>
                                            <span className={styles.placeName}>{l.name}</span>
                                            {locationDetail(l) && <span className={styles.placeDetail}>{locationDetail(l)}</span>}
                                            {!l.isVirtual && l.address && (
                                                <a href={mapUrl(l.address)} {...EXTERNAL_LINK} className={styles.mapLink}>Ver en el mapa</a>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

interface ProviderPanelProps {
    slug: string;
    provider: PublicProvider;
    appointmentsHref?: string | undefined;
}

/** The desktop left pane: always open. It leaves out the places, which are a choice in the first step right beside it. */
export function ProviderPanel({ slug, provider, appointmentsHref }: ProviderPanelProps) {
    return (
        <div className={styles.panel}>
            <ProviderIdentity slug={slug} provider={provider} headingLevel={1} />
            {provider.bio && (
                <section>
                    <h2 className={styles.sectionTitle}>Acerca de</h2>
                    <ClampedBio bio={provider.bio} />
                </section>
            )}
            {appointmentsHref && <Link href={appointmentsHref} className={`${styles.headerAction} ${styles.panelLink}`}>Mis citas</Link>}
        </div>
    );
}

/** The cut is the browser's, so only the text can say whether it was cut: it depends on the width and the font. */
function ClampedBio({ bio }: { bio: string }) {
    const text = useRef<HTMLParagraphElement>(null);
    const [ cut, setCut ] = useState(false);
    const [ open, setOpen ] = useState(false);

    useLayoutEffect(() => {
        const measure = () => {
            const el = text.current;
            if (el && el.scrollHeight > el.clientHeight) setCut(true);
        };
        measure();
        // The web font can arrive after the first paint and wrap the text longer.
        void document.fonts?.ready.then(measure);
    }, []);

    return (
        <>
            <p ref={text} className={styles.bio} data-clamped={open ? undefined : ""}>{bio}</p>
            {cut && (
                <button type="button" className={styles.profileLink} aria-expanded={open} onClick={() => setOpen(!open)}>
                    {open ? "Leer menos" : "Leer más"}
                </button>
            )}
        </>
    );
}

interface ProviderIdentityProps {
    slug: string;
    provider: PublicProvider;
    headingLevel: 1 | 2;
}

function ProviderIdentity({ slug, provider, headingLevel }: ProviderIdentityProps) {
    const [ logoFailed, setLogoFailed ] = useState(false);
    const Heading = headingLevel === 1 ? "h1" : "h2";
    const role = [ provider.jobTitle, provider.specialty ].filter(Boolean).join(" · ");
    return (
        <div className={styles.identity}>
            {provider.hasLogo && !logoFailed && (
                <img className={styles.logo} src={providerImageUrl(slug, "logo")} alt="" onError={() => setLogoFailed(true)} />
            )}
            <ProviderAvatar slug={slug} provider={provider} className={styles.photo} />
            <Heading className={styles.name}>{provider.displayName}</Heading>
            {role && <p className={styles.role}>{role}</p>}
            <ProviderContact provider={provider} />
        </div>
    );
}

function ProviderContact({ provider: { phone, whatsapp } }: { provider: PublicProvider }) {
    if (!phone && !whatsapp) return null;
    return (
        <ul className={styles.contact} aria-label="Contacto">
            {whatsapp && (
                <li>
                    <a href={whatsappUrl(whatsapp)} {...EXTERNAL_LINK} className={styles.contactLink}>
                        <MessageCircle size={16} aria-hidden="true" />WhatsApp
                    </a>
                </li>
            )}
            {phone && (
                <li>
                    <a href={`tel:${phone}`} className={styles.contactLink} aria-label={`Llamar al ${fmtPhone(phone)}`}>
                        <Phone size={16} aria-hidden="true" />
                        <span className={styles.callWord}>Llamar</span>
                        <span className={styles.callNumber}>{fmtPhone(phone)}</span>
                    </a>
                </li>
            )}
        </ul>
    );
}

interface ProviderProfileSheetProps {
    slug: string;
    provider: PublicProvider;
    closeLabel: string;
    onClose: () => void;
}

/** Opens over the booking, so nobody loses their place. The name stays pinned once it scrolls away. */
export function ProviderProfileSheet({ slug, provider, closeLabel, onClose }: ProviderProfileSheetProps) {
    const top = useRef<HTMLDivElement>(null);
    const [ scrolled, setScrolled ] = useState(false);

    useEffect(() => {
        const el = top.current;
        if (!el || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([ entry ]) => setScrolled(entry ? !entry.isIntersecting : false));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <PublicSheet title={`Perfil de ${provider.displayName}`} onClose={onClose}>
            <div className={styles.pinned} data-visible={scrolled || undefined} aria-hidden="true">
                <span className={styles.pinnedName}>{provider.displayName}</span>
            </div>
            <div ref={top} className={styles.sentinel} />
            <ProviderProfile slug={slug} provider={provider} />
            <div className={styles.sheetDock}>
                <button type="button" className={`btn-primary ${styles.sheetAction}`} onClick={onClose}>{closeLabel}</button>
            </div>
        </PublicSheet>
    );
}

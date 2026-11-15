"use client";

import { useId, type Ref } from "react";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { CHANNEL_ICONS } from "@/src/config/icons";
import type { BookingContactChoice } from "@/src/types/PortalBooking";
import { PHONE_FORMAT_HINT } from "@/src/utils/publicBooking";
import styles from "./Portal.module.css";

export type ConfirmationChannel = BookingContactChoice["channel"];

const CHANNEL_LABELS: Record<ConfirmationChannel, string> = { EMAIL: "Correo", WHATSAPP: "WhatsApp" };

interface ContactChoiceFieldProps {
    channels: ConfirmationChannel[];
    channel: ConfirmationChannel;
    email: string;
    whatsapp: string;
    invalid: boolean;
    /** Help text under the contact input, read as its description. */
    hint?: string;
    inputRef: Ref<HTMLInputElement>;
    onChannel: (channel: ConfirmationChannel) => void;
    onEmail: (value: string) => void;
    onWhatsapp: (value: string) => void;
    onTouched: () => void;
}

export function ContactChoiceField({ channels, channel, email, whatsapp, invalid, hint, inputRef, onChannel, onEmail, onWhatsapp, onTouched }: ContactChoiceFieldProps) {
    const ids = useId();
    const errorId = `${ids}-contact-error`;
    const hintId = `${ids}-contact-hint`;
    const describedBy = [ hint && hintId, invalid && errorId ].filter(Boolean).join(" ") || undefined;
    const hintText = hint && <span id={hintId} className={styles.fieldHint}>{hint}</span>;
    return (
        <>
            {channels.length > 1 && (
                <div role="group" aria-labelledby={`${ids}-channels`}>
                    <p id={`${ids}-channels`} className={styles.channelLabel}>Recibir el enlace de confirmación por</p>
                    <div className={styles.channels}>
                        {channels.map((c) => {
                            const Icon = CHANNEL_ICONS[ c ];
                            return (
                                <button key={c} type="button" className={styles.channel} aria-pressed={c === channel} onClick={() => onChannel(c)}>
                                    <Icon size={18} aria-hidden="true" />
                                    {CHANNEL_LABELS[ c ]}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            {channel === "EMAIL" ? (
                <div>
                    <label className="form-label">
                        Correo electrónico
                        <input ref={inputRef} className="form-input" type="email" name="email" autoComplete="email" inputMode="email" required maxLength={254}
                            aria-invalid={invalid || undefined} aria-describedby={describedBy}
                            value={email} onChange={(e) => onEmail(e.target.value)} onBlur={onTouched} />
                    </label>
                    {invalid && <span id={errorId} className={styles.fieldError}>Escribe un correo válido.</span>}
                    {hintText}
                </div>
            ) : (
                <div>
                    <div className="form-label">
                        <label htmlFor={`${ids}-whatsapp`}>Número de WhatsApp</label>
                        <CountryCodeInput ref={inputRef} id={`${ids}-whatsapp`} name="whatsapp" autoComplete="tel" placeholder="300 123 4567"
                            aria-invalid={invalid || undefined} aria-describedby={describedBy}
                            value={whatsapp} onChange={onWhatsapp} onBlur={onTouched} />
                    </div>
                    {invalid && <span id={errorId} className={styles.fieldError}>{PHONE_FORMAT_HINT}</span>}
                    {hintText}
                </div>
            )}
        </>
    );
}

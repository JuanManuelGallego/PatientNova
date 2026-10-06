"use client";

import { Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { CHANNEL_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { RequiredField } from "@/src/components/Info/Required";
import type { ComponentType, ReactNode } from "react";

interface Props {
  channel: Channel | undefined;
  contact?: string | null;
  required?: boolean;
  warnMissingContact?: boolean;
  marginTop?: number;
}

export function ChannelBox({
  icon: Icon,
  iconSize = 18,
  padding = "10px 14px",
  children,
}: {
  icon?: ComponentType<{ size?: number }>;
  iconSize?: number;
  padding?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding,
        borderRadius: 8,
        background: "var(--c-brand-50, #f0f7ff)",
        border: "1px solid var(--c-brand-200, #bfdbfe)",
        fontSize: 14,
        color: "var(--c-brand)",
      }}
    >
      {Icon && <Icon size={iconSize} />}
      <span>{children}</span>
    </div>
  );
}

const MISSING_CONTACT_LABEL: Record<Channel, string> = {
  [Channel.WHATSAPP]: "número de WhatsApp",
  [Channel.SMS]: "número de SMS",
  [Channel.EMAIL]: "correo electrónico",
};

export function ChannelBanner({
  channel,
  contact,
  required = false,
  warnMissingContact = true,
  marginTop = 10,
}: Props) {
  const Icon = channel ? CHANNEL_ICONS[channel] : undefined;

  return (
    <div style={{ marginTop }}>
      <div className="channel-section-label">
        {required ? (
          <RequiredField label="Canal de notificación" />
        ) : (
          "Canal de notificación"
        )}
      </div>
      {channel ? (
        <ChannelBox icon={Icon}>
          Enviando por <strong>{CHANNEL_CFG[channel].label}</strong>
          {contact && (
            <span
              style={{
                marginLeft: 6,
                color: "var(--c-gray-400)",
                fontWeight: 400,
              }}
            >
              → {contact}
            </span>
          )}
        </ChannelBox>
      ) : (
        <div
          className="error-inline"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <STATUS_ICONS.warning size={14} /> Selecciona un paciente para ver su
          canal de recordatorios.
        </div>
      )}
      {channel && !contact && warnMissingContact && (
        <div
          className="error-inline"
          style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}
        >
          <STATUS_ICONS.warning size={14} /> El paciente no tiene{" "}
          {MISSING_CONTACT_LABEL[channel]} registrado. Agrega el dato o cambia el
          canal de recordatorios del paciente.
        </div>
      )}
    </div>
  );
}

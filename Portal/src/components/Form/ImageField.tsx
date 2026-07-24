import { ACTION_ICONS } from "@/src/config/icons";
import { ImageFormat } from "@/src/utils/AvatarHelper";
import { readAndResizeImage } from "@/src/utils/imageUpload";
import Image from "next/image";
import { useRef } from "react";
import { Camera, Upload } from "lucide-react";

interface ImageFieldProps {
  variant?: "circle" | "boxed";
  label?: string;
  hint?: string;
  value: string | null;
  fallback?: React.ReactNode;
  onChange: (value: string | null) => void;
  onError?: (message: string) => void;
  maxSide?: number;
  /** Output format. When omitted, PNG sources stay PNG, others become WebP. */
  format?: ImageFormat;
  sizeErrorMessage?: string;
  selectLabel?: string;
  removeLabel?: string;
}

export function ImageField({
  variant = "boxed",
  label,
  hint,
  value,
  fallback,
  onChange,
  onError,
  maxSide = 256,
  format,
  sizeErrorMessage,
  selectLabel = "Subir",
  removeLabel = "Eliminar",
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[ 0 ];
    e.target.value = "";
    if (!file) return;
    const outputFormat =
      format ?? (file.type === "image/png" ? "image/png" : "image/webp");
    try {
      onChange(
        await readAndResizeImage(file, {
          maxSide,
          format: outputFormat,
          sizeErrorMessage,
        }),
      );
      onError?.( "");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Error al procesar la imagen");
    }
  }

  if (variant === "circle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" }}>
        {value ? (
          <Image
            src={value}
            alt="Avatar"
            width={100}
            height={100}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid var(--c-gray-200)",
            }}
          />
        ) : (
          fallback
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: "100%" }}
            onClick={() => inputRef.current?.click()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Camera size={14} /> {selectLabel}
            </div>
          </button>
          {value && (
            <button
              type="button"
              className="btn-secondary"
              style={{ width: "100%", color: "var(--c-error)" }}
              onClick={() => onChange(null)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ACTION_ICONS.delete size={14} /> {removeLabel}
              </div>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleChange}
          />
          <p style={{ fontSize: 12, color: "var(--c-gray-400)", textAlign: "center", margin: 0 }}>
            JPG, PNG o WebP · Máx. 5 MB
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--c-gray-400)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          height: 96,
          borderRadius: "var(--r-md)",
          border: "1.5px dashed var(--c-gray-200)",
          background: "var(--c-gray-50)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {value ? (
          <Image
            src={value}
            alt={label ?? "Logo"}
            width={200}
            height={88}
            style={{ objectFit: "contain", maxHeight: 88 }}
          />
        ) : (
          <span style={{ fontSize: 12, color: "var(--c-gray-400)" }}>
            Sin logo
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ flex: 1 }}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center" }}>
            <Upload size={14} /> {selectLabel}
          </div>
        </button>
        {value && (
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, color: "var(--c-error)" }}
            onClick={() => onChange(null)}
          >
            <ACTION_ICONS.delete size={14} /> {removeLabel}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleChange}
      />
      {hint && (
        <p style={{ fontSize: 12, color: "var(--c-gray-400)", margin: 0 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

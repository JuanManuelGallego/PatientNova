"use client";
import { MedicalDocument } from "@/src/types/MedicalRecord";
import { useRef, useState } from "react";
import {
  FILE_ICONS,
  FILE_ICON_DEFAULT,
  ACTION_ICONS,
  STATUS_ICONS,
} from "@/src/config/icons";
import { Download, RefreshCw, FolderOpen } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per file

function fileIcon(mime: string) {
  const Icon = FILE_ICONS[mime] ?? FILE_ICON_DEFAULT;
  return <Icon size={20} />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.readAsDataURL(file);
  });
}

interface Props {
  documents: MedicalDocument[];
  onChange: (docs: MedicalDocument[]) => void;
}

export function DocumentsSection({ documents, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const newDocs: MedicalDocument[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" supera el límite de 5 MB.`);
        continue;
      }
      try {
        const data = await readFileAsBase64(file);
        newDocs.push({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          data,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        setError(`No se pudo leer "${file.name}".`);
      }
    }
    onChange([...documents, ...newDocs]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Replace file ──────────────────────────────────────────────────────────

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingId) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(`"${file.name}" supera el límite de 5 MB.`);
      return;
    }
    try {
      const data = await readFileAsBase64(file);
      onChange(
        documents.map((d) =>
          d.id === replacingId
            ? {
                ...d,
                name: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                data,
                uploadedAt: new Date().toISOString(),
              }
            : d,
        ),
      );
    } catch {
      setError("No se pudo leer el archivo.");
    }
    setReplacingId(null);
    if (replaceRef.current) replaceRef.current.value = "";
  }

  // ── Download ──────────────────────────────────────────────────────────────

  function handleDownload(doc: MedicalDocument) {
    const a = document.createElement("a");
    a.href = doc.data;
    a.download = doc.name;
    a.click();
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  function commitRename(id: string) {
    const trimmed = editingName.trim();
    if (trimmed)
      onChange(
        documents.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
      );
    setEditingId(null);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    onChange(documents.filter((d) => d.id !== id));
    setConfirmDeleteId(null);
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  const [dragging, setDragging] = useState(false);
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? "var(--c-brand)" : "var(--c-gray-200)"}`,
          borderRadius: "var(--r-md)",
          background: dragging ? "var(--c-brand-light)" : "var(--c-gray-50)",
          padding: "28px 16px",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>
          <FolderOpen size={28} />
        </div>
        <p
          style={{
            margin: 0,
            fontWeight: 600,
            fontSize: 14,
            color: "var(--c-text)",
          }}
        >
          {uploading
            ? "Subiendo…"
            : "Arrastra archivos aquí o haz clic para seleccionar"}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12,
            color: "var(--c-gray-400)",
          }}
        >
          PDF, Word, Excel, imágenes · Máx. 5 MB por archivo
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Hidden input for replace */}
      <input
        ref={replaceRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleReplace}
      />

      {error && (
        <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <STATUS_ICONS.warning size={14} /> {error}
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--c-gray-100)",
                background: "var(--c-surface)",
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: 24, lineHeight: 1 }}>
                {fileIcon(doc.mimeType)}
              </span>

              {/* Name + meta */}
              <div style={{ overflow: "hidden" }}>
                {editingId === doc.id ? (
                  <input
                    autoFocus
                    className="form-input"
                    style={{ padding: "2px 8px", height: 30, fontSize: 13 }}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => commitRename(doc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(doc.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {doc.name}
                  </p>
                )}
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: "var(--c-gray-400)",
                  }}
                >
                  {formatBytes(doc.sizeBytes)} · {formatDate(doc.uploadedAt)}
                </p>
              </div>

              {/* Actions */}
              {confirmDeleteId === doc.id ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--c-gray-400)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ¿Eliminar?
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: "2px 10px",
                      fontSize: 12,
                      color: "var(--c-error)",
                    }}
                    onClick={() => handleDelete(doc.id)}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    No
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 4 }}>
                  <ActionBtn
                    title="Descargar"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download size={14} />
                  </ActionBtn>
                  <ActionBtn
                    title="Renombrar"
                    onClick={() => {
                      setEditingId(doc.id);
                      setEditingName(doc.name);
                    }}
                  >
                    <ACTION_ICONS.edit size={14} />
                  </ActionBtn>
                  <ActionBtn
                    title="Reemplazar archivo"
                    onClick={() => {
                      setReplacingId(doc.id);
                      replaceRef.current?.click();
                    }}
                  >
                    <RefreshCw size={14} />
                  </ActionBtn>
                  <ActionBtn
                    title="Eliminar"
                    onClick={() => setConfirmDeleteId(doc.id)}
                  >
                    <ACTION_ICONS.delete size={14} />
                  </ActionBtn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {documents.length === 0 && !uploading && (
        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--c-gray-400)",
            margin: 0,
          }}
        >
          No hay documentos adjuntos.
        </p>
      )}
    </div>
  );
}

// Small icon button
function ActionBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        background: "none",
        border: "1px solid var(--c-gray-100)",
        borderRadius: "var(--r-sm)",
        padding: "4px 7px",
        cursor: "pointer",
        fontSize: 14,
        lineHeight: 1,
        color: "var(--c-text)",
      }}
    >
      {children}
    </button>
  );
}

import { useState, useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";

interface ConsentDocumentMetadata {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    updatedAt: string;
}

export function useConsentDocument() {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ document, setDocument ] = useState<ConsentDocumentMetadata | null>(null);

    // Fetch the consent document metadata
    const fetchDocument = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/consent-document`);
            if (!res.ok) throw new Error("Failed to fetch consent document");
            const json = await res.json();
            setDocument(json.data || null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al cargar el documento de consentimiento";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    // Upload a new consent document
    const uploadDocument = useCallback(
        async (file: File): Promise<ConsentDocumentMetadata | null> => {
            if (!file.type.includes("pdf")) {
                setError("Por favor selecciona un archivo PDF");
                return null;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError("El archivo debe ser menor a 10 MB");
                return null;
            }

            setLoading(true);
            setError(null);
            try {
                const reader = new FileReader();
                return await new Promise((resolve, reject) => {
                    reader.onload = async () => {
                        try {
                            const dataUrl = reader.result as string;
                            // Extract base64 content from data URL (format: data:application/pdf;base64,XXXXX)
                            const base64Content = dataUrl.split(',')[ 1 ];
                            const body = {
                                name: file.name,
                                content: base64Content,
                                mimeType: "application/pdf",
                            };
                            const res = await fetchWithAuth(`${API_BASE}/consent-document`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(body),
                            });
                            if (!res.ok) throw new Error("Failed to upload document");
                            const json = await res.json();
                            const uploadedDoc = json.data;
                            setDocument(uploadedDoc);
                            setError(null);
                            resolve(uploadedDoc);
                        } catch (err) {
                            const msg = err instanceof Error ? err.message : "Error al subir el documento";
                            setError(msg);
                            reject(err);
                        } finally {
                            setLoading(false);
                        }
                    };
                    reader.onerror = () => {
                        setError("Error al leer el archivo");
                        setLoading(false);
                        reject(new Error("Failed to read file"));
                    };
                    reader.readAsDataURL(file);
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error desconocido";
                setError(msg);
                setLoading(false);
                return null;
            }
        },
        [],
    );

    // Delete the consent document
    const deleteDocument = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/consent-document`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete document");
            setDocument(null);
            setError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al eliminar el documento";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    // Download the consent document (returns the full document with content)
    const downloadDocument = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/consent-document/download`);
            if (!res.ok) throw new Error("Failed to download document");
            const json = await res.json();
            return json.data;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al descargar el documento";
            setError(msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        document,
        loading,
        error,
        fetchDocument,
        uploadDocument,
        deleteDocument,
        downloadDocument,
    };
}

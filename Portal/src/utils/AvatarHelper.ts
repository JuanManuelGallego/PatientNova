import { Patient } from "../types/Patient";
import { User } from "../types/User";

function getInitials(name: string, lastName: string) {
    return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getPatientFullName(patient: Patient | undefined) {
    if (!patient) return "";
    return `${patient.name} ${patient.lastName}`;
}

function getUserName(user: User | undefined | null) {
    if (!user) return "";
    return user.displayName ?? `${user.firstName} ${user.lastName}`;
}

function getAvatarColor(id: string) {
    const hues = [ 200, 160, 280, 30, 340, 60, 240 ];
    const idx = id.charCodeAt(0) % hues.length;
    return `hsl(${hues[ idx ]}, 55%, 82%)`;
}

type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

/**
 * Resize an image File to a base64 data-URL at most maxSide×maxSide px.
 *
 * @param format - Output format. Defaults to "image/jpeg".
 *   Use "image/png" or "image/webp" when the source has transparency
 *   (e.g. logos), otherwise transparent pixels become black on a canvas.
 */
async function resizeToBase64(
    file: File,
    maxSide = 256,
    format: ImageFormat = "image/jpeg",
): Promise<string> {
    if (typeof window === "undefined") throw new Error("resizeToBase64 requires a browser environment");
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (ev) => {
            const img = new window.Image();
            img.onerror = reject;
            img.onload = () => {
                const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);

                const ctx = canvas.getContext("2d")!;

                // JPEG has no alpha channel — fill white so transparent pixels
                // don't collapse to black. PNG and WebP preserve alpha natively.
                if (format === "image/jpeg") {
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL(format, 0.85));
            };
            img.src = ev.target!.result as string;
        };
        reader.readAsDataURL(file);
    });
}

export { getInitials, getAvatarColor, resizeToBase64, getPatientFullName, getUserName };
export type { ImageFormat };
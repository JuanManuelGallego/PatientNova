import { redirect } from "next/navigation";
import { settingsHref } from "@/src/config/navigation";

export default function SettingsIndex() {
    redirect(settingsHref("account"));
}

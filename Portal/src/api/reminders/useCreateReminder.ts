import { Reminder } from "@/src/types/Reminder";
import { createEntityCreate } from "@/src/api/base/useEntityMutation";

export const useCreateReminder = createEntityCreate<Reminder>({
    resource: "reminders",
    name: "Reminder",
    errorMessage: "Failed to create reminder",
});

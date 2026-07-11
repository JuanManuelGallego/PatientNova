import { Reminder } from "../types/Reminder";
import { createEntityCreate } from "./useEntityMutation";

export const useCreateReminder = createEntityCreate<Reminder>({
    resource: "reminders",
    name: "Reminder",
    errorMessage: "Failed to create reminder",
});

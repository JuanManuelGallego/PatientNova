import { Reminder } from "../types/Reminder";
import { createEntityUpdate } from "./useEntityMutation";

export const useUpdateReminder = createEntityUpdate<Reminder>({
    resource: "reminders",
    name: "Reminder",
    errorMessage: "Failed to update reminder",
});

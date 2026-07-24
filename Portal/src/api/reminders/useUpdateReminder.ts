import { Reminder } from "@/src/types/Reminder";
import { createEntityUpdate } from "@/src/api/base/useEntityMutation";

export const useUpdateReminder = createEntityUpdate<Reminder>({
    resource: "reminders",
    name: "Reminder",
    errorMessage: "Failed to update reminder",
});

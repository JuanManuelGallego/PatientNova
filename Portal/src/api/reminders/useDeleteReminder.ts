import { createEntityDelete } from "@/src/api/base/useEntityMutation";

export const useDeleteReminder = createEntityDelete({
    resource: "reminders",
    name: "Reminder",
    errorMessage: "Failed to delete reminder",
});

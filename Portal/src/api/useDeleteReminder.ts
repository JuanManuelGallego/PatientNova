import { createEntityDelete } from "./useEntityMutation";

export const useDeleteReminder = createEntityDelete({
    resource: "reminders",
    name: "Reminder",
    errorMessage: "Failed to delete reminder",
});

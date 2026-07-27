import { createEntityDelete } from "@/src/api/base/useEntityMutation";

export const useDeleteBlockedTime = createEntityDelete({
    resource: "blocked-time",
    name: "BlockedTime",
    errorMessage: "Failed to delete blocked time",
});

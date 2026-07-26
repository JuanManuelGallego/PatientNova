import { BlockedTime } from "@/src/types/BlockedTime";
import { createEntityUpdate } from "@/src/api/base/useEntityMutation";

export const useUpdateBlockedTime = createEntityUpdate<BlockedTime>({
    resource: "blocked-time",
    name: "BlockedTime",
    errorMessage: "Failed to update blocked time",
});

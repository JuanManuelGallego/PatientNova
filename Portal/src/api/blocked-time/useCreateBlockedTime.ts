import { BlockedTime } from "@/src/types/BlockedTime";
import { createEntityCreate } from "@/src/api/base/useEntityMutation";

export const useCreateBlockedTime = createEntityCreate<BlockedTime>({
    resource: "blocked-time",
    name: "BlockedTime",
    errorMessage: "Failed to create blocked time",
});

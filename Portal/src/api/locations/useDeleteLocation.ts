import { createEntityDelete } from "@/src/api/base/useEntityMutation";

export const useDeleteLocation = createEntityDelete({
    resource: "locations",
    name: "Location",
    errorMessage: "Failed to delete location",
});

import { createEntityDelete } from "./useEntityMutation";

export const useDeleteLocation = createEntityDelete({
    resource: "locations",
    name: "Location",
    errorMessage: "Failed to delete location",
});

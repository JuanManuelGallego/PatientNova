export type SetField = (
  field: string,
) => (
  e: React.ChangeEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >,
) => void;

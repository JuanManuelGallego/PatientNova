import { SelectOption } from "@/src/components/CustomSelect";

/**
 * Builds an option list prefixed with an "All" choice (`value: ""`).
 * Replaces the repeated `[{ value: "", label: "Todos" }, ...items.map(...)]`
 * pattern used across table column filters.
 */
export function withAllOption<T>(
  items: readonly T[],
  labelFor: (item: T) => string,
  allLabel = "Todos",
): SelectOption[] {
  return [
    { value: "", label: allLabel },
    ...items.map((item) => ({ value: String(item), label: labelFor(item) })),
  ];
}

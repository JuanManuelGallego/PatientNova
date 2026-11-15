import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatientAutocomplete } from "@/src/components/PatientAutocomplete";
import { Patient, PatientStatus } from "@/src/types/Patient";
import { Channel } from "@/src/types/Reminder";
import { FetchPatientsFilters } from "@/src/types/Patient";

vi.mock("@/src/api/patients/useFetchPatients", () => ({
  useFetchPatients: vi.fn(),
}));

const debounceMode = vi.hoisted(() => ({ real: false }));

vi.mock("@/src/hooks/useDebounceState", async () => {
  const react = await import("react");
  return {
    useDebounceState: <T,>(value: T, delay: number) => {
      const [debounced, setDebounced] = react.useState(value);
      react.useEffect(() => {
        if (!debounceMode.real) return;
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
      }, [value, delay]);
      return debounceMode.real ? debounced : value;
    },
  };
});

import { useFetchPatients } from "@/src/api/patients/useFetchPatients";
const mockUseFetchPatients = vi.mocked(useFetchPatients);

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p-1",
    name: "Juan",
    lastName: "García",
    reminderChannel: Channel.WHATSAPP,
    status: PatientStatus.ACTIVE,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const allPatients: Patient[] = [
  makePatient({ id: "p-1", name: "Juan", lastName: "García" }),
  makePatient({ id: "p-2", name: "María", lastName: "López" }),
  makePatient({ id: "p-3", name: "Carlos", lastName: "Ruiz" }),
];

function filterPatients(filters?: FetchPatientsFilters): Patient[] {
  if (!filters?.search) return allPatients;
  const q = filters.search.toLowerCase();
  return allPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.lastName.toLowerCase().includes(q),
  );
}

function renderAutocomplete(props: Partial<React.ComponentProps<typeof PatientAutocomplete>> = {}) {
  const onChange = props.onChange ?? vi.fn();
  return {
    onChange,
    ...render(
      <PatientAutocomplete
        value={props.value ?? ""}
        onChange={onChange}
        disabled={props.disabled}
      />,
    ),
  };
}

describe("PatientAutocomplete", () => {
  beforeEach(() => {
    mockUseFetchPatients.mockImplementation((filters?: FetchPatientsFilters) => {
      const matched = filterPatients(filters);
      return {
        patients: matched,
        loading: false,
        error: null,
        fetchPatients: vi.fn(),
        total: matched.length,
        totalPages: 1,
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    debounceMode.real = false;
  });

  it("does not select a stale result when Enter is pressed before the search settles", async () => {
    debounceMode.real = true;
    vi.useFakeTimers();
    const santiago = makePatient({ id: "p-s", name: "Santiago", lastName: "Rey" });
    const mariana = makePatient({ id: "p-m", name: "Mariana", lastName: "Paz" });
    const valentina = makePatient({ id: "p-v", name: "Valentina", lastName: "Gil" });
    mockUseFetchPatients.mockImplementation((filters?: FetchPatientsFilters) => {
      const list = filters?.search === "Valen" ? [valentina] : [santiago, mariana];
      return {
        patients: list,
        loading: false,
        error: null,
        fetchPatients: vi.fn(),
        total: list.length,
        totalPages: 1,
      };
    });
    const { onChange } = renderAutocomplete();
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Valen" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("p-v", valentina);
  });

  it("lists patients alphabetically", async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    await user.click(screen.getByRole("combobox"));
    expect(mockUseFetchPatients).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: "name", order: "asc" }),
    );
  });

  it("opens dropdown on focus and shows all patients", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
    expect(within(listbox).getByText("Juan García")).toBeInTheDocument();
    expect(within(listbox).getByText("María López")).toBeInTheDocument();
    expect(within(listbox).getByText("Carlos Ruiz")).toBeInTheDocument();
  });

  it("calls onChange when an option is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("María López"));

    expect(onChange).toHaveBeenCalledWith("p-2", allPatients[1]);
  });

  it("closes dropdown after selecting an option", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByText("Carlos Ruiz"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("filters patients when typing", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "Mar");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
    expect(within(listbox).getByText("María López")).toBeInTheDocument();
  });

  it("shows empty state when search has no results", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "zzz");

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("clears selection when clear button is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderAutocomplete({ value: "p-1" });

    const clearBtn = screen.getByRole("button", { name: /limpiar selección/i });
    await user.click(clearBtn);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("selects option with Enter key", async () => {
    const user = userEvent.setup();
    const { onChange } = renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("p-2", allPatients[1]);
  });

  it("closes dropdown on Escape", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("navigates highlight with arrow keys", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option");

    expect(options[0]).toHaveClass("patient-autocomplete__option--highlighted");

    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveClass("patient-autocomplete__option--highlighted");

    await user.keyboard("{ArrowDown}");
    expect(options[2]).toHaveClass("patient-autocomplete__option--highlighted");

    await user.keyboard("{ArrowUp}");
    expect(options[1]).toHaveClass("patient-autocomplete__option--highlighted");
  });

  it("marks selected option with aria-selected", async () => {
    const user = userEvent.setup();
    renderAutocomplete({ value: "p-2" });

    await user.click(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[2]).toHaveAttribute("aria-selected", "false");
  });

  it("closes dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens dropdown with ArrowDown when closed", async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

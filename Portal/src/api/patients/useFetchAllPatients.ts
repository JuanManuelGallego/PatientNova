import { useCallback, useEffect, useReducer } from "react";
import { API_BASE } from "@/src/config/api";
import { Patient } from "@/src/types/Patient";
import { ApiPaginatedResponse } from "@/src/types/API";
import { buildPatientQueryString } from "@/src/utils/ApiUtils";
import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";

const PAGE_SIZE = 100;

type State = {
  patients: Patient[];
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; patients: Patient[] }
  | { type: "FETCH_ERROR"; error: string };

const initialState: State = { patients: [], loading: false, error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { patients: action.patients, loading: false, error: null };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
  }
}

/**
 * Fetches every patient (all pages, max page size) so multi-select pickers
 * like the bulk-send wizard can offer the full list, not just page one.
 */
export const useFetchAllPatients = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchAll = useCallback(async (signal: AbortSignal) => {
    dispatch({ type: "FETCH_START" });
    try {
      const collected: Patient[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const url = `${API_BASE}/patients${buildPatientQueryString({ page, pageSize: PAGE_SIZE })}`;
        const res = await fetchWithAuth(url, { signal });
        if (!res.ok) {
          throw new Error(`Failed to load patients (${res.status})`);
        }
        const json = (await res.json()) as ApiPaginatedResponse<Patient>;
        if (!json.success) throw new Error("API returned an error");
        collected.push(...json.data.data);
        totalPages = json.data.totalPages;
        page += 1;
      } while (page <= totalPages);
      if (!signal.aborted) {
        dispatch({ type: "FETCH_SUCCESS", patients: collected });
      }
    } catch (err) {
      if (signal.aborted) return;
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to load patients",
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAll(controller.signal);
    return () => controller.abort();
  }, [fetchAll]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    void fetchAll(controller.signal);
    return () => controller.abort();
  }, [fetchAll]);

  return {
    patients: state.patients,
    loading: state.loading,
    error: state.error,
    refetch,
  };
};

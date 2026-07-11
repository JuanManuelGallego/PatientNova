import { useEffect, useReducer } from "react";

type State = { show: boolean };
type Action = { type: "SHOW" } | { type: "HIDE" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SHOW":
      return state.show ? state : { show: true };
    case "HIDE":
      return state.show ? { show: false } : state;
  }
}

/**
 * Returns `true` only after `loading` has been continuously `true` for `delayMs`.
 * Prevents a loading indicator from flashing for requests that resolve quickly.
 */
export function useDelayedLoading(loading: boolean, delayMs = 200): boolean {
  const [ state, dispatch ] = useReducer(reducer, { show: false });

  useEffect(() => {
    if (!loading) {
      dispatch({ type: "HIDE" });
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "SHOW" }), delayMs);
    return () => clearTimeout(timer);
  }, [ loading, delayMs ]);

  return state.show;
}

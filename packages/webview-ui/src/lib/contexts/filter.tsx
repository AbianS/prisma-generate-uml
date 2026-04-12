import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface FilterState {
  focusedNodeId: string | null;
  searchQuery: string;
  hiddenNodeIds: Set<string>;
  focusDepth: 1 | 2 | 3;
}

export interface FilterActions {
  focusNode: (id: string) => void;
  clearFocus: () => void;
  toggleHideNode: (id: string) => void;
  setSearchQuery: (q: string) => void;
  setFocusDepth: (d: 1 | 2 | 3) => void;
  resetAll: () => void;
}

export type FilterContextValue = FilterState & FilterActions;

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>({
    focusedNodeId: null,
    searchQuery: '',
    hiddenNodeIds: new Set(),
    focusDepth: 1,
  });

  const focusNode = useCallback((id: string) => {
    setState((prev) => ({ ...prev, focusedNodeId: id }));
  }, []);

  const clearFocus = useCallback(() => {
    setState((prev) => ({ ...prev, focusedNodeId: null }));
  }, []);

  const toggleHideNode = useCallback((id: string) => {
    setState((prev) => {
      const next = new Set(prev.hiddenNodeIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, hiddenNodeIds: next };
    });
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setState((prev) => ({ ...prev, searchQuery: q }));
  }, []);

  const setFocusDepth = useCallback((d: 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, focusDepth: d }));
  }, []);

  const resetAll = useCallback(() => {
    setState({
      focusedNodeId: null,
      searchQuery: '',
      hiddenNodeIds: new Set(),
      focusDepth: 1,
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      ...state,
      focusNode,
      clearFocus,
      toggleHideNode,
      setSearchQuery,
      setFocusDepth,
      resetAll,
    }),
    [
      state,
      focusNode,
      clearFocus,
      toggleHideNode,
      setSearchQuery,
      setFocusDepth,
      resetAll,
    ],
  );

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}

import type {
  MemorySearchItem,
  MemorySearchPage,
  MemorySearchRelaxation,
  MemorySearchRequest,
} from './memory-search';

export type MemorySearchState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  request?: MemorySearchRequest;
  items: MemorySearchItem[];
  total: number;
  nextCursor?: string;
  relaxationSuggestions: MemorySearchRelaxation[];
  error?: string;
  requestId: number;
  loadedPages: number;
  anchorId?: string;
};

export type MemorySearchAction =
  | { type: 'started'; requestId: number; request: MemorySearchRequest; append: boolean; preserveItems?: boolean }
  | { type: 'loaded'; requestId: number; page: MemorySearchPage; append: boolean }
  | { type: 'failed'; requestId: number; error: string }
  | { type: 'refreshed'; requestId: number; page: MemorySearchPage; loadedPages: number; anchorId?: string }
  | { type: 'anchor'; anchorId?: string }
  | { type: 'cleared' };

export const initialMemorySearchState: MemorySearchState = {
  status: 'idle',
  items: [],
  total: 0,
  relaxationSuggestions: [],
  requestId: 0,
  loadedPages: 0,
};

export function memorySearchReducer(state: MemorySearchState, action: MemorySearchAction): MemorySearchState {
  switch (action.type) {
    case 'started':
      return {
        ...state,
        status: 'loading',
        request: action.request,
        requestId: action.requestId,
        error: undefined,
        ...(action.append || action.preserveItems ? {} : {
          items: [],
          total: 0,
          nextCursor: undefined,
          relaxationSuggestions: [],
          loadedPages: 0,
          anchorId: undefined,
        }),
      };
    case 'loaded': {
      if (action.requestId !== state.requestId) return state;
      const items = action.append ? deduplicate([...state.items, ...action.page.items]) : action.page.items;
      return {
        ...state,
        status: 'ready',
        items,
        total: action.page.total,
        nextCursor: action.page.nextCursor,
        relaxationSuggestions: action.page.relaxationSuggestions ?? [],
        error: undefined,
        loadedPages: action.append ? state.loadedPages + 1 : 1,
      };
    }
    case 'failed':
      if (action.requestId !== state.requestId) return state;
      return { ...state, status: 'error', error: action.error };
    case 'refreshed':
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        status: 'ready',
        items: deduplicate(action.page.items),
        total: action.page.total,
        nextCursor: action.page.nextCursor,
        relaxationSuggestions: action.page.relaxationSuggestions ?? [],
        loadedPages: action.loadedPages,
        anchorId: action.anchorId,
        error: undefined,
      };
    case 'anchor':
      return { ...state, anchorId: action.anchorId };
    case 'cleared':
      return { ...initialMemorySearchState, requestId: state.requestId };
    default:
      return state;
  }
}

function deduplicate(items: MemorySearchItem[]): MemorySearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

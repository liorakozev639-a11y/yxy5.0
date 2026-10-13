import { sortMemories, type Memory } from './domain/memory';

export type AppState = {
  memories: Memory[];
  selectedId?: string;
  loading: boolean;
  error?: string;
};

export const initialState: AppState = {
  memories: [],
  loading: true,
};

export type AppAction =
  | { type: 'loaded'; memories: Memory[] }
  | { type: 'upserted'; memory: Memory }
  | { type: 'upsertedMany'; memories: Memory[] }
  | { type: 'removed'; id: string }
  | { type: 'selected'; id?: string }
  | { type: 'echoSettingChanged'; id: string; echoExcluded: boolean }
  | { type: 'failed'; message: string };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'loaded':
      return { ...state, memories: sortMemories(action.memories), loading: false, error: undefined };
    case 'upserted':
      return {
        ...state,
        memories: sortMemories([...state.memories.filter((memory) => memory.id !== action.memory.id), action.memory]),
        loading: false,
        error: undefined,
      };
    case 'upsertedMany': {
      const incomingIds = new Set(action.memories.map((memory) => memory.id));
      return {
        ...state,
        memories: sortMemories([...state.memories.filter((memory) => !incomingIds.has(memory.id)), ...action.memories]),
        loading: false,
        error: undefined,
      };
    }
    case 'removed':
      return {
        ...state,
        memories: state.memories.filter((memory) => memory.id !== action.id),
        selectedId: state.selectedId === action.id ? undefined : state.selectedId,
      };
    case 'selected':
      return { ...state, selectedId: action.id };
    case 'echoSettingChanged':
      return { ...state, memories: state.memories.map((memory) => memory.id === action.id ? { ...memory, echoExcluded: action.echoExcluded } : memory) };
    case 'failed':
      return { ...state, loading: false, error: action.message };
    default:
      return state;
  }
}

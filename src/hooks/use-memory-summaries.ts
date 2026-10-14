import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  DueSummaryResult,
  MemoryStorySummary,
  StoryPeriodType,
  SummaryListItem,
  SummaryPreference,
  SummaryReflection,
  SummaryStoryPage,
} from '../domain/memory-summary';
import { isReadySummary } from '../domain/memory-summary';
import type {
  SaveSummaryReflectionRequest,
  UpdateSummaryPageRequest,
  UpdateSummaryPreferenceRequest,
} from '../repositories/api-summary-repository';
import { ApiSummaryRepository } from '../repositories/api-summary-repository';

export type SummaryFlowMode = 'archive' | 'player' | 'editor' | 'reflection';

export type SummaryFlowState = {
  initialized: boolean;
  loading: boolean;
  error: string;
  consentOpen: boolean;
  reminderDismissed: boolean;
  dueResult?: DueSummaryResult;
  preference?: SummaryPreference;
  summaries: SummaryListItem[];
  reflections: SummaryReflection[];
  active?: MemoryStorySummary;
  filter: StoryPeriodType;
  mode: SummaryFlowMode;
};

export const initialSummaryFlowState: SummaryFlowState = {
  initialized: false,
  loading: false,
  error: '',
  consentOpen: false,
  reminderDismissed: false,
  summaries: [],
  reflections: [],
  filter: 'MONTH',
  mode: 'archive',
};

type SummaryFlowAction =
  | { type: 'loading'; value: boolean }
  | { type: 'error'; message: string }
  | { type: 'checked'; dueResult: DueSummaryResult; preference?: SummaryPreference }
  | { type: 'consent_confirmed'; dueResult: DueSummaryResult; preference: SummaryPreference }
  | { type: 'consent_opened' }
  | { type: 'consent_closed' }
  | { type: 'reminder_dismissed' }
  | { type: 'archive_loaded'; summaries: SummaryListItem[]; reflections: SummaryReflection[]; filter?: StoryPeriodType }
  | { type: 'filter_changed'; filter: StoryPeriodType }
  | { type: 'summary_opened'; summary: MemoryStorySummary }
  | { type: 'progress_saved'; summary: MemoryStorySummary }
  | { type: 'page_saved'; page: SummaryStoryPage }
  | { type: 'reflection_saved'; reflection: SummaryReflection }
  | { type: 'summary_deleted'; id: string }
  | { type: 'mode_changed'; mode: SummaryFlowMode };

export function summaryFlowReducer(state: SummaryFlowState, action: SummaryFlowAction): SummaryFlowState {
  switch (action.type) {
    case 'loading': return { ...state, loading: action.value };
    case 'error': return { ...state, loading: false, error: action.message };
    case 'checked': return { ...state, initialized: true, loading: false, error: '', dueResult: action.dueResult, preference: action.preference, consentOpen: action.dueResult.needsConsent, reminderDismissed: false };
    case 'consent_confirmed': return { ...state, initialized: true, loading: false, error: '', preference: action.preference, dueResult: action.dueResult, consentOpen: false, reminderDismissed: false };
    case 'consent_opened': return { ...state, consentOpen: true };
    case 'consent_closed': return { ...state, consentOpen: false };
    case 'reminder_dismissed': return { ...state, reminderDismissed: true };
    case 'filter_changed': return { ...state, filter: action.filter };
    case 'archive_loaded': return { ...state, loading: false, error: '', summaries: action.summaries, reflections: action.reflections, ...(action.filter ? { filter: action.filter } : {}) };
    case 'summary_opened': return { ...state, active: action.summary, mode: 'player' };
    case 'progress_saved': return {
      ...state,
      active: action.summary,
      summaries: replaceSummary(state.summaries, action.summary),
      dueResult: state.dueResult ? { ...state.dueResult, due: replaceSummary(state.dueResult.due, action.summary) } : undefined,
    };
    case 'page_saved': return state.active ? { ...state, active: { ...state.active, pages: state.active.pages.map((page) => page.id === action.page.id ? action.page : page).sort((left, right) => left.displayOrder - right.displayOrder) } } : state;
    case 'reflection_saved': return {
      ...state,
      reflections: [action.reflection, ...state.reflections.filter((item) => item.id !== action.reflection.id)],
      active: state.active?.id === action.reflection.summaryId ? { ...state.active, reflection: action.reflection } : state.active,
      mode: 'archive',
    };
    case 'summary_deleted': return {
      ...state,
      summaries: state.summaries.filter((item) => item.id !== action.id),
      reflections: state.reflections.filter((item) => item.summaryId !== action.id),
      active: state.active?.id === action.id ? undefined : state.active,
      mode: 'archive',
    };
    case 'mode_changed': return { ...state, mode: action.mode };
    default: return state;
  }
}

type InitializeRepository = Pick<ApiSummaryRepository, 'checkDue' | 'getPreferences'>;
type ConsentRepository = Pick<ApiSummaryRepository, 'checkDue' | 'updatePreferences'>;

export async function initializeSummaryFlow(repository: InitializeRepository) {
  const dueResult = await repository.checkDue();
  const preference = dueResult.needsConsent ? await repository.getPreferences() : undefined;
  return { initialized: true, consentOpen: dueResult.needsConsent, reminderDismissed: false, dueResult, preference };
}

export async function confirmSummaryConsent(repository: ConsentRepository, input: UpdateSummaryPreferenceRequest) {
  const preference = await repository.updatePreferences(input);
  const dueResult = await repository.checkDue();
  return { consentOpen: false, dueResult, preference };
}

export function useMemorySummaries(repository: ApiSummaryRepository, enabled: boolean) {
  const [state, dispatch] = useReducer(summaryFlowReducer, initialSummaryFlowState);
  const stateRef = useRef(state);
  const initializedRef = useRef(false);
  const progressQueue = useRef(Promise.resolve());
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    initializedRef.current = true;
    dispatch({ type: 'loading', value: true });
    void initializeSummaryFlow(repository)
      .then((result) => dispatch({ type: 'checked', dueResult: result.dueResult, preference: result.preference }))
      .catch((error) => dispatch({ type: 'error', message: readableError(error, '总结检查暂时失败，请稍后重试。') }));
  }, [enabled, repository]);

  const loadArchive = useCallback(async (filter: StoryPeriodType = stateRef.current.filter) => {
    dispatch({ type: 'loading', value: true });
    dispatch({ type: 'filter_changed', filter });
    try {
      const summaries = await repository.list(filter);
      const details = await Promise.all(summaries.filter(isReadySummary).map((summary) => repository.getById(summary.id).catch(() => undefined)));
      const reflections = details.flatMap((summary) => summary?.reflection ? [summary.reflection] : []);
      dispatch({ type: 'archive_loaded', summaries, reflections, filter });
      return summaries;
    } catch (error) {
      dispatch({ type: 'error', message: readableError(error, '总结档案读取失败，请稍后重试。') });
      return [];
    }
  }, [repository]);

  const openSummary = useCallback(async (id: string) => {
    try {
      const summary = await repository.getById(id);
      dispatch({ type: 'summary_opened', summary });
      return summary;
    } catch (error) {
      dispatch({ type: 'error', message: readableError(error, '这份总结暂时无法打开。') });
      return undefined;
    }
  }, [repository]);

  const saveProgress = useCallback((page: number, viewed: boolean) => {
    progressQueue.current = progressQueue.current.then(async () => {
      const active = stateRef.current.active;
      if (!active) return;
      const updated = await repository.updateProgress(active.id, { version: active.version, page, viewed });
      stateRef.current = summaryFlowReducer(stateRef.current, { type: 'progress_saved', summary: updated });
      dispatch({ type: 'progress_saved', summary: updated });
    }).catch((error) => dispatch({ type: 'error', message: readableError(error, '阅读进度保存失败。') }));
    return progressQueue.current;
  }, [repository]);

  const savePage = useCallback(async (pageId: string, input: Omit<UpdateSummaryPageRequest, 'version'>) => {
    const active = stateRef.current.active;
    const page = active?.pages.find((item) => item.id === pageId);
    if (!active || !page) throw new Error('总结页面不存在');
    const updated = await repository.updatePage(active.id, pageId, { ...input, version: page.version });
    stateRef.current = summaryFlowReducer(stateRef.current, { type: 'page_saved', page: updated });
    dispatch({ type: 'page_saved', page: updated });
    return updated;
  }, [repository]);

  const reorderPage = useCallback(async (pageId: string, displayOrder: number, version: number) => {
    const active = stateRef.current.active;
    if (!active) throw new Error('总结不存在');
    const updated = await repository.updatePage(active.id, pageId, { version, displayOrder });
    const refreshed = await repository.getById(active.id);
    const nextState = summaryFlowReducer(stateRef.current, { type: 'progress_saved', summary: refreshed });
    stateRef.current = nextState;
    dispatch({ type: 'progress_saved', summary: refreshed });
    return updated;
  }, [repository]);

  const regenerate = useCallback(async () => {
    const active = stateRef.current.active;
    if (!active) return;
    const result = await repository.regenerate(active.id);
    if (result.status === 'NO_CONTENT') {
      dispatch({ type: 'summary_deleted', id: active.id });
      return;
    }
    stateRef.current = summaryFlowReducer(stateRef.current, { type: 'summary_opened', summary: result });
    dispatch({ type: 'summary_opened', summary: result });
  }, [repository]);

  const saveReflection = useCallback(async (input: SaveSummaryReflectionRequest) => {
    const active = stateRef.current.active;
    if (!active) throw new Error('总结不存在');
    const reflection = await repository.saveReflection(active.id, input);
    stateRef.current = summaryFlowReducer(stateRef.current, { type: 'reflection_saved', reflection });
    dispatch({ type: 'reflection_saved', reflection });
    return reflection;
  }, [repository]);

  const confirmConsent = useCallback(async (input: UpdateSummaryPreferenceRequest) => {
    dispatch({ type: 'loading', value: true });
    try {
      const result = await confirmSummaryConsent(repository, input);
      dispatch({ type: 'consent_confirmed', dueResult: result.dueResult, preference: result.preference });
    } catch (error) {
      dispatch({ type: 'error', message: readableError(error, '授权设置保存失败，请稍后重试。') });
    }
  }, [repository]);

  const remove = useCallback(async (id: string) => {
    await repository.remove(id);
    dispatch({ type: 'summary_deleted', id });
  }, [repository]);

  return {
    ...state,
    loadArchive,
    openSummary,
    saveProgress,
    savePage,
    reorderPage,
    regenerate,
    saveReflection,
    confirmConsent,
    remove,
    dismissReminder: () => dispatch({ type: 'reminder_dismissed' }),
    openConsent: () => dispatch({ type: 'consent_opened' }),
    closeConsent: () => dispatch({ type: 'consent_closed' }),
    setMode: (mode: SummaryFlowMode) => dispatch({ type: 'mode_changed', mode }),
  };
}

function replaceSummary<T extends SummaryListItem>(items: T[], summary: MemoryStorySummary): T[] {
  return items.map((item) => item.id === summary.id ? { ...item, ...summary } as T : item);
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

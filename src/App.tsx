import { useEffect, useMemo, useReducer, useState } from 'react';
import { appReducer, initialState } from './app-state';
import { formatDay } from './domain/date';
import { createMemoryRepository } from './storage/db';
import { createImportantDayRepository } from './storage/db';
import type { ImportantDay } from './domain/important-day';
import type { Memory, MemoryDraft } from './domain/memory';
import type { Topic } from './domain/topic';
import type { EchoPreference, EchoReflection, MemoryEcho } from './domain/memory-echo';
import { dismissEcho, saveEchoReflection, shouldApplyMemoryReflections } from './domain/memory-echo-state';
import { buildAutoCollectCopyInput, findCopyDecisionCandidates, type CopyDecisionCandidate } from './domain/long-term-copy-policy';
import { ApiClient, ApiError } from './api/client';
import { ApiMemoryRepository } from './repositories/api-memory-repository';
import { ApiTopicRepository } from './repositories/api-topic-repository';
import { ApiLongTermCopyRepository, type LongTermCopy, type LongTermCopyInput } from './repositories/api-long-term-copy-repository';
import { ApiMemoryEchoRepository } from './repositories/api-memory-echo-repository';
import { LongTermCopiesView } from './components/LongTermCopiesView';
import { LongTermCopyTimeline } from './components/LongTermCopyTimeline';
import { HomeView } from './components/HomeView';
import { MemoryDetail } from './components/MemoryDetail';
import { MemoryForm } from './components/MemoryForm';
import { MemoryCard } from './components/MemoryCard';
import { Toast } from './components/Toast';
import { ImportantDaysView } from './components/ImportantDaysView';
import { LongTermCopyDecisionDialog, type CopyDecisionMap } from './components/LongTermCopyDecisionDialog';
import { BatchImportDialog } from './components/BatchImportDialog';
import { MemoryEchoCard } from './components/MemoryEchoCard';
import { EchoDisabledCard, MemoryEchoPage, nextEchoIndex } from './components/MemoryEchoPage';
import { EchoReflectionEditor } from './components/EchoReflectionEditor';
import { EchoSettingsPanel } from './components/EchoSettingsPanel';
import { nextReadablePage, type SummaryPreference } from './domain/memory-summary';
import { ApiSummaryRepository } from './repositories/api-summary-repository';
import { SummaryReminderCard } from './components/SummaryReminderCard';
import { SummaryArchivePage } from './components/SummaryArchivePage';
import { SummaryStoryPlayer } from './components/SummaryStoryPlayer';
import { SummaryStoryEditor } from './components/SummaryStoryEditor';
import { SummaryReflectionEditor } from './components/SummaryReflectionEditor';
import { useMemorySummaries } from './hooks/use-memory-summaries';
import type { AppLockStatus } from './domain/data-vault';
import { ApiAppLockRepository } from './repositories/api-app-lock-repository';
import { ApiVaultRepository } from './repositories/api-vault-repository';
import { AppLockGate } from './components/AppLockGate';
import { DataVaultPage } from './components/DataVaultPage';

type View = 'home' | 'timeline' | 'important' | 'copies' | 'echo' | 'summary' | 'vault';
type PolicyRequest = { candidates: CopyDecisionCandidate[]; resolve: (decisions: CopyDecisionMap) => void; reject: (error: Error) => void };

export const APP_NAV_ITEMS = [
  { view: 'home', label: '记忆', icon: '▦' },
  { view: 'timeline', label: '时间线', icon: '☷' },
  { view: 'copies', label: '长期副本', icon: '◌' },
  { view: 'important', label: '重要日子', icon: '♡' },
] as const;

export const APP_SUMMARY_ENTRY_LABEL = '情绪电影';

function readList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export default function App() {
  const apiClient = useMemo(() => new ApiClient(), []);
  const repository = useMemo(() => new ApiMemoryRepository(apiClient), [apiClient]);
  const localRepository = useMemo(() => createMemoryRepository(), []);
  const topicRepository = useMemo(() => new ApiTopicRepository(apiClient), [apiClient]);
  const copyRepository = useMemo(() => new ApiLongTermCopyRepository(apiClient), [apiClient]);
  const echoRepository = useMemo(() => new ApiMemoryEchoRepository(apiClient), [apiClient]);
  const summaryRepository = useMemo(() => new ApiSummaryRepository(apiClient), [apiClient]);
  const appLockRepository = useMemo(() => new ApiAppLockRepository(apiClient), [apiClient]);
  const vaultRepository = useMemo(() => new ApiVaultRepository(apiClient), [apiClient]);
  const importantRepository = useMemo(() => createImportantDayRepository(), []);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [view, setView] = useState<View>('home');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<'new' | Memory>();
  const [customMoods, setCustomMoods] = useState(() => readList('photo-memory-custom-moods'));
  const [customStatuses, setCustomStatuses] = useState(() => readList('photo-memory-custom-statuses'));
  const [topics, setTopics] = useState<Topic[]>(defaultTopics);
  const [toast, setToast] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [importantDays, setImportantDays] = useState<ImportantDay[]>([]);
  const [longTermCopies, setLongTermCopies] = useState<LongTermCopy[]>([]);
  const [selectedCopyId, setSelectedCopyId] = useState<string>();
  const [policyRequest, setPolicyRequest] = useState<PolicyRequest>();
  const [batchFiles, setBatchFiles] = useState<File[]>();
  const [todayEchoes, setTodayEchoes] = useState<MemoryEcho[]>([]);
  const [echoHistory, setEchoHistory] = useState<MemoryEcho[]>([]);
  const [echoPreference, setEchoPreference] = useState<EchoPreference>({ userId: 'local-user', enabled: true, excludedMoods: [] });
  const [echoIndex, setEchoIndex] = useState(0);
  const [echoLoading, setEchoLoading] = useState(true);
  const [echoError, setEchoError] = useState('');
  const [reflectionEcho, setReflectionEcho] = useState<MemoryEcho>();
  const [echoSettingsOpen, setEchoSettingsOpen] = useState(false);
  const [selectedReflections, setSelectedReflections] = useState<EchoReflection[]>([]);
  const [lockStatus, setLockStatus] = useState<AppLockStatus>();
  const [lockSkipped, setLockSkipped] = useState(false);
  const accessReady = !!lockStatus && (lockSkipped || !lockStatus.configured || !lockStatus.enabled || !lockStatus.locked);
  const summaryFlow = useMemorySummaries(summaryRepository, accessReady && !state.loading);

  useEffect(() => {
    let active = true;
    appLockRepository.status().then((status) => { if (active) setLockStatus(status); }).catch(() => {
      if (active) setLockStatus({ configured: false, enabled: false, locked: false, autoLockMinutes: 30 });
    });
    const refreshLock = () => { void appLockRepository.status().then(setLockStatus).catch(() => undefined); };
    window.addEventListener('photo-memory-lock-required', refreshLock);
    return () => { active = false; window.removeEventListener('photo-memory-lock-required', refreshLock); };
  }, [appLockRepository]);

  useEffect(() => {
    if (!accessReady) return;
    void repository.getAll().then((memories) => dispatch({ type: 'loaded', memories })).catch(async () => {
      const local = await localRepository.getAll().catch(() => []);
      dispatch({ type: 'loaded', memories: local });
      setToast('后端暂未连接，当前显示浏览器中的本地草稿。');
    });
  }, [accessReady, localRepository, repository]);
  useEffect(() => { if (accessReady) void topicRepository.list().then(setTopics).catch(() => undefined); }, [accessReady, topicRepository]);
  useEffect(() => { if (accessReady) void copyRepository.list().then(setLongTermCopies).catch(() => undefined); }, [accessReady, copyRepository]);
  useEffect(() => { if (accessReady) void loadTodayEchoes(); }, [accessReady, echoRepository]);
  useEffect(() => {
    if (!accessReady) return;
    void importantRepository.getAll().then(setImportantDays).catch(() => setToast('重要日子读取失败，请刷新重试。'));
  }, [accessReady, importantRepository]);

  useEffect(() => {
    const next: Record<string, string> = {};
    const localUrls: string[] = [];
    state.memories.forEach((memory) => {
      if (memory.imageUrl) next[memory.id] = memory.imageUrl;
      else if (memory.imageBlob) { next[memory.id] = URL.createObjectURL(memory.imageBlob); localUrls.push(next[memory.id]); }
    });
    setImageUrls(next);
    return () => localUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [state.memories]);

  useEffect(() => { localStorage.setItem('photo-memory-custom-moods', JSON.stringify(customMoods)); }, [customMoods]);
  useEffect(() => { localStorage.setItem('photo-memory-custom-statuses', JSON.stringify(customStatuses)); }, [customStatuses]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const selectedMemory = state.memories.find((memory) => memory.id === state.selectedId);
  const currentEcho = todayEchoes[echoIndex]?.status === 'ACTIVE' ? todayEchoes[echoIndex] : todayEchoes.find((echo) => echo.status === 'ACTIVE');

  useEffect(() => {
    if (!selectedMemory) { setSelectedReflections([]); return; }
    const requestedMemoryId = selectedMemory.id;
    let active = true;
    void echoRepository.listReflections(requestedMemoryId).then((reflections) => {
      if (active && shouldApplyMemoryReflections(requestedMemoryId, selectedMemory.id)) setSelectedReflections(reflections);
    }).catch(() => { if (active) setSelectedReflections([]); });
    return () => { active = false; };
  }, [echoRepository, selectedMemory]);

  async function loadTodayEchoes() {
    setEchoLoading(true);
    setEchoError('');
    try {
      const preference = await echoRepository.getPreferences();
      const echoes = preference.enabled ? await echoRepository.today() : [];
      setEchoPreference(preference);
      setTodayEchoes(echoes);
      setEchoIndex(echoes.findIndex((echo) => echo.status === 'ACTIVE') < 0 ? 0 : echoes.findIndex((echo) => echo.status === 'ACTIVE'));
    } catch {
      setEchoError('记忆回声暂时没有响起，请稍后重试。');
    } finally {
      setEchoLoading(false);
    }
  }

  async function openEchoPage() {
    setView('echo');
    try { setEchoHistory(await echoRepository.list(30)); } catch { setEchoError('最近的回声读取失败，请稍后重试。'); }
  }

  async function openSummaryArchive() {
    setView('summary');
    await summaryFlow.loadArchive(summaryFlow.filter);
  }

  async function openStorySummary(id: string) {
    setView('summary');
    await summaryFlow.openSummary(id);
  }

  async function saveReflection(text: string) {
    if (!reflectionEcho) return;
    const reflection = await echoRepository.saveReflection(reflectionEcho.id, text);
    setTodayEchoes((current) => saveEchoReflection(current, reflectionEcho.id, reflection));
    setEchoHistory((current) => saveEchoReflection(current, reflectionEcho.id, reflection));
    if (selectedMemory?.id === reflection.memoryId) setSelectedReflections((current) => [reflection, ...current.filter((item) => item.id !== reflection.id)]);
    setReflectionEcho(undefined);
    setToast('回声感言已经保存');
  }

  async function dismissCurrentEcho(echo: MemoryEcho) {
    await echoRepository.dismiss(echo.id);
    const updated = dismissEcho(todayEchoes, echo.id);
    setTodayEchoes(updated);
    setEchoHistory((current) => dismissEcho(current, echo.id));
    setEchoIndex(nextEchoIndex(echoIndex, updated));
  }

  async function excludeEchoMemory(memory: Memory) {
    if (!window.confirm('确定以后不再让这段记忆出现在新的记忆回声中吗？历史回声仍会保留。')) return;
    await echoRepository.setMemoryExcluded(memory.id, true);
    dispatch({ type: 'echoSettingChanged', id: memory.id, echoExcluded: true });
    setToast('这段记忆以后不会生成新的回声');
  }

  async function disableEchoTopic(topic: Topic) {
    if (!window.confirm(`确定关闭“${topic.name}”主题的记忆回声吗？原记忆和历史回声不会删除。`)) return;
    await echoRepository.setTopicEnabled(topic.id, false);
    setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, echoEnabled: false } : item));
    setToast(`已关闭“${topic.name}”主题回声`);
  }

  async function saveEchoPreferences(input: Partial<Pick<EchoPreference, 'enabled' | 'excludedMoods'>>) {
    const preference = await echoRepository.updatePreferences(input);
    setEchoPreference(preference);
    setEchoSettingsOpen(false);
    if (preference.enabled) {
      const echoes = await echoRepository.today();
      setTodayEchoes(echoes);
      setEchoIndex(echoes.findIndex((echo) => echo.status === 'ACTIVE') < 0 ? 0 : echoes.findIndex((echo) => echo.status === 'ACTIVE'));
    }
    setToast('回声设置已经保存');
  }

  async function restoreEchoTopic(topicId: string) {
    await echoRepository.setTopicEnabled(topicId, true);
    setTopics((current) => current.map((item) => item.id === topicId ? { ...item, echoEnabled: true } : item));
  }

  async function restoreEchoMemory(memoryId: string) {
    await echoRepository.setMemoryExcluded(memoryId, false);
    dispatch({ type: 'echoSettingChanged', id: memoryId, echoExcluded: false });
  }

  async function saveMemory(draft: MemoryDraft) {
    await resolveCopyPolicy(draft.topicIds ?? [], draft.eventAt);
    const saved = await persistMemory(draft, editor !== 'new' && editor ? editor : undefined);
    dispatch({ type: 'upserted', memory: saved });
    setEditor(undefined);
    setToast(editor !== 'new' && editor ? '这段记忆已经更新' : '这段记忆已经收好');
  }

  async function persistMemory(draft: MemoryDraft, previous?: Memory) {
    const now = new Date().toISOString();
    const memory = { ...draft, id: previous?.id ?? crypto.randomUUID(), createdAt: previous?.createdAt ?? now, updatedAt: now };
    return repository.put(memory);
  }

  async function removeMemory() {
    if (!selectedMemory || !window.confirm('确定要删除这段记忆吗？照片和文字都会从本机移除。')) return;
    await repository.remove(selectedMemory.id);
    const affectedDays = importantDays.filter((day) => day.memoryIds.includes(selectedMemory.id));
    await Promise.all(affectedDays.map((day) => importantRepository.put({ ...day, memoryIds: day.memoryIds.filter((id) => id !== selectedMemory.id) })));
    if (affectedDays.length) setImportantDays((current) => current.map((day) => affectedDays.find((changed) => changed.id === day.id) ?? day));
    dispatch({ type: 'removed', id: selectedMemory.id });
    setToast('这段记忆已删除');
  }

  function addMood(value: string) { setCustomMoods((current) => current.includes(value) ? current : [...current, value]); }
  function addStatus(value: string) { setCustomStatuses((current) => current.includes(value) ? current : [...current, value]); }
  async function addTopic(value: string) {
    try {
      const topic = await topicRepository.create(value);
      setTopics((current) => current.some((item) => item.id === topic.id) ? current : [...current, topic]);
      return topic;
    } catch {
      setToast('主题保存失败，请确认后端已连接。');
      throw new Error('主题保存失败，请确认后端已连接。');
    }
  }

  async function resolveCopyPolicy(topicIds: string[], eventAt: string) {
    const candidates = findCopyDecisionCandidates(topicIds, topics, longTermCopies);
    if (!candidates.length) return;
    const decisions = await new Promise<CopyDecisionMap>((resolve, reject) => setPolicyRequest({ candidates, resolve, reject }));
    await applyCopyDecisions(candidates, decisions, eventAt);
  }

  async function applyCopyDecisions(candidates: CopyDecisionCandidate[], decisions: CopyDecisionMap, eventAt: string) {
    for (const { topic, copy } of candidates) {
      const action = decisions[topic.id];
      if (action === 'enable') {
        if (copy) {
          await copyRepository.update(copy.id, { lifecycleStatus: 'ACTIVE', autoCollectEnabled: true });
        } else {
          try {
            await copyRepository.create(buildAutoCollectCopyInput(topic, eventAt));
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 409) throw error;
            const currentCopies = await copyRepository.list();
            const existing = currentCopies.find((item) => item.topicId === topic.id);
            if (!existing) throw error;
            if (existing.lifecycleStatus !== 'ACTIVE' || !existing.autoCollectEnabled) {
              await copyRepository.update(existing.id, { lifecycleStatus: 'ACTIVE', autoCollectEnabled: true });
            }
          }
        }
      } else if (action === 'suppress') {
        await topicRepository.update(topic.id, { suppressLongTermPrompt: true });
      }
    }
    if (Object.keys(decisions).length) {
      const [nextTopics, nextCopies] = await Promise.all([topicRepository.list(), copyRepository.list()]);
      setTopics(nextTopics);
      setLongTermCopies(nextCopies);
    }
  }

  async function createImportantDay(name: string, date: string) {
    const day: ImportantDay = { id: crypto.randomUUID(), name, date, memoryIds: [], createdAt: new Date().toISOString() };
    await importantRepository.put(day);
    setImportantDays((current) => [...current, day].sort((a, b) => a.date.localeCompare(b.date)));
    setToast('重要日子已经记下');
  }

  async function updateImportantDay(day: ImportantDay) {
    await importantRepository.put(day);
    setImportantDays((current) => current.map((item) => item.id === day.id ? day : item));
  }

  async function deleteImportantDay(day: ImportantDay) {
    if (!window.confirm(`确定删除“${day.name}”吗？`)) return;
    await importantRepository.remove(day.id);
    setImportantDays((current) => current.filter((item) => item.id !== day.id));
    setToast('重要日子已删除');
  }

  async function createLongTermCopy(input: LongTermCopyInput) {
    const copy = await copyRepository.create(input);
    setLongTermCopies((current) => [copy, ...current]);
    setToast('长期副本已经创建');
  }

  async function toggleCopyAutoCollect(copy: LongTermCopy, enabled: boolean) {
    setLongTermCopies((current) => current.map((item) => item.id === copy.id ? { ...item, autoCollectEnabled: enabled } : item));
    try {
      const updated = await copyRepository.update(copy.id, { autoCollectEnabled: enabled });
      setLongTermCopies((current) => current.map((item) => item.id === updated.id ? updated : item));
      setToast(enabled ? '已开启同主题自动收集' : '已关闭同主题自动收集');
    } catch {
      setLongTermCopies((current) => current.map((item) => item.id === copy.id ? copy : item));
      setToast('自动收集设置保存失败，请稍后重试');
    }
  }

  if (!lockStatus) return <div className="app-loading"><div className="loading-orb">✦</div><p>正在检查本机保护状态…</p></div>;
  if (!lockSkipped && (!lockStatus.configured || (lockStatus.enabled && lockStatus.locked))) {
    return <AppLockGate onSkip={() => setLockSkipped(true)} onStatusChange={(status) => { setLockStatus(status); setLockSkipped(false); }} repository={appLockRepository} status={lockStatus}><div /></AppLockGate>;
  }
  if (state.loading) return <div className="app-loading"><div className="loading-orb">✦</div><p>正在打开你的记忆本…</p></div>;

  return (
    <div className="app-shell">
      <header className="topbar"><button className="brand" onClick={() => { setView('home'); setQuery(''); }} type="button"><span className="brand-mark">✦</span><span>照片记忆本<small>PHOTO MEMORY</small></span></button><div className="topbar-tools"><div className="topbar-note">安全保存到你的本地数据库</div><button className="vault-entry" onClick={() => setView('vault')} type="button"><span>◇</span> 数据保险箱</button></div><button className="mobile-add" onClick={() => setEditor('new')} type="button">＋</button></header>
      <main className="main-content">
        {state.error && <div className="error-banner">{state.error}</div>}
        {view === 'home' && <HomeView
          echoCard={<section className="home-echo-section">{!echoPreference.enabled ? <EchoDisabledCard onOpenHistory={() => void openEchoPage()} onOpenSettings={() => setEchoSettingsOpen(true)} /> : echoLoading ? <div className="home-echo-status">正在听取今天的记忆回声…</div> : echoError ? <div className="home-echo-status is-error"><p>{echoError}</p><button className="text-button" onClick={() => void loadTodayEchoes()} type="button">重试</button></div> : currentEcho ? <MemoryEchoCard echo={currentEcho} index={echoIndex} onDismiss={(echo) => void dismissCurrentEcho(echo)} onExclude={(memory) => void excludeEchoMemory(memory)} onNext={() => setEchoIndex(nextEchoIndex(echoIndex, todayEchoes))} onOpen={(id) => dispatch({ type: 'selected', id })} onOpenAll={() => void openEchoPage()} onReflect={setReflectionEcho} onDisableTopic={(topic) => void disableEchoTopic(topic)} sectionLabel="记忆回声" total={todayEchoes.filter((echo) => echo.status === 'ACTIVE').length} /> : <div className="home-echo-status"><strong>过去的记忆还在慢慢积累</strong><p>保存满 30 天后，它们会在合适的时候回来。</p><button className="text-button" onClick={() => void openEchoPage()} type="button">查看回声记录</button></div>}</section>}
          summaryCard={summaryFlow.dueResult && !summaryFlow.reminderDismissed && summaryFlow.dueResult.due.length > 0
            ? <SummaryReminderCard due={summaryFlow.dueResult.due} onLater={summaryFlow.dismissReminder} onOpen={(id) => void openStorySummary(id)} />
            : <section className="home-summary-card"><div><span className="section-kicker">YOUR EMOTION FILM</span><h2>把这一段生活，放成一部情绪电影</h2><p>从真实照片、心情、主题与长期副本中生成并永久保存月度或年度回顾。</p></div><div><button className="secondary-button" onClick={() => summaryFlow.dueResult?.needsConsent ? summaryFlow.openConsent() : void openSummaryArchive()} type="button">打开情绪电影档案馆</button></div></section>}
          imageUrls={imageUrls}
          memories={state.memories}
          onAdd={() => setEditor('new')}
          onQueryChange={setQuery}
          onSelect={(id) => dispatch({ type: 'selected', id })}
          query={query}
        />}
        {view === 'timeline' && <Timeline memories={state.memories} imageUrls={imageUrls} onSelect={(id) => dispatch({ type: 'selected', id })} />}
        {view === 'important' && <ImportantDaysView days={importantDays} imageUrls={imageUrls} memories={state.memories} onCreate={createImportantDay} onDelete={deleteImportantDay} onSelectMemory={(id) => dispatch({ type: 'selected', id })} onUpdate={updateImportantDay} />}
        {view === 'copies' && (selectedCopyId ? <LongTermCopyTimeline copyId={selectedCopyId} onBack={() => setSelectedCopyId(undefined)} repository={copyRepository} /> : <LongTermCopiesView copies={longTermCopies} onCreate={createLongTermCopy} onSelect={setSelectedCopyId} onToggleAutoCollect={toggleCopyAutoCollect} topics={topics} />)}
        {view === 'echo' && <MemoryEchoPage history={echoHistory} onBack={() => setView('home')} onDismiss={(echo) => void dismissCurrentEcho(echo)} onExclude={(memory) => void excludeEchoMemory(memory)} onOpen={(id) => dispatch({ type: 'selected', id })} onOpenSettings={() => setEchoSettingsOpen(true)} onReflect={setReflectionEcho} onDisableTopic={(topic) => void disableEchoTopic(topic)} today={todayEchoes} />}
        {view === 'summary' && <>{summaryFlow.error && <div className="error-banner">{summaryFlow.error}</div>}{summaryFlow.loading && <div className="summary-status">正在整理情绪电影档案…</div>}<SummaryArchivePage filter={summaryFlow.filter} onBack={() => setView('home')} onFilterChange={(filter) => void summaryFlow.loadArchive(filter)} onOpen={(id) => void openStorySummary(id)} reflections={summaryFlow.reflections} summaries={summaryFlow.summaries} /></>}
        {view === 'vault' && <DataVaultPage appLockRepository={appLockRepository} lockStatus={lockStatus} onBack={() => setView('home')} onLockStatusChange={(next) => { setLockStatus(next); if (next.configured) setLockSkipped(false); }} repository={vaultRepository} />}
      </main>
      <nav className="bottom-nav"><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')} type="button"><span>▦</span>记忆</button><button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')} type="button"><span>☷</span>时间线</button><button className={view === 'copies' ? 'active' : ''} onClick={() => { setView('copies'); setSelectedCopyId(undefined); }} type="button"><span>◌</span>长期副本</button><button className={view === 'important' ? 'active' : ''} onClick={() => setView('important')} type="button"><span>♡</span>重要日子</button></nav>
      {selectedMemory && !editor && <MemoryDetail imageUrl={imageUrls[selectedMemory.id]} memory={selectedMemory} onClose={() => dispatch({ type: 'selected' })} onDelete={() => void removeMemory()} onEdit={() => setEditor(selectedMemory)} reflections={selectedReflections} />}
      {editor && <MemoryForm customMoods={customMoods} customStatuses={customStatuses} topics={topics} initial={editor === 'new' ? undefined : editor} onAddMood={addMood} onAddStatus={addStatus} onAddTopic={addTopic} onBatchSelected={(files) => { setEditor(undefined); setBatchFiles(files); }} onCancel={() => setEditor(undefined)} onSave={saveMemory} />}
      {batchFiles && <BatchImportDialog files={batchFiles} topics={topics} onAddTopic={addTopic} onClose={() => setBatchFiles(undefined)} onComplete={(memories) => { if (!memories.length) return; dispatch({ type: 'upsertedMany', memories }); setToast(`已导入 ${memories.length} 张照片`); }} onResolvePolicy={resolveCopyPolicy} onSaveDraft={(draft) => persistMemory(draft)} />}
      {policyRequest && <LongTermCopyDecisionDialog candidates={policyRequest.candidates} onCancel={() => { policyRequest.reject(new Error('已取消保存')); setPolicyRequest(undefined); }} onConfirm={async (decisions) => { const request = policyRequest; setPolicyRequest(undefined); request.resolve(decisions); }} />}
      {reflectionEcho && <EchoReflectionEditor echo={reflectionEcho} onCancel={() => setReflectionEcho(undefined)} onSave={saveReflection} />}
      {echoSettingsOpen && <EchoSettingsPanel availableMoods={Array.from(new Set([...DEFAULT_MOODS, ...customMoods, ...state.memories.map((memory) => memory.mood).filter(Boolean), ...echoPreference.excludedMoods]))} disabledTopics={topics.filter((topic) => topic.echoEnabled === false)} excludedMemories={state.memories.filter((memory) => memory.echoExcluded)} onClose={() => setEchoSettingsOpen(false)} onRestoreMemory={restoreEchoMemory} onRestoreTopic={restoreEchoTopic} onSave={saveEchoPreferences} preference={echoPreference} />}
      {summaryFlow.consentOpen && <SummaryConsentDialog onCancel={summaryFlow.closeConsent} onConfirm={(input) => void summaryFlow.confirmConsent(input)} />}
      {summaryFlow.active && summaryFlow.mode === 'player' && <SummaryStoryPlayer initialPage={nextReadablePage(summaryFlow.active)} onClose={() => summaryFlow.setMode('archive')} onEdit={() => summaryFlow.setMode('editor')} onProgress={summaryFlow.saveProgress} onReflect={() => summaryFlow.setMode('reflection')} summary={summaryFlow.active} />}
      {summaryFlow.active && summaryFlow.mode === 'editor' && <SummaryStoryEditor
        onClose={() => summaryFlow.setMode('player')}
        onRegenerate={summaryFlow.regenerate}
        onReorder={summaryFlow.reorderPage}
        onSavePage={(pageId, input) => summaryFlow.savePage(pageId, { narration: input.narration, payload: input.payload })}
        summary={summaryFlow.active}
      />}
      {summaryFlow.active && summaryFlow.mode === 'reflection' && <SummaryReflectionEditor initialText={summaryFlow.active.reflection?.text ?? ''} onCancel={() => summaryFlow.setMode('player')} onSave={summaryFlow.saveReflection} summary={summaryFlow.active} />}
      <Toast message={toast} />
    </div>
  );
}

type SummaryConsentInput = Pick<SummaryPreference, 'allowText' | 'allowPhotos' | 'allowCloudAi'> & { reviewed: true };

export function SummaryConsentDialog({ onConfirm, onCancel }: { onConfirm: (input: SummaryConsentInput) => void; onCancel: () => void }) {
  const [allowText, setAllowText] = useState(true);
  const [allowPhotos, setAllowPhotos] = useState(true);
  const [allowCloudAi, setAllowCloudAi] = useState(false);
  return (
    <div className="modal-backdrop summary-consent-backdrop" role="presentation">
      <section aria-labelledby="summary-consent-title" aria-modal="true" className="summary-consent-dialog" role="dialog">
        <span className="eyebrow">BEFORE YOUR FIRST FILM</span>
        <h2 id="summary-consent-title">生成总结前，请先确认授权</h2>
        <p>总结只读取你允许的本地记忆。关闭文字或照片后，对应内容不会进入快照，也不会发送给云端 AI。</p>
        <div className="summary-consent-options">
          <label><span><strong>允许使用文字</strong><small>标题和备忘录会用于挑选代表片段与撰写旁白</small></span><input checked={allowText} onChange={(event) => setAllowText(event.target.checked)} type="checkbox" /></label>
          <label><span><strong>允许使用照片</strong><small>代表照片会用于情绪电影画面</small></span><input checked={allowPhotos} onChange={(event) => setAllowPhotos(event.target.checked)} type="checkbox" /></label>
          <label><span><strong>使用云端 AI</strong><small>仅发送以上授权范围内的结构化事实；关闭时使用本地模板</small></span><input checked={allowCloudAi} onChange={(event) => setAllowCloudAi(event.target.checked)} type="checkbox" /></label>
        </div>
        <div className="dialog-actions"><button onClick={onCancel} type="button">暂不生成</button><button className="primary-button" onClick={() => onConfirm({ reviewed: true, allowText, allowPhotos, allowCloudAi })} type="button">确认并生成</button></div>
      </section>
    </div>
  );
}

const defaultTopics: Topic[] = [
  { id: 'topic-none', name: '无', isNone: true },
  { id: 'topic-love', name: '恋爱' },
  { id: 'topic-exam', name: '考研' },
  { id: 'topic-grad', name: '读研' },
];

const DEFAULT_MOODS = ['开心', '平静', '难过', '焦虑', '感动', '疲惫'];

function Timeline({ memories, imageUrls, onSelect }: { memories: import('./domain/memory').Memory[]; imageUrls: Record<string, string>; onSelect: (id: string) => void }) {
  const groups = memories.reduce<Record<string, typeof memories>>((accumulator, memory) => {
    const day = memory.eventAt.slice(0, 10);
    (accumulator[day] ??= []).push(memory);
    return accumulator;
  }, {});
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">A QUIET WAY BACK</span><h1>时间线</h1><p>按发生的时间，把故事重新串起来。</p></div></div>{memories.length === 0 ? <div className="empty-state"><div className="empty-mark">◷</div><h2>时间线还在等第一段记忆</h2><p>从首页上传一张照片开始吧。</p></div> : <div className="timeline-list">{Object.entries(groups).map(([day, items]) => <div className="timeline-group" key={day}><div className="timeline-date">{formatDay(day)}</div><div className="timeline-items">{items.map((memory) => <MemoryCard imageUrl={imageUrls[memory.id]} key={memory.id} memory={memory} onClick={() => onSelect(memory.id)} />)}</div></div>)}</div>}</section>;
}

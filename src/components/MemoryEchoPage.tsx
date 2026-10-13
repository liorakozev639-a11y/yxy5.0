import { formatDay } from '../domain/date';
import type { Memory } from '../domain/memory';
import type { MemoryEcho } from '../domain/memory-echo';
import type { Topic } from '../domain/topic';
import { MemoryEchoCard } from './MemoryEchoCard';

type MemoryEchoPageProps = {
  today: MemoryEcho[];
  history: MemoryEcho[];
  onBack: () => void;
  onOpen: (memoryId: string) => void;
  onReflect: (echo: MemoryEcho) => void;
  onDismiss: (echo: MemoryEcho) => void;
  onExclude: (memory: Memory) => void;
  onDisableTopic: (topic: Topic) => void;
  onOpenSettings: () => void;
};

export function groupEchoesByDate(echoes: MemoryEcho[]): Array<[string, MemoryEcho[]]> {
  const groups = echoes.reduce<Record<string, MemoryEcho[]>>((result, echo) => {
    (result[echo.echoDate.slice(0, 10)] ??= []).push(echo);
    return result;
  }, {});
  return Object.entries(groups).sort(([left], [right]) => right.localeCompare(left));
}

export function nextEchoIndex(currentIndex: number, echoes: MemoryEcho[]): number {
  const activeIndexes = echoes.map((echo, index) => ({ echo, index })).filter(({ echo }) => echo.status === 'ACTIVE').map(({ index }) => index);
  if (activeIndexes.length === 0) return 0;
  const activePosition = activeIndexes.indexOf(currentIndex);
  return activeIndexes[(activePosition + 1 + activeIndexes.length) % activeIndexes.length];
}

export function MemoryEchoPage({ today, history, onBack, onOpen, onReflect, onDismiss, onExclude, onDisableTopic, onOpenSettings }: MemoryEchoPageProps) {
  const todayEchoes = today.filter((echo) => echo.status === 'ACTIVE').slice(0, 3);
  const todayDate = today[0]?.echoDate.slice(0, 10);
  const historyGroups = groupEchoesByDate(history.filter((echo) => echo.echoDate.slice(0, 10) !== todayDate));
  const hasAnyEcho = todayEchoes.length > 0 || historyGroups.length > 0;
  return (
    <section className="page-section echo-page">
      <div className="page-heading echo-page-heading">
        <div><span className="eyebrow">A MESSAGE FROM YOUR PAST</span><h1>记忆回声</h1><p>旧照片在合适的日子里，轻轻回来看看你。</p></div>
        <div className="page-heading-actions"><button className="secondary-button" onClick={onBack} type="button">返回记忆</button><button className="secondary-button" onClick={onOpenSettings} type="button">回声设置</button></div>
      </div>
      {!hasAnyEcho ? <div className="empty-state echo-empty"><div className="empty-mark">◌</div><h2>过去的记忆还在慢慢积累</h2><p>当记忆保存满 30 天，回声会在合适的日子出现。</p></div> : <>
        {todayEchoes.length > 0 && <div className="echo-today-grid">{todayEchoes.map((echo, index) => <MemoryEchoCard echo={echo} index={index} key={echo.id} onDismiss={onDismiss} onExclude={onExclude} onNext={() => undefined} onOpen={onOpen} onOpenAll={() => undefined} onReflect={onReflect} onDisableTopic={onDisableTopic} total={todayEchoes.length} />)}</div>}
        <section className="echo-history"><div className="echo-section-title"><span className="section-kicker">ARCHIVE</span><h2>最近30天</h2></div>{historyGroups.length === 0 ? <p className="echo-history-empty">最近还没有其他回声。</p> : historyGroups.map(([date, echoes]) => <div className="echo-history-group" key={date}><h3>{formatDay(date)}</h3><div>{echoes.map((echo, index) => <MemoryEchoCard echo={echo} index={index} key={echo.id} onDismiss={onDismiss} onExclude={onExclude} onNext={() => undefined} onOpen={onOpen} onOpenAll={() => undefined} onReflect={onReflect} onDisableTopic={onDisableTopic} sectionLabel="历史回声" showNavigationActions={false} total={echoes.length} />)}</div></div>)}</section>
      </>}
    </section>
  );
}

export function EchoDisabledCard({ onOpenHistory, onOpenSettings }: { onOpenHistory: () => void; onOpenSettings: () => void }) {
  return <section className="home-echo-status"><strong>记忆回声已关闭</strong><p>历史回声仍然保留，你也可以随时重新开启。</p><div className="echo-disabled-actions"><button className="text-button" onClick={onOpenHistory} type="button">查看历史</button><button className="secondary-button" onClick={onOpenSettings} type="button">重新开启</button></div></section>;
}

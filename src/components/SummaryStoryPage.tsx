import type { SummaryStoryPage as StoryPage } from '../domain/memory-summary';

type Props = { page: StoryPage };

type StoryMemory = {
  id: string;
  mediaId?: string;
  imageUrl?: string;
  title?: string;
  note?: string;
  mood?: string;
  eventAt?: string;
  statuses?: string[];
  topics?: string[];
};

export function SummaryStoryPage({ page }: Props) {
  const content = pageContent(page);
  return (
    <article className={`summary-story-page summary-story-${page.pageType.toLowerCase()}`} data-page-type={page.pageType}>
      <div className="summary-story-visual">{content}</div>
      <p className="summary-story-narration">{page.narration}</p>
    </article>
  );
}

function pageContent(page: StoryPage) {
  const payload = page.payload;
  switch (page.pageType) {
    case 'COVER':
      return <div className="summary-story-cover"><span>YOUR EMOTION FILM</span><h1>{text(payload.label) || '你的记忆电影'}</h1><small>向上滑动，慢慢回看</small></div>;
    case 'OVERVIEW':
      return <div className="summary-story-metrics"><Metric label="段记忆" value={number(payload.memoryCount)} /><Metric label="张照片" value={number(payload.photoCount)} /><Metric label="有记录的日子" value={number(payload.recordedDays)} /></div>;
    case 'MOOD': {
      const mood = object(payload.leadMood);
      return <div className="summary-story-mood"><span>这个阶段出现最多的情绪</span><strong>{text(mood?.name) || '继续向前'}</strong>{mood?.count !== undefined && <small>被你记录了 {number(mood.count)} 次</small>}</div>;
    }
    case 'MEMORY':
      return <MemoryGallery memories={selectedMemories(payload)} originalLabel="你当时写下" />;
    case 'QUOTE':
      return <MemoryGallery memories={selectedMemories(payload)} originalLabel="来自你的原文" quote />;
    case 'COPY':
      return <div className="summary-story-copy"><span>你的长期副本</span>{array(payload.copies).map((copy, index) => { const item = object(copy); return <div key={text(item?.id) || index}><strong>{text(item?.name)}</strong><small>{number(item?.memoryCount)} 段新进展</small></div>; })}</div>;
    case 'SEASON':
      return <div className="summary-story-season"><span>SEASON CHAPTER</span><strong>{text(payload.season) || '这一季'}</strong></div>;
    case 'ORDINARY':
      return <RankCloud title="认真生活过的日常" values={payload.topStatuses} />;
    case 'KEYWORD':
      return <RankCloud title="陪你走过的关键词" values={payload.keywords ?? payload.topTopics} />;
    case 'CLOSING':
      return <RankCloud title="这段时间，你在意的事" values={payload.topTopics} />;
    case 'REFLECTION':
      return <div className="summary-story-reflection"><span>ONE MORE THING</span><h2>写给未来的你</h2><p>把看完这段生活后的感受，留成一张回声感言。</p></div>;
    default:
      return <div className="summary-story-generic">这是属于你的真实记忆。</div>;
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function MemoryGallery({ memories, originalLabel, quote = false }: { memories: StoryMemory[]; originalLabel: string; quote?: boolean }) {
  if (!memories.length) return <div className="summary-story-placeholder">照片暂时无法显示，但这一页的故事仍然被保存着。</div>;
  return (
    <div className={`summary-story-memories${quote ? ' is-quote' : ''}`}>
      {memories.map((memory) => (
        <figure key={memory.id}>
          {memory.imageUrl && <img alt={memory.title?.trim() || '记忆照片'} src={memory.imageUrl} />}
          <figcaption>
            {memory.title && <strong>{memory.title}</strong>}
            {memory.note && <><span>{originalLabel}</span><blockquote>{memory.note}</blockquote></>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function RankCloud({ title, values }: { title: string; values: unknown }) {
  const ranks = array(values).map(object).filter(Boolean);
  return <div className="summary-story-ranks"><h2>{title}</h2>{ranks.map((rank, index) => <span key={text(rank?.name) || index}>{text(rank?.name)}{rank?.count !== undefined ? ` · ${number(rank.count)}` : ''}</span>)}</div>;
}

function selectedMemories(payload: Record<string, unknown>): StoryMemory[] {
  const memories = array(payload.memories).map((item) => item as StoryMemory).filter((item) => Boolean(item?.id));
  const selectedMediaId = text(payload.selectedMediaId);
  if (!selectedMediaId) return memories;
  return [...memories].sort((left, right) => Number(right.mediaId === selectedMediaId) - Number(left.mediaId === selectedMediaId));
}

function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function object(value: unknown): Record<string, unknown> | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }

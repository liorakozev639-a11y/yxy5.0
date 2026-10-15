# “记忆寻迹” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有首页搜索与“时间线”合并升级为“记忆寻迹”，支持本地语句解析、组合筛选、稳定分页、错别字模糊搜索和最近 20 条本机历史。

**Architecture:** 浏览器仅把自然语言解析成用户确认过的结构化条件；现有 `MemoriesModule` 通过 `POST /api/memories/search` 查询 PostgreSQL，每次返回 5 条原始记忆。前端复用现有记忆详情与编辑流程，原“时间线”导航直接升级，不建立第二套搜索模块。

**Tech Stack:** React、TypeScript、Vite、Vitest、NestJS、Prisma 6、PostgreSQL、`pg_trgm`、Pillow、python-docx

**Spec:** `docs/superpowers/specs/2026-10-15-memory-search-design.md`

## Global Constraints

- 所有代码、文档和生成物必须保存在 `D:\yxy5.0`，不得写入 C 盘项目目录。
- 不分析照片画面，不调用云端 AI，不上传自然语言原句，不生成经历总结或答案。
- 搜索只读取原始记忆；长期副本、记忆回声、月度总结和年度总结不进入搜索索引。
- 时间、心情、状态、主题和关键词全部执行 AND；心情单选，状态和主题最多各 10 个，关键词最多 5 个。
- 自然语言或关键词总长度最多 100 个字符；每次首次及继续加载均为 5 条。
- 最近 20 条搜索仅保存在当前浏览器，不创建数据库表，不进入任何导出或备份。
- 保持现有 `GET /api/memories` 兼容；应用锁继续覆盖所有寻迹页面和 API。
- 每个任务遵循测试先行；提交前不得跳过对应测试。

## Review Focus

- 上海时区跨日、跨月、跨年及周一边界：Task 1 必须用 UTC 临界时间固定解析结果。
- 自定义标签重名、标签包含关系和标点残留：Task 1 必须验证最长标签优先且未识别文字仍可确认。
- 用户快速连续搜索导致旧响应覆盖新响应：Task 5 必须验证请求序号丢弃过期响应。
- 相同匹配分数和相同发生时间导致重复或漏项：Task 4 必须验证游标包含分数、时间和 ID。
- 历史条件引用已删除主题、图片缺失或后端离线：Task 2、Task 7 和 Task 8 分别固定降级行为，不得显示错误完整结果。

---

## File Structure

### Frontend domain and storage

- Create `src/domain/memory-search.ts`: search contracts, normalization, local exact matching helpers.
- Create `src/domain/memory-query-parser.ts`: Shanghai-time date phrases and known-label parser.
- Create `src/domain/memory-search-state.ts`: request/result reducer and stale-response protection.
- Create `src/storage/memory-search-history.ts`: injected-storage implementation for 20-item local history.

### Frontend data and UI

- Modify `src/repositories/api-memory-repository.ts`: add advanced search call and response mapping.
- Create `src/hooks/use-memory-search.ts`: parser, confirmation, pagination, refresh and history orchestration.
- Create `src/components/MemorySearchInput.tsx`: natural-language and keyword entry.
- Create `src/components/MemorySearchFilters.tsx`: time, mood, status, topic and sort controls.
- Create `src/components/MemorySearchConfirmation.tsx`: recognized-condition confirmation.
- Create `src/components/MemorySearchTimeline.tsx`: month grouping and five-at-a-time continuation.
- Create `src/components/MemorySearchPage.tsx`: complete “记忆寻迹” page states.
- Modify `src/components/HomeView.tsx`: turn the old local search into a navigation entry.
- Modify `src/App.tsx`: replace the inline `Timeline`, wire search state, detail/edit refresh and navigation.
- Modify `src/styles.css`: styles for search controls, condition chips, timeline, errors and responsive states.

### Backend and database

- Modify `server/src/memories/memory.dto.ts`: advanced search DTO and limits.
- Create `server/src/memories/memory-search.types.ts`: service input/output and cursor contracts.
- Create `server/src/memories/memory-search-cursor.ts`: validated base64url cursor codec.
- Create `server/src/memories/memory-search-query.ts`: parameterized exact/relevance/fuzzy SQL builder.
- Create `server/src/memories/memory-search.service.ts`: search, total count, relation hydration and relaxation suggestions.
- Modify `server/src/memories/memories.controller.ts`: expose `POST /api/memories/search`.
- Modify `server/src/memories/memories.module.ts`: register `MemorySearchService`.
- Create `server/prisma/migrations/0007_memory_search_indexes/migration.sql`: trigram extension and search indexes.

### Documentation

- Modify `README.md`, `tools/generate_final_docs.py` and `tools/generate_product_visuals.py`.
- Regenerate the three Word documents, full business flow, product schematic and editable SVG files in `docs/`.

---

### Task 1: Search contracts and local natural-language parser

**Files:**
- Create: `src/domain/memory-search.ts`
- Create: `src/domain/memory-query-parser.ts`
- Test: `src/domain/memory-search.test.ts`
- Test: `src/domain/memory-query-parser.test.ts`

**Interfaces:**
- Produces: `MemorySearchCriteria`, `MemorySearchSort`, `MemorySearchMatchMode`, `ParsedMemorySearch`, `SearchCatalog`, `MemorySearchRequest`, `MemorySearchItem` and `MemorySearchPage`.
- Produces: `parseMemorySearchInput(input: string, catalog: SearchCatalog, now: Date): ParsedMemorySearch`.
- Produces: `normalizeMemorySearchCriteria(criteria: MemorySearchCriteria): MemorySearchCriteria` and `memoryMatchesExactCriteria(memory: Memory, criteria: MemorySearchCriteria): boolean`.

- [ ] **Step 1: Write failing contract and normalization tests**

Assert that normalization trims and deduplicates values, limits keywords to 5, statuses/topics to 10, rejects text over 100 characters, and preserves AND semantics for `memoryMatchesExactCriteria`.

```ts
expect(memoryMatchesExactCriteria(memory, {
  mood: '开心', statusValues: ['学习', '散步'], topicIds: ['topic-exam'], keywords: ['图书馆']
})).toBe(true);
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- --run src/domain/memory-search.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the search contracts and exact local matcher**

Keep this file independent of React and browser storage. Keywords only inspect `title` and `note`; status/topic arrays require every selected value.

- [ ] **Step 4: Write failing parser tests**

Cover explicit dates, today/yesterday, current/previous week, current/previous month, current/previous year and recent N days. Pin Shanghai boundaries with a UTC instant and verify Monday as the first weekday.

```ts
const parsed = parseMemorySearchInput(
  '找上个月考研时开心的图书馆记录',
  { moods: ['开心'], statuses: [], topics: [{ id: 'topic-exam', name: '考研' }] },
  new Date('2026-10-15T02:00:00.000Z'),
);
expect(parsed.criteria).toMatchObject({ mood: '开心', topicIds: ['topic-exam'] });
expect(parsed.pendingKeywords).toEqual(['图书馆']);
```

Also test overlapping custom labels using longest-name-first matching and preserve unknown text instead of guessing.

- [ ] **Step 5: Run parser tests and verify they fail**

Run: `npm test -- --run src/domain/memory-query-parser.test.ts`

Expected: FAIL because `parseMemorySearchInput` is not implemented.

- [ ] **Step 6: Implement the parser**

Recognize only the spec-approved phrases. Remove known prompt boilerplate and standalone particles after extracting labels; return all remaining meaningful text in `pendingKeywords` for user confirmation.

- [ ] **Step 7: Run domain tests and build**

Run: `npm test -- --run src/domain/memory-search.test.ts src/domain/memory-query-parser.test.ts`

Expected: both files PASS.

Run: `npm run build`

Expected: TypeScript and Vite build PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/memory-search.ts src/domain/memory-query-parser.ts src/domain/memory-search.test.ts src/domain/memory-query-parser.test.ts
git commit -m "feat: add local memory search parser"
```

### Task 2: Device-only recent search history

**Files:**
- Create: `src/storage/memory-search-history.ts`
- Test: `src/storage/memory-search-history.test.ts`

**Interfaces:**
- Consumes: `MemorySearchCriteria` from Task 1.
- Produces: `MemorySearchHistoryEntry` and `createMemorySearchHistory(storage: StorageLike)` with `list()`, `save(entry)`, `remove(id)` and `clear()`.

- [ ] **Step 1: Write failing history tests**

Test normalization-based deduplication, most-recent-first order, truncation to 20, single deletion, full clearing, corrupt JSON recovery and invalid/deleted topic detection through `validate(catalog)`.

```ts
for (let index = 0; index < 21; index += 1) history.save(entry(index));
expect(history.list()).toHaveLength(20);
expect(history.list()[0].displayText).toBe('搜索 20');
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- --run src/storage/memory-search-history.test.ts`

Expected: FAIL because the storage module does not exist.

- [ ] **Step 3: Implement injected browser storage**

Use one versioned localStorage key. Store display text plus confirmed criteria only; never call export, backup or server repositories.

- [ ] **Step 4: Run test and verify it passes**

Run: `npm test -- --run src/storage/memory-search-history.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/memory-search-history.ts src/storage/memory-search-history.test.ts
git commit -m "feat: keep recent memory searches on device"
```

### Task 3: Exact advanced search endpoint in the existing MemoriesModule

**Files:**
- Modify: `server/src/memories/memory.dto.ts`
- Create: `server/src/memories/memory-search.types.ts`
- Create: `server/src/memories/memory-search.service.ts`
- Modify: `server/src/memories/memories.controller.ts`
- Modify: `server/src/memories/memories.module.ts`
- Test: `server/test/memory-search.service.spec.ts`
- Modify: `server/test/memories.e2e.spec.ts`
- Modify: `server/test/dto-validation.spec.ts`

**Interfaces:**
- Consumes: existing `PrismaService`, local user ID and current `MemoryView` response fields.
- Produces: `MemorySearchService.search(userId: string, input: MemorySearchInput): Promise<MemorySearchPage>`.
- Produces: `POST /api/memories/search` with page size fixed to 5.

- [ ] **Step 1: Write failing DTO validation tests**

Assert rejection for 101 characters, 6 keywords, 11 statuses, 11 topics, invalid sort/match mode and any page size other than 5. Assert accepted input is transformed without unknown properties.

- [ ] **Step 2: Run DTO tests and verify they fail**

Run: `npm --prefix server test -- --run test/dto-validation.spec.ts`

Expected: FAIL because the search DTO is missing.

- [ ] **Step 3: Add the DTO and service types**

Define exact enums and optional fields from the spec. Do not add a database model for search history.

- [ ] **Step 4: Write failing exact-search service tests**

Test `deletedAt: null`, user scoping, inclusive start/exclusive end dates, exact mood, `hasEvery` statuses, all selected topics, all keywords across title/note, total count and five-item continuation. Include associated long-term copy names in returned search items.

- [ ] **Step 5: Run service tests and verify they fail**

Run: `npm --prefix server test -- --run test/memory-search.service.spec.ts`

Expected: FAIL because `MemorySearchService` is missing.

- [ ] **Step 6: Implement exact structured search with Prisma**

Use Prisma for the initial exact/chronological path. For each topic ID, add its own `AND topics.some` clause; for each keyword, add an `AND` clause containing title-or-note alternatives. Hydrate media, topics and linked long-term copies without changing the existing `GET /api/memories` response contract.

- [ ] **Step 7: Write and run the endpoint test**

Add an e2e test that posts confirmed structured conditions, verifies the local user is used and receives `{ items, total, nextCursor }`.

Run: `npm --prefix server test -- --run test/memories.e2e.spec.ts`

Expected: PASS.

- [ ] **Step 8: Run backend build and focused tests**

Run: `npm --prefix server test -- --run test/dto-validation.spec.ts test/memory-search.service.spec.ts test/memories.e2e.spec.ts`

Run: `npm run server:build`

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/memories server/test/dto-validation.spec.ts server/test/memory-search.service.spec.ts server/test/memories.e2e.spec.ts
git commit -m "feat: add exact memory search endpoint"
```

### Task 4: Stable relevance, fuzzy search, suggestions and indexes

**Files:**
- Create: `server/src/memories/memory-search-cursor.ts`
- Create: `server/src/memories/memory-search-query.ts`
- Modify: `server/src/memories/memory-search.service.ts`
- Create: `server/prisma/migrations/0007_memory_search_indexes/migration.sql`
- Create: `server/test/memory-search-cursor.spec.ts`
- Create: `server/test/memory-search-query.spec.ts`
- Create: `server/test/memory-search-schema.spec.ts`
- Modify: `server/test/memory-search.service.spec.ts`

**Interfaces:**
- Consumes: `MemorySearchInput` and `MemorySearchPage` from Task 3.
- Produces: `encodeMemorySearchCursor(value)` and `decodeMemorySearchCursor(cursor)` using `{ score, eventAt, id }`.
- Produces: parameterized query fragments for exact relevance and confirmed fuzzy mode.

- [ ] **Step 1: Write failing cursor tests**

Verify round trip, rejection of malformed/oversized cursors, and stable ordering when score and event time are identical but IDs differ.

- [ ] **Step 2: Run cursor tests and verify they fail**

Run: `npm --prefix server test -- --run test/memory-search-cursor.spec.ts`

- [ ] **Step 3: Implement the cursor codec**

Decode base64url JSON into a fully validated value; invalid cursors must raise `BadRequestException` rather than reaching SQL.

- [ ] **Step 4: Write failing parameterization and ranking tests**

Verify that title matches rank above note matches, all keywords are required, fuzzy mode uses `similarity`, user input remains in bound parameters, and the ordering tuple is score, event time, ID.

- [ ] **Step 5: Run query tests and verify they fail**

Run: `npm --prefix server test -- --run test/memory-search-query.spec.ts`

- [ ] **Step 6: Implement the parameterized query builder and service integration**

Use `Prisma.sql`/`Prisma.join`; never concatenate user text. Exact mode uses substring matching. `FUZZY` is accepted only when the client explicitly resubmits with that mode. Fetch ordered IDs and totals, then hydrate existing memory relations in the same order.

- [ ] **Step 7: Add relaxation suggestion tests and implementation**

For an empty result only, remove one condition at a time, count results, return at most three positive suggestions, and never return broadened memory rows until the user resubmits.

- [ ] **Step 8: Add and test the migration**

Create `pg_trgm` if absent, trigram GIN indexes for lowercased title and note, and a GIN index for `statuses`. The schema test must assert `CREATE EXTENSION IF NOT EXISTS pg_trgm` and each expected index.

Run: `npm --prefix server test -- --run test/memory-search-cursor.spec.ts test/memory-search-query.spec.ts test/memory-search-schema.spec.ts test/memory-search.service.spec.ts`

Expected: PASS.

- [ ] **Step 9: Validate Prisma and backend build**

Run: `npx --prefix server prisma validate --schema server/prisma/schema.prisma`

Run: `npm run server:build`

Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add server/src/memories server/prisma/migrations/0007_memory_search_indexes server/test/memory-search-*.spec.ts
git commit -m "feat: add ranked and fuzzy memory search"
```

### Task 5: Frontend repository and race-safe search state

**Files:**
- Modify: `src/repositories/api-memory-repository.ts`
- Modify: `src/repositories/api-memory-repository.test.ts`
- Create: `src/domain/memory-search-state.ts`
- Create: `src/domain/memory-search-state.test.ts`
- Create: `src/hooks/use-memory-search.ts`

**Interfaces:**
- Consumes: search contracts from Task 1 and backend response from Tasks 3–4.
- Produces: `ApiMemoryRepository.search(input: MemorySearchRequest): Promise<MemorySearchPage>`.
- Produces: `useMemorySearch({ repository, catalog, history })` with parse, confirm, loadMore, retry, fuzzy, relax, refreshLoadedPages and clear actions.

- [ ] **Step 1: Write failing repository tests**

Assert `POST /api/memories/search`, JSON body contains only confirmed criteria, response maps image/topics/copies, and no natural-language raw input is sent.

- [ ] **Step 2: Run repository tests and verify they fail**

Run: `npm test -- --run src/repositories/api-memory-repository.test.ts`

- [ ] **Step 3: Implement the repository method**

Reuse the existing `ApiClient` and `Memory` mapper. Add optional linked-copy metadata only to search results.

- [ ] **Step 4: Write failing reducer tests**

Cover first page, append page, retry without clearing existing items, deduplication by memory ID, reset on new criteria, no-result suggestions and stale request IDs.

```ts
const next = memorySearchReducer(currentNewQuery, { type: 'loaded', requestId: oldId, page: oldPage });
expect(next).toBe(currentNewQuery);
```

- [ ] **Step 5: Implement reducer and hook orchestration**

The hook owns request IDs and rejects late responses. `refreshLoadedPages(anchorId)` replays the current query for the number of already loaded five-item pages, preserving an anchor ID for scroll restoration.

- [ ] **Step 6: Run focused tests and frontend build**

Run: `npm test -- --run src/repositories/api-memory-repository.test.ts src/domain/memory-search-state.test.ts`

Run: `npm run build`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/api-memory-repository.ts src/repositories/api-memory-repository.test.ts src/domain/memory-search-state.ts src/domain/memory-search-state.test.ts src/hooks/use-memory-search.ts
git commit -m "feat: add memory search client state"
```

### Task 6: Input, filters, confirmation and recent-history UI

**Files:**
- Create: `src/components/MemorySearchInput.tsx`
- Create: `src/components/MemorySearchFilters.tsx`
- Create: `src/components/MemorySearchConfirmation.tsx`
- Create: `src/components/MemorySearchInput.test.tsx`
- Create: `src/components/MemorySearchFilters.test.tsx`
- Create: `src/components/MemorySearchConfirmation.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: parser output, criteria types and hook actions from Tasks 1 and 5.
- Produces: controlled components; no component performs API calls or writes storage directly.

- [ ] **Step 1: Write failing rendering and callback tests**

Assert the natural-language input, advanced filter panel, single mood selection, multi status/topic selection, invalid-history warning, 20-item history controls and confirmation chips. Assert “开始寻迹” is disabled until parsed values are confirmed.

- [ ] **Step 2: Run component tests and verify they fail**

Run: `npm test -- --run src/components/MemorySearchInput.test.tsx src/components/MemorySearchFilters.test.tsx src/components/MemorySearchConfirmation.test.tsx`

- [ ] **Step 3: Implement controlled components**

Keep display text in Chinese. Show supported time examples; do not imply seasons, image recognition or AI understanding.

- [ ] **Step 4: Add responsive and accessible styles**

Provide visible labels, keyboard-reachable chip removal, focus states and mobile wrapping. Do not duplicate existing global button styles.

- [ ] **Step 5: Run focused tests and build**

Run: `npm test -- --run src/components/MemorySearchInput.test.tsx src/components/MemorySearchFilters.test.tsx src/components/MemorySearchConfirmation.test.tsx`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/MemorySearchInput* src/components/MemorySearchFilters* src/components/MemorySearchConfirmation* src/styles.css
git commit -m "feat: add memory search criteria interface"
```

### Task 7: Narrative result timeline and full search page

**Files:**
- Create: `src/components/MemorySearchTimeline.tsx`
- Create: `src/components/MemorySearchTimeline.test.tsx`
- Create: `src/components/MemorySearchPage.tsx`
- Create: `src/components/MemorySearchPage.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `useMemorySearch` state/actions, existing `MemoryCard`, image URLs and linked-copy metadata.
- Produces: page states for all memories, criteria editing, confirmation, results, no results and load failure.

- [ ] **Step 1: Write failing timeline tests**

Assert month grouping, exact event times on each card, note/tag rendering through existing cards, linked-copy labels without duplicate memories, missing-image placeholder, five-item continuation and “回到顶部”.

- [ ] **Step 2: Run timeline tests and verify they fail**

Run: `npm test -- --run src/components/MemorySearchTimeline.test.tsx`

- [ ] **Step 3: Implement the timeline**

Group by Shanghai calendar month. Use an intersection sentinel to request the next five; retain an explicit retry/load button as an accessible fallback.

- [ ] **Step 4: Write failing page-state tests**

Cover no-condition all-memory state, parsed confirmation, exact empty result, fuzzy confirmation, up to three relaxation suggestions, loading append and retry preserving visible items.

- [ ] **Step 5: Implement `MemorySearchPage`**

Compose Task 6 components and the timeline. Do not call `searchMemories` from `src/domain/memory.ts`.

- [ ] **Step 6: Run focused tests and build**

Run: `npm test -- --run src/components/MemorySearchTimeline.test.tsx src/components/MemorySearchPage.test.tsx`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/MemorySearchTimeline* src/components/MemorySearchPage* src/styles.css
git commit -m "feat: add narrative memory search timeline"
```

### Task 8: Replace duplicate home search and timeline, then preserve detail/edit context

**Files:**
- Modify: `src/components/HomeView.tsx`
- Modify: `src/components/HomeView.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app-navigation.test.ts`
- Modify: `src/app-state.ts` if a refresh token action is required
- Modify: `src/app-state.test.ts` if reducer state changes
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `MemorySearchPage` and `useMemorySearch` from Tasks 5–7.
- Produces: bottom navigation label “记忆寻迹”; homepage query handoff; detail/edit/delete refresh preserving anchor and scroll.

- [ ] **Step 1: Update tests first**

Change navigation expectation from “时间线” to “记忆寻迹”. Assert HomeView calls `onOpenSearch(initialText)` instead of locally filtering memories. Assert the homepage no longer renders a second search-result grid.

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- --run src/app-navigation.test.ts src/components/HomeView.test.tsx`

- [ ] **Step 3: Wire the consolidated navigation**

Remove the inline `Timeline` function and home-level `query` filtering. Keep the existing bottom-nav position and route it to `MemorySearchPage`; carry homepage input as initial parser text.

- [ ] **Step 4: Add failing refresh-context tests**

Pin these cases: closing read-only detail restores the same scroll anchor; saving a still-matching memory updates its card; saving a non-matching memory removes it with a toast; deleting removes it; a refresh failure keeps existing items; offline mode says results may be incomplete rather than claiming completeness; an enabled locked application never renders the search page or recent history.

- [ ] **Step 5: Implement refresh and scroll restoration**

On save/delete, call `refreshLoadedPages(selectedMemoryId)` and restore the nearest surviving anchor after render. Continue using existing `MemoryDetail` and `MemoryForm`; do not create duplicate detail or edit screens.

- [ ] **Step 6: Run all frontend tests and build**

Run: `npm test -- --run`

Run: `npm run build`

Expected: all frontend tests and build PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/app-navigation.test.ts src/app-state.ts src/app-state.test.ts src/components/HomeView.tsx src/components/HomeView.test.tsx src/styles.css
git commit -m "feat: merge timeline into memory search"
```

### Task 9: Database verification, complete documentation and final review

**Files:**
- Modify: `README.md`
- Modify: `tools/generate_final_docs.py`
- Modify: `tools/generate_product_visuals.py`
- Regenerate: `docs/照片记忆本产品需求文档_PRD_V2.docx`
- Regenerate: `docs/照片记忆本前后端技术方案.docx`
- Regenerate: `docs/照片记忆本代码模块说明.docx`
- Regenerate: `docs/照片记忆本业务逻辑流程图.png`
- Regenerate: `docs/照片记忆本业务逻辑流程图.svg`
- Regenerate: `docs/照片记忆本产品示意图.png`
- Regenerate: `docs/照片记忆本产品示意图.svg`

**Interfaces:**
- Consumes: the completed implementation and its verified filenames/interfaces.
- Produces: current product documentation and reproducible visual artifacts.

- [ ] **Step 1: Apply and inspect the real migration**

Run from `server/` against the configured local PostgreSQL database:

`npx prisma migrate deploy`

Expected: migration `0007_memory_search_indexes` applies successfully.

Use PostgreSQL `EXPLAIN ANALYZE` on representative exact, combined-filter and confirmed-fuzzy queries with a 10,000-row fixture. Expected: first 5 metadata rows return within the 1-second target on the user’s normal local environment; record the actual plan and timing in the delivery notes.

- [ ] **Step 2: Run complete automated verification**

Run: `npm test -- --run`

Run: `npm run build`

Run: `npm run server:test`

Run: `npm run server:build`

Working directory: `server/`

Run: `npx prisma validate`

Expected: every command exits 0.

- [ ] **Step 3: Update reproducible documentation sources**

Add “记忆寻迹” to the PRD, frontend/backend architecture, API list, privacy boundary, business flow and code map. Explicitly state that it replaces the former timeline and homepage local search; do not describe it as a fifth parallel module.

- [ ] **Step 4: Update diagrams and product schematic**

Show the flow `首页入口/底部导航 → 本地解析 → 用户确认 → 原始记忆查询 → 月份时间流 → 只读详情 → 主动编辑`. Preserve existing modules and clearly separate active search from memory echo and emotional summaries.

- [ ] **Step 5: Regenerate and visually verify Word and image artifacts**

Run: `python tools/generate_final_docs.py`

Render all three Word documents page by page using the documents workflow. Reject clipped tables, orphan headings, broken Chinese fonts, stale version labels or diagrams that omit “记忆寻迹”. Verify PNG dimensions and parse every SVG as XML.

- [ ] **Step 6: Security and repository review**

Confirm no `.env`, user photos, PostgreSQL dumps, exports, search history or runtime data are tracked. Run `git diff --check` and inspect every changed file.

- [ ] **Step 7: Request independent whole-branch code review**

Reviewer focus: AND semantics, SQL parameterization, cursor stability, privacy/logging, race handling, app-lock coverage, no duplicate old search/timeline, and documentation accuracy. Fix findings and rerun affected tests before completion.

- [ ] **Step 8: Commit the documentation and final fixes**

```bash
git add README.md tools/generate_final_docs.py tools/generate_product_visuals.py docs
git commit -m "docs: document memory search experience"
```

- [ ] **Step 9: Final status and optional push**

Verify `git status --short --branch` is clean. Push to GitHub only when the user has authorized implementation delivery and the complete branch has passed verification; never force-push.

---

## Completion Criteria

- The bottom navigation contains “记忆寻迹” instead of the old “时间线”, with no second search implementation left on the homepage.
- All-memory browsing still works when no criteria are selected.
- Local parsing, confirmation, exact search, user-approved fuzzy search, AND filters, five-item pagination and 20-item local history behave as specified.
- Results show only real original memories and reuse existing read-only detail/edit flows.
- Search history never reaches PostgreSQL, exports, backups, summaries or server logs.
- Existing upload, batch import, long-term copies, echoes, summaries, important days, vault and app lock pass regression tests.
- PostgreSQL migration, complete tests, builds, document rendering and independent review all pass before any completion claim.

# 情绪电影月度/年度总结 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有实时统计式记忆总结升级为可持久化、可编辑、可续播、支持 AI 旁白降级的“情绪电影”月度/年度总结。

**Architecture:** 保留现有 `summary.domain.ts` 的周期统计能力，在 PostgreSQL 中新增总结、总结页面、感言和偏好模型。后端先生成可信快照和候选页面，再通过可替换的 OpenAI-compatible 适配器生成第二人称旁白；AI 缺失、超时或结果不可信时使用本地模板。前端将现有总结页面转为档案馆入口，并新增首页提醒、分页播放器、编辑器和感言卡片。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、NestJS 11、Prisma 6、PostgreSQL、原生 `fetch`（OpenAI-compatible Chat Completions API）

**Spec:** `docs/superpowers/specs/2026-10-14-emotional-memory-summary-design.md`

## Global Constraints

- 月度总结按 Asia/Shanghai 自然月生成，年度总结按 Asia/Shanghai 自然年生成。
- 月度旁白和年度旁白统一使用第二人称，不加入背景音乐。
- 用户首次使用云端总结前必须授权；文字、照片开关默认开启但可分别关闭。
- AI 只能改写结构化真实事实，不能新增快照中不存在的经历、日期、数量、主题或情绪。
- 云端不可用、配置缺失或输出无效时必须使用本地模板，不允许生成流程整体失败。
- 少量记录生成 3–4 页精简版；周期内完全没有记忆时不生成总结。
- 同一用户、周期类型和周期键只能存在一份有效总结。
- 用户编辑总结不能修改原始记忆；总结感言作为独立特殊卡片展示，不写入普通 `Memory`。
- 所有代码、迁移、测试和文档只保存在 `D:\yxy5.0`。

## Review Focus

- 月末 23:59:59、跨年和 UTC 时间输入必须落入正确的 Asia/Shanghai 周期；Task 2 的边界测试固定该行为。
- 最高频情绪并列时必须选择最近出现的情绪，无情绪时三个月内不得重复鼓励文案；Task 2 的领域测试固定该行为。
- 首页重复请求或两个并发请求不能创建重复总结；Task 6 的服务集成测试固定数据库唯一性和幂等返回。
- 关闭文字/照片授权、AI 超时、返回非 JSON 或虚构事实时不能泄露数据或保存错误旁白；Task 5 的适配器测试固定该行为。
- 两个页面同时编辑或进度更新乱序时不能静默覆盖较新数据；Task 6 的版本冲突测试固定乐观锁行为。

---

## File Structure

### Database and backend

- `server/prisma/schema.prisma`：新增总结相关枚举、表和 `Memory.summaryExcluded`。
- `server/prisma/migrations/0006_emotional_memory_summaries/migration.sql`：可部署的 PostgreSQL 迁移。
- `server/src/summaries/summary-story.types.ts`：后端快照、页面、生成结果和 API 共享内部类型。
- `server/src/summaries/summary-story.domain.ts`：纯函数形式的周期键、情绪选择、鼓励文案、候选记忆和页面计划规则。
- `server/src/summaries/summary-copy.ts`：固定中文模板和鼓励文案库。
- `server/src/summaries/summary-snapshot.service.ts`：从 Prisma 读取授权范围内数据并构建冻结快照。
- `server/src/summaries/summary-ai.adapter.ts`：OpenAI-compatible 请求、超时、结构解析和最小数据发送。
- `server/src/summaries/summary-validation.service.ts`：验证 AI 事实引用和页面结构。
- `server/src/summaries/summary-template.service.ts`：生成完全本地的第二人称降级旁白。
- `server/src/summaries/summary.dto.ts`：生成、进度、编辑、感言和偏好 DTO。
- `server/src/summaries/summaries.service.ts`：总结生命周期、幂等生成、重生成、编辑和删除。
- `server/src/summaries/summaries.controller.ts`：REST 接口。
- `server/src/summaries/summaries.module.ts`：注册新服务。
- `server/src/common/config.ts`、`server/.env.example`：AI 服务 URL、密钥、模型和超时配置。

### Frontend

- `src/domain/memory-summary.ts`：替换实时统计类型为总结列表、详情、页面、偏好、状态和感言类型，同时保留旧统计响应兼容类型到迁移结束。
- `src/repositories/api-summary-repository.ts`：总结生命周期全部 API。
- `src/domain/memory.ts`、`src/repositories/api-memory-repository.ts`：暴露 `summaryExcluded` 并提供总结排除设置接口。
- `src/components/SummaryReminderCard.tsx`：首页新总结提醒。
- `src/components/SummaryArchivePage.tsx`：月度/年度档案馆和空状态。
- `src/components/SummaryStoryPlayer.tsx`：分页播放、键盘/滚轮/触控和进度保存。
- `src/components/SummaryStoryPage.tsx`：各页面类型的纯展示。
- `src/components/SummaryStoryEditor.tsx`：旁白、照片和排序编辑。
- `src/components/SummaryReflectionEditor.tsx`：写给未来的自己。
- `src/components/SummaryReflectionCard.tsx`：在记忆模块展示特殊感言卡片。
- `src/components/MemorySummaryPage.tsx`：改为兼容路由容器，逐步委托给档案馆与播放器。
- `src/hooks/use-memory-summaries.ts`：集中管理检查、授权、列表、播放器、编辑和感言异步状态。
- `src/App.tsx`：首页检查、提醒、打开总结、进度、编辑和感言状态编排。
- `src/styles.css`：情绪电影视觉、响应式和减少动效样式。

## Task 1: PostgreSQL 总结模型与迁移

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/0006_emotional_memory_summaries/migration.sql`
- Test: `server/test/summary-schema.spec.ts`

**Interfaces:**
- Produces: Prisma 模型 `MemorySummary`、`MemorySummaryPage`、`SummaryReflection`、`SummaryPreference`；枚举 `SummaryPeriodType`、`SummaryGenerationStatus`、`SummaryGenerationMode`；字段 `Memory.summaryExcluded: boolean`。

- [ ] **Step 1: 写失败的 schema 测试**

在 `summary-schema.spec.ts` 断言 schema 和迁移包含四个新模型、三个枚举、`@@unique([userId, periodType, periodKey])`、页面顺序唯一约束、版本字段、外键删除规则以及 `summaryExcluded Boolean @default(false)`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --prefix server test -- --run test/summary-schema.spec.ts`
Expected: FAIL，提示总结模型或迁移文件不存在。

- [ ] **Step 3: 实现 Prisma 模型和 SQL 迁移**

`MemorySummary` 必须包含 `sourceSnapshot Json`、`sourceHash`、`generationMode`、`isCompact`、`viewedAt`、`lastViewedPage`、`version @default(1)` 和生成时间字段；`MemorySummaryPage` 包含 `pageType`、`displayOrder`、`narration`、`originalNarration`、`payload Json`、`isUserEdited` 和 `version`；`SummaryReflection` 使用可选 `coverMediaId`，不得要求普通 `Memory`；`SummaryPreference` 的文字、照片开关默认 `true`，云端 AI 必须经确认后才能为 `true`。

- [ ] **Step 4: 生成 Prisma Client 并运行测试**

Run: `cd server; npx prisma generate; npm test -- --run test/summary-schema.spec.ts`
Expected: Prisma generate 成功，测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add server/prisma server/test/summary-schema.spec.ts
git commit -m "feat: add persistent memory summary schema"
```

## Task 2: 周期、情绪和页面规划领域规则

**Files:**
- Create: `server/src/summaries/summary-story.types.ts`
- Create: `server/src/summaries/summary-story.domain.ts`
- Create: `server/src/summaries/summary-copy.ts`
- Modify: `server/src/summaries/summary.domain.ts`
- Test: `server/test/summary-story.domain.spec.ts`
- Test: `server/test/summary.domain.spec.ts`

**Interfaces:**
- Produces: `getPreviousPeriod(now, periodType)`、`toPeriodKey(periodType, date)`、`selectLeadMood(memories)`、`selectEncouragement(history, seed)`、`selectRepresentativeMemories(memories, limit)`、`buildStoryPlan(snapshot)`。
- Produces: `SummarySnapshot`、`SummaryPageDraft`、`LeadMoodResult` 类型。

- [ ] **Step 1: 写周期和零记录失败测试**

覆盖北京时间月末、跨年、闰年；断言零记忆返回 `shouldGenerate: false`，1–2 条记忆返回 `isCompact: true` 和 3–4 个页面草稿。

- [ ] **Step 2: 写情绪和鼓励文案失败测试**

断言最高频情绪获选；并列时取 `eventAt` 最近的情绪；无情绪时返回鼓励文案；最近三个月使用过的文案不会再次返回；同一 seed 结果稳定。

- [ ] **Step 3: 写代表记忆和混合叙事失败测试**

断言优先完整记忆、尽量跨日期、跳过 `summaryExcluded` 和已删除项，并按时间主线插入情绪页与长期副本页。

- [ ] **Step 4: 运行测试并确认失败**

Run: `npm --prefix server test -- --run test/summary-story.domain.spec.ts test/summary.domain.spec.ts`
Expected: FAIL，提示新领域函数不存在。

- [ ] **Step 5: 实现最小纯函数**

鼓励文案库不少于 12 条；正常月度计划 5–7 页，正常年度计划 10–14 页；页面草稿只保存事实引用和模板键，不调用数据库或网络。

- [ ] **Step 6: 运行领域测试**

Run: `npm --prefix server test -- --run test/summary-story.domain.spec.ts test/summary.domain.spec.ts`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add server/src/summaries server/test/summary-story.domain.spec.ts server/test/summary.domain.spec.ts
git commit -m "feat: add emotional summary story rules"
```

## Task 3: 总结授权偏好 API

**Files:**
- Create: `server/src/summaries/summary.dto.ts`
- Modify: `server/src/summaries/summaries.service.ts`
- Modify: `server/src/summaries/summaries.controller.ts`
- Modify: `server/src/summaries/summaries.module.ts`
- Test: `server/test/summary-preferences.service.spec.ts`
- Test: `server/test/summary-preferences.e2e.spec.ts`

**Interfaces:**
- Produces: `SummariesService.getPreferences(userId)`、`updatePreferences(userId, input)`。
- Produces endpoints: `GET /summaries/preferences`、`PATCH /summaries/preferences`。
- Consumes: Task 1 的 `SummaryPreference`。

- [ ] **Step 1: 写失败的服务和 DTO 验证测试**

断言默认返回 `allowText: true`、`allowPhotos: true`、`allowCloudAi: false`；仅接受布尔值；用户显式确认后才允许开启云端 AI。

- [ ] **Step 2: 写失败的 e2e 测试**

断言读取、更新和再次读取保持一致；响应不包含密钥或模型配置。

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm --prefix server test -- --run test/summary-preferences.service.spec.ts test/summary-preferences.e2e.spec.ts`
Expected: FAIL，接口不存在。

- [ ] **Step 4: 实现偏好服务、DTO 和接口**

使用 Prisma `upsert` 保存本地用户偏好；控制器路径必须放在 `:id` 动态路径之前，避免把 `preferences` 误识别为总结 ID。

- [ ] **Step 5: 运行测试**

Run: `npm --prefix server test -- --run test/summary-preferences.service.spec.ts test/summary-preferences.e2e.spec.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add server/src/summaries server/test/summary-preferences*
git commit -m "feat: add summary privacy preferences"
```

## Task 4: 可信快照和本地模板生成

**Files:**
- Create: `server/src/summaries/summary-snapshot.service.ts`
- Create: `server/src/summaries/summary-template.service.ts`
- Modify: `server/src/summaries/summaries.module.ts`
- Test: `server/test/summary-snapshot.service.spec.ts`
- Test: `server/test/summary-template.service.spec.ts`

**Interfaces:**
- Produces: `SummarySnapshotService.create(userId, periodType, periodKey, preference): Promise<SummarySnapshot | null>`。
- Produces: `SummaryTemplateService.generate(snapshot, pageDrafts): SummaryPageDraft[]`，每页包含最终第二人称 `narration`。
- Consumes: Task 2 的领域函数和 Task 3 的偏好。

- [ ] **Step 1: 写快照失败测试**

断言只查询周期内、未删除、未排除的记忆；关闭文字时快照不包含标题与备忘录；关闭照片时不包含可发送的图片引用；长期副本计数只覆盖当前周期。

- [ ] **Step 2: 写模板失败测试**

断言旁白使用第二人称；最高频情绪按 Task 2 结果出现；无情绪时使用选定鼓励文案；精简版没有空排行或虚构结论。

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm --prefix server test -- --run test/summary-snapshot.service.spec.ts test/summary-template.service.spec.ts`
Expected: FAIL，服务不存在。

- [ ] **Step 4: 实现快照和模板服务**

快照写入前生成稳定 `sourceHash`；关闭文字后，快照和最终页面都不保存标题或备忘录原文；关闭照片后，快照和最终页面都不保存媒体引用。云端输入只能是该授权后快照的进一步裁剪版本。

- [ ] **Step 5: 运行测试**

Run: `npm --prefix server test -- --run test/summary-snapshot.service.spec.ts test/summary-template.service.spec.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add server/src/summaries server/test/summary-snapshot.service.spec.ts server/test/summary-template.service.spec.ts
git commit -m "feat: build trustworthy summary snapshots"
```

## Task 5: 云端 AI 适配、事实验证和模板降级

**Files:**
- Create: `server/src/summaries/summary-ai.adapter.ts`
- Create: `server/src/summaries/summary-validation.service.ts`
- Modify: `server/src/common/config.ts`
- Modify: `server/.env.example`
- Modify: `server/src/summaries/summaries.module.ts`
- Test: `server/test/summary-ai.adapter.spec.ts`
- Test: `server/test/summary-validation.service.spec.ts`

**Interfaces:**
- Produces: `SummaryAiAdapter.generate(input: SummaryAiInput): Promise<SummaryAiResult>`。
- Produces: `SummaryValidationService.validate(result, snapshot, plan): ValidatedSummaryResult`。
- Consumes environment: `SUMMARY_AI_BASE_URL`、`SUMMARY_AI_API_KEY`、`SUMMARY_AI_MODEL`、`SUMMARY_AI_TIMEOUT_MS`。
- Consumes: Task 4 的 `SummaryTemplateService` 作为降级路径。

- [ ] **Step 1: 写最小数据发送失败测试**

模拟 `fetch` 并断言关闭文字后请求体不包含标题和备忘录，关闭照片后不包含媒体内容；API key 只出现在 Authorization header。

- [ ] **Step 2: 写 AI 异常失败测试**

覆盖配置缺失、超时、HTTP 非 2xx、非 JSON、页面数量不符和未知事实引用；所有情况都必须返回可识别的失败结果供模板降级，不泄漏响应正文到用户错误信息。

- [ ] **Step 3: 写事实验证失败测试**

断言未知记忆 ID、错误统计数字、快照中不存在的情绪或主题被拒绝；只修改旁白且事实引用完整的结果通过。

- [ ] **Step 4: 运行测试并确认失败**

Run: `npm --prefix server test -- --run test/summary-ai.adapter.spec.ts test/summary-validation.service.spec.ts`
Expected: FAIL，适配器和验证器不存在。

- [ ] **Step 5: 实现 OpenAI-compatible 适配器和验证器**

使用原生 `fetch` 和 `AbortController`；请求 `/v1/chat/completions`；要求 JSON object 响应；系统提示明确第二人称、不得新增事实；不得记录 API key、原始照片二进制或完整用户备忘录。

- [ ] **Step 6: 运行测试**

Run: `npm --prefix server test -- --run test/summary-ai.adapter.spec.ts test/summary-validation.service.spec.ts`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add server/src server/.env.example server/test/summary-ai.adapter.spec.ts server/test/summary-validation.service.spec.ts
git commit -m "feat: add safe ai summary narration"
```

## Task 6: 总结生命周期与 REST API

**Files:**
- Modify: `server/src/summaries/summaries.service.ts`
- Modify: `server/src/summaries/summaries.controller.ts`
- Modify: `server/src/summaries/summary.dto.ts`
- Modify: `server/src/summaries/summaries.module.ts`
- Modify: `server/src/memories/memories.service.ts`
- Modify: `server/src/memories/memory.dto.ts`
- Test: `server/test/summaries.service.spec.ts`
- Test: `server/test/summaries.e2e.spec.ts`

**Interfaces:**
- Produces: `checkDue(userId, now)`、`generate(userId, input)`、`list(userId, query)`、`getById(userId, id)`、`updateProgress(userId, id, input)`、`updatePage(userId, summaryId, pageId, input)`、`regenerate(userId, id)`、`saveReflection(userId, id, input)`、`remove(userId, id)`。
- Produces endpoints from spec section 11, with static routes declared before `:id`.
- Produces memory endpoint: `PATCH /memories/:id/summary-setting`，请求体 `{ summaryExcluded: boolean }`。
- Consumes: Tasks 1–5 models and services。

- [ ] **Step 1: 写幂等生成和零记录失败测试**

并发调用相同周期两次只创建一条 `MemorySummary`；零记录返回 `NO_CONTENT` 状态且不创建总结；少量记录保存 `isCompact: true`。

- [ ] **Step 2: 写生命周期失败测试**

覆盖列表、详情、已读、阅读进度、旁白编辑、照片替换、页面排序、重新生成、感言保存和删除；断言所有查询按 `userId` 隔离。

- [ ] **Step 3: 写版本冲突失败测试**

进度和页面编辑 DTO 携带 `version`；旧版本更新返回 409，不能覆盖新版本。

- [ ] **Step 4: 写 e2e 失败测试**

覆盖 `/summaries/check` 到查看详情和保存感言的完整路径；调用 `/memories/:id/summary-setting` 后，断言 `summaryExcluded` 更新且新生成总结不包含该记忆。

- [ ] **Step 5: 运行测试并确认失败**

Run: `npm --prefix server test -- --run test/summaries.service.spec.ts test/summaries.e2e.spec.ts`
Expected: FAIL，生命周期方法或接口不存在。

- [ ] **Step 6: 实现生命周期和 REST API**

生成顺序固定为：创建 `GENERATING` 记录、冻结快照、生成页面计划、尝试 AI、事实验证、必要时模板降级、事务写入页面并标记 `READY`；失败时标记 `FAILED` 且允许重试。

- [ ] **Step 7: 运行总结和记忆服务测试**

Run: `npm --prefix server test -- --run test/summaries.service.spec.ts test/summaries.e2e.spec.ts test/memories.service.spec.ts test/memories.e2e.spec.ts`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add server/src server/test/summaries* server/test/memories*
git commit -m "feat: add memory summary lifecycle api"
```

## Task 7: 前端类型与 API Repository

**Files:**
- Modify: `src/domain/memory-summary.ts`
- Modify: `src/repositories/api-summary-repository.ts`
- Modify: `src/api/client.ts`
- Modify: `src/domain/memory.ts`
- Modify: `src/repositories/api-memory-repository.ts`
- Test: `src/repositories/api-summary-repository.test.ts`
- Test: `src/domain/memory-summary.test.ts`
- Modify: `src/repositories/api-memory-repository.test.ts`

**Interfaces:**
- Produces: `SummaryListItem`、`MemoryStorySummary`、`SummaryStoryPage`、`SummaryPreference`、`SummaryReflection`、`DueSummaryResult`。
- Produces repository methods matching Task 6 endpoints, including optimistic-lock `version` fields。
- Produces: `ApiMemoryRepository.setSummaryExcluded(id, excluded)`，调用 `PATCH /api/memories/:id/summary-setting`。

- [ ] **Step 1: 写 repository 请求失败测试**

断言检查、列表、详情、生成、进度、页面编辑、重生成、感言、删除和偏好方法使用正确路径、HTTP 方法和 JSON body；断言记忆映射保留 `summaryExcluded` 且排除设置调用正确接口。

- [ ] **Step 2: 写前端领域辅助函数失败测试**

新增并测试 `isReadySummary`、`nextReadablePage` 和 `shouldShowDueSummary`，保证失败任务和零记录结果不会显示“总结已生成”。

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm test -- --run src/repositories/api-summary-repository.test.ts src/domain/memory-summary.test.ts`
Expected: FAIL，新接口和类型不存在。

- [ ] **Step 4: 实现类型、辅助函数和 repository**

保持 `ApiClient` 的锁定错误处理；所有更新方法返回服务端最新 `version`。

- [ ] **Step 5: 运行测试**

Run: `npm test -- --run src/repositories/api-summary-repository.test.ts src/domain/memory-summary.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/domain/memory* src/repositories/api-summary-repository* src/repositories/api-memory-repository* src/api/client.ts
git commit -m "feat: add summary story client api"
```

## Task 8: 首页提醒与总结档案馆

**Files:**
- Create: `src/components/SummaryReminderCard.tsx`
- Create: `src/components/SummaryArchivePage.tsx`
- Create: `src/components/SummaryReflectionCard.tsx`
- Modify: `src/components/HomeView.tsx`
- Modify: `src/components/MemorySummaryPage.tsx`
- Test: `src/components/SummaryReminderCard.test.tsx`
- Test: `src/components/SummaryArchivePage.test.tsx`
- Modify: `src/components/MemorySummaryPage.test.tsx`

**Interfaces:**
- Produces: `SummaryReminderCard({ due, onOpen, onLater })`。
- Produces: `SummaryArchivePage({ summaries, reflections, filter, onFilterChange, onOpen, onBack })`。
- Consumes: Task 7 类型。

- [ ] **Step 1: 写提醒卡失败测试**

断言月度和年度文案正确；立即查看与稍后提醒回调正确；没有 `READY` 新总结时不渲染卡片。

- [ ] **Step 2: 写档案馆失败测试**

断言月度/年度筛选、未读标记、空状态、精简版标记和特殊感言卡片；完全没有记忆的周期不显示伪造总结。

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm test -- --run src/components/SummaryReminderCard.test.tsx src/components/SummaryArchivePage.test.tsx src/components/MemorySummaryPage.test.tsx`
Expected: FAIL，新组件不存在或旧页面仍渲染实时报告。

- [ ] **Step 4: 实现提醒卡和档案馆**

保留现有统计页面的可用信息作为总结详情中的数据章节，不保留旧的“每次打开实时生成一份总结”行为。

- [ ] **Step 5: 运行测试**

Run: `npm test -- --run src/components/SummaryReminderCard.test.tsx src/components/SummaryArchivePage.test.tsx src/components/MemorySummaryPage.test.tsx`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/components/Summary* src/components/HomeView.tsx src/components/MemorySummaryPage*
git commit -m "feat: add summary reminders and archive"
```

## Task 9: 情绪电影播放器、编辑器与未来感言

**Files:**
- Create: `src/components/SummaryStoryPage.tsx`
- Create: `src/components/SummaryStoryPlayer.tsx`
- Create: `src/components/SummaryStoryEditor.tsx`
- Create: `src/components/SummaryReflectionEditor.tsx`
- Test: `src/components/SummaryStoryPage.test.tsx`
- Test: `src/components/SummaryStoryPlayer.test.tsx`
- Test: `src/components/SummaryStoryEditor.test.tsx`
- Test: `src/components/SummaryReflectionEditor.test.tsx`

**Interfaces:**
- Produces: `SummaryStoryPlayer({ summary, initialPage, onProgress, onEdit, onClose, onReflect })`。
- Produces: `SummaryStoryEditor({ summary, onSavePage, onReorder, onRegenerate, onClose })`。
- Produces: `SummaryReflectionEditor({ summary, initialText, onSave, onCancel })`。
- Consumes: Task 7 repository payload types。

- [ ] **Step 1: 写页面类型渲染失败测试**

覆盖封面、概览、情绪、代表记忆、长期副本、季节、寄语和未来感言页面；断言所有图片有替代文字，用户原文与旁白可区分。

- [ ] **Step 2: 写播放器失败测试**

断言按钮、方向键、滚轮和触控只移动一页；顶部进度正确；关闭时保存页码；最后一页进入感言；`prefers-reduced-motion` 下不依赖动画。

- [ ] **Step 3: 写编辑器失败测试**

断言修改旁白、替换照片、调整顺序和重新生成确认；旧 `version` 冲突显示重新加载提示而不是覆盖。

- [ ] **Step 4: 写感言失败测试**

断言空文本不保存；保存后返回特殊感言；不创建普通图片记忆。

- [ ] **Step 5: 运行测试并确认失败**

Run: `npm test -- --run src/components/SummaryStoryPage.test.tsx src/components/SummaryStoryPlayer.test.tsx src/components/SummaryStoryEditor.test.tsx src/components/SummaryReflectionEditor.test.tsx`
Expected: FAIL，组件不存在。

- [ ] **Step 6: 实现播放器、编辑器和感言**

播放器保持一屏一个重点；不加入音频元素；动效只使用淡入、轻微推近和文字出现；所有核心操作都有可见按钮，不能只依赖手势。

- [ ] **Step 7: 运行测试**

Run: `npm test -- --run src/components/SummaryStoryPage.test.tsx src/components/SummaryStoryPlayer.test.tsx src/components/SummaryStoryEditor.test.tsx src/components/SummaryReflectionEditor.test.tsx`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/components/SummaryStory* src/components/SummaryReflection*
git commit -m "feat: add emotional summary story player"
```

## Task 10: App 集成、授权流程和响应式样式

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/hooks/use-memory-summaries.ts`
- Create: `src/hooks/use-memory-summaries.test.ts`
- Modify: `src/app-navigation.test.ts`
- Create: `src/summary-app-flow.test.tsx`
- Modify: `src/components/HomeView.test.tsx`

**Interfaces:**
- Consumes: Tasks 7–9 repository 和组件。
- Produces: 首页首次检查、授权弹层、提醒、档案馆、播放器、编辑器和感言的完整用户路径。

- [ ] **Step 1: 写首页检查失败测试**

断言解锁且数据可用后调用一次 `checkDue()`；新总结出现提醒；“稍后提醒”只关闭当前提示，不标记已读；打开后进入正确总结。

- [ ] **Step 2: 写首次授权失败测试**

断言首次生成前显示授权说明；文字和照片默认开启但可单独关闭；未确认时 `allowCloudAi` 保持 false；确认后先保存偏好再生成。

- [ ] **Step 3: 写完整流程失败测试**

模拟“首页提醒 → 播放到中途 → 退出 → 恢复 → 编辑旁白 → 保存未来感言 → 在记忆模块看到特殊感言卡片”。

- [ ] **Step 4: 运行测试并确认失败**

Run: `npm test -- --run src/summary-app-flow.test.tsx src/app-navigation.test.ts src/components/HomeView.test.tsx`
Expected: FAIL，App 尚未集成新流程。

- [ ] **Step 5: 实现 App 状态编排**

将总结相关异步状态集中在 `src/hooks/use-memory-summaries.ts`，避免继续扩大 `App.tsx` 的职责；hook 负责检查、授权、列表、详情、进度、编辑、重生成和感言状态。

- [ ] **Step 6: 实现情绪电影样式**

加入暗色沉浸封面、暖色照片页、进度条、移动端全宽布局、桌面端居中画布和 `@media (prefers-reduced-motion: reduce)`；不得出现内部滚动导致翻页冲突。

- [ ] **Step 7: 运行集成测试**

Run: `npm test -- --run src/summary-app-flow.test.tsx src/app-navigation.test.ts src/components/HomeView.test.tsx src/hooks/use-memory-summaries.test.ts`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/styles.css src/hooks src/summary-app-flow.test.tsx src/app-navigation.test.ts src/components/HomeView.test.tsx
git commit -m "feat: integrate emotional memory summaries"
```

## Task 11: 全量回归、迁移验证与文档同步

**Files:**
- Modify: `README.md`
- Modify: `docs/照片记忆本产品需求文档_PRD_V2.docx`（在全部功能验证后由现有生成脚本更新）
- Modify: `docs/照片记忆本前后端技术方案.docx`（在全部功能验证后由现有生成脚本更新）
- Modify: `tools/generate_final_docs.py`
- Test: existing frontend and backend suites

**Interfaces:**
- Consumes: Tasks 1–10 完整功能。
- Produces: 可部署迁移、通过的全量测试、同步后的 README；Word 文档更新遵循用户此前要求，在功能稳定后统一进行。

- [ ] **Step 1: 在测试数据库验证迁移**

Run: `cd server; npx prisma migrate deploy`
Expected: `0006_emotional_memory_summaries` 成功应用且无 schema drift。

- [ ] **Step 2: 运行后端全量测试和构建**

Run: `npm --prefix server test -- --run`
Expected: 全部 PASS。

Run: `npm --prefix server run build`
Expected: TypeScript 编译成功。

- [ ] **Step 3: 运行前端全量测试和构建**

Run: `npm test -- --run`
Expected: 全部 PASS。

Run: `npm run build`
Expected: TypeScript 和 Vite 构建成功。

- [ ] **Step 4: 执行手工验收**

分别验证有完整记录、只有 1 条记录、没有情绪、关闭文字、关闭照片、AI 不可用、编辑冲突和移动端窄屏场景；确认没有背景音乐、没有双人功能、没有虚构事实。

- [ ] **Step 5: 更新 README 配置说明**

记录四个 `SUMMARY_AI_*` 环境变量、模板降级行为、迁移命令和本地隐私边界；不得写入真实 API key。

- [ ] **Step 6: 更新 PRD 和前后端技术方案生成源并重新生成 Word 文档**

使用现有 `tools/generate_final_docs.py` 的同一文档风格，将情绪电影总结的页面结构、业务逻辑、数据模型、接口、AI 授权和异常降级写入两份正式文档，并完成 DOCX 渲染检查。

- [ ] **Step 7: Commit**

```bash
git add README.md tools/generate_final_docs.py docs
git commit -m "docs: document emotional memory summaries"
```

- [ ] **Step 8: 最终工作区检查**

Run: `git status --short`
Expected: 空输出；如果存在用户原有改动，必须明确列出且不得覆盖。


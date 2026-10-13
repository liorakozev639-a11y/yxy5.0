# 照片记忆本 PostgreSQL MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 React + IndexedDB 网页 MVP 上接入本地 PostgreSQL 后端，实现图片记忆、备忘录、当日状态、当日主题、长期副本和时间线。

**Architecture:** 保留现有 Vite React 前端，新增 NestJS + Prisma 模块化单体后端。PostgreSQL 保存结构化数据，`D:\yxy5.0\data\uploads` 保存图片文件；Vite `/api` 代理到本地 API。MVP 采用固定本地用户，不实现登录和总结 AI。

**Tech Stack:** React, TypeScript, Vite, NestJS, Prisma, PostgreSQL, Multer, Vitest, Supertest, Playwright-ready API boundaries.

**Spec:** `D:\yxy5.0\docs\superpowers\specs\2026-10-12-photo-memory-postgres-mvp-design.md`

## Global Constraints

- 所有项目代码、配置和运行数据路径使用 `D:\yxy5.0`，不新增 C 盘项目文件。
- 一条记忆必须包含一张图片；备忘录可以为空；当日状态和当日主题支持多选。
- 主题决定长期副本关联，状态不参与长期副本关联；主题“无”不参与自动关联。
- 一条记忆可以进入多个长期副本，关联使用联合唯一键保证幂等。
- 长期副本空状态文案固定为“暂无长期副本”，不会未经用户确认自动创建副本。
- MVP 不做登录注册、S3/MinIO、AI 总结、月度/年度总结、阶段总结、通知、分享和多图记忆。
- 保留现有 IndexedDB Repository，不删除浏览器已有数据。
- 每个新增服务行为必须先写失败测试，再写最小实现；最终必须运行完整测试和构建。

## Review Focus

- 图片文件类型或大小非法时，API 应拒绝请求且不产生孤立记忆；由 Task 2 的 MediaService 测试覆盖。
- 同一记忆重复提交时，长期副本关联不重复；由 Task 3 的幂等关联测试覆盖。
- 选择多个主题时，记忆进入每个匹配的 ACTIVE 副本，但不进入 PAUSED/COMPLETED/ARCHIVED 副本；由 Task 3 的状态矩阵测试覆盖。
- 删除记忆后，首页和时间轴都不再显示该记录，但图片和数据库关系不应在请求中被错误删除；由 Task 3 的软删除测试覆盖。
- 后端不可用或请求失败时，前端不应静默清空已有本地状态，表单输入应保留；由 Task 4 的 API 错误和表单测试覆盖。

---

### Task 1: 后端工程骨架与本地 PostgreSQL 配置

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/main.ts`
- Create: `server/src/app.module.ts`
- Create: `server/src/common/config.ts`
- Create: `server/src/common/local-user.ts`
- Create: `server/test/health.e2e-spec.ts`
- Create: `server/.env.example`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces `GET /api/health -> { status: "ok" }`。
- Produces `LOCAL_USER_ID` 配置值，默认值为 `local-user`。
- Produces Vite `/api` 到 `http://localhost:3001` 的代理配置。

- [ ] **Step 1: Write the failing test**

在 `server/test/health.e2e-spec.ts` 写一个测试，启动 Nest testing module，调用 `GET /api/health`，断言响应状态为 200 且 `body.status === "ok"`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix server test -- --runInBand server/test/health.e2e-spec.ts`

Expected: FAIL，因为 `server/` 和 health controller 尚不存在。

- [ ] **Step 3: Implement the minimal server skeleton**

创建 NestJS 应用入口、HealthController、ConfigModule 和本地用户配置；根目录脚本提供 `server:dev`、`server:test`、`server:build`。不要在这一任务加入业务表或上传逻辑。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix server test -- --runInBand server/test/health.e2e-spec.ts`

Expected: PASS，健康接口返回 200。

- [ ] **Step 5: Verify frontend proxy and server build**

Run: `npm run build` and `npm --prefix server run build`

Expected: 两个命令均以退出码 0 完成。

### Task 2: Prisma 数据模型与图片/主题基础服务

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/prisma/seed.ts`
- Create: `server/src/prisma/prisma.module.ts`
- Create: `server/src/prisma/prisma.service.ts`
- Create: `server/src/media/media.module.ts`
- Create: `server/src/media/media.service.ts`
- Create: `server/src/media/media.controller.ts`
- Create: `server/src/topics/topics.module.ts`
- Create: `server/src/topics/topics.service.ts`
- Create: `server/src/topics/topics.controller.ts`
- Create: `server/test/media.service.spec.ts`
- Create: `server/test/topics.service.spec.ts`
- Modify: `server/src/app.module.ts`
- Modify: `server/package.json`
- Modify: `.env.example`

**Interfaces:**
- Produces Prisma models `MediaAsset`, `Memory`, `Topic`, `MemoryTopic`, `LongTermCopy`, `LongTermCopyMemory`。
- Produces `MediaService.createFromUpload(file, userId) -> Promise<MediaAssetView>`。
- Produces `TopicsService.list(userId) -> Promise<TopicView[]>` and `create(userId, input) -> Promise<TopicView>`。
- Produces `POST /api/media`、`GET /api/media/:id/file`、`GET/POST/PATCH/DELETE /api/topics`。

- [ ] **Step 1: Write the failing tests**

为 MediaService 写“拒绝非图片 MIME”“拒绝超过 20MB”“保存合法图片并返回 storagePath”的测试；为 TopicsService 写“同一用户主题名称唯一”和“用户只能读取自己的主题”的测试。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix server test -- --runInBand server/test/media.service.spec.ts server/test/topics.service.spec.ts`

Expected: FAIL，因为 Prisma schema、服务和控制器尚不存在。

- [ ] **Step 3: Implement Prisma schema and services**

在 `schema.prisma` 中实现 `userId` 字段、主题唯一约束、MemoryTopic 和 LongTermCopyMemory 联合唯一约束、软删除字段和时间索引。MediaService 使用随机文件名写入 `D:\yxy5.0\data\uploads`，数据库保存元数据；TopicsService 在所有查询中带 `userId`。

- [ ] **Step 4: Create the migration and seed**

配置 `DATABASE_URL`，运行 `npx prisma migrate dev --name init` 和 `npx prisma db seed`。seed 为 `local-user` 创建预置主题“无”、恋爱、考研、读研等基础主题，重复运行不产生重复主题。

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix server test -- --runInBand server/test/media.service.spec.ts server/test/topics.service.spec.ts`

Expected: PASS；非法文件不落盘，主题越权读取被拒绝。

### Task 3: 记忆、长期副本与时间线 API

**Files:**
- Create: `server/src/memories/memories.module.ts`
- Create: `server/src/memories/memories.service.ts`
- Create: `server/src/memories/memories.controller.ts`
- Create: `server/src/long-term-copies/long-term-copies.module.ts`
- Create: `server/src/long-term-copies/long-term-copies.service.ts`
- Create: `server/src/long-term-copies/long-term-copies.controller.ts`
- Create: `server/test/memories.service.spec.ts`
- Create: `server/test/long-term-copies.service.spec.ts`
- Create: `server/test/memories.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Produces `MemoriesService.create(userId, input) -> Promise<MemoryView>`。
- Produces `MemoriesService.list(userId, filter) -> Promise<{ items: MemoryView[]; nextCursor?: string }>`。
- Produces `LongTermCopiesService.create(userId, input, backfill) -> Promise<LongTermCopyView>`。
- Produces `LongTermCopiesService.timeline(userId, copyId, page) -> Promise<TimelinePage>`。
- Produces `POST/GET/PATCH/DELETE /api/memories`、`GET /api/memories/:id`。
- Produces `GET/POST/PATCH/DELETE /api/long-term-copies` 和 `GET /api/long-term-copies/:id/timeline`。

- [ ] **Step 1: Write the failing domain/service tests**

覆盖以下行为：事件时间保存；`note`、`statuses`、`topics` 均为空时 `isPending === true`；多个主题写入多个 MemoryTopic；创建记忆自动关联所有同主题 ACTIVE 副本；PAUSED、COMPLETED、ARCHIVED 副本不新增；重复创建关联不重复；软删除后列表和时间线过滤；时间线按 `eventAt DESC` 和 cursor 分页。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix server test -- --runInBand server/test/memories.service.spec.ts server/test/long-term-copies.service.spec.ts`

Expected: FAIL，业务服务和 Prisma 查询尚未实现。

- [ ] **Step 3: Implement transaction-safe memory creation**

实现 DTO 校验和 MemoryService。创建、更新 Memory 与 MemoryTopic 使用 Prisma transaction；写入关联时使用 `createMany({ skipDuplicates: true })` 或等价的联合唯一约束保护；所有资源查询带 `local-user` 的归属校验。

- [ ] **Step 4: Implement long-term copy lifecycle and backfill**

实现副本状态枚举 `ACTIVE|PAUSED|COMPLETED|ARCHIVED`、主题归属校验、创建时可选历史回填和时间线查询。GET 空列表返回 `[]`，由前端负责展示“暂无长期副本”。

- [ ] **Step 5: Run service tests and API tests**

Run: `npm --prefix server test -- --runInBand server/test/memories.service.spec.ts server/test/long-term-copies.service.spec.ts server/test/memories.e2e-spec.ts`

Expected: PASS，覆盖记忆完整字段、主题多选、副本状态和时间轴分页。

### Task 4: 前端 API Repository 与记忆表单改造

**Files:**
- Create: `src/api/client.ts`
- Create: `src/repositories/api-memory-repository.ts`
- Create: `src/repositories/api-topic-repository.ts`
- Create: `src/domain/topic.ts`
- Modify: `src/domain/memory.ts`
- Modify: `src/components/MemoryForm.tsx`
- Modify: `src/components/HomeView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/api/client.test.ts`
- Create: `src/repositories/api-memory-repository.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces `ApiClient.request<T>(path, init?) -> Promise<T>`，统一处理 JSON 错误和网络错误。
- Produces `ApiMemoryRepository` 的 `getAll/list/get/put/remove` 方法，供 App 使用。
- `Memory` 新增 `mediaId` 和 `topicIds`；保留现有 `imageBlob` 字段作为本地兼容类型，但 API 主流程使用 `mediaId` 和 `imageUrl`。
- `MemoryForm` 的 `onSave` 先上传图片再提交记忆；新增 `topics` 多选和自定义主题入口。

- [ ] **Step 1: Write the failing frontend tests**

测试 ApiClient：非 2xx 返回结构化错误；测试 ApiMemoryRepository：`getAll` 将 API 响应映射为 MemoryView；测试 MemoryForm 的领域转换：多状态、多主题和上传失败时保留表单值。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/api/client.test.ts src/repositories/api-memory-repository.test.ts`

Expected: FAIL，因为 API client 和 repository 尚不存在。

- [ ] **Step 3: Implement API client and repositories**

新增 `fetch` 封装、请求超时和错误映射；实现 multipart 图片上传、创建/编辑记忆和主题读取。保留 IndexedDB repository，不删除或清空现有本地数据。

- [ ] **Step 4: Update MemoryForm and App wiring**

把保存流程改为“上传图片 → 创建记忆”；编辑已有记忆时没有新文件则复用原 `mediaId`。App 从 API 加载主数据，API 失败显示错误状态而不覆盖现有内存状态；图片展示使用后端文件 URL。

- [ ] **Step 5: Run frontend tests and build**

Run: `npm test -- --run src/api/client.test.ts src/repositories/api-memory-repository.test.ts src/domain/memory.test.ts` and `npm run build`

Expected: 新增测试和原有领域测试 PASS，前端构建退出码为 0。

### Task 5: 长期副本页面、端到端联调与最终验收

**Files:**
- Create: `src/repositories/api-long-term-copy-repository.ts`
- Create: `src/components/LongTermCopiesView.tsx`
- Create: `src/components/LongTermCopyForm.tsx`
- Create: `src/components/LongTermCopyTimeline.tsx`
- Create: `src/repositories/api-long-term-copy-repository.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces `ApiLongTermCopyRepository.list/create/update/remove/timeline/backfill`。
- `LongTermCopiesView` 接收 `copies`、`onCreate`、`onSelect`，空数组渲染固定文案“暂无长期副本”。
- `LongTermCopyTimeline` 接收 `copyId`，按 cursor 追加节点，节点展示图片、时间、备忘录、状态和主题。

- [ ] **Step 1: Write the failing component/repository tests**

测试空数组显示“暂无长期副本”；测试副本创建请求包含 `name/topicId/startDate/lifecycleStatus`；测试时间线响应映射为节点并能够追加 `nextCursor`。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/repositories/api-long-term-copy-repository.test.ts`

Expected: FAIL，因为长期副本 repository 和页面尚不存在。

- [ ] **Step 3: Implement the long-term copy UI**

新增导航入口、列表、创建表单、生命周期状态展示和时间轴页面。主题选择只保存 topicId；不增加状态到长期副本模型。创建成功后刷新列表，并允许用户选择是否回填历史同主题记忆。

- [ ] **Step 4: Run frontend and backend integration checks**

启动 PostgreSQL 和 NestJS API，运行 Prisma migration；另一个终端运行 Vite。手动验证：上传图片 → 保存记忆 → 选择多个主题 → 创建对应副本 → 查看时间线 → 重复提交不产生重复节点。

- [ ] **Step 5: Run the full verification suite**

Run: `npm test -- --run`, `npm run build`, `npm --prefix server test -- --runInBand` and `npm --prefix server run build`

Expected: 前端和后端测试均无失败，两个构建命令均以退出码 0 完成；若 PostgreSQL 未启动，必须明确报告数据库联调未完成，不能声称 MVP 已验收。


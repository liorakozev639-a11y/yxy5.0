# 记忆回声 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为照片记忆本增加每日稳定生成、最近三十天可回看、可写独立感言且由用户主动控制的“记忆回声”，完成本地与 GitHub 提交。

**Architecture:** NestJS 新增独立 `echoes` 模块，领域层以纯函数完成候选过滤、里程碑判断、评分和主题多样性排序，Prisma 用回声快照保证每日结果稳定。React 通过独立 Repository 获取回声，在首页展示第一条、独立页面展示当天最多三条及最近三十天记录；回声设置与原记忆、长期副本状态解耦。

**Tech Stack:** React、TypeScript、Vite、Vitest、NestJS、Prisma 6、PostgreSQL、Node.js 24。

**Spec:** `D:\yxy5.0\docs\superpowers\specs\2026-10-13-memory-echo-data-vault-design.md`

## Global Constraints

- 项目源代码和项目数据只写入 `D:\yxy5.0`；不在 C 盘创建项目副本。
- 用户时区固定按 `Asia/Shanghai` 计算自然日。
- 每天最多生成三条回声；首页只展示第一条；同一天重复请求结果不变。
- 只有至少三十天前、未删除且未被排除的记忆可进入候选池。
- 最近三十天已经正式展示的同一记忆不重复推荐。
- 用户对负面心情、主题和单条记忆的排除必须是主动操作，系统不自动判断敏感内容。
- 回声感言独立保存，不修改原备忘录，也不创建新照片记忆。
- 本阶段只实现记忆回声；数据保险箱、最终 PRD、最终技术方案、最终流程图和最终产品示意图在后续阶段统一完成。
- `.env`、用户照片、数据库内容、备份、导出文件、依赖和构建产物不得提交 Git。

## Review Focus

- 上海时区零点附近的两个并发请求必须返回同一批快照，不得生成重复序号。
- 2 月 29 日记忆在非闰年不得错误命中“往年今日”，闰年应正确命中。
- 同一记忆同时命中往年今日和里程碑时，只生成得分最高的一条回声。
- 用户关闭某主题或排除某心情后，已有历史回声仍可查看，但之后不再生成新回声。
- 原记忆删除或照片缺失时，历史回声接口不得导致整个页面失败，应返回可显示的缺失状态或过滤该快照。

---

### Task 1: 初始化安全的 Git 工作区

**Files:**
- Create: `D:\yxy5.0\.gitignore`
- Inspect: `D:\yxy5.0\server\.env`
- Inspect: `D:\yxy5.0\data\`

**Interfaces:**
- Consumes: 当前未初始化 Git 的完整项目目录。
- Produces: 已初始化但暂不提交的 `main` 工作区；记忆回声完成并通过全量测试后再统一创建第一次本地提交。

- [ ] **Step 1: 写入隐私优先的 `.gitignore`**

至少排除：

```gitignore
node_modules/
dist/
coverage/
*.tsbuildinfo
.env
.env.*
!.env.example
data/uploads/
data/backups/
data/exports/
data/temp/
*.log
tools/__pycache__/
docs/_rendered/
```

- [ ] **Step 2: 初始化仓库并验证忽略规则**

Run: `git init -b main`  
Run: `git status --short --ignored`  
Expected: `.env`、`node_modules`、`data/uploads` 和所有运行数据只显示为 ignored，不进入待提交列表。

- [ ] **Step 3: 对待提交文件做敏感信息扫描**

Run: `git ls-files --others --exclude-standard | rg -n "(^|\\)(\.env|node_modules|data\\uploads|data\\backups|data\\exports)(\\|$)"`  
Expected: 无输出。

- [ ] **Step 4: 暂存基线但不提交**

```powershell
git add .
git status --short
```

Expected: 仅源代码、迁移、测试、文档和安全配置进入暂存区；记忆回声完成并通过 Task 7 全量测试前不创建提交。

### Task 2: 扩展 Prisma 回声数据模型

**Files:**
- Modify: `D:\yxy5.0\server\prisma\schema.prisma`
- Create: `D:\yxy5.0\server\prisma\migrations\0003_memory_echo\migration.sql`
- Test: `D:\yxy5.0\server\test\echo-schema.spec.ts`

**Interfaces:**
- Consumes: 现有 `Memory`、`Topic`、`LongTermCopy` 模型。
- Produces: `EchoType`、`EchoStatus`、`MemoryEcho`、`EchoReflection`、`EchoPreference` Prisma 类型，以及 `Memory.echoExcluded`、`Topic.echoEnabled`。

- [ ] **Step 1: 写失败的 schema 契约测试**

测试读取 `schema.prisma` 并断言：

```ts
expect(schema).toContain('echoExcluded Boolean');
expect(schema).toContain('echoEnabled Boolean');
expect(schema).toContain('model MemoryEcho');
expect(schema).toContain('@@unique([userId, echoDate, memoryId])');
expect(schema).toContain('model EchoReflection');
expect(schema).toContain('model EchoPreference');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm --prefix server test -- --run test/echo-schema.spec.ts`  
Expected: FAIL，提示 `MemoryEcho` 或新增字段不存在。

- [ ] **Step 3: 修改 Prisma schema 和迁移**

精确约束：

- `Memory.echoExcluded Boolean @default(false)`。
- `Topic.echoEnabled Boolean @default(true)`。
- `MemoryEcho.echoDate DateTime @db.Date`。
- `MemoryEcho` 同一用户/日期/记忆唯一，同一用户/日期/展示序号唯一。
- `EchoReflection.memoryEchoId` 唯一，一条来源回声只有一条可编辑感言。
- `EchoPreference.userId` 为主键，`enabled` 默认 true，`excludedMoods` 默认空数组。
- 所有回声关系删除策略必须保留数据一致性；删除快照时不级联删除原记忆。

- [ ] **Step 4: 生成客户端并验证迁移**

Run: `npx prisma validate --schema server/prisma/schema.prisma`  
Run: `npx prisma generate --schema server/prisma/schema.prisma`  
Run: `npm --prefix server test -- --run test/echo-schema.spec.ts`  
Expected: schema valid，测试 PASS。

- [ ] **Step 5: 保留变更等待统一提交**

```powershell
git add server/prisma server/test/echo-schema.spec.ts
git status --short
```

### Task 3: 实现回声评分纯函数

**Files:**
- Create: `D:\yxy5.0\server\src\echoes\echo-ranking.ts`
- Test: `D:\yxy5.0\server\test\echo-ranking.spec.ts`

**Interfaces:**
- Consumes: `EchoCandidateInput`，包含记忆、主题、长期副本、近三十天展示 ID、偏好和 `today`。
- Produces: `rankEchoCandidates(input: RankEchoInput): RankedEcho[]`，按稳定顺序返回最多三条。

- [ ] **Step 1: 写回声规则失败测试**

至少固定以下断言：

```ts
expect(rankEchoCandidates(onThisDayInput)[0]).toMatchObject({ type: 'ON_THIS_DAY', score: 100 });
expect(rankEchoCandidates(anniversaryInput)[0]).toMatchObject({ type: 'COPY_ANNIVERSARY', score: 95 });
expect(rankEchoCandidates(day100Input)[0]).toMatchObject({ type: 'COPY_MILESTONE', score: 90 });
expect(rankEchoCandidates(copyFirstInput)[0]).toMatchObject({ type: 'COPY_FIRST', score: 80 });
expect(rankEchoCandidates(pastAndNowInput)[0]).toMatchObject({ type: 'PAST_AND_NOW', score: 75 });
expect(rankEchoCandidates(multiMatchInput)).toHaveLength(1);
expect(rankEchoCandidates(recentlyShownInput)).toEqual([]);
expect(rankEchoCandidates(excludedMoodInput)).toEqual([]);
expect(rankEchoCandidates(mixedTopicsInput).map((item) => item.topicId)).toEqual(['topic-a', 'topic-b', 'topic-c']);
```

另加 2 月 29 日、正好 29/30 天、没有主题和不足三条候选的边界测试。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm --prefix server test -- --run test/echo-ranking.spec.ts`  
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现领域类型和纯函数**

实现：

- `toShanghaiDateKey(date: Date): string`
- `daysBetweenShanghai(from: Date, to: Date): number`
- `classifyEcho(candidate: EchoCandidate, today: Date): EchoMatch | undefined`
- `rankEchoCandidates(input: RankEchoInput): RankedEcho[]`

稳定次序：得分降序 → 发生时间升序 → 记忆 ID 升序。主题多样性优先选每个主题的第一条，再用剩余候选补足三条。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm --prefix server test -- --run test/echo-ranking.spec.ts`  
Expected: PASS。

- [ ] **Step 5: 暂存领域规则**

```powershell
git add server/src/echoes/echo-ranking.ts server/test/echo-ranking.spec.ts
git status --short
```

### Task 4: 实现回声服务与 REST API

**Files:**
- Create: `D:\yxy5.0\server\src\echoes\echoes.module.ts`
- Create: `D:\yxy5.0\server\src\echoes\echoes.controller.ts`
- Create: `D:\yxy5.0\server\src\echoes\echoes.service.ts`
- Create: `D:\yxy5.0\server\src\echoes\echo.dto.ts`
- Modify: `D:\yxy5.0\server\src\app.module.ts`
- Modify: `D:\yxy5.0\server\src\memories\memories.service.ts`
- Modify: `D:\yxy5.0\server\src\memories\memories.controller.ts`
- Modify: `D:\yxy5.0\server\src\topics\topics.service.ts`
- Modify: `D:\yxy5.0\server\src\topics\topics.controller.ts`
- Modify: `D:\yxy5.0\server\src\topics\topic.dto.ts`
- Test: `D:\yxy5.0\server\test\echoes.service.spec.ts`
- Test: `D:\yxy5.0\server\test\echoes.e2e.spec.ts`
- Test: `D:\yxy5.0\server\test\dto-validation.spec.ts`

**Interfaces:**
- Consumes: `rankEchoCandidates()` 与 Prisma 回声模型。
- Produces: `GET /api/echoes/today`、`GET /api/echoes?days=30`、`PUT /api/echoes/:id/reflection`、`POST /api/echoes/:id/dismiss`、记忆/主题回声设置和回声偏好接口。

- [ ] **Step 1: 写服务和 E2E 失败测试**

固定以下行为：

```ts
expect(await service.today(userId, now)).toHaveLength(3);
expect(await service.today(userId, now)).toEqual(await service.today(userId, now));
expect(await service.list(userId, 30)).toEqual(expect.arrayContaining([expect.objectContaining({ reason: expect.any(String) })]));
expect(await service.upsertReflection(userId, echoId, '现在的我更从容了')).toMatchObject({ text: '现在的我更从容了' });
```

E2E 断言非法 `days=31` 返回 400、2001 字感言返回 400、他人或不存在 ID 返回 404。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm --prefix server test -- --run test/echoes.service.spec.ts test/echoes.e2e.spec.ts test/dto-validation.spec.ts`  
Expected: FAIL，EchoesModule 或路由不存在。

- [ ] **Step 3: 实现 `EchoesService.today(userId: string, now?: Date)`**

步骤必须是：读取当日快照 → 若存在直接返回 → 读取偏好和候选 → 评分 → 事务创建最多三条 → 捕获 Prisma `P2002` 并重新读取。不得先删除再重建当天快照。

- [ ] **Step 4: 实现列表、感言、跳过和偏好更新**

- `list(userId, days)` 只允许 1–30。
- `upsertReflection` 限制 1–2000 字。
- `dismiss` 只修改当前快照状态。
- 单条记忆排除更新 `Memory.echoExcluded`。
- 主题关闭更新 `Topic.echoEnabled`。
- 历史快照查询不因偏好后来变化而消失，但原记忆软删除时返回 `memoryAvailable: false`。

- [ ] **Step 5: 注册控制器与 DTO**

DTO 使用 `class-validator`；控制器始终使用 `LOCAL_USER_ID`。返回结构统一包含：

```ts
type EchoView = {
  id: string;
  echoDate: string;
  type: EchoType;
  reason: string;
  displayOrder: number;
  status: 'ACTIVE' | 'DISMISSED';
  memoryAvailable: boolean;
  memory?: MemoryView;
  reflection?: { id: string; text: string; updatedAt: string };
};
```

- [ ] **Step 6: 运行回声与全部后端测试**

Run: `npm --prefix server test -- --run`  
Run: `npm --prefix server run build`  
Expected: 全部 PASS，TypeScript 编译成功。

- [ ] **Step 7: 暂存后端回声模块**

```powershell
git add server/src server/test
git status --short
```

### Task 5: 实现前端回声 Repository 与领域映射

**Files:**
- Create: `D:\yxy5.0\src\domain\memory-echo.ts`
- Create: `D:\yxy5.0\src\repositories\api-memory-echo-repository.ts`
- Create: `D:\yxy5.0\src\repositories\api-memory-echo-repository.test.ts`
- Modify: `D:\yxy5.0\src\domain\memory.ts`
- Modify: `D:\yxy5.0\src\domain\topic.ts`
- Modify: `D:\yxy5.0\src\repositories\api-memory-repository.ts`
- Modify: `D:\yxy5.0\src\repositories\api-topic-repository.ts`

**Interfaces:**
- Consumes: Task 4 的 REST 返回结构。
- Produces: `ApiMemoryEchoRepository`，供首页、独立页面和设置面板使用。

- [ ] **Step 1: 写 Repository 失败测试**

```ts
await repository.today();
expect(request).toHaveBeenCalledWith('/api/echoes/today');
await repository.list(30);
expect(request).toHaveBeenCalledWith('/api/echoes?days=30');
await repository.saveReflection('echo-1', '新的感受');
expect(request).toHaveBeenCalledWith('/api/echoes/echo-1/reflection', expect.objectContaining({ method: 'PUT' }));
```

同时测试 dismiss、更新总开关、排除心情、排除单条记忆和关闭主题。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/repositories/api-memory-echo-repository.test.ts`  
Expected: FAIL，Repository 不存在。

- [ ] **Step 3: 实现类型、映射和 Repository**

所有日期在领域类型中使用 ISO 字符串；`Memory` 新增 `echoExcluded?: boolean`，`Topic` 新增 `echoEnabled?: boolean`。Repository 不缓存当天结果，由 React 状态控制视图轮换。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/repositories/api-memory-echo-repository.test.ts src/repositories/api-memory-repository.test.ts src/repositories/api-topic-repository.test.ts`  
Expected: PASS。

- [ ] **Step 5: 暂存前端数据层**

```powershell
git add src/domain src/repositories
git status --short
```

### Task 6: 实现首页回声卡片和独立页面

**Files:**
- Create: `D:\yxy5.0\src\components\MemoryEchoCard.tsx`
- Create: `D:\yxy5.0\src\components\MemoryEchoCard.test.tsx`
- Create: `D:\yxy5.0\src\components\MemoryEchoPage.tsx`
- Create: `D:\yxy5.0\src\components\MemoryEchoPage.test.tsx`
- Create: `D:\yxy5.0\src\components\EchoReflectionEditor.tsx`
- Create: `D:\yxy5.0\src\components\EchoSettingsPanel.tsx`
- Modify: `D:\yxy5.0\src\components\HomeView.tsx`
- Modify: `D:\yxy5.0\src\components\MemoryDetail.tsx`
- Modify: `D:\yxy5.0\src\App.tsx`
- Modify: `D:\yxy5.0\src\styles.css`

**Interfaces:**
- Consumes: `ApiMemoryEchoRepository` 与 `EchoView`。
- Produces: 首页一条回声、独立回声页面、感言编辑器和主动控制设置。

- [ ] **Step 1: 写组件失败测试**

```tsx
expect(renderCard(echo)).toContain('三年前的今天');
expect(renderCard(echo)).toContain('写下感言');
expect(renderEmpty()).toContain('过去的记忆还在慢慢积累');
expect(renderPage([echo1, echo2, echo3])).toContain('最近30天');
expect(renderAppNavigation()).toEqual(['记忆', '时间线', '长期副本', '重要日子']);
```

增加交互测试：换一条只改变当前索引；感言保存失败保留输入；关闭主题前出现确认；无原记忆时显示“原记忆已不可用”。

- [ ] **Step 2: 运行组件测试确认失败**

Run: `npm test -- --run src/components/MemoryEchoCard.test.tsx src/components/MemoryEchoPage.test.tsx`  
Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现 `MemoryEchoCard` 和空状态**

首页卡片展示照片、标题、原始日期、推荐原因、主题标签和主要动作。加载失败使用局部重试，不修改 `state.error`，避免遮挡照片主页面。

- [ ] **Step 4: 实现独立页面和最近三十天分组**

`View` 增加 `'echo'`，但底部导航保持四项不变；只能从首页“查看全部”或回声卡片进入。当天最多三条，历史按 `echoDate` 倒序分组。

- [ ] **Step 5: 实现感言与用户控制**

- 感言编辑上限 2000 字，保存成功后更新当前回声。
- “暂时跳过”切换下一条；全部跳过则展示今日已看完状态。
- 永久排除单条记忆和关闭主题必须二次确认。
- 设置面板支持总开关和多选排除心情。
- `MemoryDetail` 增加回声感言历史区，但没有感言时不占据主要空间。

- [ ] **Step 6: 加入视觉样式和响应式规则**

沿用现有暖白、青绿色设计语言；桌面卡片采用图文双栏，窄屏改为纵向；所有按钮有可见焦点，图片有替代文本，弹窗可通过关闭按钮退出。

- [ ] **Step 7: 运行前端全部测试与构建**

Run: `npm test -- --run`  
Run: `npm run build`  
Expected: 全部 PASS，生产构建成功。

- [ ] **Step 8: 暂存前端回声体验**

```powershell
git add src
git status --short
```

### Task 7: 在真实 PostgreSQL 和浏览器中验收记忆回声

**Files:**
- Modify if needed: `D:\yxy5.0\server\.env.example`
- Evidence only: 不提交真实 `.env`、数据库内容或用户照片。

**Interfaces:**
- Consumes: Tasks 2–6 的完整实现。
- Produces: 可重复的数据库、API、浏览器验收结果。

- [ ] **Step 1: 执行数据库迁移并检查状态**

Run: `npx prisma migrate deploy --schema server/prisma/schema.prisma`  
Run: `npx prisma migrate status --schema server/prisma/schema.prisma`  
Expected: `0003_memory_echo` applied，database schema is up to date。

- [ ] **Step 2: 运行全量自动化验证**

Run: `npm test -- --run`  
Run: `npm --prefix server test -- --run`  
Run: `npm run build`  
Run: `npm --prefix server run build`  
Expected: 全部命令退出码 0。

- [ ] **Step 3: 运行真实 API 冒烟测试**

验证：当天首次请求生成；第二次返回相同 ID；列表不超过三条；保存感言后可读；排除记忆后不再产生新回声；关闭主题不影响原记忆读取。

- [ ] **Step 4: 运行浏览器主流程**

验证：首页出现一条回声 → 换一条 → 查看全部 → 保存感言 → 打开原记忆 → 暂时跳过 → 设置排除心情。确认首页其他功能、批量导入和长期副本仍可使用。

- [ ] **Step 5: 使用验证和代码审查技能完成最终检查**

执行 `superpowers:verification-before-completion` 与 `superpowers:requesting-code-review`；修复审查发现后重新运行受影响测试和四条全量命令。

- [ ] **Step 6: 全量测试通过后创建统一提交**

```powershell
git add .
git commit -m "feat: add photo memory app with memory echoes"
```

该提交同时包含此前已有项目基线与本次记忆回声；提交前必须重新检查 `.env`、照片、依赖、构建产物和运行数据均未进入索引。

### Task 8: 推送记忆回声阶段成果

**Files:**
- Git metadata only.

**Interfaces:**
- Consumes: 已通过验证的本地 `main`。
- Produces: GitHub `main` 与本地提交一致。

- [ ] **Step 1: 再次检查提交内容和隐私边界**

Run: `git status --short`  
Run: `git ls-files | rg "(^|/)(\.env|node_modules|data/uploads|data/backups|data/exports)(/|$)"`  
Expected: 工作区干净；敏感路径无输出。

- [ ] **Step 2: 配置远程仓库**

Run: `git remote add origin https://github.com/liorakozev639-a11y/yxy5.0.git`，若 `origin` 已存在则先读取并确认地址，只有地址错误时才更新。

- [ ] **Step 3: 推送 `main`**

Run: `git push -u origin main`  
Expected: 推送成功。

- [ ] **Step 4: 核对本地与远程提交**

Run: `git rev-parse HEAD`  
Run: `git ls-remote origin refs/heads/main`  
Expected: 两个提交哈希一致。

## 后续阶段顺序

记忆回声完成并推送后，再按已确认规格实施数据保险箱。所有功能完成后最后统一：

1. 更新 `照片记忆本产品需求文档_PRD_V2.docx`，覆盖全部现有功能、记忆回声和数据安全迁移功能。
2. 更新 `照片记忆本前后端技术方案.docx`，覆盖最终前端、后端、数据库、安全、导出恢复与部署方案。
3. 重新生成最终业务逻辑流程图，不沿用仅包含部分功能的草稿。
4. 重新生成最终产品示意图，至少展示首页、照片记忆、长期副本、记忆回声、总结和数据保险箱。
5. 对 Word 文档和图片完成视觉检查后提交并推送。

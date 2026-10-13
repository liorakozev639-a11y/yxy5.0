# 数据保险箱、总结与最终交付 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已上线记忆回声的照片记忆本中，实现月度/年度总结、JSON/PDF/ZIP 导出、安全导入恢复、PostgreSQL 手动备份、应用锁和透明存储信息，并最终更新全部产品文档与视觉交付物。

**Architecture:** NestJS 新增 `summaries`、`vault`、`app-lock` 三个模块；固定 `D:\yxy5.0\data` 为唯一运行数据根目录，领域层负责可测试的导出清单、去重、ZIP 安全和总结统计，服务层负责文件系统、事务、`pg_dump` 和会话。React 新增总结页、数据保险箱页和应用锁门禁，通过独立 Repository 调用后端；最终 Word 文档、流程图和产品示意图从实际实现反向更新。

**Tech Stack:** React、TypeScript、Vite、Vitest、NestJS、Prisma 6、PostgreSQL、Node.js 24、Node `crypto.scrypt`、PDFKit、Archiver、AdmZip、DOCX/PDF 渲染工具。

**Spec:** `D:\yxy5.0\docs\superpowers\specs\2026-10-13-memory-echo-data-vault-design.md`

## Global Constraints

- 项目代码和运行数据只写入 `D:\yxy5.0`；照片、备份、导出、密码摘要、会话和数据库数据不得进入 Git。
- 前端不得提交任意输出路径；后端只在固定 uploads/backups/exports/temp 子目录内生成或读取文件。
- ZIP 导入必须拒绝绝对路径、盘符、`..`、条目超限、大小超限、哈希不符和关系损坏。
- 导入先预览后确认，默认安全合并；冲突生成新 ID，失败回滚数据库并清理临时文件。
- 应用锁使用 `scrypt` 带盐摘要和 HttpOnly、SameSite=Strict Cookie；不保存或返回明文密码。
- 敏感操作必须在已解锁会话基础上再次验证；总开关关闭或锁定不删除现有数据。
- 月度/年度总结使用确定性统计和用户已有内容，不调用外部 AI，不上传照片或文字。
- 最终文档只在全部功能和回归完成后更新，并进行渲染与逐页视觉检查。

## Review Focus

- ZIP Slip、压缩炸弹和伪造 manifest 必须在任何写入前被拒绝，且 temp 目录无残留。
- 两次导入同一迁移包不得复制相同记录；同 ID 内容冲突必须生成副本并重建全部关系。
- 应用锁开启后，绕过前端直接访问业务 API 必须被拒绝；会话过期和手动锁定立即生效。
- `pg_dump` 失败、路径含空格或数据库不可用时，备份记录必须标记失败且不得泄露连接串。
- PDF 中文、照片缺失、零记忆月份和跨年区间仍能生成可读结果，原有记忆功能不受影响。

---

### Task 1: 建立数据保险箱与应用锁数据模型

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/0005_vault_lock_summary/migration.sql`
- Create: `server/test/vault-schema.spec.ts`
- Modify: `server/src/common/config.ts`

**Interfaces:**
- Produces: `AppLockSetting`、`AppSession`、`BackupRecord`、`ImportRecord`；固定 `VaultPaths` 配置。

- [ ] 写 schema 与路径边界失败测试，断言模型、会话唯一哈希、状态字段和四个 D 盘目录。
- [ ] 运行测试确认失败。
- [ ] 实现 Prisma 模型、迁移和 `getVaultPaths(): VaultPaths`，拒绝解析到 `D:\yxy5.0\data` 之外的路径。
- [ ] 验证 Prisma、生成客户端、运行测试和后端构建。

### Task 2: 实现应用锁与服务器会话

**Files:**
- Create: `server/src/app-lock/app-lock.crypto.ts`
- Create: `server/src/app-lock/app-lock.service.ts`
- Create: `server/src/app-lock/app-lock.controller.ts`
- Create: `server/src/app-lock/app-lock.guard.ts`
- Create: `server/src/app-lock/app-lock.module.ts`
- Create: `server/test/app-lock.crypto.spec.ts`
- Create: `server/test/app-lock.service.spec.ts`
- Create: `server/test/app-lock.e2e.spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Produces: `/api/app-lock/status|setup|unlock|verify|lock|settings|recover`；`requireRecentVerification(sessionId)`；全局业务 API 门禁。

- [ ] 写密码不落明文、恢复密钥仅显示一次、5 次失败限流、30 分钟自动锁、Cookie 属性和业务 API 被锁的失败测试。
- [ ] 运行确认失败。
- [ ] 用 `scrypt`、随机 32 字节盐、随机会话令牌摘要实现服务；恢复密钥仅返回一次。
- [ ] 注册全局 Guard，放行 health 与必要 app-lock 路由；敏感操作验证有效期 5 分钟。
- [ ] 运行应用锁组和后端全量测试、构建。

### Task 3: 实现月度与年度总结

**Files:**
- Create: `server/src/summaries/summary.domain.ts`
- Create: `server/src/summaries/summaries.service.ts`
- Create: `server/src/summaries/summaries.controller.ts`
- Create: `server/src/summaries/summaries.module.ts`
- Create: `server/test/summary.domain.spec.ts`
- Create: `src/domain/memory-summary.ts`
- Create: `src/repositories/api-summary-repository.ts`
- Create: `src/components/MemorySummaryPage.tsx`
- Create: `src/components/MemorySummaryPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `GET /api/summaries?period=month|year&date=YYYY-MM-DD`；主题/心情/状态排行、照片数、记录天数、代表记忆和长期副本进展。

- [ ] 写零记录、跨月/跨年边界、并列排行和代表记忆确定性的失败测试。
- [ ] 实现纯统计函数和接口，不生成虚构文字。
- [ ] 写前端月度/年度切换、空态和代表照片测试并实现独立页面，从记忆首页进入且不新增底部导航。
- [ ] 运行前后端相关测试和构建。

### Task 4: 实现 JSON、ZIP 与 PDF 导出

**Files:**
- Create: `server/src/vault/export-manifest.ts`
- Create: `server/src/vault/vault-export.service.ts`
- Create: `server/test/export-manifest.spec.ts`
- Create: `server/test/vault-export.service.spec.ts`
- Modify: `server/src/vault/vault.module.ts`
- Modify: `server/src/vault/vault.controller.ts`
- Modify: `server/package.json`

**Interfaces:**
- Produces: `/api/vault/exports/json|zip|pdf`，返回文件元数据和受控下载 URL；格式版本 `photo-memory-v1`。

- [ ] 写 JSON 版本/关系、ZIP 相对路径/哈希/照片、PDF 中文和缺图容错失败测试。
- [ ] 安装固定版本 `pdfkit`、`archiver`、`adm-zip` 及类型包，锁定 package-lock。
- [ ] 实现数据快照与 SHA-256 清单；临时文件成功后原子移动，失败清理。
- [ ] 实现 PDF 图文记忆册；找不到系统中文字体时返回明确错误而非乱码文件。
- [ ] 运行导出测试，实际打开 JSON/ZIP/PDF 做内容检查。

### Task 5: 实现 ZIP/JSON 导入预览与事务恢复

**Files:**
- Create: `server/src/vault/import-validator.ts`
- Create: `server/src/vault/vault-import.service.ts`
- Create: `server/test/import-validator.spec.ts`
- Create: `server/test/vault-import.service.spec.ts`
- Modify: `server/src/vault/vault.controller.ts`

**Interfaces:**
- Produces: `POST /api/vault/imports/inspect`、`POST /api/vault/imports/:id/restore`；预览 summary 与安全合并结果。

- [ ] 写 ZIP Slip、绝对路径、条目/大小上限、缺照片、坏哈希、重复、冲突和失败回滚测试。
- [ ] 实现只读 inspect：隔离解压、manifest 校验、关系校验、哈希和预览统计。
- [ ] 实现 restore：二次验证 → 自动备份 → 照片暂存 → Prisma 事务安全合并 → 原子移动；异常清理和失败记录。
- [ ] 用导出的真实迁移包执行导入预览与无破坏的重复导入验收。

### Task 6: 实现 PostgreSQL 备份、状态与存储透明度

**Files:**
- Create: `server/src/vault/database-url.ts`
- Create: `server/src/vault/vault-backup.service.ts`
- Create: `server/test/database-url.spec.ts`
- Create: `server/test/vault-backup.service.spec.ts`
- Modify: `server/src/vault/vault.controller.ts`

**Interfaces:**
- Produces: `GET /api/vault/status|storage|backups`、`POST /api/vault/backups`；脱敏连接信息、目录大小、最新状态。

- [ ] 写 IPv6/转义密码连接串脱敏、pg_dump 路径含空格、成功/失败记录和不泄密日志测试。
- [ ] 从 `DATABASE_URL` 解析 host/port/database/schema，用户名部分脱敏且永不返回密码。
- [ ] 以参数数组启动受控 `pg_dump`，输出 `.dump` 到 backups；记录大小、SHA-256 和失败摘要。
- [ ] 计算 uploads/backups/exports 目录占用，所有返回路径必须位于 D 盘固定根目录。
- [ ] 在本机 PostgreSQL 执行真实备份并校验文件非空、记录成功。

### Task 7: 实现数据保险箱与应用锁前端

**Files:**
- Create: `src/domain/data-vault.ts`
- Create: `src/repositories/api-vault-repository.ts`
- Create: `src/repositories/api-app-lock-repository.ts`
- Create: `src/components/DataVaultPage.tsx`
- Create: `src/components/DataVaultPage.test.tsx`
- Create: `src/components/AppLockGate.tsx`
- Create: `src/components/AppLockGate.test.tsx`
- Modify: `src/api/client.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Tasks 2、4、5、6 API。
- Produces: 数据保险箱页面、导出下载、导入三阶段、备份状态、存储位置、锁屏/设置/二次验证。

- [ ] 写保险箱状态、三种导出、导入预览、备份、锁屏、恢复密钥一次展示和敏感操作验证失败测试。
- [ ] API Client 默认携带 Cookie；锁定响应切换全局锁屏但不清空用户输入。
- [ ] 实现数据保险箱页面并从顶栏安全入口进入，不改变四项底部导航。
- [ ] 实现首次设置、解锁、手动锁、自动锁、修改/关闭和恢复流程；密码输入永不写 localStorage。
- [ ] 运行前端全量测试、构建和浏览器主流程。

### Task 8: 全量回归、审查、提交与推送功能版本

**Files:**
- Evidence only; no user data committed.

- [ ] 运行前端全量、后端全量、两端构建、Prisma validate/generate/migrate status。
- [ ] 真实验收：JSON/PDF/ZIP 导出、inspect、备份、锁定/解锁、月度/年度总结；测试产物仅留在 ignored data 目录。
- [ ] 使用 verification-before-completion 和 requesting-code-review；Critical/Important 逐项 RED→GREEN。
- [ ] 隐私扫描 `.env`、照片、备份、导出、会话、摘要、依赖和构建产物。
- [ ] 提交 `feat: add data vault app lock and memory summaries` 并推送；核对本地/远程哈希。

### Task 9: 更新最终 PRD、技术方案、流程图和产品示意图

**Files:**
- Modify: `docs/照片记忆本产品需求文档_PRD_V2.docx`
- Modify: `docs/照片记忆本前后端技术方案.docx`
- Create: `docs/照片记忆本业务逻辑流程图.svg`
- Create: `docs/照片记忆本业务逻辑流程图.png`
- Create: `docs/照片记忆本产品示意图.png`

**Interfaces:**
- Consumes: 最终代码、API、数据模型和真实验收结果。
- Produces: 覆盖全部现有功能的最终中文版交付物。

- [ ] 使用 documents 技能读取现有 Word 结构，按实际功能更新 PRD 和技术方案，嵌入最终流程图。
- [ ] 使用 diagram/visual workflow 生成“照片导入→补充信息→主题/长期副本→记忆回声→感言→月/年总结→保险箱导出/备份/恢复”流程图。
- [ ] 生成首页、照片记忆、长期副本、记忆回声、总结、数据保险箱的产品示意图。
- [ ] 渲染两份 Word 文档逐页检查；检查 PNG/SVG 清晰度、中文、连线和版式，修正后复验。
- [ ] 最终全量测试与隐私扫描，提交 `docs: finalize product and technical documentation`，推送并核对哈希。

## Self-review

- Spec coverage: 导出三格式、导入三阶段、安全合并、备份、存储说明、应用锁、月/年总结、最终四类文档均有任务。
- Type consistency: Vault API、Lock API、Summary API 的生产者和前端消费者名称唯一且一致。
- Review Focus: ZIP 安全、重复/冲突导入、API 门禁、pg_dump 泄密、中文 PDF/空区间分别落入 Tasks 2–6 测试。
- Proportion: 计划只固定接口、边界和可观察断言，不抄写实现函数体。

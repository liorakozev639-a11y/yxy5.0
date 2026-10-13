# 照片记忆本 PostgreSQL MVP 实现设计

## 1. 目标与边界

本次实现将现有 React + IndexedDB 前端扩展为“本地 PostgreSQL 后端 MVP”。用户可以先上传图片，再补充备忘录、当日状态和当日主题；用户可以创建长期副本，并让选择了匹配主题的记忆自动进入副本时间线。

本期实现的成功标准：

- 一条记忆包含一张图片、可选备忘录、多个当日状态和多个当日主题。
- 记忆数据写入本地 PostgreSQL；图片文件保存到 `D:\yxy5.0\data\uploads`。
- 用户可以创建、编辑、删除记忆，并按日期、关键词、主题查看。
- 用户可以创建长期副本，设置名称、主题、开始日期和生命周期状态。
- 一条记忆可以关联多个主题，并进入多个匹配的长期副本；关联操作幂等。
- 长期副本页无数据时显示“暂无长期副本”，不会未经用户确认自动创建副本。
- 长期副本时间轴按事件时间分页返回图片、文字、状态和主题。

本期明确不做：登录注册、多人协作、S3/MinIO、AI 总结、月度/年度总结、30/100/365 天总结、通知、分享、多图记忆和原生客户端。

## 2. 现状与技术决策

当前项目是单一 Vite React 应用，数据层使用 IndexedDB，已有记忆、状态、重要日子和基础时间线组件。当前仓库不是 Git 仓库，因此实现过程中不执行 reset、checkout 或其他会覆盖用户文件的操作。

采用以下 MVP 方案：

- 前端：保留 React + TypeScript + Vite，新增 API Repository。
- 后端：新增 `server/`，使用 NestJS + TypeScript + REST API。
- 数据库：PostgreSQL + Prisma，连接地址由 `DATABASE_URL` 提供。
- 图片：后端接收 multipart 图片并写入 `D:\yxy5.0\data\uploads`；PostgreSQL 只保存文件路径和元数据。
- 单用户：MVP 不做认证，使用固定本地用户 `LOCAL_USER_ID`；所有资源表仍保留 `userId`，方便后续接入认证。
- 联调：Vite 将 `/api` 代理到本地 NestJS 服务；前端不再直接访问 IndexedDB 作为主数据源。
- 兼容性：保留现有 IndexedDB Repository，作为未接后端时的本地草稿和迁移基础，不主动删除浏览器数据。

## 3. 目录与模块设计

```text
D:\yxy5.0\
├─ src/                         # 现有 React 前端
│  ├─ repositories/             # API 与 IndexedDB 实现
│  ├─ api/                      # fetch 客户端与错误适配
│  └─ ...
├─ server/
│  ├─ src/
│  │  ├─ common/                # DTO 错误、分页、配置
│  │  ├─ media/                 # 图片上传、元数据、文件服务
│  │  ├─ memories/              # 记忆 CRUD 和筛选
│  │  ├─ topics/                # 主题查询和自定义主题
│  │  ├─ long-term-copies/      # 副本、主题关联、时间轴
│  │  └─ main.ts
│  ├─ prisma/schema.prisma
│  └─ test/
├─ data/uploads/                # 本地图片文件，不提交到代码仓库
├─ .env.example
└─ vite.config.ts
```

## 4. 数据模型

### 4.1 MediaAsset

保存图片文件的元数据：`id`、`userId`、`storagePath`、`originalName`、`mimeType`、`fileSize`、`width`、`height`、`captureAt`、`captureSource`、`processingStatus`、`createdAt`。

MVP 文件直接落盘，`storagePath` 使用随机文件名，禁止使用用户原文件名作为路径。支持 JPEG、PNG、WebP，单文件建议限制 20MB。

### 4.2 Memory

保存：`id`、`userId`、`mediaId`、`note`、`eventAt`、`timezone`、`statuses`、`isPending`、`createdAt`、`updatedAt`、`deletedAt`。

`eventAt` 优先使用图片 EXIF 时间，用户手动填写时覆盖 EXIF，没有时间时使用上传时间。`isPending` 由服务端根据 note、statuses 和 topics 是否为空计算。

### 4.3 Topic 与 MemoryTopic

Topic 保存用户主题：`id`、`userId`、`name`、`color`、`icon`、`isNone`、`createdAt`、`updatedAt`。同一个用户的主题名称唯一。

MemoryTopic 保存多对多关系：`memoryId`、`topicId`，使用联合唯一键避免重复关联。预置主题“无”不参与长期副本自动关联。

### 4.4 LongTermCopy 与 LongTermCopyMemory

LongTermCopy 保存：`id`、`userId`、`name`、`topicId`、`startDate`、`coverMediaId`、`lifecycleStatus`、`createdAt`、`updatedAt`、`completedAt`、`archivedAt`。

LongTermCopyMemory 保存：`copyId`、`memoryId`、`linkedAt`，使用联合唯一键保证幂等。

生命周期状态为：`ACTIVE`、`PAUSED`、`COMPLETED`、`ARCHIVED`。只有 ACTIVE 副本接收新记忆的自动关联；一条记忆可以进入多个 ACTIVE 副本。

## 5. 业务流程

### 5.1 创建记忆

1. 前端调用 `POST /api/media` 上传图片。
2. 后端校验 MIME、文件大小和文件头，将图片写入 `data/uploads`。
3. 后端解析 EXIF，返回 `mediaId`、缩略图 URL 和建议事件时间。
4. 前端提交 `mediaId`、`note`、`eventAt`、`statuses[]`、`topics[]` 到 `POST /api/memories`。
5. 后端校验资源归属，在一个事务中创建 Memory 和 MemoryTopic。
6. 后端查询当前用户所有 ACTIVE 且 topicId 匹配的 LongTermCopy，幂等创建 LongTermCopyMemory。
7. 返回完整记忆详情和已关联副本。

### 5.2 创建长期副本

1. `GET /api/long-term-copies` 无数据时返回空数组，前端显示“暂无长期副本”。
2. 用户主动打开创建页面，填写副本名称、主题、开始日期和状态。
3. `POST /api/long-term-copies` 创建副本。
4. MVP 先提供“是否导入开始日期后已有同主题记忆”的确认步骤。
5. 确认后批量建立 LongTermCopyMemory，重复执行不会产生重复节点。

### 5.3 编辑和删除

- 编辑记忆时在事务中更新 Memory 和 MemoryTopic，并重新计算 ACTIVE 副本关联。
- 删除记忆使用软删除，时间线、列表和搜索默认过滤 `deletedAt`。
- 删除媒体文件延后处理；如果 MVP 暂不做清理队列，至少在服务端保留明确的清理函数和错误日志。

## 6. API 契约

### 图片

- `POST /api/media`：multipart 上传单张图片，返回 `mediaId`、`eventAt`、`thumbnailUrl`。
- `GET /api/media/:id/file`：返回当前用户图片文件。

### 记忆

- `POST /api/memories`
- `GET /api/memories?keyword=&topicId=&status=&from=&to=&cursor=&pageSize=`
- `GET /api/memories/:id`
- `PATCH /api/memories/:id`
- `DELETE /api/memories/:id`

创建请求示例：

```json
{
  "mediaId": "media_xxx",
  "note": "今天第一次完成模拟考试。",
  "eventAt": "2026-10-12T18:30:00+08:00",
  "statuses": ["焦虑", "学习"],
  "topics": ["topic_exam"]
}
```

### 主题

- `GET /api/topics`
- `POST /api/topics`
- `PATCH /api/topics/:id`
- `DELETE /api/topics/:id`

### 长期副本

- `GET /api/long-term-copies`
- `POST /api/long-term-copies`
- `GET /api/long-term-copies/:id`
- `PATCH /api/long-term-copies/:id`
- `DELETE /api/long-term-copies/:id`
- `GET /api/long-term-copies/:id/timeline?cursor=&pageSize=`
- `POST /api/long-term-copies/:id/backfill`

## 7. 前端接入设计

- 新增 `ApiMemoryRepository`、`ApiTopicRepository`、`ApiLongTermCopyRepository`。
- App 启动时从 API 加载记忆、主题和长期副本；请求失败时展示错误状态，不静默覆盖本地数据。
- MemoryForm 保持“先上传图片，再添加文字”的顺序，增加主题多选和已有长期副本提示。
- 新增长期副本导航入口和页面，空状态文案固定为“暂无长期副本”。
- 时间线页保留现有记忆时间线；新增长期副本时间线，节点展示图片、日期、备忘录、状态和主题。
- 统一处理 loading、empty、error、submitting 四类状态。
- API 客户端使用 `fetch`，统一处理 JSON 错误、超时和网络断开。

## 8. 测试设计

### 后端

- MemoryService：创建完整记忆、缺少文字时 isPending、事件时间优先级。
- TopicService：用户自定义主题唯一、不能读取其他用户主题。
- LongTermCopyService：副本生命周期、主题自动关联、重复关联幂等。
- TimelineService：按 eventAt 排序、过滤软删除、cursor 分页。
- MediaService：拒绝错误 MIME、限制大小、保存文件并返回元数据。
- API 测试：完整创建链路、资源归属校验和错误码。

### 前端

- API Repository：成功响应、错误响应、空列表和分页。
- MemoryForm：多选状态和主题、提交中不可重复提交、失败保留输入。
- 长期副本页面：空状态、创建、生命周期显示和时间线节点。

实现严格遵循测试先行：每个新增服务行为先写一个会失败的测试，再写最小实现，最后运行完整测试和构建。

## 9. 验收标准

- `npm test -- --run` 通过。
- `npm run build` 通过。
- 后端启动后可以连接 PostgreSQL，并成功执行 Prisma migration。
- 浏览器可以上传图片并在 PostgreSQL 中看到 MediaAsset 和 Memory 数据。
- 一条记忆可以保存多个状态和多个主题。
- 选择主题后，记忆自动进入同主题的 ACTIVE 长期副本。
- 同一记忆重复保存或重试不会生成重复长期副本节点。
- 长期副本时间线能返回图片、时间、备忘录、状态和主题。
- 停止后端时，现有 IndexedDB 数据仍然保留，不被删除。


# 照片记忆本 Web MVP

一个本地优先的网页版照片记忆本。用户先上传照片，再按自己的节奏补充标题、备忘录、当日心情、当日状态和当日主题；匹配主题会进入长期副本，旧记录会通过记忆回声和“情绪电影”月度、年度总结重新出现。

## 启动

```bash
npm install
npm run dev
```

前端默认访问 `/api`，需要另开终端启动后端：

```bash
cd server
copy .env.example .env
# 修改 .env 中的 DATABASE_URL 为你的 PostgreSQL 连接串
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

图片文件保存在 `D:\yxy5.0\data\uploads`，业务数据保存在 PostgreSQL。后端未连接时，前端会回退显示浏览器 IndexedDB 中的本地草稿，不会主动清除本地数据。

### 情绪电影 AI 配置

情绪电影默认可完全使用本地模板生成。需要云端 AI 旁白时，在 `server/.env` 中配置以下变量；不要把真实密钥提交到 Git：

```dotenv
SUMMARY_AI_BASE_URL=https://your-provider.example.com
SUMMARY_AI_API_KEY=replace-with-your-local-secret
SUMMARY_AI_MODEL=your-model-name
SUMMARY_AI_TIMEOUT_MS=12000
```

- `SUMMARY_AI_BASE_URL`：兼容 OpenAI Chat Completions 的服务根地址，后端会请求 `/v1/chat/completions`。
- `SUMMARY_AI_API_KEY`：仅从本机环境变量读取，不进入数据库、响应或日志。
- `SUMMARY_AI_MODEL`：服务端配置的模型名称。
- `SUMMARY_AI_TIMEOUT_MS`：请求超时毫秒数，默认 `12000`。
- 任一必需配置缺失、请求超时、返回结构无效或旁白引用了快照外事实时，系统自动使用本地第二人称模板完成总结。

## 已实现的 MVP

- 照片墙、最近记忆、关键词搜索
- 单图新增与编辑；EXIF 时间读取、无 EXIF 回退当前时间、手动改时间
- 照片先保存、文字后补充；空字段不会产生“待补充记忆”入口
- 单张或批量导入；批量时可统一主题，失败项可单独重试
- 当日状态多选、当日主题多选，均支持自定义项
- 详情查看、编辑、删除
- 时间线按日期分组
- 长期副本创建、主题授权、自动收集开关和稳定分页时间线
- 重要日子创建、日期差、关联已有记忆
- 记忆回声：每日最多 3 条、最近 30 天、回声感言和排除设置
- 情绪电影：月度与年度总结、首次打开惰性生成、首页提醒、档案馆和阅读进度恢复
- 情绪电影编辑：旁白、代表照片、页面顺序、重新生成和月度/年度回声感言
- 总结隐私：首次授权，文字与照片可分别关闭，单条记忆可排除，云端 AI 可关闭
- 数据保险箱：JSON、ZIP、PDF 导出，导入恢复，PostgreSQL 备份，应用锁和存储位置展示

## 暂不包含

登录注册、双人共同空间、S3/MinIO、云同步、背景音乐、单条多图记忆、系统通知、地图、人物关系和公开分享卡片。

## 情绪电影生成与隐私边界

- 后端按上海时区冻结指定月或年的真实记忆快照；空周期不创建总结，1 至 2 条记录生成 4 页精简版。
- 统计、最高频情绪、代表记忆、页面计划和长期副本进展都在本机完成。
- 首次生成前必须确认授权；文字和照片默认开启但可单独关闭，云端 AI 默认关闭。
- 只有用户开启云端 AI 时，授权范围内的最小结构化信息才会发送到配置的服务；本地文件路径和数据库连接信息永不发送。
- AI 只负责组织第二人称旁白。后端会校验页面结构、事实引用和数字；验证失败立即回退本地模板。
- 生成后的总结是独立快照。修改总结不会修改原始记忆；重新生成时才读取最新原始数据。

## 数据与删除说明

- 新上传图片若未能创建或更新记忆，前端会调用媒体清理接口；替换图片成功后会清理不再使用的旧文件。
- 删除记忆当前采用软删除，页面与长期副本不再展示该记录；原媒体文件保留，便于后续实现回收站与恢复策略。
- 上传只接受 JPEG、PNG、WebP，单文件最大 20MB，并校验 MIME 与文件签名。
- 总结 API 不返回冻结快照或图片绝对存储路径；应用只通过受控媒体接口展示照片。

## 数据库迁移

升级已有项目后，在后端目录运行：

```bash
cd D:\yxy5.0\server
npx prisma migrate deploy
npx prisma generate
```

`0006_emotional_memory_summaries` 会新增总结、总结页面、回声感言、总结偏好和单条记忆排除字段。迁移不会删除已有记忆、照片、长期副本或记忆回声。

## 验证

```bash
npm test -- --run
npm run build
npm --prefix server test -- --run
npm --prefix server run build
```

当前回归基线：前端 38 个测试文件共 100 项，后端 33 个测试文件共 136 项；前后端生产构建均通过。

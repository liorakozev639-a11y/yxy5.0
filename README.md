# 照片记忆本 · Web MVP

一个网页版照片记忆本 MVP。用户先上传一张照片，再按自己的节奏补充备忘录、当日状态和当日主题；匹配的主题会自动进入长期副本时间线。

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

## 暂不包含

登录注册、S3/MinIO、总结 AI、月度/年度总结、阶段总结、单条多图记忆、导入导出、通知、地图、人物关系、分享卡片。

## 数据与删除说明

- 新上传图片若未能创建或更新记忆，前端会调用媒体清理接口；替换图片成功后会清理不再使用的旧文件。
- 删除记忆当前采用软删除，页面与长期副本不再展示该记录；原媒体文件保留，便于后续实现回收站与恢复策略。
- 上传只接受 JPEG、PNG、WebP，单文件最大 20MB，并校验 MIME 与文件签名。

## 验证

```bash
npm test -- --run
npm run build
npm --prefix server test -- run
npm --prefix server run build
```

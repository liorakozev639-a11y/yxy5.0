from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"D:\photo-memory-mvp")
OUTPUT = ROOT / "docs" / "照片记忆本后端技术方案.docx"

ACCENT = "4F8585"
ACCENT_DARK = "315A5C"
LIGHT_BLUE = "EAF2F1"
LIGHT_GRAY = "F5F6F4"
BORDER = "D9D9D9"
TEXT = "222A29"
MUTED = "6E7B77"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=110, start=130, bottom=110, end=130):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color=BORDER, size="6"):
    tbl = table._tbl
    tbl_pr = tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_width(cell, width_inches):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(int(width_inches * 1440)))
    tc_w.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_run_font(run, name="Microsoft YaHei", size=None, color=TEXT, bold=False, italic=False):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    if size:
        run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    run.italic = italic


def add_run(paragraph, text, **kwargs):
    run = paragraph.add_run(text)
    set_run_font(run, **kwargs)
    return run


def style_paragraph(paragraph, before=0, after=7, line=1.25):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line


def add_body(doc, text, after=8):
    p = doc.add_paragraph(style="Normal")
    add_run(p, text, size=10.5)
    style_paragraph(p, after=after, line=1.35)
    return p


def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
    add_run(p, text, size=10.5)
    style_paragraph(p, after=3, line=1.25)
    return p


def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    add_run(p, text, size=10.5)
    style_paragraph(p, after=3, line=1.25)
    return p


def add_heading(doc, text, level=1):
    p = doc.add_paragraph(style=f"Heading {level}")
    add_run(p, text, size=17 if level == 1 else 12.5, bold=True, color="000000")
    style_paragraph(p, before=18 if level == 1 else 11, after=7 if level == 1 else 5, line=1.15)
    return p


def add_code(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.18)
    p.paragraph_format.right_indent = Inches(0.18)
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(9)
    p.paragraph_format.line_spacing = 1.1
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), "F2F5F3")
    pPr.append(shd)
    add_run(p, text, name="Consolas", size=8.6, color=ACCENT_DARK)
    return p


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    header = table.rows[0]
    set_repeat_table_header(header)
    for idx, value in enumerate(headers):
        cell = header.cells[idx]
        set_cell_shading(cell, ACCENT_DARK)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        if widths:
            set_cell_width(cell, widths[idx])
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        style_paragraph(p, after=0, line=1.1)
        add_run(p, value, size=9, color="FFFFFF", bold=True)
    for row_index, values in enumerate(rows):
        row = table.add_row()
        for idx, value in enumerate(values):
            cell = row.cells[idx]
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if widths:
                set_cell_width(cell, widths[idx])
            if row_index % 2 == 1:
                set_cell_shading(cell, LIGHT_GRAY)
            p = cell.paragraphs[0]
            style_paragraph(p, after=0, line=1.18)
            add_run(p, str(value), size=8.8)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return table


def add_callout_paragraph(doc, lead, text):
    p = doc.add_paragraph()
    style_paragraph(p, before=3, after=10, line=1.35)
    add_run(p, lead, size=10.5, bold=True, color=ACCENT_DARK)
    add_run(p, text, size=10.5)
    return p


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_run(paragraph, "照片记忆本后端技术方案  |  ", size=8, color=MUTED)
    run = paragraph.add_run()
    set_run_font(run, size=8, color=MUTED)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def configure_document(doc):
    section = doc.sections[0]
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.72)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)
    section.header_distance = Inches(0.3)
    section.footer_distance = Inches(0.32)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Microsoft YaHei"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(TEXT)
    for style_name, size in (("Title", 26), ("Heading 1", 17), ("Heading 2", 12.5)):
        style = styles[style_name]
        style.font.name = "Microsoft YaHei"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.font.bold = True
    footer = section.footer
    add_page_number(footer.paragraphs[0])


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    configure_document(doc)

    # Cover
    p = doc.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    style_paragraph(p, before=42, after=15, line=1.05)
    add_run(p, "照片记忆本后端技术方案", size=27, bold=True, color="000000")
    p = doc.add_paragraph()
    style_paragraph(p, after=22, line=1.25)
    add_run(p, "面向云端同步与多设备访问的后端架构设计", size=13, color=ACCENT_DARK, bold=True)
    add_body(doc, "本文档基于照片记忆本 V0 产品需求，给出从本地优先前端 MVP 演进到可登录、可同步、可扩展后端系统的技术方案。方案重点覆盖图片上传、记忆 CRUD、时间线、搜索、重要日子关联以及自定义心情和状态等核心业务。", after=14)
    add_callout_paragraph(doc, "方案结论  ", "第一阶段采用 NestJS 模块化单体，配合 PostgreSQL、S3 兼容对象存储和 Redis。该方案能快速支撑 P0 业务，同时为多图记忆、云同步和通知能力保留扩展空间。")
    add_table(doc, ["项目", "决策"], [
        ["架构形态", "模块化单体，按业务域拆分 NestJS Module"],
        ["接口风格", "RESTful API，使用 OpenAPI 维护接口契约"],
        ["核心数据", "PostgreSQL + Prisma"],
        ["图片文件", "S3 / MinIO，对象存储不进入关系数据库"],
        ["异步任务", "Redis + BullMQ，处理缩略图、EXIF 和清理任务"],
        ["部署方式", "Docker Compose 起步，生产环境接入 Nginx 与对象存储"],
    ], widths=[1.35, 5.1])
    p = doc.add_paragraph()
    style_paragraph(p, before=15, after=0)
    add_run(p, f"文档版本  V1.0    编制日期  {date.today().isoformat()}", size=9, color=MUTED)

    doc.add_page_break()

    add_heading(doc, "一 方案背景与建设目标", 1)
    add_body(doc, "当前 MVP 使用浏览器 IndexedDB 保存照片和记忆，适合验证产品交互，但无法满足账号体系、跨设备访问、图片云端备份和数据安全隔离等生产需求。后端版本的目标不是一次性实现全部高级功能，而是先建立稳定的用户、图片和记忆数据基础。")
    add_heading(doc, "建设目标", 2)
    for item in [
        "支持用户注册、登录以及个人数据隔离。",
        "支持单图记忆创建、编辑、删除和详情查看。",
        "支持优先读取 EXIF 时间，并允许用户手动修正。",
        "支持标题、备忘录、心情和当日状态的保存与检索。",
        "支持时间线、关键词搜索和重要日子关联。",
        "图片文件与业务数据分离，支持缩略图和后续图片处理。",
        "保留前端 Repository 抽象，便于从 IndexedDB 切换到 API。",
    ]:
        add_bullet(doc, item)
    add_heading(doc, "非目标", 2)
    add_body(doc, "本阶段不强制实现多图记忆、复杂提醒、地图、人物关系、AI 生成、分享卡片和社交协作。这些能力在数据模型和任务系统中预留扩展点，但不阻塞 P0 交付。")

    add_heading(doc, "二 总体架构", 1)
    add_body(doc, "推荐使用前后端分离的模块化单体。前端继续使用 React + Vite，后端使用 TypeScript 体系，减少团队在语言和类型定义上的切换成本。部署初期所有业务模块运行在一个 API 服务中，按领域边界组织代码，等真实流量和团队规模达到拆分条件后再演进为独立服务。")
    add_code(doc, "React Web 端\n    │ HTTPS / REST + OpenAPI\n    ▼\nNestJS API  ───── Redis + BullMQ  ───── 图片处理 Worker\n    │                    │                         │\n    ├── PostgreSQL       └── 缓存 / 限流 / 任务      └── EXIF / 缩略图\n    │\n    └── S3 / MinIO 对象存储（原图、缩略图）")
    add_heading(doc, "技术栈", 2)
    add_table(doc, ["层次", "推荐技术", "用途"], [
        ["Web API", "NestJS + TypeScript", "模块化、依赖注入、鉴权和参数校验"],
        ["接口契约", "OpenAPI / Swagger", "前后端协作与接口文档"],
        ["关系数据库", "PostgreSQL", "用户、记忆、标签和关联关系"],
        ["数据访问", "Prisma", "类型安全的 Schema 与迁移"],
        ["对象存储", "S3 / MinIO", "原图、缩略图和未来多媒体资源"],
        ["缓存队列", "Redis + BullMQ", "异步图片处理、限流和短期缓存"],
        ["部署", "Docker + Nginx", "环境一致性、反向代理和 HTTPS"],
        ["观测", "Pino + Prometheus", "结构化日志、指标和错误定位"],
    ], widths=[1.15, 2.15, 3.15])

    add_heading(doc, "三 业务模块设计", 1)
    add_table(doc, ["模块", "职责", "P0 交付"], [
        ["用户模块", "注册、登录、Token 刷新、个人信息", "是"],
        ["记忆模块", "创建、编辑、查询、删除；空字段不产生待补充入口", "是"],
        ["图片模块", "上传凭证、EXIF、缩略图、签名 URL", "是"],
        ["标签模块", "预设与自定义心情、状态", "是"],
        ["时间线模块", "按事件时间排序、日期分组", "是"],
        ["搜索模块", "标题、备忘录和标签关键词检索", "是"],
        ["重要日子模块", "纪念日创建和记忆关联", "P1"],
        ["任务模块", "图片处理、删除清理和重试", "P1"],
    ], widths=[1.25, 4.25, 0.95])
    add_callout_paragraph(doc, "模块边界  ", "业务模块之间通过 Service 接口调用，禁止控制器直接操作 Prisma。图片处理和删除清理由队列完成，避免上传接口被大文件处理阻塞。")

    doc.add_page_break()
    add_heading(doc, "四 核心数据模型", 1)
    add_heading(doc, "Memory 记忆", 2)
    add_code(doc, "Memory {\n  id, userId, title, note, eventAt, timezone, mood\n  statuses[], isPending, createdAt, updatedAt, deletedAt\n}")
    add_body(doc, "eventAt 是时间线排序和详情展示的唯一业务时间。服务端不直接相信前端传入的 isPending，而是在创建和更新时根据标题、备忘录、心情和状态重新计算。deletedAt 用于软删除和后续恢复能力。")
    add_heading(doc, "MediaAsset 图片资源", 2)
    add_code(doc, "MediaAsset {\n  id, memoryId, objectKey, originalName, mimeType\n  fileSize, width, height, captureAt, captureSource\n  thumbnailKey, createdAt\n}")
    add_body(doc, "图片二进制保存到 S3 或 MinIO，数据库只记录对象 Key 和元数据。V0 一条记忆通过 memoryId 唯一约束只绑定一张图片；未来扩展多图时再拆除该约束并增加 sortOrder。")
    add_heading(doc, "ImportantDay 重要日子", 2)
    add_code(doc, "ImportantDay { id, userId, name, date, createdAt, updatedAt }\nImportantDayMemory { importantDayId, memoryId, createdAt }")
    add_body(doc, "通过中间表实现多对多关联：一个纪念日可以关联多条记忆，一条记忆也可以出现在多个纪念日中。删除记忆时清理关联，读取纪念日时再次过滤不存在或已删除的记忆。")
    add_heading(doc, "CustomOption 自定义选项", 2)
    add_code(doc, "CustomOption { id, userId, type, value, createdAt }\nunique(userId, type, value)")
    add_body(doc, "type 区分 mood 和 status。预设项可以由服务端以配置形式返回，自定义项写入数据库并绑定用户，避免不同用户之间出现标签污染。")

    add_heading(doc, "五 图片上传与时间解析", 1)
    add_body(doc, "推荐使用预签名 URL。前端先向 API 申请上传凭证，再直接把图片传到对象存储，最后通知 API 完成上传。这样可以降低 API 服务的带宽压力，并为后续 CDN 和断点续传留下空间。")
    add_code(doc, "选择图片\n  → POST /api/memories/upload-url\n  → 直接 PUT 到 S3 / MinIO\n  → POST /api/memories/complete\n  → Worker 读取 EXIF、生成缩略图\n  → 创建或补全 Memory 与 MediaAsset")
    add_heading(doc, "时间优先级", 2)
    add_table(doc, ["顺序", "来源", "captureSource"], [
        ["1", "EXIF DateTimeOriginal", "exif"],
        ["2", "EXIF CreateDate", "exif"],
        ["3", "用户手动填写的事件时间", "manual"],
        ["4", "上传时间", "upload_time"],
    ], widths=[0.65, 3.9, 1.9])
    add_heading(doc, "上传安全规则", 2)
    for item in [
        "限制图片格式和大小，服务端重新检测 MIME，不依赖文件扩展名。",
        "生成随机 objectKey，不使用用户原文件名作为存储路径。",
        "原图与缩略图使用不同 Key，下载时返回短时效签名 URL。",
        "图片处理失败不删除原图，任务记录失败原因并支持重试。",
    ]:
        add_bullet(doc, item)

    doc.add_page_break()
    add_heading(doc, "六 API 接口设计", 1)
    add_heading(doc, "认证接口", 2)
    add_table(doc, ["方法", "路径", "说明"], [
        ["POST", "/api/auth/register", "注册用户"],
        ["POST", "/api/auth/login", "登录并返回 Access Token"],
        ["POST", "/api/auth/refresh", "刷新 Access Token"],
        ["POST", "/api/auth/logout", "注销 Refresh Token"],
        ["GET", "/api/me", "读取当前用户"],
        ["PATCH", "/api/me", "更新昵称或头像"],
    ], widths=[0.75, 2.8, 2.9])
    add_heading(doc, "记忆接口", 2)
    add_table(doc, ["方法", "路径", "说明"], [
        ["POST", "/api/memories/upload-url", "创建图片上传凭证"],
        ["POST", "/api/memories", "创建一条记忆"],
        ["GET", "/api/memories", "列表、筛选和关键词搜索"],
        ["GET", "/api/memories/:id", "读取记忆详情"],
        ["PATCH", "/api/memories/:id", "编辑文字、时间和标签"],
        ["DELETE", "/api/memories/:id", "软删除记忆"],
    ], widths=[0.75, 2.8, 2.9])
    add_heading(doc, "记忆创建请求示例", 2)
    add_code(doc, "POST /api/memories\n{\n  \"mediaId\": \"media_xxx\",\n  \"title\": \"我们第一次见面的那天\",\n  \"note\": \"那天下着小雨，但很开心。\",\n  \"eventAt\": \"2026-10-12T18:30:00+08:00\",\n  \"mood\": \"感动\",\n  \"statuses\": [\"约会\"]\n}")
    add_heading(doc, "重要日子接口", 2)
    add_table(doc, ["方法", "路径", "说明"], [
        ["POST", "/api/important-days", "创建纪念日"],
        ["GET", "/api/important-days", "读取当前用户的纪念日"],
        ["PATCH", "/api/important-days/:id", "编辑名称或日期"],
        ["DELETE", "/api/important-days/:id", "删除纪念日"],
        ["POST", "/api/important-days/:id/memories/:memoryId", "关联记忆"],
        ["DELETE", "/api/important-days/:id/memories/:memoryId", "取消关联"],
    ], widths=[0.75, 3.55, 2.15])
    add_heading(doc, "搜索参数", 2)
    add_code(doc, "GET /api/memories?keyword=约会\nGET /api/memories?from=2026-01-01&to=2026-12-31\nGET /api/memories?mood=开心&status=旅行&page=1&pageSize=24")
    add_body(doc, "初期可使用 PostgreSQL ILIKE 和复合索引实现搜索。当记忆量达到规模后，再迁移到 PostgreSQL 全文索引或 Elasticsearch，不改变前端 API 形态。")

    add_heading(doc, "七 关键业务流程", 1)
    add_heading(doc, "创建记忆", 2)
    for item in [
        "校验用户身份和 mediaId 所属关系。",
        "校验图片已经上传完成且 MIME、大小符合规则。",
        "读取服务端解析出的 EXIF 时间；无 EXIF 时使用用户手动时间，再无时间才使用服务器时间。",
        "清洗标题、备忘录和标签，计算 isPending。",
        "写入 Memory，返回带缩略图签名 URL 的详情。",
    ]:
        add_number(doc, item)
    add_heading(doc, "编辑与删除", 2)
    add_body(doc, "编辑接口只允许修改当前用户拥有的记录，并更新 updatedAt。删除接口采用软删除，列表和搜索默认过滤 deletedAt 非空记录；后台清理任务再异步删除对象存储文件和无效关联。")
    add_heading(doc, "重要日子关联", 2)
    add_body(doc, "关联操作先校验重要日子和记忆属于同一用户，再通过唯一联合键防止重复关联。读取详情时按 memoryIds 加载记忆，同时过滤已删除数据。日期差按用户 timezone 计算，避免 UTC 转换导致纪念日提前或延后一天。")

    doc.add_page_break()
    add_heading(doc, "八 安全与可靠性", 1)
    add_table(doc, ["风险", "控制措施"], [
        ["越权访问", "所有查询带 userId，资源详情和对象存储 Key 做归属校验"],
        ["图片伪造", "服务端检测 MIME、文件头、大小和图片解码结果"],
        ["Token 泄漏", "Access Token 短时效，Refresh Token 可撤销并轮换"],
        ["恶意上传", "限流、单用户配额、文件大小限制、异步处理"],
        ["误删除", "默认软删除，后续可增加回收站恢复"],
        ["任务失败", "BullMQ 重试、失败原因记录和管理员监控"],
        ["数据丢失", "PostgreSQL 备份、对象存储版本控制和生命周期策略"],
    ], widths=[1.45, 5.0])
    add_heading(doc, "九 部署与环境", 1)
    add_table(doc, ["环境", "组成", "说明"], [
        ["本地开发", "NestJS + PostgreSQL + Redis + MinIO", "Docker Compose 一键启动"],
        ["测试环境", "API + 托管数据库 + 对象存储", "执行迁移、接口测试和图片测试"],
        ["生产环境", "Nginx + API + Worker + PostgreSQL + S3", "HTTPS、备份、监控和日志"],
    ], widths=[1.25, 2.55, 2.65])
    add_code(doc, "docker compose up -d postgres redis minio\npnpm prisma migrate dev\npnpm start:dev")
    add_heading(doc, "十 项目目录建议", 1)
    add_code(doc, "server/\n├─ src/\n│  ├─ auth/\n│  ├─ users/\n│  ├─ memories/\n│  ├─ media/\n│  ├─ important-days/\n│  ├─ custom-options/\n│  ├─ search/\n│  ├─ common/\n│  ├─ prisma/\n│  ├─ app.module.ts\n│  └─ main.ts\n├─ prisma/schema.prisma\n├─ test/\n├─ Dockerfile\n└─ docker-compose.yml")
    add_body(doc, "控制器只负责协议层，Service 负责业务规则，Repository 或 Prisma Service 负责数据访问。每个模块拥有自己的 DTO、Service、Controller 和测试，避免后期演进时形成跨模块耦合。")

    add_heading(doc, "十一 与当前前端 MVP 的衔接", 1)
    add_body(doc, "当前前端已经把页面操作和数据访问分开，后续只需要把 IndexedDB 实现替换为 API 实现。页面组件继续依赖同一组 Repository 方法，可以降低后端接入对 UI 的影响。")
    add_code(doc, "interface MemoryRepository {\n  list(): Promise<Memory[]>;\n  get(id: string): Promise<Memory>;\n  create(input: CreateMemoryInput): Promise<Memory>;\n  update(id: string, input: UpdateMemoryInput): Promise<Memory>;\n  remove(id: string): Promise<void>;\n}")
    add_table(doc, ["阶段", "交付内容"], [
        ["P0", "认证、图片上传、记忆 CRUD、EXIF、时间线、基础搜索"],
        ["P1", "重要日子、自定义选项、缩略图、回收站、分页"],
        ["P2", "多图、云同步、导入导出、提醒、分享和 AI"],
    ], widths=[0.8, 5.65])
    add_callout_paragraph(doc, "实施建议  ", "先完成用户、图片和记忆三条主链路，再接入重要日子。后端第一版不拆微服务，优先把数据归属、安全校验、图片处理和可恢复删除做扎实。")

    add_heading(doc, "十二 验收清单", 1)
    for item in [
        "用户可以注册、登录并只能看到自己的数据。",
        "上传一张无 EXIF 图片后，系统可以使用当前时间创建记忆。",
        "上传一张带 EXIF 图片后，系统可以读取拍摄时间并允许手动修正。",
        "只保存图片时，记忆显示为待补充；后续补充文字后状态更新。",
        "标题、备忘录、心情和状态均能被关键词搜索命中。",
        "删除记忆后列表、搜索和重要日子关联均不再展示该记忆。",
        "重要日子可以创建、编辑、删除、关联和取消关联记忆。",
        "图片原图、缩略图和数据库备份策略可以独立恢复。",
    ]:
        add_bullet(doc, item)

    doc.core_properties.title = "照片记忆本后端技术方案"
    doc.core_properties.subject = "照片记忆本后端架构、数据模型与接口设计"
    doc.core_properties.author = "Codex"
    doc.core_properties.keywords = "照片记忆本, 后端, NestJS, PostgreSQL, S3"
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()

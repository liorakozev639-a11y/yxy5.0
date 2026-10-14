from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Iterable

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
FLOW = DOCS / "照片记忆本业务逻辑流程图.png"
MOCKUP = DOCS / "照片记忆本产品示意图.png"
PRD = DOCS / "照片记忆本产品需求文档_PRD_V2.docx"
TECH = DOCS / "照片记忆本前后端技术方案.docx"
CODEMAP = DOCS / "照片记忆本代码模块说明.docx"

FONT_CN = "Microsoft YaHei"
FONT_SERIF = "SimSun"
INK = "253C37"
MUTED = "66756F"
TEAL = "4F7E78"
TEAL_LIGHT = "EEF5F2"
GOLD_LIGHT = "FFF8E8"
GRID = "D9D9D9"


def set_font(run, name=FONT_CN, size=None, bold=None, color=None):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def cell_margins(cell, top=110, start=120, bottom=110, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for tag, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{tag}"))
        if node is None:
            node = OxmlElement(f"w:{tag}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_text(cell, text, *, header=False, center=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.2
    r = p.add_run(str(text))
    set_font(r, size=9.2, bold=header, color="FFFFFF" if header else INK)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    cell_margins(cell)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_row_cant_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = tr_pr.find(qn("w:cantSplit"))
    if cant_split is None:
        cant_split = OxmlElement("w:cantSplit")
        tr_pr.append(cant_split)


def set_cell_width(cell, width_inches):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(int(width_inches * 1440)))
    tc_w.set(qn("w:type"), "dxa")


def add_table(doc, headers: list[str], rows: list[list[str]], widths: list[float] | None = None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    set_repeat_table_header(table.rows[0])
    set_row_cant_split(table.rows[0])
    for i, header in enumerate(headers):
        shade(table.rows[0].cells[i], TEAL)
        set_cell_text(table.rows[0].cells[i], header, header=True, center=len(header) <= 8)
        if widths:
            set_cell_width(table.rows[0].cells[i], widths[i])
    for row_idx, values in enumerate(rows):
        row = table.add_row()
        set_row_cant_split(row)
        cells = row.cells
        for i, value in enumerate(values):
            if row_idx % 2 == 1:
                shade(cells[i], TEAL_LIGHT)
            set_cell_text(cells[i], value, center=(i == 0 and len(str(value)) <= 12))
            if widths:
                set_cell_width(cells[i], widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_page_start(doc):
    """Start a new page without attaching the break to a heading or table."""
    anchor = doc.add_paragraph()
    anchor.paragraph_format.page_break_before = True
    anchor.paragraph_format.space_before = Pt(0)
    anchor.paragraph_format.space_after = Pt(0)
    run = anchor.add_run("\u00a0")
    set_font(run, size=1, color="FFFFFF")


def configure_document(doc: Document):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.orientation = WD_ORIENT.PORTRAIT
    section.top_margin = Inches(0.68)
    section.bottom_margin = Inches(0.68)
    section.left_margin = Inches(0.72)
    section.right_margin = Inches(0.72)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = FONT_CN
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.34

    title = styles["Title"]
    title.font.name = FONT_SERIF
    title._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_SERIF)
    title.font.size = Pt(30)
    title.font.bold = True
    title.font.color.rgb = RGBColor(0, 0, 0)
    title.paragraph_format.space_after = Pt(14)

    for style_name, size, before, after in (("Heading 1", 18, 16, 8), ("Heading 2", 13.5, 12, 6), ("Heading 3", 11.5, 9, 4)):
        style = styles[style_name]
        style.font.name = FONT_CN
        style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    for style_name in ("List Bullet", "List Number"):
        style = styles[style_name]
        style.font.name = FONT_CN
        style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)
        style.font.size = Pt(10.2)
        style.font.color.rgb = RGBColor.from_string(INK)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = footer.add_run("照片记忆本  产品与技术文档")
    set_font(r, size=8.5, color=MUTED)


def add_cover(doc, title, subtitle, version):
    p = doc.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(120)
    p.add_run(title)
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p2.add_run(subtitle)
    set_font(r, size=13, color=MUTED)
    p2.paragraph_format.space_after = Pt(42)
    meta = add_table(doc, ["项目", "内容"], [
        ["文档版本", version],
        ["更新日期", "2026年10月14日"],
        ["产品形态", "本地优先的网页版 MVP"],
        ["代码位置", r"D:\yxy5.0"],
        ["数据位置", r"D:\yxy5.0\data"],
    ], [1.55, 5.15])
    meta.rows[0].cells[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()
    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r3 = p3.add_run("本文档以已实现并通过验证的代码为准")
    set_font(r3, size=9.5, color=MUTED)
    doc.add_page_break()


def add_intro(doc, lead, scope):
    p = doc.add_paragraph()
    r = p.add_run("结论  ")
    set_font(r, bold=True, size=11)
    p.add_run(lead)
    p2 = doc.add_paragraph(scope)
    p2.paragraph_format.space_after = Pt(12)


def add_contents(doc, items: Iterable[str]):
    doc.add_page_break()
    doc.add_heading("文档目录", level=1)
    for index, item in enumerate(items, start=1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.22)
        p.paragraph_format.first_line_indent = Inches(-0.22)
        p.add_run(f"{index}. {item}")
    doc.add_page_break()


def add_bullets(doc, items: Iterable[str]):
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def add_numbered(doc, items: Iterable[str]):
    for index, item in enumerate(items, start=1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.22)
        p.paragraph_format.first_line_indent = Inches(-0.22)
        p.add_run(f"{index}. {item}")


def add_figure(doc, path: Path, caption: str, width=7.0):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(path), width=Inches(width))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(10)
    r = cap.add_run(caption)
    set_font(r, size=9, color=MUTED)


def build_prd():
    doc = Document()
    configure_document(doc)
    add_cover(doc, "照片记忆本产品需求文档", "完整功能版  先有照片后补文字", "V4.0")
    add_intro(
        doc,
        "照片记忆本定位为本地优先的情感型记忆产品。用户先保存照片，再按需要补充标题、备忘录、心情、状态和主题；系统通过长期副本、记忆回声、月度年度总结，把零散照片转化为可以持续回看的个人记忆档案。",
        "本版覆盖当前网页 MVP 的全部功能、情绪电影、数据安全能力和业务边界。默认使用本地模板生成总结；只有用户主动开启云端 AI 后，后端才会发送授权范围内的最小结构化内容。运行数据固定保存在 D 盘项目目录和本机 PostgreSQL。",
    )
    add_figure(doc, MOCKUP, "产品功能总览示意图", 7.0)
    add_contents(doc, [
        "产品定位与目标", "目标人群与核心场景", "产品范围与信息架构", "照片记忆功能", "主题与长期副本", "记忆回声", "月度与年度总结", "数据保险箱与应用锁", "完整业务逻辑", "业务规则与异常处理", "非功能要求", "验收标准与预期效果", "版本边界与后续规划",
    ])

    doc.add_heading("1 产品定位与目标", level=1)
    doc.add_heading("1.1 产品定位", level=2)
    doc.add_paragraph("照片记忆本是一款以照片为第一入口的私人记忆产品。它不要求用户在记录当下写成长篇日记，而是允许用户先把照片收好，再在合适的时候补充文字和情绪信息。产品的核心差异是用主题把单次记忆连接成长线，并通过回声和总结主动帮助用户重新看见过去。")
    doc.add_heading("1.2 核心价值", level=2)
    add_bullets(doc, [
        "降低记录门槛。图片和时间是唯一必需内容，其他字段都可后补。",
        "保留当时语境。标题、备忘录、心情、状态和主题共同描述一段记忆。",
        "形成长期叙事。考研、恋爱、读研等主题可以生成长期副本时间线。",
        "提供温和回看。系统每天最多展示三条记忆回声，并允许保存新的回声感言。",
        "让数据归用户控制。图片、数据库、导出、备份和恢复都清楚显示在本机 D 盘。",
    ])
    doc.add_heading("1.3 产品目标", level=2)
    add_table(doc, ["目标", "产品结果", "主要能力"], [
        ["快速记录", "用户可在一分钟内保存一张照片", "单张导入  批量导入  自动读取时间"],
        ["持续积累", "同主题照片自动进入长期副本", "主题授权  自动收集  时间线"],
        ["情感回看", "旧记忆在合适时间重新出现", "记忆回声  回声感言  重要日子"],
        ["阶段复盘", "用户能看见月度和年度变化", "排行  代表记忆  长期副本进展"],
        ["数据可迁移", "用户可独立导出和恢复全部服务器侧记忆数据", "JSON  ZIP  PDF  PostgreSQL 备份"],
    ], [1.25, 2.35, 3.05])

    doc.add_heading("2 目标人群与核心场景", level=1)
    doc.add_heading("2.1 目标人群", level=2)
    add_bullets(doc, [
        "希望记录恋爱、备考、读研、旅行、工作或个人成长的人。",
        "拍照频率高，但不愿每天写完整日记的人。",
        "重视隐私，希望照片和文字主要保存在自己设备上的人。",
        "希望长期回看某段经历，并在一个月或一年后获得结构化总结的人。",
    ])
    doc.add_heading("2.2 核心场景", level=2)
    add_table(doc, ["场景", "用户任务", "系统响应"], [
        ["随手记录", "上传一张照片，稍后再写", "读取时间并立即保存；其余字段可为空"],
        ["批量整理", "一次导入多张相册照片", "询问是否使用同一主题，逐张保存时间"],
        ["长期经历", "跟踪恋爱或考研过程", "创建长期副本并自动收集同主题记忆"],
        ["偶然回看", "打开首页时想看到过去", "当天首次打开生成最多三条记忆回声"],
        ["阶段复盘", "查看这个月或这一年做了什么", "生成第二人称情绪电影和代表记忆"],
        ["迁移与保护", "备份或迁移本机数据", "先验证应用锁，再导出、备份或恢复"],
    ], [1.3, 2.45, 2.9])

    doc.add_heading("3 产品范围与信息架构", level=1)
    add_table(doc, ["入口", "当前功能", "优先级"], [
        ["记忆首页", "照片卡片  搜索  添加记忆  记忆回声  总结入口", "P0"],
        ["时间线", "按事件日期分组浏览全部记忆", "P0"],
        ["长期副本", "创建  查看  自动收集  暂停  完成  归档", "P0"],
        ["重要日子", "创建纪念日并关联已有照片记忆", "P0"],
        ["记忆回声", "今日回声  三十天历史  感言  排除设置", "P0"],
        ["情绪电影", "月度年度总结  沉浸播放  编辑  感言  档案馆", "P0"],
        ["数据保险箱", "导出  恢复  数据库备份  存储位置  应用锁", "P0"],
    ], [1.4, 4.4, 0.85])

    doc.add_heading("4 照片记忆功能", level=1)
    doc.add_heading("4.1 一次记忆的数据字段", level=2)
    add_table(doc, ["字段", "必填", "规则"], [
        ["图片", "是", "一条记忆对应一张 JPEG PNG 或 WebP，单文件最大 20 MB"],
        ["事件时间", "是", "默认读取图片时间或当前时间，用户可以修改"],
        ["事件标题", "否", "编辑保存后首页卡片和详情立即显示新标题"],
        ["备忘录", "否", "保存当时发生的事，支持后续补充"],
        ["当日心情", "否", "单选；支持开心 平静 难过 焦虑 感动 疲惫及自定义"],
        ["当日状态", "否", "多选；支持约会 散步 旅行 工作 学习 家庭 独处 庆祝及自定义"],
        ["当日主题", "否", "多选；默认无 恋爱 考研 读研，支持用户创建"],
    ], [1.35, 0.75, 4.55])
    doc.add_heading("4.2 单张导入", level=2)
    add_numbered(doc, [
        "用户选择图片，系统读取或设置事件时间。",
        "用户可立即填写标题、备忘录、心情、状态和主题，也可以全部留空。",
        "用户新增主题时，主题立即保存并出现在长期副本的关联主题列表。",
        "保存前，如果所选主题尚未完成长期副本授权，系统询问是否创建或启用该主题副本。",
        "系统先保存媒体，再保存记忆及主题关系；编辑后列表、详情和长期副本统一显示最新内容。",
    ])
    doc.add_heading("4.3 批量导入", level=2)
    add_bullets(doc, [
        "检测到多张照片后，系统询问是否使用相同主题。",
        "如果选择相同主题，整批照片使用同一主题，并只保存图片和各自事件时间。",
        "批量导入暂不填写标题、备忘录、心情和状态。",
        "如果该主题已有启用自动收集的长期副本，整批照片自动加入副本。",
        "批量任务逐张反馈成功或失败；失败项可以重试，不重复已成功记录。",
        "无论单张还是批量，字段未填写完整的照片都不进入待补充记忆列表。",
    ])

    doc.add_heading("5 主题与长期副本", level=1)
    doc.add_heading("5.1 主题规则", level=2)
    doc.add_paragraph("主题是记忆与长期副本之间唯一的自动关联条件。状态和心情只描述当日语境，不参与副本收集。主题“无”不触发长期副本询问。")
    doc.add_heading("5.2 首次授权", level=2)
    add_table(doc, ["用户选择", "本次结果", "以后同主题"], [
        ["同意加入", "创建或启用长期副本，并加入当前记忆", "直接自动收集，不再询问"],
        ["暂不加入", "保存当前记忆，不改变副本设置", "下次继续询问"],
        ["以后不再询问", "保存当前记忆并关闭该主题提示", "不再弹出授权提示"],
    ], [1.45, 3.15, 2.05])
    doc.add_heading("5.3 长期副本状态", level=2)
    add_table(doc, ["状态", "含义", "自动收集"], [
        ["进行中", "副本持续积累", "用户开关决定"],
        ["暂停", "临时停止收集", "关闭"],
        ["已完成", "长期事件已经结束", "关闭"],
        ["已归档", "从主要列表收起但保留数据", "关闭"],
    ], [1.2, 3.7, 1.75])

    doc.add_heading("6 记忆回声", level=1)
    doc.add_paragraph("记忆回声是情感型产品的首要主动回看能力。系统在用户当天首次打开首页时生成，最多三条，历史记录保留最近三十天。回声只使用本机已有记忆，不调用外部生成服务。")
    add_table(doc, ["候选类型", "触发依据", "用户操作"], [
        ["那年今日", "同月同日的旧记忆", "打开原记忆  再看一次  忽略"],
        ["长期副本节点", "副本周年  里程碑  第一条记忆", "进入副本  写下感言"],
        ["过去与现在", "同主题的两段时间记忆", "对比查看  保存回声感言"],
        ["主题记忆", "符合主题与情绪过滤的代表记忆", "关闭主题回声或排除单条记忆"],
    ], [1.45, 2.8, 2.7])
    add_bullets(doc, [
        "用户主动控制是否启用回声，并可排除某个心情、主题或单条记忆。",
        "忽略回声只改变本次回声状态，不删除原记忆。",
        "回声感言保存为独立记录，并在原记忆详情和回声历史中显示。",
        "记忆不足时展示真实空态，不虚构过去发生的内容。",
    ])

    doc.add_heading("7 月度与年度总结", level=1)
    doc.add_paragraph("月度与年度总结统一命名为“情绪电影”。它从首页提醒卡片和独立档案馆进入，以类似年度回顾的沉浸式翻页形式，用第二人称帮助用户回看自己经历过的阶段。")
    doc.add_heading("7.1 生成与提醒", level=2)
    add_bullets(doc, [
        "用户首次确认总结授权后，文字和照片默认参与；两者都可以单独关闭，云端 AI 默认关闭。",
        "每月第一天起，用户当天首次打开首页时检查上个月；新年首次打开时同时检查上一年。",
        "有真实记忆才创建总结；空周期不创建总结，也不显示虚构故事。",
        "未读总结在首页显示“已经生成，可以前往查看”；关闭提醒不删除总结，之后仍可从档案馆进入。",
        "生成结果保存在 PostgreSQL；阅读进度自动保存，再次打开从上次页面继续。",
    ])
    doc.add_heading("7.2 故事结构", level=2)
    add_table(doc, ["类型", "正常结构", "精简结构"], [
        ["月度", "7 页：封面、概览、情绪开场、代表记忆、长期副本、收束、感言", "仅 1 至 2 条记忆时生成 4 页"],
        ["年度", "12 页：封面、概览、季节、长期副本、情绪、代表记忆、原话、日常、收束、感言", "仅 1 至 2 条记忆时生成 4 页"],
    ], [1.05, 4.15, 1.7])
    add_bullets(doc, [
        "情绪开场使用当期出现次数最多的心情；并列时优先最近出现的心情。",
        "如果整期没有心情记录，系统从鼓励文案中稳定选择一句，并避免连续重复最近三次。",
        "代表记忆优先选择标题、备忘录、状态和主题信息更完整的照片，并尽量分布在不同日期。",
        "所有数字、主题、心情、状态、照片和原话必须来自冻结快照；不得补写用户没有记录的事实。",
        "当前版本不加入背景音乐，也不加入双人共同空间或双人叙事。",
    ])
    doc.add_heading("7.3 回看与编辑", level=2)
    add_table(doc, ["能力", "业务规则"], [
        ["沉浸播放", "全屏逐页浏览，窄屏自适应；系统减少动态效果设置开启时关闭非必要动画"],
        ["档案馆", "按月度或年度筛选，查看已生成、未读和已读总结，并可删除单份总结"],
        ["编辑", "可修改旁白、替换授权照片和调整页面顺序；乐观锁冲突时要求刷新，避免覆盖新版本"],
        ["重新生成", "重新读取当前记忆和授权设置，覆盖旧页面；空周期则移除旧总结"],
        ["回声感言", "看完后可写一段总结感言并选择封面照片，作为独立记录保留"],
    ], [1.45, 5.5])
    doc.add_heading("7.4 AI 与隐私", level=2)
    add_bullets(doc, [
        "本地模板始终可用；缺少 AI 配置、网络超时、接口失败或输出校验不通过时自动回退本地模板。",
        "只有用户主动开启云端 AI，后端才发送授权范围内的最小结构化快照；本地路径、数据库连接和密钥永不发送。",
        "AI 仅改写第二人称旁白。后端逐页校验页面数量、事实引用和数字，禁止引入快照外事实。",
        "单条记忆可以设置“不参与总结”；软删除记忆和被排除记忆都不会进入新快照。",
    ])

    doc.add_heading("8 数据保险箱与应用锁", level=1)
    doc.add_heading("8.1 数据保险箱", level=2)
    add_table(doc, ["能力", "产品行为", "输出位置"], [
        ["JSON 导出", "输出版本化结构数据和关系", r"D:\yxy5.0\data\exports"],
        ["ZIP 导出", "输出 data json 原图 manifest 哈希和缺图警告", r"D:\yxy5.0\data\exports"],
        ["PDF 导出", "输出可阅读的中文图文记忆册", r"D:\yxy5.0\data\exports"],
        ["导入恢复", "先预检再确认，重复包幂等，冲突记录生成新 ID", r"D:\yxy5.0\data\temp 与 uploads"],
        ["数据库备份", "调用 pg dump 生成 custom 格式并记录大小与 SHA 256", r"D:\yxy5.0\data\backups"],
        ["存储透明度", "显示照片 备份 导出 临时目录及占用空间", r"D:\yxy5.0\data"],
    ], [1.4, 3.85, 1.7])
    doc.add_heading("8.2 应用锁", level=2)
    add_bullets(doc, [
        "首次进入时提示设置应用锁，也允许暂不设置。",
        "密码长度至少八位，仅保存 scrypt 加盐摘要；恢复密钥只显示一次。",
        "连续五次失败后锁定十五分钟；会话默认三十分钟无操作后失效。",
        "敏感导出、恢复、备份、关闭应用锁和修改锁定时间前需要在五分钟内再次验证。",
        "支持立即锁定、修改密码、暂停保护、用原密码重新开启和恢复密钥重设。",
    ])
    doc.add_heading("8.3 当前数据边界", level=2)
    doc.add_paragraph("服务器导出覆盖照片、记忆、主题、长期副本、记忆回声、回声感言和回声偏好。重要日子及自定义心情和状态的候选列表仍保存在浏览器 IndexedDB 或 localStorage；记忆中已经使用的心情和状态会随记忆导出。后续版本应把这两类浏览器数据迁移到 PostgreSQL，纳入统一备份。")

    doc.add_heading("9 完整业务逻辑", level=1)
    add_figure(doc, FLOW, "照片记忆本完整业务逻辑流程图", 7.0)

    doc.add_heading("10 业务规则与异常处理", level=1)
    add_table(doc, ["情况", "处理规则"], [
        ["上传成功但记忆保存失败", "显示明确错误；媒体清理或重试由后端负责，禁止伪装成功"],
        ["主题创建失败", "不保留仅在前端存在的伪主题，提示检查后端"],
        ["同主题副本冲突", "数据库唯一约束返回 409，前端刷新并使用已有副本"],
        ["照片原文件缺失", "JSON 仍可导出；ZIP 和 PDF记录警告或保留文字"],
        ["导入文件不安全", "拒绝绝对路径 盘符 .. 条目超限 大小超限 压缩比异常或哈希不符"],
        ["导入过程中失败", "数据库事务回滚，清理本次暂存照片，导入记录标记失败"],
        ["PostgreSQL 不可用", "备份标记失败，错误信息脱敏，不泄露连接串或密码"],
        ["应用锁会话失效", "业务 API 返回 401，前端切换到锁屏，保留尚未发送的表单输入"],
        ["云端 AI 不可用", "不阻断总结生成，校验失败或请求异常时立即使用本地模板"],
        ["总结版本冲突", "返回 409，前端提示刷新，禁止旧版本覆盖较新的旁白或页面顺序"],
    ], [2.0, 4.95])

    doc.add_heading("11 非功能要求", level=1)
    add_table(doc, ["类别", "要求"], [
        ["隐私", "默认本地模板；仅经授权向云端 AI 发送最小快照；不记录明文密码；数据库连接信息仅返回脱敏用户名"],
        ["安全", "业务 API 受服务器 Guard 保护；ZIP 导入在写入前完成路径 哈希 关系和大小校验"],
        ["可靠性", "数据库写入使用事务；导出和备份先写临时文件再原子移动"],
        ["可恢复性", "恢复前自动生成 JSON 安全快照；重复导入不复制相同记录"],
        ["性能", "记忆接口游标分页；首页前端自动拉取分页；批量导入顺序执行"],
        ["兼容性", "当前面向 Windows 本机 Chrome Edge 和 Codex 内置浏览器"],
        ["可访问性", "表单具备可读标签，按钮可键盘聚焦，文档图片带替代说明"],
    ], [1.35, 5.6])

    doc.add_page_break()
    doc.add_heading("12 验收标准与预期效果", level=1)
    add_table(doc, ["编号", "验收标准", "当前结果"], [
        ["A01", "单张和批量图片可保存，编辑标题后列表即时更新", "已实现"],
        ["A02", "新建主题能立即用于长期副本，授权后同主题自动收集", "已实现"],
        ["A03", "记忆回声当天最多三条，历史三十天，可保存感言", "已实现"],
        ["A04", "月度和年度情绪电影使用真实快照，支持提醒、播放、进度、编辑、再生成和感言", "已实现并自动测试"],
        ["A05", "JSON ZIP PDF 可生成，ZIP 含 manifest 和原图", "已实现并真实验收"],
        ["A06", "导入先预检后恢复，危险压缩包被拒绝", "已实现并自动测试"],
        ["A07", "pg dump 备份成功并记录大小与 SHA 256", "已实现并真实验收"],
        ["A08", "应用锁从前端和 API 两层阻止未授权访问", "已实现并自动测试"],
        ["A09", "代码与运行数据只在 D 盘项目及指定数据目录", "已验证"],
    ], [0.7, 4.65, 1.6])
    doc.add_paragraph("本次发布前验证基线为前端 38 个测试文件共 100 项通过，后端 33 个测试文件共 136 项通过；前后端生产构建通过，Prisma schema 有效，6 个数据库迁移全部应用。最终交付前会再次执行全量验证。")

    doc.add_heading("13 版本边界与后续规划", level=1)
    add_bullets(doc, [
        "当前为单用户本地版，不包含账号体系、多人共享、评论和社交关系。",
        "不提供云同步、跨设备自动同步、地图轨迹、视频处理或面部识别。",
        "总结默认使用确定性统计和本地模板；云端 AI 只在用户授权且服务端完成配置时用于改写旁白。",
        "当前不提供背景音乐，不提供双人共同空间、双人年度回顾或共同编辑。",
        "下一优先级是把重要日子和自定义候选列表迁移到 PostgreSQL，并纳入统一导出。",
        "后续可增加应用启动时的自动备份策略、备份保留周期和恢复演练提醒。",
    ])

    doc.save(PRD)


def build_tech():
    doc = Document()
    configure_document(doc)
    add_cover(doc, "照片记忆本前后端技术方案", "本地优先网页 MVP  完整实现版", "V4.0")
    add_intro(
        doc,
        "系统采用 React TypeScript Vite 前端、NestJS Prisma 后端和本机 PostgreSQL。图片作为文件保存在 D 盘，结构化数据保存在 PostgreSQL；情绪电影以冻结快照、本地模板和可选云端 AI 构建，应用锁与数据保险箱保护本地数据。",
        "本文档描述当前代码的模块边界、数据模型、API、核心时序、安全控制、部署方式和验证结果。所有路径均以 D:\\yxy5.0 为项目根目录。",
    )
    add_figure(doc, FLOW, "产品业务流程与技术边界", 7.0)
    add_contents(doc, [
        "方案目标与技术栈", "总体架构", "前端方案", "后端方案", "数据模型", "API 设计", "核心业务时序", "记忆回声与总结算法", "数据保险箱", "应用锁与安全", "存储与部署", "测试与质量保证", "已知边界与演进方案",
    ])

    doc.add_heading("1 方案目标与技术栈", level=1)
    add_table(doc, ["层级", "技术", "用途"], [
        ["前端", "React  TypeScript  Vite", "页面 组件 状态和开发代理"],
        ["前端测试", "Vitest  React DOM Server  fake indexeddb", "领域 组件 Repository 与本地存储测试"],
        ["后端", "NestJS  TypeScript", "REST API 模块 注入 校验和全局 Guard"],
        ["数据访问", "Prisma 6", "PostgreSQL 模型 事务 查询和迁移"],
        ["数据库", "PostgreSQL 18  localhost 5433", "记忆 主题 副本 回声 会话和备份记录"],
        ["文件处理", "Multer  AdmZip  Archiver  PDFKit", "图片上传 ZIP 校验与打包 中文 PDF"],
        ["安全", "Node crypto scrypt SHA 256", "密码摘要 会话令牌摘要 文件校验"],
        ["备份", "pg dump", "PostgreSQL custom 格式数据库备份"],
        ["总结生成", "本地模板  可选兼容 OpenAI 的 Chat Completions", "第二人称旁白 事实校验和自动回退"],
    ], [1.1, 2.45, 3.3])
    add_bullets(doc, [
        "前端地址为 http://127.0.0.1:5173，Vite 将 /api 代理到后端。",
        "后端仅绑定 127.0.0.1:3001，CORS 只允许可信本机来源。",
        "数据库连接通过 server/.env 的 DATABASE_URL 提供，当前端口为 5433。",
        "运行数据根目录固定为 D:\\yxy5.0\\data。",
    ])

    doc.add_heading("2 总体架构", level=1)
    doc.add_paragraph("浏览器只通过 Repository 层调用 REST API。NestJS Controller 负责 DTO 和会话边界，Service 负责业务事务，Prisma 访问 PostgreSQL。图片原文件不进入数据库；MediaAsset 保存相对存储路径和元数据。")
    add_table(doc, ["组件", "责任", "依赖"], [
        ["React 页面", "渲染首页 时间线 副本 回声 总结 保险箱", "领域对象与 Repository"],
        ["ApiClient", "超时 JSON 错误 Cookie 和 401 锁屏事件", "fetch"],
        ["NestJS Controller", "路由 DTO 文件上传 响应 Cookie", "Service"],
        ["Service", "授权 排行 事务 导出 恢复 备份", "Prisma 文件系统 crypto"],
        ["Prisma", "模型 关联 查询 事务 迁移", "PostgreSQL"],
        ["D 盘文件系统", "uploads backups exports temp", "受控路径解析"],
    ], [1.45, 3.2, 2.2])

    doc.add_heading("3 前端方案", level=1)
    doc.add_heading("3.1 页面与组件", level=2)
    add_table(doc, ["模块", "主要组件", "关键状态"], [
        ["记忆", "HomeView MemoryCard MemoryDetail MemoryForm BatchImportDialog", "列表 查询 编辑器 批量队列"],
        ["长期副本", "LongTermCopiesView LongTermCopyTimeline LongTermCopyDecisionDialog", "副本列表 当前副本 授权决策"],
        ["重要日子", "ImportantDaysView", "IndexedDB 重要日子及关联记忆"],
        ["记忆回声", "MemoryEchoCard MemoryEchoPage EchoReflectionEditor EchoSettingsPanel", "今日回声 历史 感言 偏好"],
        ["情绪电影", "SummaryReminderCard SummaryArchivePage SummaryStoryPlayer SummaryStoryPage SummaryStoryEditor SummaryReflectionEditor", "授权 到期提醒 档案 播放进度 页面编辑 感言"],
        ["数据保险箱", "DataVaultPage AppLockGate", "存储状态 导入预览 验证动作 锁状态"],
    ], [1.25, 3.8, 1.8])
    doc.add_heading("3.2 状态管理", level=2)
    add_bullets(doc, [
        "记忆列表使用 useReducer 管理加载 新增批量 更新 删除 选择和回声排除状态。",
        "主题 长期副本 重要日子 回声和应用锁使用页面级状态；useMemorySummaries 用 reducer 管理总结授权、提醒、档案、播放、编辑和感言状态机。",
        "ApiClient 默认 credentials include，使 HttpOnly 会话 Cookie 自动随请求发送。",
        "任何业务 API 返回 401 时，ApiClient 派发 photo memory lock required 事件；App 重新读取锁状态并显示 AppLockGate。",
        "应用锁未解锁前不触发记忆 主题 副本和回声请求，避免页面内容闪现。",
    ])
    doc.add_heading("3.3 Repository 边界", level=2)
    add_table(doc, ["Repository", "职责"], [
        ["ApiMemoryRepository", "上传媒体 记忆增删改查 自动拉取分页"],
        ["ApiTopicRepository", "主题列表 创建 更新提示策略与回声设置"],
        ["ApiLongTermCopyRepository", "副本 CRUD 回填 时间线和自动收集开关"],
        ["ApiMemoryEchoRepository", "今日回声 历史 感言 偏好与排除"],
        ["ApiSummaryRepository", "到期检查 授权偏好 生成 列表 详情 进度 页面编辑 再生成 感言和删除"],
        ["ApiVaultRepository", "导出 导入预检 恢复 备份与状态"],
        ["ApiAppLockRepository", "设置 解锁 验证 锁定 改密 恢复与开关"],
    ], [2.0, 4.85])

    doc.add_heading("4 后端方案", level=1)
    add_table(doc, ["NestJS 模块", "责任", "关键实现"], [
        ["MediaModule", "图片上传 下载 删除", "MIME 与签名校验 20 MB 上限 受控路径"],
        ["MemoriesModule", "记忆 CRUD 分页和关联重建", "Prisma 事务 主题校验 副本自动收集"],
        ["TopicsModule", "主题和提示设置", "同用户名称唯一"],
        ["LongTermCopiesModule", "副本生命周期 回填和时间线", "同用户同主题唯一"],
        ["EchoesModule", "生成每日回声 感言和偏好", "确定性评分 每日唯一 最多三条"],
        ["SummariesModule", "月度年度情绪电影生命周期", "上海时区快照 故事计划 本地模板 可选 AI 事实校验 乐观锁"],
        ["VaultModule", "导出 导入 备份 状态和文件下载", "清单 哈希 事务 pg dump"],
        ["AppLockModule", "密码 会话 恢复和全局门禁", "scrypt 令牌摘要 Cookie Guard"],
    ], [1.65, 2.6, 2.6])

    doc.add_heading("5 数据模型", level=1)
    add_table(doc, ["实体", "关键字段", "关系与约束"], [
        ["MediaAsset", "storagePath mimeType fileSize captureAt", "一对一 Memory  可作为副本封面"],
        ["Memory", "title note mood statuses eventAt timezone echoExcluded summaryExcluded", "唯一 mediaId  软删除  多对多 Topic 可单条排除总结"],
        ["Topic", "name isNone suppressLongTermPrompt echoEnabled", "userId name 唯一"],
        ["LongTermCopy", "topicId lifecycleStatus autoCollectEnabled startDate", "userId topicId 唯一"],
        ["LongTermCopyMemory", "copyId memoryId linkedAt", "复合主键"],
        ["MemoryEcho", "echoDate echoType score displayOrder status", "用户 日期 记忆唯一"],
        ["EchoReflection", "memoryEchoId memoryId text sourceEchoDate", "回声可有一条感言"],
        ["EchoPreference", "enabled excludedMoods", "每用户一条"],
        ["MemorySummary", "periodType periodKey status sourceHash generationMode version viewedAt", "用户 周期类型 周期键唯一；保存冻结快照和阅读进度"],
        ["MemorySummaryPage", "pageType displayOrder narration payload factRefs version", "属于一份总结；页面顺序唯一；乐观锁编辑"],
        ["SummaryReflection", "summaryId text coverMediaId", "每份总结最多一条回声感言"],
        ["SummaryPreference", "enabled allowText allowPhotos allowCloudAi consentReviewedAt", "每用户一条授权和隐私偏好"],
        ["AppLockSetting", "passwordHash recoveryKeyHash failedAttempts lockedUntil", "每用户一条"],
        ["AppSession", "tokenHash expiresAt verifiedUntil", "令牌摘要唯一"],
        ["BackupRecord", "status storagePath fileSize checksum", "记录 pg dump 结果"],
        ["ImportRecord", "sourceType status storagePath summary errorMessage", "记录预检和恢复结果"],
    ], [1.55, 3.2, 2.1])

    doc.add_heading("6 API 设计", level=1)
    add_table(doc, ["域", "方法与路径", "说明"], [
        ["健康", "GET /api/health", "公开健康检查"],
        ["媒体", "POST /api/media  GET DELETE /api/media id", "上传 获取和删除图片"],
        ["记忆", "POST GET /api/memories  GET PATCH DELETE /api/memories id", "记忆 CRUD 与游标分页"],
        ["主题", "GET POST /api/topics  PATCH DELETE /api/topics id", "主题 CRUD 与策略"],
        ["长期副本", "GET POST /api/long-term-copies  GET PATCH DELETE id", "副本 CRUD"],
        ["副本扩展", "POST id/backfill  GET id/timeline", "历史回填和时间线"],
        ["回声", "GET /api/echoes/today  GET /api/echoes", "今日和最近三十天"],
        ["回声操作", "PUT id/reflection  POST id/dismiss", "感言和忽略"],
        ["总结检查", "GET /api/summaries/check", "当天首次进入时检查上月和上年并幂等生成"],
        ["总结生成", "POST /api/summaries/generate", "按 MONTH 或 YEAR 与 periodKey 创建快照故事"],
        ["总结列表详情", "GET /api/summaries  GET /api/summaries/:id", "档案筛选、兼容旧统计查询和完整页面详情"],
        ["总结进度编辑", "PATCH /api/summaries/:id/progress  PATCH /api/summaries/:id/pages/:pageId", "保存阅读页、已读状态、旁白、照片和顺序"],
        ["总结操作", "POST /api/summaries/:id/regenerate  POST /api/summaries/:id/reflection  DELETE /api/summaries/:id", "再生成、感言和删除"],
        ["总结偏好", "GET PATCH /api/summary-preferences", "文字、照片、云端 AI 和总开关授权"],
        ["记忆总结设置", "PATCH /api/memories/:id/summary-setting", "单条记忆加入或排除后续总结"],
        ["应用锁", "GET status  POST setup unlock verify lock recover change-password", "锁状态和凭证操作"],
        ["保险箱导出", "POST /api/vault/exports/json zip pdf", "生成导出文件"],
        ["保险箱导入", "POST /api/vault/imports/inspect  POST id/restore", "预检与恢复"],
        ["数据库备份", "GET POST /api/vault/backups", "列表与创建备份"],
        ["保险箱状态", "GET /api/vault/status storage", "数据库脱敏信息和目录占用"],
    ], [1.25, 3.8, 1.8])

    doc.add_heading("7 核心业务时序", level=1)
    doc.add_heading("7.1 保存单张记忆", level=2)
    add_numbered(doc, [
        "前端选择图片并读取时间元数据。",
        "用户填写可选字段并选择主题；新主题先调用 Topics API 保存。",
        "前端根据主题和现有副本计算需要询问的授权项。",
        "用户确认后，前端创建或启用长期副本，或记录以后不再询问。",
        "前端 POST /api/media 获得 mediaId，再 POST /api/memories。",
        "MemoriesService 在同一事务中写入 Memory MemoryTopic，并为启用自动收集的副本写入 LongTermCopyMemory。",
        "前端更新 reducer，卡片和详情立即显示最新标题与标签。",
    ])
    doc.add_heading("7.2 批量导入", level=2)
    add_numbered(doc, [
        "BatchImportDialog 获取稳定文件数组并询问是否统一主题。",
        "统一主题时只执行一次长期副本授权决策。",
        "队列顺序上传媒体和保存记忆，标题 备忘录 心情 状态保持为空。",
        "每项记录成功或失败；重试只处理失败项。",
    ])

    doc.add_heading("8 记忆回声与总结算法", level=1)
    doc.add_heading("8.1 回声生成", level=2)
    add_bullets(doc, [
        "以 Asia Shanghai 的自然日作为 echoDate。每个用户每天只有一条 EchoGeneration。",
        "候选包括那年今日 副本周年 副本里程碑 副本第一条 过去与现在和主题记忆。",
        "过滤软删除 排除记忆 禁用主题 禁用心情和最近展示记录。",
        "评分后使用确定性顺序取前三条，并通过数据库唯一约束处理并发。",
    ])
    doc.add_heading("8.2 情绪电影快照与故事计划", level=2)
    add_bullets(doc, [
        "MONTH 使用当月第一天到下一月第一天，YEAR 使用当年第一天到下一年第一天，统一按 Asia Shanghai 切分。",
        "SummarySnapshotService 只读取未删除且未排除的记忆，根据 allowText 和 allowPhotos 裁剪字段，并计算 SHA 256 sourceHash。",
        "buildStoryPlan 对空周期返回 NO CONTENT；一至两条记忆生成四页精简版，正常月度七页、年度十二页。",
        "最高频心情按次数、最近出现时间和中文名称稳定排序；无心情时从鼓励文案池稳定选取并避开最近三次。",
        "代表记忆按内容完整度和日期去重评分，长期副本只展示周期内确实有关联记忆的进展。",
    ])
    doc.add_heading("8.3 旁白生成、校验与回退", level=2)
    add_numbered(doc, [
        "SummaryTemplateService 先为每一页生成可直接使用的第二人称本地旁白。",
        "仅当 SummaryPreference 已确认且 allowCloudAi 为 true 时，SummaryAiAdapter 才发送裁剪后的结构化快照。",
        "SummaryValidationService 验证页数、页序、factRefs、数字和引用事实，拒绝快照之外的内容。",
        "AI 未配置、超时、返回格式错误或事实校验失败时，继续保存本地模板，generationMode 标记为 TEMPLATE。",
        "保存时从 API 响应递归移除 sourceSnapshot 与 storagePath；密钥只存在服务端环境变量。",
    ])

    doc.add_heading("9 数据保险箱", level=1)
    doc.add_heading("9.1 导出格式", level=2)
    add_table(doc, ["格式", "结构", "校验"], [
        ["JSON", "formatVersion exportedAt userId data", "结构版本 photo memory v1"],
        ["ZIP", "data json photos manifest json", "每个文件 SHA 256  缺图 warning"],
        ["PDF", "中文标题 时间 图片 备忘录 心情状态", "使用本机中文 TTF  缺图继续导出文字"],
    ], [1.1, 3.55, 2.15])
    doc.add_heading("9.2 导入安全", level=2)
    add_bullets(doc, [
        "inspect 阶段不写业务表，只保存待恢复文件和预览摘要。",
        "ZIP 检查路径 盘符 条目数 展开大小 单条大小 压缩比 manifest 哈希和关系完整性。",
        "restore 前生成 JSON 安全快照，再暂存照片并执行 Prisma 事务。",
        "相同记录幂等跳过；同 ID 不同内容生成新 ID，并重建主题 副本 回声和感言关系。",
        "事务失败时清理本次写入的照片并标记 ImportRecord FAILED。",
    ])
    doc.add_heading("9.3 PostgreSQL 备份", level=2)
    doc.add_paragraph("VaultBackupService 解析 DATABASE_URL，把 pg dump 参数作为数组传入 spawn，密码只通过 PGPASSWORD 环境变量传递。备份先写隐藏 part 文件，成功后原子改名；随后计算 SHA 256 并更新 BackupRecord。错误文本会删除连接串、密码和 URL 编码密码。")

    doc.add_heading("10 应用锁与安全", level=1)
    add_table(doc, ["控制", "实现"], [
        ["密码摘要", "crypto scrypt 随机盐 timingSafeEqual，不保存明文"],
        ["恢复密钥", "高熵随机值，只返回一次，数据库保存摘要"],
        ["会话", "随机令牌只存 SHA 256 摘要，HttpOnly SameSite Strict Cookie"],
        ["自动锁", "默认三十分钟滑动过期，手动锁定删除全部用户会话"],
        ["失败限制", "五次错误后 lockedUntil 延后十五分钟"],
        ["敏感操作", "会话必须解锁且 verifiedUntil 在五分钟内"],
        ["API 门禁", "全局 AppLockGuard 仅放行 health 和必要锁接口"],
        ["本机边界", "服务仅监听 127.0.0.1，CORS 校验可信 localhost origin"],
    ], [1.55, 5.3])

    doc.add_heading("11 存储与部署", level=1)
    add_table(doc, ["目录", "内容", "是否进入 Git"], [
        [r"D:\yxy5.0\data\uploads", "照片原文件", "否"],
        [r"D:\yxy5.0\data\backups", "PostgreSQL dump", "否"],
        [r"D:\yxy5.0\data\exports", "JSON ZIP PDF", "否"],
        [r"D:\yxy5.0\data\temp", "导入预检临时文件", "否"],
        [r"D:\yxy5.0\server\.env", "DATABASE_URL 和本机配置", "否"],
        [r"D:\yxy5.0\server\prisma\migrations", "数据库迁移脚本", "是"],
    ], [3.05, 2.55, 1.25])
    doc.add_heading("11.1 启动顺序", level=2)
    add_numbered(doc, [
        "确认 PostgreSQL 在 localhost 5433 接受连接。",
        "在 D:\\yxy5.0\\server 执行 npx prisma migrate deploy。",
        "在 D:\\yxy5.0\\server 执行 npm run dev，后端监听 3001。",
        "在 D:\\yxy5.0 执行 npm run dev，前端监听 5173。",
        "访问 http://127.0.0.1:5173 并完成应用锁选择。",
    ])
    doc.add_heading("11.2 环境配置", level=2)
    add_bullets(doc, [
        "DATABASE_URL 必须指向 PostgreSQL；用户名 密码 数据库名和端口按本机实际值填写。",
        "PG_DUMP_PATH 默认使用 D:\\pgsql18\\pgsql\\pgAdmin 4\\runtime\\pg_dump.exe。",
        "LOCAL_USER_ID 默认 local user，可在独立测试进程中覆盖。",
        "PORT 默认 3001。",
        "SUMMARY_AI_BASE_URL SUMMARY_AI_API_KEY SUMMARY_AI_MODEL 用于可选云端 AI；任一必需项缺失时走本地模板。",
        "SUMMARY_AI_TIMEOUT_MS 控制 AI 请求超时，默认 12000 毫秒。所有真实密钥只放在未纳入 Git 的 server/.env。",
    ])

    doc.add_heading("12 测试与质量保证", level=1)
    add_table(doc, ["验证项", "结果"], [
        ["前端测试", "38 个测试文件 100 项通过（功能完成时基线）"],
        ["后端测试", "33 个测试文件 136 项通过（功能完成时基线）"],
        ["生产构建", "前端和后端均通过"],
        ["Prisma", "schema valid，6 个 migration 全部已应用"],
        ["真实数据库", "PostgreSQL localhost 5433 可用"],
        ["真实导出", "JSON 10 KB  ZIP 1.1 MB  PDF 1.2 MB，均有效"],
        ["真实备份", "pg dump 38 KB，状态 COMPLETED，SHA 256 已记录"],
        ["浏览器冒烟", "首页 保险箱 存储路径和应用锁表单正常，控制台无错误"],
        ["Git", "文档记录功能实现；最终全量验证完成后统一提交本地并推送 GitHub"],
    ], [2.0, 4.85])
    doc.add_heading("12.1 重点测试覆盖", level=2)
    add_bullets(doc, [
        "图片签名和 MIME 不一致、标题编辑、主题关系和副本自动收集。",
        "回声候选排序、每日幂等、排除设置和感言保存。",
        "总结跨月跨年边界、精简版、最高频心情、无心情鼓励、代表记忆和空周期。",
        "总结授权裁剪、AI 不可用回退、事实引用校验、乐观锁冲突、播放进度、页面顺序和无音乐约束。",
        "ZIP Slip、绝对路径、压缩炸弹、坏哈希、关系损坏和重复导入。",
        "应用锁密码摘要、失败限流、过期会话、Cookie 属性和业务 API 门禁。",
        "pg dump 参数数组、路径含空格、成功失败记录和连接串脱敏。",
    ])

    doc.add_heading("13 已知边界与演进方案", level=1)
    add_table(doc, ["当前边界", "影响", "建议"], [
        ["重要日子仍在 IndexedDB", "不在服务器 JSON ZIP 备份中", "新增 ImportantDay 与关联表并迁移"],
        ["自定义候选列表在 localStorage", "未使用的候选值不随迁移", "新增用户字典表或导出前端偏好"],
        ["单用户固定 userId", "不支持多人或账号隔离", "引入本地账号和用户主表"],
        ["手动数据库备份", "依赖用户主动执行", "增加计划任务和保留策略"],
        ["本机 Cookie secure false", "只适用于 HTTP localhost", "部署 HTTPS 时启用 Secure"],
        ["云端 AI 为可选外部依赖", "启用时会发送已授权的最小结构化内容", "保持默认关闭并在设置中明确服务提供方"],
        ["当前无背景音乐和双人模式", "情绪电影专注个人图文回看", "仅在用户价值验证后再单独设计，不与当前范围混入"],
    ], [2.1, 2.2, 2.55])

    doc.save(TECH)


FILE_DESCRIPTIONS = {
    "src/App.tsx": "前端总编排器。创建各 Repository，加载记忆、主题、副本和应用锁，并把首页、时间线、长期副本、回声、情绪电影与保险箱串成单页应用。",
    "src/main.tsx": "React 启动入口，把 App 挂载到 DOM，并载入全局样式。",
    "src/app-state.ts": "记忆列表 reducer；统一处理初始化、批量新增、编辑、删除、选中和回声排除，避免页面状态分散。",
    "src/api/client.ts": "REST 基础客户端。统一 JSON、超时、Cookie、错误消息和 401 锁屏事件，所有 API Repository 复用。",
    "src/styles.css": "全局视觉系统与响应式规则；包含照片墙、弹窗、回声、保险箱和情绪电影的沉浸样式、窄屏布局及 reduced-motion 降级。",
    "src/components/AppLockGate.tsx": "应用锁门面。根据未设置、已锁定、限流和恢复状态渲染表单，解锁前遮蔽全部业务页面。",
    "src/components/BatchImportDialog.tsx": "批量导入向导。稳定保存文件队列，询问统一主题，显示逐项进度并只重试失败项。",
    "src/components/DataVaultPage.tsx": "数据保险箱页面。展示存储位置，组织导出、导入预检/恢复、数据库备份和敏感操作再验证。",
    "src/components/EchoReflectionEditor.tsx": "回声感言编辑器，把用户新的感受保存为独立感言而不改写原记忆。",
    "src/components/EchoSettingsPanel.tsx": "记忆回声设置面板，控制总开关及心情、主题和单条记忆排除。",
    "src/components/HomeView.tsx": "记忆首页布局，组合照片墙、搜索、添加入口、回声卡片和情绪电影提醒卡片。",
    "src/components/ImportantDaysView.tsx": "重要日子列表和编辑界面，计算纪念日距离并关联已有记忆。",
    "src/components/LongTermCopiesView.tsx": "长期副本总览；展示创建、生命周期、自动收集和进入时间线的操作。",
    "src/components/LongTermCopyDecisionDialog.tsx": "主题首次授权弹窗，支持加入、暂不加入和以后不再询问。",
    "src/components/LongTermCopyForm.tsx": "长期副本创建/编辑表单，选择唯一关联主题并维护名称、日期和状态。",
    "src/components/LongTermCopyTimeline.tsx": "按事件时间稳定排列副本内照片、标题和备忘录。",
    "src/components/MemoryCard.tsx": "照片墙单卡片，展示缩略图、标题、时间与主题，并触发详情。",
    "src/components/MemoryDetail.tsx": "记忆详情与编辑入口，展示完整图文、标签、回声感言和总结排除开关。",
    "src/components/MemoryEchoCard.tsx": "首页回声卡片，呈现单条回声理由、照片和查看/忽略/写感言动作。",
    "src/components/MemoryEchoPage.tsx": "独立回声页面，浏览今日和最近三十天历史并进入设置。",
    "src/components/MemoryForm.tsx": "单张记忆新增与编辑表单，处理标题、备忘录、时间、心情、状态、主题和自定义选项。",
    "src/components/MemorySummaryPage.tsx": "保留的旧版统计总结页，供兼容按月/年统计查询；新体验由情绪电影组件承接。",
    "src/components/SummaryArchivePage.tsx": "情绪电影档案馆，按月度/年度筛选并打开、继续或删除总结。",
    "src/components/SummaryReflectionCard.tsx": "在档案馆展示已保存的月度/年度回声感言和封面。",
    "src/components/SummaryReflectionEditor.tsx": "总结结束后的感言编辑器，校验文字并允许选择授权照片作为封面。",
    "src/components/SummaryReminderCard.tsx": "首页未读总结提醒，提供立即查看、查看档案和本次关闭。",
    "src/components/SummaryStoryEditor.tsx": "情绪电影页面编辑器，修改旁白、代表照片和顺序，并把版本号交给乐观锁接口。",
    "src/components/SummaryStoryPage.tsx": "按 COVER、MOOD、MEMORY 等页面类型渲染故事页，严格使用后端公开 payload。",
    "src/components/SummaryStoryPlayer.tsx": "全屏逐页播放器，处理上一页/下一页、关闭、继续阅读、已读和进入编辑/感言。",
    "src/components/Toast.tsx": "轻量全局反馈条，用于显示成功、失败和需要用户注意的短消息。",
    "src/hooks/use-memory-summaries.ts": "情绪电影前端状态机。负责首次检查、授权、提醒、档案加载、播放进度队列、页面编辑、重新生成、感言和删除。",
    "src/domain/memory-summary.ts": "情绪电影领域类型与守卫；定义周期、状态、页面、偏好、感言及 READY 判断。",
    "src/domain/memory.ts": "照片记忆核心模型、创建与更新输入、完整度和展示所需的类型。",
    "src/domain/memory-echo.ts": "记忆回声、感言和偏好领域模型。",
    "src/domain/memory-echo-state.ts": "回声前端 reducer 与状态转换，处理今日回声、历史、忽略、排除和感言。",
    "src/domain/long-term-copy-policy.ts": "主题与长期副本授权决策规则，区分本次加入、继续询问和永久不询问。",
    "src/domain/batch-import.ts": "批量导入队列、统一主题和失败项重试的纯业务函数。",
    "src/domain/date.ts": "日期格式化、上海时区显示和分组辅助函数。",
    "src/domain/important-day.ts": "重要日子模型、纪念日日期差和关联记忆规则。",
    "src/domain/data-vault.ts": "导出、导入、备份、存储状态和应用锁的前端类型。",
    "src/domain/options.ts": "默认心情、状态和主题候选项。",
    "src/domain/topic.ts": "主题模型及提示、回声相关设置。",
    "src/repositories/api-memory-repository.ts": "封装媒体上传和记忆 CRUD；自动遍历游标分页并把后端 DTO 转成前端模型。",
    "src/repositories/api-topic-repository.ts": "封装主题列表、创建及提示策略更新。",
    "src/repositories/api-long-term-copy-repository.ts": "封装长期副本 CRUD、回填、时间线与自动收集开关。",
    "src/repositories/api-memory-echo-repository.ts": "封装今日回声、三十天历史、感言、忽略及回声偏好接口。",
    "src/repositories/api-summary-repository.ts": "封装情绪电影到期检查、授权、生成、列表、详情、进度、页面编辑、再生成、感言和删除接口。",
    "src/repositories/api-vault-repository.ts": "封装 JSON、ZIP、PDF 导出，导入预检与恢复，数据库备份和存储状态。",
    "src/repositories/api-app-lock-repository.ts": "封装应用锁设置、解锁、验证、立即锁定、改密、恢复和开关。",
    "src/storage/db.ts": "IndexedDB 适配层，保存仍属浏览器侧的草稿与重要日子，并提供升级和兼容读取。",
    "src/storage/image-metadata.ts": "读取图片 EXIF 拍摄时间；无时间信息时回退本机当前时间。",
    "server/src/main.ts": "NestJS 启动入口；配置本机监听、全局前缀、DTO 校验、Cookie/CORS 和端口。",
    "server/src/app.module.ts": "后端根模块，装配 Prisma、媒体、记忆、主题、长期副本、回声、总结、保险箱和应用锁。",
    "server/src/health.controller.ts": "公开健康检查，用于确认后端进程可访问。",
    "server/src/common/config.ts": "集中解析服务端端口、数据根目录、上传目录和环境配置。",
    "server/src/common/local-security.ts": "限制服务只接受可信 localhost 来源，构成本地应用网络边界。",
    "server/src/common/local-user.ts": "提供单用户 MVP 的固定本地 userId。",
    "server/src/prisma/prisma.service.ts": "PrismaClient 生命周期适配，随 Nest 启停建立和释放 PostgreSQL 连接。",
    "server/src/prisma/prisma.module.ts": "导出全局 PrismaService，供业务模块注入。",
    "server/src/media/media.service.ts": "验证 MIME 与文件签名、20MB 限制、受控路径写入/读取/删除和上传补偿清理。",
    "server/src/memories/memories.service.ts": "记忆事务核心；写入字段和主题关系，自动收集长期副本，处理软删除、分页及单条总结排除。",
    "server/src/topics/topics.service.ts": "主题 CRUD 与同名约束，保存长期副本提示和回声开关。",
    "server/src/long-term-copies/long-term-copies.service.ts": "长期副本创建、状态流转、历史回填、自动收集和稳定分页时间线。",
    "server/src/echoes/echo-ranking.ts": "回声候选评分与确定性排序纯函数。",
    "server/src/echoes/echoes.service.ts": "按上海自然日生成最多三条回声，处理三十天历史、排除、忽略和回声感言。",
    "server/src/summaries/summaries.service.ts": "情绪电影生命周期核心：幂等生成、快照、故事页持久化、档案、阅读进度、编辑乐观锁、再生成、感言、删除和偏好。",
    "server/src/summaries/summary-snapshot.service.ts": "按授权冻结月度/年度真实数据，裁剪文字和照片，计算排行、长期副本进度、鼓励文案及 sourceHash。",
    "server/src/summaries/summary-story.domain.ts": "故事规划纯函数；处理周期键、最高频心情、代表记忆、4/7/12 页结构和稳定鼓励文案。",
    "server/src/summaries/summary-story.types.ts": "快照、故事计划、页面草稿、事实引用和情绪结果类型。",
    "server/src/summaries/summary-template.service.ts": "生成可离线使用的第二人称本地旁白，是 AI 关闭或失败时的可信基线。",
    "server/src/summaries/summary-ai.adapter.ts": "调用兼容 OpenAI Chat Completions 的可选服务；读取服务端环境变量、限制超时并把失败安全降级。",
    "server/src/summaries/summary-validation.service.ts": "校验 AI 页数、事实引用和数字，拒绝快照外内容，保证旁白不虚构。",
    "server/src/summaries/summary-copy.ts": "维护鼓励文案等受控产品文案。",
    "server/src/summaries/summary.domain.ts": "兼容旧版按需统计接口的日期区间与汇总纯函数。",
    "server/src/summaries/summary.dto.ts": "总结生成、筛选、进度、页面编辑、感言和授权偏好的 DTO 校验。",
    "server/src/summaries/summaries.controller.ts": "暴露总结和 summary-preferences REST 路由，把本地用户上下文传给服务层。",
    "server/src/summaries/summaries.module.ts": "注册总结服务、快照、模板、AI 适配器和事实校验器。",
    "server/src/vault/vault-export.service.ts": "生成版本化 JSON、带原图和 manifest 的 ZIP、中文图文 PDF，并记录缺图警告。",
    "server/src/vault/vault-import.service.ts": "执行导入预检后的事务恢复、ID 冲突重映射、幂等跳过、照片暂存和失败清理。",
    "server/src/vault/import-validator.ts": "校验 ZIP Slip、绝对路径、压缩炸弹、清单哈希和关系完整性。",
    "server/src/vault/export-manifest.ts": "生成导出清单与 SHA-256 校验信息。",
    "server/src/vault/vault-backup.service.ts": "以参数数组调用 pg_dump，原子写入 custom 备份并记录大小、哈希和脱敏错误。",
    "server/src/vault/database-url.ts": "安全解析并脱敏 PostgreSQL 连接串，为备份命令构造参数。",
    "server/src/app-lock/app-lock.service.ts": "应用锁业务：设置、解锁、短期再验证、立即锁定、改密、恢复、限流和会话滑动过期。",
    "server/src/app-lock/app-lock.crypto.ts": "基于 scrypt、随机盐和 timingSafeEqual 的密码与恢复密钥摘要。",
    "server/src/app-lock/app-lock.guard.ts": "全局 Guard；锁开启且会话无效时拒绝业务 API，只放行健康和必要锁接口。",
    "server/prisma/schema.prisma": "PostgreSQL 数据模型总定义，包含记忆、主题、副本、回声、情绪电影、保险箱和应用锁实体及约束。",
    "server/prisma/seed.ts": "初始化“无、恋爱、考研、读研”等默认主题，使用 upsert 保证重复执行安全。",
    "server/prisma/migrations/0001_init/migration.sql": "建立媒体、记忆、主题和长期副本的初始表结构。",
    "server/prisma/migrations/0002_memory_fields_and_copy_policy/migration.sql": "补充记忆字段和长期副本主题授权策略。",
    "server/prisma/migrations/0003_memory_echo/migration.sql": "新增记忆回声、回声偏好和感言相关表。",
    "server/prisma/migrations/0004_echo_generation_source_topic/migration.sql": "补充回声生成批次与来源主题，保证每日幂等和可追踪。",
    "server/prisma/migrations/0005_vault_lock_summary/migration.sql": "新增数据保险箱、应用锁和旧版总结相关结构。",
    "server/prisma/migrations/0006_emotional_memory_summaries/migration.sql": "新增情绪电影、故事页面、总结感言、隐私偏好和单条记忆排除字段。",
    "tools/generate_final_docs.py": "从当前代码事实生成 PRD、前后端技术方案和本代码模块说明三份 Word 文档。",
    "tools/build_prd_v2.py": "早期 PRD 生成脚本，保留用于追溯旧版文档。",
    "tools/build_backend_doc.py": "早期后端方案文档生成脚本。",
    "tools/build_backend_v2.py": "第二版后端方案生成脚本。",
    "tools/build_fullstack_plan.py": "早期前后端技术方案生成脚本。",
    "package.json": "前端依赖与 dev、build、test、server 快捷脚本。",
    "server/package.json": "后端 NestJS、Prisma、导入导出和测试依赖及启动脚本。",
    "vite.config.ts": "Vite/React 配置、/api 到 3001 的本机代理和 Vitest 文件范围。",
    "tsconfig.json": "前端 TypeScript 工程引用入口。",
    "tsconfig.app.json": "前端应用 TypeScript 编译选项。",
    "tsconfig.node.json": "Vite 配置等 Node 侧 TypeScript 编译选项。",
    "server/tsconfig.json": "NestJS 后端 TypeScript 输出和模块解析配置。",
    "server/vitest.config.ts": "后端 Vitest 与测试目录配置。",
    "server/.env.example": "后端环境变量模板；只放占位值，不包含本机密码或 AI 密钥。",
    "index.html": "Vite 页面壳和 React 挂载节点。",
    ".gitignore": "排除 node_modules、构建产物、本机环境变量和 D 盘运行数据，避免隐私数据进入 Git。",
}


def source_inventory() -> list[Path]:
    files: set[Path] = set()
    for base, patterns in (
        (ROOT / "src", ("*.ts", "*.tsx", "*.css")),
        (ROOT / "server" / "src", ("*.ts",)),
        (ROOT / "server" / "test", ("*.ts",)),
        (ROOT / "server" / "prisma", ("*.prisma", "*.ts", "*.sql")),
        (ROOT / "tools", ("*.py",)),
    ):
        if base.exists():
            for pattern in patterns:
                files.update(path for path in base.rglob(pattern) if path.is_file())
    for relative in (
        ".gitignore", "index.html", "package.json", "package-lock.json", "tsconfig.json",
        "tsconfig.app.json", "tsconfig.node.json", "vite.config.ts", "server/.env.example",
        "server/package.json", "server/package-lock.json", "server/tsconfig.json", "server/vitest.config.ts",
    ):
        path = ROOT / relative
        if path.exists():
            files.add(path)
    return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix().lower())


def code_module(relative: str) -> str:
    if ".test." in relative or relative.startswith("server/test/"):
        return "自动化测试"
    if relative.startswith("src/components/"):
        return "前端组件"
    if relative.startswith("src/domain/"):
        return "前端领域"
    if relative.startswith("src/repositories/") or relative.startswith("src/api/"):
        return "前端数据访问"
    if relative.startswith("src/storage/"):
        return "浏览器存储"
    if relative.startswith("src/hooks/"):
        return "前端流程编排"
    if relative.startswith("src/"):
        return "前端入口与样式"
    if relative.startswith("server/src/summaries/"):
        return "后端·情绪电影"
    if relative.startswith("server/src/echoes/"):
        return "后端·记忆回声"
    if relative.startswith("server/src/app-lock/"):
        return "后端·应用锁"
    if relative.startswith("server/src/vault/"):
        return "后端·数据保险箱"
    if relative.startswith("server/src/media/") or relative.startswith("server/src/memories/"):
        return "后端·照片记忆"
    if relative.startswith("server/src/topics/") or relative.startswith("server/src/long-term-copies/"):
        return "后端·主题与副本"
    if relative.startswith("server/src/"):
        return "后端基础设施"
    if relative.startswith("server/prisma/migrations/"):
        return "数据库迁移"
    if relative.startswith("server/prisma/"):
        return "数据库模型"
    if relative.startswith("tools/"):
        return "文档工具"
    return "工程配置"


def code_description(relative: str) -> str:
    if relative in FILE_DESCRIPTIONS:
        return FILE_DESCRIPTIONS[relative]
    name = Path(relative).name
    if relative.endswith("package-lock.json"):
        return "锁定实际安装依赖版本和完整性哈希，保证本机与后续安装结果可复现。"
    if ".test." in relative or relative.startswith("server/test/"):
        target = name.replace(".test.tsx", "").replace(".test.ts", "").replace(".spec.ts", "")
        kind = "端到端接口" if ".e2e." in name else "单元与回归"
        return f"{target} 的{kind}测试；固定关键输入、成功路径和异常边界，防止功能修改后回归。"
    if name.endswith(".controller.ts"):
        return "NestJS 路由层；接收并校验请求，把本地用户上下文和 DTO 交给对应 Service。"
    if name.endswith(".service.ts"):
        return "NestJS 业务服务；承载该模块事务、查询、权限边界和响应组装。"
    if name.endswith(".module.ts"):
        return "NestJS 依赖注入模块；注册 Controller、Service 及跨模块依赖。"
    if name.endswith(".dto.ts"):
        return "class-validator DTO；限制请求字段、枚举、长度和可选性。"
    if relative.startswith("src/components/"):
        component = name.rsplit(".", 1)[0]
        return f"{component} React 组件；渲染对应界面并通过 props 回调把业务动作交回 App 或 Hook。"
    if relative.startswith("src/test-utils/"):
        return "前端测试夹具与构造器，减少回声等测试的重复样本代码。"
    if name == "test-setup.ts":
        return "前端测试全局初始化，安装 IndexedDB 等浏览器 API 替身。"
    if name == "vite-env.d.ts":
        return "声明 Vite 客户端环境类型。"
    return "项目支撑文件；由所属模块在构建、运行或文档生成阶段使用。"


def build_code_map():
    doc = Document()
    configure_document(doc)
    add_cover(doc, "照片记忆本代码模块说明", "逐文件功能分类与实现索引", "V1.0")
    add_intro(
        doc,
        "代码按“前端交互与状态—Repository—NestJS Controller/Service—Prisma/PostgreSQL—D 盘文件系统”分层。情绪电影在既有架构上新增独立领域、前端状态机和后端快照生成链路，没有绕过应用锁或数据边界。",
        "本文档列出仓库内自有源代码、测试、迁移、配置和文档脚本。node_modules、dist、运行数据和生成后的 Word/图片属于依赖、构建产物或用户数据，不作为自有源代码逐项列出。",
    )
    add_figure(doc, FLOW, "从记录、回看、总结到数据保护的业务与代码边界", 6.35)
    add_contents(doc, ["架构与阅读顺序", "运行时调用链", "前端代码索引", "后端代码索引", "数据库与迁移索引", "自动化测试索引", "工程配置与文档工具", "维护建议"])

    doc.add_heading("1 架构与阅读顺序", level=1)
    add_table(doc, ["层级", "入口", "实现原则"], [
        ["前端页面", "src/App.tsx 与 src/components", "组件只负责展示与交互，跨页面流程由 App 和 Hook 编排"],
        ["前端领域", "src/domain 与 src/app-state.ts", "纯类型、纯函数和 reducer 可独立测试"],
        ["前端数据访问", "src/repositories 与 src/api/client.ts", "页面不直接拼接 URL；统一错误、Cookie 和锁屏处理"],
        ["后端接口", "server/src/*/*.controller.ts", "Controller 只做 HTTP 边界和 DTO，业务规则进入 Service"],
        ["后端业务", "server/src/*/*.service.ts", "事务、幂等、授权、文件安全和响应裁剪集中在服务层"],
        ["持久化", "server/prisma", "关系和唯一约束由 PostgreSQL 保证，演进通过 migration 落地"],
    ], [1.35, 2.25, 3.45])
    doc.add_heading("2 运行时调用链", level=1)
    add_numbered(doc, [
        "用户在 React 组件触发操作，App 或 useMemorySummaries 组织完整业务流程。",
        "Repository 通过 ApiClient 访问 /api，并携带 HttpOnly 应用锁会话 Cookie。",
        "NestJS Controller 使用 DTO 校验输入；AppLockGuard 在业务路由前检查会话。",
        "Service 执行业务规则和 Prisma 事务；图片、导出和备份通过受控 D 盘路径读写。",
        "Prisma 将结构化数据写入 PostgreSQL；Controller 仅返回公开 DTO，不暴露 storagePath、sourceSnapshot 或密钥。",
    ])

    files = source_inventory()
    grouped: dict[str, list[list[str]]] = {}
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        grouped.setdefault(code_module(relative), []).append([relative, code_module(relative), code_description(relative)])

    section_groups = [
        ("3 前端代码索引", ("前端入口与样式", "前端组件", "前端流程编排", "前端领域", "前端数据访问", "浏览器存储")),
        ("4 后端代码索引", ("后端基础设施", "后端·照片记忆", "后端·主题与副本", "后端·记忆回声", "后端·情绪电影", "后端·数据保险箱", "后端·应用锁")),
        ("5 数据库与迁移索引", ("数据库模型", "数据库迁移")),
        ("6 自动化测试索引", ("自动化测试",)),
        ("7 工程配置与文档工具", ("工程配置", "文档工具")),
    ]
    code_rows_per_page = 6
    for heading, modules in section_groups:
        section_started = False
        for module in modules:
            rows = grouped.get(module, [])
            if not rows:
                continue
            for chunk_index in range(0, len(rows), code_rows_per_page):
                add_page_start(doc)
                starts_section = not section_started
                if starts_section:
                    section_heading = doc.add_heading(heading, level=1)
                    section_started = True
                continuation = "（续）" if chunk_index else ""
                module_heading = doc.add_heading(f"{module}{continuation}", level=2)
                add_table(
                    doc,
                    ["文件", "对应模块", "实现方式"],
                    rows[chunk_index:chunk_index + code_rows_per_page],
                    [2.45, 1.25, 3.25],
                )

    add_page_start(doc)
    doc.add_heading("8 维护建议", level=1)
    add_bullets(doc, [
        "新增用户功能时，先补领域规则和失败测试，再接 Repository、Service、Controller 和组件，避免把业务判断堆进页面。",
        "修改 Prisma schema 时必须新增 migration，禁止只运行 db push；生产前执行 migrate deploy。",
        "情绪电影新增页面类型时，需要同步更新故事类型、计划、模板、AI 校验、前端渲染和端到端测试。",
        "任何导出、导入、备份或 AI 改动都要复核应用锁、路径限制、敏感字段裁剪和失败回退。",
        "交付前固定执行前端测试与构建、后端测试与构建、Prisma validate，以及 Word 文档逐页渲染检查。",
    ])
    doc.add_paragraph(f"本次索引共覆盖 {len(files)} 个仓库自有代码与配置文件。")
    doc.save(CODEMAP)


if __name__ == "__main__":
    DOCS.mkdir(parents=True, exist_ok=True)
    build_prd()
    build_tech()
    build_code_map()
    print(PRD)
    print(TECH)
    print(CODEMAP)

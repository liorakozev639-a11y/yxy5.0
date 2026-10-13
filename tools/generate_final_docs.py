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


ROOT = Path(r"D:\yxy5.0")
DOCS = ROOT / "docs"
FLOW = DOCS / "照片记忆本业务逻辑流程图.png"
MOCKUP = DOCS / "照片记忆本产品示意图.png"
PRD = DOCS / "照片记忆本产品需求文档_PRD_V2.docx"
TECH = DOCS / "照片记忆本前后端技术方案.docx"

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
    for i, header in enumerate(headers):
        shade(table.rows[0].cells[i], TEAL)
        set_cell_text(table.rows[0].cells[i], header, header=True, center=len(header) <= 8)
        if widths:
            set_cell_width(table.rows[0].cells[i], widths[i])
    for row_idx, values in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(values):
            if row_idx % 2 == 1:
                shade(cells[i], TEAL_LIGHT)
            set_cell_text(cells[i], value, center=(i == 0 and len(str(value)) <= 12))
            if widths:
                set_cell_width(cells[i], widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


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
        ["更新日期", "2026年10月13日"],
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
    add_cover(doc, "照片记忆本产品需求文档", "完整功能版  先有照片后补文字", "V3.0")
    add_intro(
        doc,
        "照片记忆本定位为本地优先的情感型记忆产品。用户先保存照片，再按需要补充标题、备忘录、心情、状态和主题；系统通过长期副本、记忆回声、月度年度总结，把零散照片转化为可以持续回看的个人记忆档案。",
        "本版覆盖当前网页 MVP 的全部功能、数据安全能力和业务边界。产品不依赖外部 AI，也不会把照片或文字上传到第三方；运行数据固定保存在 D 盘项目目录和本机 PostgreSQL。",
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
        ["阶段复盘", "查看这个月或这一年做了什么", "生成确定性统计和代表记忆"],
        ["迁移与保护", "备份或迁移本机数据", "先验证应用锁，再导出、备份或恢复"],
    ], [1.3, 2.45, 2.9])

    doc.add_heading("3 产品范围与信息架构", level=1)
    add_table(doc, ["入口", "当前功能", "优先级"], [
        ["记忆首页", "照片卡片  搜索  添加记忆  记忆回声  总结入口", "P0"],
        ["时间线", "按事件日期分组浏览全部记忆", "P0"],
        ["长期副本", "创建  查看  自动收集  暂停  完成  归档", "P0"],
        ["重要日子", "创建纪念日并关联已有照片记忆", "P0"],
        ["记忆回声", "今日回声  三十天历史  感言  排除设置", "P0"],
        ["记忆总结", "月度年度切换  排行  代表照片  副本进展", "P0"],
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
    doc.add_paragraph("总结模块从记忆首页进入，不增加底部导航。用户选择月份或年份后，系统按 Asia Shanghai 时区读取真实记录并生成统计结果。")
    add_table(doc, ["输出", "数据来源", "空数据处理"], [
        ["记忆数 照片数 记录天数", "所选周期内未删除记忆", "显示零值和说明"],
        ["主题 心情 状态排行", "主题关系 mood statuses", "不展示空排行"],
        ["代表记忆", "按确定性规则选择最多三条", "不生成虚构文案"],
        ["长期副本进展", "副本状态和周期内关联记忆数", "没有副本时显示空态"],
    ], [1.85, 3.05, 2.05])

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
    ], [2.0, 4.95])

    doc.add_heading("11 非功能要求", level=1)
    add_table(doc, ["类别", "要求"], [
        ["隐私", "不上传第三方；不记录明文密码；数据库连接信息仅返回脱敏用户名"],
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
        ["A04", "月度和年度总结使用真实数据并处理空周期", "已实现"],
        ["A05", "JSON ZIP PDF 可生成，ZIP 含 manifest 和原图", "已实现并真实验收"],
        ["A06", "导入先预检后恢复，危险压缩包被拒绝", "已实现并自动测试"],
        ["A07", "pg dump 备份成功并记录大小与 SHA 256", "已实现并真实验收"],
        ["A08", "应用锁从前端和 API 两层阻止未授权访问", "已实现并自动测试"],
        ["A09", "代码与运行数据只在 D 盘项目及指定数据目录", "已验证"],
    ], [0.7, 4.65, 1.6])
    doc.add_paragraph("本次发布前验证结果为前端 28 个测试文件共 68 项通过，后端 23 个测试文件共 90 项通过；前后端生产构建通过，Prisma schema 有效，5 个数据库迁移全部应用。")

    doc.add_heading("13 版本边界与后续规划", level=1)
    add_bullets(doc, [
        "当前为单用户本地版，不包含账号体系、多人共享、评论和社交关系。",
        "不提供云同步、跨设备自动同步、地图轨迹、视频处理或面部识别。",
        "总结使用确定性统计，不调用大模型自动创作文案。",
        "下一优先级是把重要日子和自定义候选列表迁移到 PostgreSQL，并纳入统一导出。",
        "后续可增加应用启动时的自动备份策略、备份保留周期和恢复演练提醒。",
    ])

    doc.save(PRD)


def build_tech():
    doc = Document()
    configure_document(doc)
    add_cover(doc, "照片记忆本前后端技术方案", "本地优先网页 MVP  完整实现版", "V3.0")
    add_intro(
        doc,
        "系统采用 React TypeScript Vite 前端、NestJS Prisma 后端和本机 PostgreSQL。图片作为文件保存在 D 盘，结构化数据保存在 PostgreSQL；应用锁由服务器会话控制，数据保险箱提供导出、恢复和数据库备份。",
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
        ["记忆总结", "MemorySummaryPage", "周期 日期 数据 加载 错误"],
        ["数据保险箱", "DataVaultPage AppLockGate", "存储状态 导入预览 验证动作 锁状态"],
    ], [1.25, 3.8, 1.8])
    doc.add_heading("3.2 状态管理", level=2)
    add_bullets(doc, [
        "记忆列表使用 useReducer 管理加载 新增批量 更新 删除 选择和回声排除状态。",
        "主题 长期副本 重要日子 回声 总结和应用锁使用页面级 useState。",
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
        ["ApiSummaryRepository", "按月或年读取确定性总结"],
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
        ["SummariesModule", "月度年度统计", "Asia Shanghai 边界 稳定排序"],
        ["VaultModule", "导出 导入 备份 状态和文件下载", "清单 哈希 事务 pg dump"],
        ["AppLockModule", "密码 会话 恢复和全局门禁", "scrypt 令牌摘要 Cookie Guard"],
    ], [1.65, 2.6, 2.6])

    doc.add_heading("5 数据模型", level=1)
    add_table(doc, ["实体", "关键字段", "关系与约束"], [
        ["MediaAsset", "storagePath mimeType fileSize captureAt", "一对一 Memory  可作为副本封面"],
        ["Memory", "title note mood statuses eventAt timezone echoExcluded", "唯一 mediaId  软删除  多对多 Topic"],
        ["Topic", "name isNone suppressLongTermPrompt echoEnabled", "userId name 唯一"],
        ["LongTermCopy", "topicId lifecycleStatus autoCollectEnabled startDate", "userId topicId 唯一"],
        ["LongTermCopyMemory", "copyId memoryId linkedAt", "复合主键"],
        ["MemoryEcho", "echoDate echoType score displayOrder status", "用户 日期 记忆唯一"],
        ["EchoReflection", "memoryEchoId memoryId text sourceEchoDate", "回声可有一条感言"],
        ["EchoPreference", "enabled excludedMoods", "每用户一条"],
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
        ["总结", "GET /api/summaries period date", "月度年度总结"],
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
    doc.add_heading("8.2 总结统计", level=2)
    add_bullets(doc, [
        "month 使用当月第一天到下一月第一天，year 使用当年第一天到下一年第一天。",
        "服务层查询周期内 Memory 和 LongTermCopy，再交给纯函数统计。",
        "并列排行按计数降序后名称排序，代表记忆规则稳定，便于测试。",
        "空周期返回完整零值结构，前端展示真实空态。",
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
    ])

    doc.add_heading("12 测试与质量保证", level=1)
    add_table(doc, ["验证项", "结果"], [
        ["前端测试", "28 个测试文件 68 项通过"],
        ["后端测试", "23 个测试文件 90 项通过"],
        ["生产构建", "前端和后端均通过"],
        ["Prisma", "schema valid，5 个 migration 全部已应用"],
        ["真实数据库", "PostgreSQL localhost 5433 可用"],
        ["真实导出", "JSON 10 KB  ZIP 1.1 MB  PDF 1.2 MB，均有效"],
        ["真实备份", "pg dump 38 KB，状态 COMPLETED，SHA 256 已记录"],
        ["浏览器冒烟", "首页 保险箱 存储路径和应用锁表单正常，控制台无错误"],
        ["Git", "main 已推送 GitHub，本地和远程哈希一致"],
    ], [2.0, 4.85])
    doc.add_heading("12.1 重点测试覆盖", level=2)
    add_bullets(doc, [
        "图片签名和 MIME 不一致、标题编辑、主题关系和副本自动收集。",
        "回声候选排序、每日幂等、排除设置和感言保存。",
        "总结跨月跨年边界、并列排行、空周期和代表记忆。",
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
        ["依赖安全公告无法联网复核", "需在可访问 npm registry 的环境检查", "CI 加入 npm audit 或 SCA"],
    ], [2.1, 2.2, 2.55])

    doc.save(TECH)


if __name__ == "__main__":
    DOCS.mkdir(parents=True, exist_ok=True)
    build_prd()
    build_tech()
    print(PRD)
    print(TECH)

"""Render reproducible product diagrams without reading private user photos."""
from __future__ import annotations

from html import escape
from math import atan2, cos, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs"
INK = "#253c37"
MUTED = "#65776f"
TEAL = "#538780"
PALE = "#eaf3ef"
BG = "#f7f4ee"
BORDER = "#d8e2db"


class Canvas:
    def __init__(self, width: int, height: int, background=BG):
        self.width, self.height = width, height
        self.image = Image.new("RGB", (width * 2, height * 2), background)
        self.draw = ImageDraw.Draw(self.image)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
                    f'<rect width="{width}" height="{height}" fill="{background}"/>']
        self.fonts = {}

    def font(self, size, bold=False):
        key = size, bold
        if key not in self.fonts:
            name = "msyhbd.ttc" if bold else "msyh.ttc"
            self.fonts[key] = ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size * 2)
        return self.fonts[key]

    def rect(self, x, y, w, h, fill="white", stroke=BORDER, radius=16):
        self.draw.rounded_rectangle((x*2, y*2, (x+w)*2, (y+h)*2), radius=radius*2, fill=fill, outline=stroke, width=2)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}"/>')

    def text(self, x, y, value, size=22, color=INK, bold=False, center=False):
        value = str(value)
        anchor = "mt" if center else "lt"
        self.draw.text((x*2, y*2), value, font=self.font(size, bold), fill=color, anchor=anchor)
        self.svg.append(f'<text x="{x}" y="{y+size}" font-family="Microsoft YaHei, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" text-anchor="{"middle" if center else "start"}" fill="{color}">{escape(value)}</text>')

    def lines(self, x, y, values, size=20, color=MUTED, step=30, center=False):
        for i, value in enumerate(values):
            self.text(x, y+i*step, value, size, color, center=center)

    def arrow(self, points, color=TEAL, dashed=False):
        scaled = [(x*2, y*2) for x, y in points]
        if not dashed:
            self.draw.line(scaled, fill=color, width=4)
        else:
            for start, stop in zip(points, points[1:]):
                dx, dy = stop[0]-start[0], stop[1]-start[1]
                distance = (dx*dx+dy*dy)**0.5
                for offset in range(0, int(distance), 14):
                    a, b = offset/distance, min(offset+7, distance)/distance
                    self.draw.line(((start[0]+dx*a)*2, (start[1]+dy*a)*2, (start[0]+dx*b)*2, (start[1]+dy*b)*2), fill=color, width=4)
        x, y = points[-1]
        px, py = points[-2]
        angle = atan2(y-py, x-px)
        head = [(x, y), (x-13*cos(angle-.43), y-13*sin(angle-.43)), (x-13*cos(angle+.43), y-13*sin(angle+.43))]
        self.draw.polygon([(a*2,b*2) for a,b in head], fill=color)
        coords = " ".join(f"{a},{b}" for a,b in points)
        self.svg.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="2" {"stroke-dasharray=\"7 7\"" if dashed else ""}/>')
        coords = " ".join(f"{a},{b}" for a,b in head)
        self.svg.append(f'<polygon points="{coords}" fill="{color}"/>')

    def node(self, x, y, w, title, detail=(), h=100, fill="white", size=24):
        self.rect(x, y, w, h, fill)
        self.text(x+w/2, y+17, title, size, bold=True, center=True)
        self.lines(x+w/2, y+53, detail, size=19, step=27, center=True)

    def save(self, name, svg=True):
        OUT.mkdir(parents=True, exist_ok=True)
        self.image.save(OUT / f"{name}.png", optimize=True)
        if svg:
            (OUT / f"{name}.svg").write_text("\n".join([*self.svg, "</svg>"]), encoding="utf-8")


def overview():
    c = Canvas(1680, 1340)
    c.text(60, 40, "照片记忆本业务逻辑", 42, bold=True)
    c.text(60, 101, "当前网页 MVP · 先存照片，再补文字，通过主题、回声和情绪电影回看经历", 23, MUTED)
    c.rect(45, 160, 1590, 220, PALE)
    c.text(70, 177, "01 记录与主题授权", 26, bold=True)
    stages = [
        ("选择照片", ["单张或批量导入"]),
        ("读取发生时间", ["EXIF ／ 当前时间 ／ 手改"]),
        ("选择或创建主题", ["批量时询问是否统一主题"]),
        ("确认长期副本", ["同意后同主题自动收集"]),
        ("保存记忆", ["标题、文字、心情、状态", "均可后补"]),
    ]
    for i, (title, detail) in enumerate(stages):
        x = 70+i*312
        c.node(x, 236, 290, title, detail, h=108, size=24)
        if i < 4:
            c.arrow([(x+290,290),(x+312,290)])
    c.text(70, 402, "记忆保存后，各回看模块独立读取有效记录；长期副本只按主题关联，心情和状态不参与收集。", 23, MUTED)
    for x, title, color in [(45,"02 日常回看", "#eef4f0"),(585,"03 记忆回声", "#fff7e6"),(1125,"04 情绪电影", "#f0edf6")]:
        c.rect(x, 455, 510, 600, color)
        c.text(x+25, 478, title, 28, bold=True)
    groups = [
        (45, [("照片墙与搜索", ["按标题、文字、主题查找"]), ("发生时间线", ["按日期分组打开记忆"]), ("我的长期副本", ["主题持续积累 ／ 自动收集开关"]), ("重要日子", ["日期差与已有记忆关联"]) ]),
        (585, [("当天首次打开", ["按设置筛选旧记忆"]), ("生成最多 3 条", ["那年今日 ／ 主题 ／ 副本节点"]), ("打开原记忆或忽略", ["支持主题、心情、单条排除"]), ("保存回声感言", ["原记忆详情与最近 30 天历史"]) ]),
        (1125, [("授权与周期检查", ["检查上月、上一年"]), ("冻结真实记忆快照", ["空周期跳过 ／ 少量记录精简"]), ("本地模板或可选 AI", ["AI 校验失败则回退模板"]), ("提醒、播放与编辑", ["档案续播 ／ 重新生成 ／ 感言"]) ]),
    ]
    for x, nodes in groups:
        for i, (title, detail) in enumerate(nodes):
            y = 535+i*125
            c.node(x+25, y, 460, title, detail, h=105)
            if i<3 and x != 45:
                c.arrow([(x+255,y+105),(x+255,y+125)], dashed=x==45)
    c.rect(45, 1090, 1590, 155, "#eaf1f8")
    c.text(70, 1110, "05 数据保险箱与应用锁", 27, bold=True)
    c.lines(70, 1155, ["导出 JSON ／ ZIP 原图包 ／ PDF 记忆册    ·    导入预检 → 用户确认 → 安全合并", "数据库备份状态与照片存储位置    ·    独立密码、自动锁定、恢复密钥与敏感操作验证"], size=23, step=35)
    c.text(60, 1273, "存储边界  PostgreSQL 保存结构数据；照片、备份和导出保存在 D 盘；重要日子与候选标签仍在浏览器。", 21, MUTED)
    c.save("照片记忆本业务逻辑流程图")


def summary_flow():
    c = Canvas(1680, 1440)
    c.text(60, 38, "情绪电影生成与回看流程", 42, bold=True)
    c.text(60, 100, "基于现有实现的月度与年度总结链路", 23, MUTED)
    c.node(620,160,440,"首页解锁后首次检查",["上海时区的上月与上一年"],h=100)
    c.node(70,310,440,"尚未授权时先询问",["文字照片默认开 ／ AI 默认关"],h=100)
    c.node(620,310,440,"读取用户已确认的偏好",["开启总结则继续"],h=100)
    c.node(1170,310,440,"总开关关闭",["结束本次检查"],h=100,fill="#fff7e6")
    c.arrow([(840,260),(840,310)])
    c.arrow([(620,210),(290,210),(290,310)])
    c.arrow([(510,360),(620,360)])
    c.arrow([(1060,360),(1170,360)])
    c.node(620,460,440,"检查当前周期的任务状态",["不存在或 FAILED 则继续生成"],h=100)
    c.arrow([(840,410),(840,460)])
    c.node(1170,460,440,"复用已有结果或状态",["READY ／ PENDING ／ GENERATING"],h=100,fill="#eaf3ef")
    c.arrow([(1060,510),(1170,510)])
    c.arrow([(1610,510),(1640,510),(1640,1110),(1060,1110)],dashed=True)
    c.node(620,610,440,"读取授权范围的真实快照",["过滤已删除及被排除的记忆"],h=100)
    c.arrow([(840,560),(840,610)])
    c.node(70,610,440,"0 条有效记忆则停止",["重生成时删除旧总结及其感言"],h=100,fill="#fff7e6")
    c.arrow([(620,660),(510,660)])
    c.node(620,760,440,"生成第二人称本地旁白",["最高频心情 ／ 无心情用鼓励句"],h=100)
    c.arrow([(840,710),(840,760)])
    c.node(1170,760,440,"已授权且已配置云端 AI",["尝试整理并校验，不符则回退模板"],h=100)
    c.arrow([(1060,810),(1170,810)])
    c.arrow([(1390,860),(1390,960),(1060,960)])
    c.node(620,910,440,"事务保存总结与故事页",["1–2 条精简版 ／ 独立快照"],h=100)
    c.arrow([(840,860),(840,910)])
    c.node(620,1060,440,"结果展示和用户回看",["未读 READY 提醒 ／ 档案馆续播"],h=100)
    c.arrow([(840,1010),(840,1060)])
    c.text(1170,1014,"生成中只返回状态，不显示新总结提醒",19,MUTED)
    c.rect(65, 1210, 1550, 128, "#eaf3ef")
    c.text(90, 1228, "回看后的用户操作", 26, bold=True)
    c.lines(90, 1273, ["编辑旁白、照片与页序；发生版本冲突时重新加载。非空周期重新生成保留感言，空周期删除总结及其感言。", "保存月度或年度回声感言，之后在档案馆回看。修改总结不会改写原始记忆。"], size=21, step=31)
    c.text(65, 1375, "实现边界  删除总结、单条记忆排除和偏好更新已有 API；独立设置与删除操作入口尚待补齐。", 21, MUTED)
    c.save("照片记忆本情绪电影流程图")


def photo(c, x, y, w, h, variant=0):
    colors = [("#c9dbd1", "#8ca79a"),("#dfd1bb", "#b69b7c"),("#cad6e3", "#8d9fad")]
    light, dark = colors[variant%3]
    c.rect(x,y,w,h,light,light,10)
    c.rect(x+12,y+h*.60,w-24,h*.26,dark,dark,7)
    c.text(x+w/2,y+h*.26,"照片",17,dark,center=True)


def chip(c,x,y,label,selected=False):
    w = 30+len(label)*18
    c.rect(x,y,w,34,PALE if selected else "#fbfaf7",TEAL if selected else BORDER,17)
    c.text(x+w/2,y+6,label,17,TEAL if selected else MUTED,center=True)
    return w


def button(c,x,y,w,label,primary=False):
    c.rect(x,y,w,38,TEAL if primary else "#fbfaf7",TEAL if primary else BORDER,18)
    c.text(x+w/2,y+8,label,17,"white" if primary else TEAL,bold=primary,center=True)


def product():
    c = Canvas(1680, 1270)
    c.text(60, 35, "照片记忆本产品示意图", 42, bold=True)
    c.text(60, 98, "当前网页 MVP · 关键页面与功能入口 · 界面结构示意，图片和内容均为示例", 23, MUTED)
    titles = ["01 记忆首页", "02 记录与批量导入", "03 我的长期副本", "04 记忆回声", "05 情绪电影", "06 数据保险箱"]
    for index,title in enumerate(titles):
        col,row = index%3,index//3
        x,y = 55+col*550,170+row*525
        c.text(x,y,title,26,bold=True)
        c.rect(x,y+45,510,440,"#fffdfa",BORDER,18)
        c.text(x+22,y+65,"照片记忆本",19,bold=True)
        c.text(x+365,y+68,"本地保存",15,MUTED)
        p,q = x+22,y+105
        if index==0:
            c.rect(p,q,466,62,PALE)
            c.text(p+14,q+10,"上个月的月度总结已经生成好了",19,bold=True)
            c.text(p+14,q+37,"现在查看情绪电影",16,TEAL)
            c.text(p,q+78,"关键词搜索                         ＋ 添加照片",17,MUTED)
            for k in range(3):
                photo(c,p+k*158,q+112,145,124,k)
                c.text(p+k*158,q+247,["周末散步","认真学习","平常的一天"][k],17)
                c.text(p+k*158,q+274,"示例日期 · 心情",15,MUTED)
            c.text(p,q+323,"记忆     时间线     长期副本     重要日子",19,TEAL)
        elif index==1:
            photo(c,p,q,115,90)
            c.lines(p+132,q+5,["事件时间  可手动修改", "标题与备忘录  可稍后补充"],size=18,step=36)
            c.text(p,q+108,"今日心情",18,bold=True)
            chip(c,p,q+137,"开心",True);chip(c,p+92,q+137,"平静");chip(c,p+184,q+137,"自定义")
            c.text(p,q+184,"当日状态  散步 · 学习 · 自定义",18)
            c.text(p,q+221,"当日主题  无 · 恋爱 · 考研 · 读研",18)
            c.text(p,q+260,"选择多张图片 → 询问是否统一主题",17,TEAL)
            c.text(p,q+291,"批量只存照片、时间与可选统一主题",17,MUTED)
            button(c,p+270,q+322,196,"保存这段记忆",True)
        elif index==2:
            c.text(p,q,"长期的事情，也值得慢慢记录。",20)
            button(c,p+310,q+45,156,"创建长期副本",True)
            c.rect(p,q+105,466,156,PALE)
            c.text(p+17,q+122,"考研这段日子",23,bold=True)
            c.text(p+17,q+164,"关联主题  考研",18,MUTED)
            c.text(p+17,q+199,"自动收集以后新增的同主题记忆",17,TEAL)
            c.text(p+17,q+231,"点击进入按发生时间排列的照片轴",16,MUTED)
            c.text(p,q+288,"新建主题后，关联主题选项同步更新",17,MUTED)
            c.text(p,q+323,"无副本时显示空态，由用户自行创建",17,MUTED)
        elif index==3:
            photo(c,p,q,180,208,1)
            c.text(p+198,q+3,"今天的记忆回声",22,bold=True)
            c.lines(p+198,q+48,["那年今日", "旧时光在今天回来", "每天最多 3 条"],size=18,step=38)
            c.text(p+198,q+174,"查看原记忆",18,TEAL)
            button(c,p,q+237,148,"写下感言",True)
            button(c,p+162,q+237,142,"忽略这条")
            c.lines(p,q+298,["最近 30 天回声记录", "用户可控制心情、主题与记忆排除"],size=18,step=34)
        elif index==4:
            c.text(p,q,"情绪电影档案馆",23,bold=True)
            chip(c,p,q+45,"月度总结",True);chip(c,p+132,q+45,"年度总结")
            c.rect(p,q+99,466,139,"#293f3c","#293f3c")
            c.text(p+20,q+116,"你的九月记忆",26,"#f6f1e4",bold=True)
            c.text(p+20,q+165,"你认真留下的日子，都值得回看。",18,"#dce6de")
            c.text(p+20,q+201,"未读  ·  从上次页面继续",17,"#c5d8d0")
            c.lines(p,q+265,["逐页播放 · 第二人称旁白 · 阅读进度", "编辑旁白、照片和页序 · 重新生成", "保存回声感言 · 本地模板与授权 AI"],size=17,step=33)
        elif index==5:
            c.text(p,q,"照片与文字，由你自己掌控",21,bold=True)
            for i,label in enumerate(["JSON","ZIP","PDF"]):
                button(c,p+i*155,q+49,140,"导出 "+label,i==1)
            c.rect(p,q+109,466,76,PALE)
            c.text(p+14,q+121,"导入恢复",19,bold=True)
            c.text(p+14,q+153,"选择文件 → 预检预览 → 确认安全合并",17,MUTED)
            c.lines(p,q+211,["数据库备份  创建备份并查看最近状态", r"照片存储位置  D:\yxy5.0\data\uploads", "应用锁  独立密码、自动锁定与恢复密钥"],size=17,step=39)
            c.text(p,q+335,"重要操作开启保护后需要再次验证",17,TEAL)
    c.text(60, 1232, "说明  时间线与重要日子从主导航进入；主题用于长期副本；记忆回声与情绪电影分别保存各自感言。", 20, MUTED)
    c.save("照片记忆本产品示意图")


def build_visuals():
    overview()
    summary_flow()
    product()


if __name__ == "__main__":
    build_visuals()
    print(f"Product visuals written to {OUT}")

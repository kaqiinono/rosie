"""Generate analysis images for lesson 42 pretest (42-P1 ~ 42-P5)."""
from PIL import Image, ImageDraw, ImageFont
import math, os

OUT = "/Users/meinuo/WebstormProjects/ai/rosie/public/img/math"
FONT_PATH = "/Library/Fonts/Arial Unicode.ttf"

# ── colour palette (matches existing lesson-42 images) ──────────────────────
BG       = "#FFFFFF"
C_GREEN  = "#E8F5E9"   # result / sum box fill
C_GREEN_B= "#81C784"   # result box border
C_PURPLE = "#EDE7F6"   # 砝码 circle fill
C_PURPLE_B="#9575CD"   # 砝码 circle border
C_PINK   = "#FCE4EC"   # arrow / highlight box fill
C_PINK_B = "#F48FB1"   # arrow / highlight box border
C_YELLOW = "#FFF8E1"   # empty-bottle / step box fill
C_YELLOW_B="#FFD54F"   # empty-bottle / step box border
C_DARK   = "#546E7A"   # duplicate / dark box fill (white text)
C_RED    = "#E53935"   # accent text (e.g. formula)
C_BLUE   = "#1565C0"   # arrow colour
C_GRAY   = "#757575"   # secondary text
C_TEXT   = "#212121"   # main text
C_ORANGE = "#E65100"   # small spoon / accent


def load_font(size):
    return ImageFont.truetype(FONT_PATH, size, index=0)


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def rounded_rect(draw, x, y, w, h, r, fill, outline, lw=2):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=fill, outline=outline, width=lw)


def circle(draw, cx, cy, r, fill, outline, lw=2):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline, width=lw)


def centered_text(draw, text, cx, cy, font, fill=C_TEXT):
    tw, th = text_size(draw, text, font)
    draw.text((cx - tw / 2, cy - th / 2), text, font=font, fill=fill)


def arrow_right(draw, x1, y, x2, color=C_BLUE, lw=2):
    draw.line([(x1, y), (x2, y)], fill=color, width=lw)
    draw.polygon([(x2, y), (x2 - 8, y - 5), (x2 - 8, y + 5)], fill=color)


def arrow_down(draw, x, y1, y2, color=C_GRAY, lw=2):
    draw.line([(x, y1), (x, y2)], fill=color, width=lw)
    draw.polygon([(x, y2), (x - 5, y2 - 8), (x + 5, y2 - 8)], fill=color)


# ═══════════════════════════════════════════════════════════════════════════
# 42-P1  三砝码单边  2克/5克/6克  → 7种
# ═══════════════════════════════════════════════════════════════════════════
def make_p1():
    W, H = 720, 520
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    fL = load_font(22)   # label font
    fN = load_font(24)   # number font
    fS = load_font(18)   # small

    WEIGHTS = [2, 5, 6]

    def draw_weight_circle(cx, cy, val):
        circle(draw, cx, cy, 22, C_PURPLE, C_PURPLE_B)
        centered_text(draw, str(val), cx, cy, fN)

    def draw_sum_box(cx, cy, val, dark=False):
        fill = C_DARK if dark else C_GREEN
        border = C_DARK if dark else C_GREEN_B
        tcolor = "white" if dark else C_TEXT
        rounded_rect(draw, cx - 22, cy - 16, 44, 32, 6, fill, border)
        centered_text(draw, str(val), cx, cy, fN, tcolor)

    def draw_group(cx, cy, indices):
        """Draw circles for砝码 subset, a line, then the sum box."""
        vals = [WEIGHTS[i] for i in indices]
        n = len(vals)
        spacing = 50
        total_w = (n - 1) * spacing
        xs = [cx - total_w / 2 + i * spacing for i in range(n)]
        for x, v in zip(xs, vals):
            draw_weight_circle(int(x), cy, v)
        line_x0 = int(xs[0]) - 28
        line_x1 = int(xs[-1]) + 28
        draw.line([(line_x0, cy + 28), (line_x1, cy + 28)], fill=C_GRAY, width=2)
        s = sum(vals)
        # check duplicate: 7 appears as 2+5
        # In this problem ALL sums are distinct
        draw_sum_box(cx, cy + 52, s)

    # ── Row labels ──────────────────────────────────────────
    y1 = 60   # 1个砝码
    y2 = 190  # 2个砝码
    y3 = 370  # 3个砝码

    draw.text((20, y1 - 14), "1个砝码：", font=fL, fill=C_TEXT)
    draw.text((20, y2 - 14), "2个砝码：", font=fL, fill=C_TEXT)
    draw.text((20, y3 - 14), "3个砝码：", font=fL, fill=C_TEXT)

    # single weights
    for i, v in enumerate(WEIGHTS):
        cx = 160 + i * 100
        draw_weight_circle(cx, y1, v)
        draw.line([(cx - 28, y1 + 28), (cx + 28, y1 + 28)], fill=C_GRAY, width=2)
        draw_sum_box(cx, y1 + 52, v)

    # pairs
    pairs = [(0, 1), (0, 2), (1, 2)]
    pair_cx = [160, 340, 520]
    for (i, j), cx in zip(pairs, pair_cx):
        draw_group(cx, y2, [i, j])

    # triple
    draw_group(360, y3, [0, 1, 2])

    # total
    draw.text((20, H - 50), "共 7 种（2、5、6、7、8、11、13），全部不同", font=fS, fill=C_GRAY)
    rounded_rect(draw, W - 140, H - 58, 120, 40, 8, C_GREEN, C_GREEN_B, 2)
    centered_text(draw, "共 7 种 ✓", W - 80, H - 38, fL, C_TEXT)

    img.save(os.path.join(OUT, "42-P1.png"))
    print("42-P1.png done")


# ═══════════════════════════════════════════════════════════════════════════
# 42-P2  四砝码两边  1/3/4/5  → 13种
# ═══════════════════════════════════════════════════════════════════════════
def make_p2():
    W, H = 720, 480
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    fL = load_font(22)
    fN = load_font(22)
    fS = load_font(18)
    fT = load_font(20)

    WEIGHTS = [1, 3, 4, 5]
    # Each combination: weight = sum(+side) - sum(-side)
    # Pre-calculated: all 1-13 achievable
    results = [
        (1,  "1",              [(1, "+")]),
        (2,  "3−1",            [(3, "+"), (1, "−")]),
        (3,  "3",              [(3, "+")]),
        (4,  "4",              [(4, "+")]),
        (5,  "5",              [(5, "+")]),
        (6,  "1+5",            [(1, "+"), (5, "+")]),
        (7,  "3+4",            [(3, "+"), (4, "+")]),
        (8,  "3+5",            [(3, "+"), (5, "+")]),
        (9,  "4+5",            [(4, "+"), (5, "+")]),
        (10, "1+4+5",          [(1, "+"), (4, "+"), (5, "+")]),
        (11, "3+4+5−1",        [(3, "+"), (4, "+"), (5, "+"), (1, "−")]),
        (12, "3+4+5",          [(3, "+"), (4, "+"), (5, "+")]),
        (13, "1+3+4+5",        [(1, "+"), (3, "+"), (4, "+"), (5, "+")]),
    ]

    # Draw title
    draw.text((20, 18), "砝码两边称：每个砝码可放物品侧（−）/ 不用 / 另一侧（+）", font=fS, fill=C_GRAY)

    # Draw 13 result rows in a grid  (2 columns)
    COL_W = 350
    ROW_H = 32
    x_starts = [30, 380]
    y_start = 60

    for idx, (weight, formula, _) in enumerate(results):
        col = idx % 2
        row = idx // 2
        x = x_starts[col]
        y = y_start + row * ROW_H

        # weight box
        rounded_rect(draw, x, y + 2, 36, 26, 5, C_GREEN, C_GREEN_B)
        centered_text(draw, str(weight), x + 18, y + 15, fN)

        # formula text
        draw.text((x + 46, y + 3), f"= {formula}", font=fT, fill=C_TEXT)

    # summary line
    y_sum = y_start + 7 * ROW_H + 20
    draw.line([(20, y_sum), (W - 20, y_sum)], fill=C_GRAY, width=1)
    draw.text((20, y_sum + 10), "1 克 ~ 13 克均可称出，共", font=fL, fill=C_TEXT)
    rounded_rect(draw, 310, y_sum + 8, 80, 36, 8, C_GREEN, C_GREEN_B, 2)
    centered_text(draw, "13 种", 350, y_sum + 26, fL)
    draw.text((400, y_sum + 10), "✓", font=fL, fill=C_GREEN_B)

    img.save(os.path.join(OUT, "42-P2.png"))
    print("42-P2.png done")


# ═══════════════════════════════════════════════════════════════════════════
# 42-P3  奶酪棒分账  小纳8 小月7 小梦0  →  小纳得6元 小月得4元
# ═══════════════════════════════════════════════════════════════════════════
def make_p3():
    W, H = 620, 320
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    fL = load_font(22)
    fN = load_font(22)
    fS = load_font(18)

    persons = [("小纳", 8, 6), ("小月", 7, 4), ("小梦", 0, None)]
    y_rows = [80, 155, 230]
    EACH = 5  # each person's fair share

    for (name, paid, gets), y in zip(persons, y_rows):
        # name
        draw.text((20, y - 12), name, font=fL, fill=C_TEXT)

        # paid circle
        cx_paid = 120
        circle(draw, cx_paid, y, 24, C_PURPLE, C_PURPLE_B)
        centered_text(draw, str(paid), cx_paid, y, fN)

        # arrow → paid box
        arrow_right(draw, cx_paid + 26, y, 220)
        rounded_rect(draw, 220, y - 17, 44, 34, 6, C_GREEN if paid >= EACH else C_YELLOW, C_GREEN_B if paid >= EACH else C_YELLOW_B)
        centered_text(draw, str(paid), 242, y, fN)

        # result label on right
        if gets is not None:
            arrow_right(draw, 268, y, 380)
            rounded_rect(draw, 380, y - 17, 180, 34, 8, C_PINK, C_PINK_B)
            centered_text(draw, f"多付{paid - EACH}个×2=得{gets}元", 470, y, fS)
        else:
            # 小梦：show the 10元 payment
            arrow_right(draw, 268, y, 380)
            rounded_rect(draw, 380, y - 17, 170, 34, 8, C_GREEN, C_GREEN_B)
            centered_text(draw, "实付5块：10元", 465, y, fS)

    # formula below
    draw.text((20, H - 52), "小梦付10元 ÷ 5块 = 每块2元", font=fS, fill=C_RED)
    draw.text((20, H - 28), "小纳得 6 元，小月得 4 元，合计 6+4=10 元 ✓", font=fS, fill=C_GRAY)

    img.save(os.path.join(OUT, "42-P3.png"))
    print("42-P3.png done")


# ═══════════════════════════════════════════════════════════════════════════
# 42-P4  空可乐罐换可乐  12个空罐 3换1  → 6瓶
# ═══════════════════════════════════════════════════════════════════════════
def make_p4():
    W, H = 520, 520
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    fL = load_font(22)
    fN = load_font(22)
    fS = load_font(18)

    # steps: (empty_start, divide_by, colas, leftover_empty, label)
    steps = [
        (12, "÷3", "4瓶", "0空",   "12空罐 → 换4瓶，喝完得4空"),
        (4,  "÷3", "1瓶", "1空",   "4空罐 → 换1瓶 + 剩1空 → 共2空"),
        (None, None, "1瓶", "0空",  "借1空 → 3空 → 换1瓶，还1空"),
    ]

    def box(cx, cy, w, h, text, fill, border, font=None):
        rounded_rect(draw, cx - w // 2, cy - h // 2, w, h, 6, fill, border)
        centered_text(draw, text, cx, cy, font or fN)

    y = 80
    ROW = 120
    for i, (emp, div, cola, left, note) in enumerate(steps):
        y_row = y + i * ROW

        if emp is not None:
            box(70, y_row, 60, 34, f"{emp}空", C_YELLOW, C_YELLOW_B)
            draw.text((104, y_row - 10), div, font=fS, fill=C_GRAY)
            arrow_right(draw, 128, y_row, 200)
        else:
            # borrow row
            rounded_rect(draw, 20, y_row - 17, 50, 34, 6, C_PINK, C_PINK_B)
            centered_text(draw, "借1", 45, y_row, fN)
            rounded_rect(draw, 74, y_row - 17, 50, 34, 6, C_YELLOW, C_YELLOW_B)
            centered_text(draw, "2空", 99, y_row, fN)
            draw.line([(20, y_row + 17), (124, y_row + 17)], fill=C_GRAY, width=1)
            centered_text(draw, "=3空", 99 + 60, y_row, fN)
            arrow_right(draw, 200, y_row, 250)

        box(260, y_row, 60, 34, cola, C_GREEN, C_GREEN_B)
        draw.text((294, y_row - 10), "……", font=fS, fill=C_GRAY)
        box(360, y_row, 60, 34, left if left != "0空" else left, C_YELLOW, C_YELLOW_B)

        # note
        draw.text((20, y_row + 26), note, font=fS, fill=C_GRAY)

        # dotted arrow down (except last)
        if i < len(steps) - 1:
            for yy in range(y_row + 56, y_row + ROW - 10, 6):
                draw.ellipse([357, yy, 363, yy + 3], fill=C_GRAY)
            arrow_down(draw, 360, y_row + ROW - 12, y_row + ROW - 2)

    # total
    y_total = y + len(steps) * ROW + 10
    draw.line([(20, y_total), (W - 20, y_total)], fill=C_GRAY, width=1)
    draw.text((20, y_total + 12), "最多能喝：12 ÷ (3−1) = 6 瓶", font=fL, fill=C_TEXT)
    rounded_rect(draw, W - 140, y_total + 8, 110, 38, 8, C_GREEN, C_GREEN_B, 2)
    centered_text(draw, "共 6 瓶 ✓", W - 85, y_total + 27, fL)

    img.save(os.path.join(OUT, "42-P4.png"))
    print("42-P4.png done")


# ═══════════════════════════════════════════════════════════════════════════
# 42-P5  大小勺量酒  大15克 小8克 → 量出22克
# ═══════════════════════════════════════════════════════════════════════════
def make_p5():
    W, H = 620, 300
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    fL = load_font(22)
    fN = load_font(22)
    fS = load_font(18)
    fT = load_font(20)

    # Header
    draw.text((20, 16), "22 = 15×2 − 8×1  →  舀大勺2次，再倒出小勺1次", font=fS, fill=C_GRAY)

    steps = [
        ("①", "大勺满",  "+15克", 15,  "容器",  C_GREEN),
        ("②", "大勺满",  "+15克", 30,  "容器",  C_GREEN),
        ("③", "小勺取出", "−8克",  22,  "容器",  C_GREEN),
    ]

    y = 80
    ROW = 68
    for i, (num, action, delta, total, label, fill) in enumerate(steps):
        y_row = y + i * ROW

        # step number
        circle(draw, 30, y_row, 18, C_PINK, C_PINK_B, 2)
        centered_text(draw, num, 30, y_row, fT)

        # action label
        is_add = delta.startswith("+")
        col_fill = C_GREEN if is_add else C_PINK
        col_bord = C_GREEN_B if is_add else C_PINK_B
        rounded_rect(draw, 60, y_row - 17, 100, 34, 6, col_fill, col_bord)
        centered_text(draw, action, 110, y_row, fT)

        # delta
        draw.text((170, y_row - 10), delta, font=fL,
                  fill=C_BLUE if is_add else C_ORANGE)

        # arrow
        arrow_right(draw, 248, y_row, 310)

        # total box
        rounded_rect(draw, 318, y_row - 17, 80, 34, 6, fill, C_GREEN_B)
        centered_text(draw, f"{total}克", 358, y_row, fN)

        # result mark for last step
        if i == len(steps) - 1:
            draw.text((410, y_row - 10), "← 22 克 ✓", font=fL, fill=C_GREEN_B)

    # formula summary
    draw.line([(20, H - 50), (W - 20, H - 50)], fill=C_GRAY, width=1)
    draw.text((20, H - 38), "操作：舀大勺×2 次 + 舀小勺×1 次 = 共 3 次", font=fS, fill=C_GRAY)
    rounded_rect(draw, W - 120, H - 46, 100, 32, 6, C_GREEN, C_GREEN_B)
    centered_text(draw, "3 次 ✓", W - 70, H - 30, fL)

    img.save(os.path.join(OUT, "42-P5.png"))
    print("42-P5.png done")


if __name__ == "__main__":
    make_p1()
    make_p2()
    make_p3()
    make_p4()
    make_p5()
    print("All done.")

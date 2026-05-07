"""Generate Product Hunt marketing assets for EvalDesk."""

from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# Colors (Linear-inspired dark theme)
BG_DARK = (8, 9, 10)
BG_PANEL = (15, 16, 17)
BG_SURFACE = (25, 26, 27)
ACCENT = (171, 200, 58)  # #ABC83A - EvalDesk green
ACCENT2 = (78, 147, 99)  # #4E9363
TEXT_WHITE = (247, 248, 248)
TEXT_GRAY = (138, 143, 152)
TEXT_DIM = (98, 102, 109)
BORDER = (35, 37, 42)


def get_font(size, bold=False):
    paths = [
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_thumbnail():
    """240x240 Product Hunt thumbnail."""
    img = Image.new("RGB", (240, 240), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background with accent color
    margin = 30
    draw.rounded_rectangle(
        [margin, margin, 240 - margin, 240 - margin],
        radius=24,
        fill=ACCENT,
    )

    # "E" letter in center
    font_big = get_font(100, bold=True)
    draw.text((120, 120), "E", fill=BG_DARK, font=font_big, anchor="mm")

    img.save(os.path.join(OUT, "thumbnail_240x240.png"))
    print("Created: thumbnail_240x240.png")


def draw_gallery_1_hero():
    """1270x760 — Hero showcase with tagline."""
    img = Image.new("RGB", (1270, 760), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Top accent bar
    draw.rectangle([0, 0, 1270, 4], fill=ACCENT)

    # Logo + name
    font_logo = get_font(20)
    draw.rounded_rectangle([60, 40, 80, 60], radius=5, fill=ACCENT)
    draw.text((68, 50), "E", fill=BG_DARK, font=get_font(14), anchor="mm")
    draw.text((92, 50), "EvalDesk", fill=TEXT_WHITE, font=font_logo, anchor="lm")

    # Main headline
    font_h1 = get_font(52)
    draw.text((635, 200), "Test AI agents", fill=TEXT_WHITE, font=font_h1, anchor="mm")
    draw.text((635, 265), "without writing code", fill=ACCENT, font=font_h1, anchor="mm")

    # Subtitle
    font_sub = get_font(20)
    draw.text(
        (635, 340),
        "Domain experts rate AI answers with Pass/Fail — no Python, no JSON, no engineers",
        fill=TEXT_GRAY, font=font_sub, anchor="mm",
    )

    # Feature pills
    features = ["Open Source", "Self-Hostable", "No-Code UI", "LLM-as-Judge"]
    pill_w = 160
    total_w = len(features) * pill_w + (len(features) - 1) * 12
    start_x = (1270 - total_w) // 2
    y = 420
    font_pill = get_font(16)
    for i, feat in enumerate(features):
        x = start_x + i * (pill_w + 12)
        draw.rounded_rectangle([x, y, x + pill_w, y + 40], radius=20, fill=BG_SURFACE, outline=BORDER)
        draw.text((x + pill_w // 2, y + 20), feat, fill=TEXT_WHITE, font=font_pill, anchor="mm")

    # Mock dashboard preview
    dash_y = 500
    dash_h = 200
    dash_margin = 80
    draw.rounded_rectangle(
        [dash_margin, dash_y, 1270 - dash_margin, dash_y + dash_h],
        radius=12, fill=BG_PANEL, outline=BORDER,
    )
    # Window dots
    for i, color in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        draw.ellipse([dash_margin + 20 + i * 18, dash_y + 14, dash_margin + 32 + i * 18, dash_y + 26], fill=color)

    # Fake stat cards in dashboard
    card_labels = ["Projects", "Runs", "Pass Rate", "Test Cases"]
    card_values = ["4", "7", "65%", "15"]
    card_w = 140
    card_start = dash_margin + 40
    for i in range(4):
        cx = card_start + i * (card_w + 16)
        cy = dash_y + 50
        draw.rounded_rectangle([cx, cy, cx + card_w, cy + 60], radius=8, fill=BG_SURFACE, outline=BORDER)
        draw.text((cx + card_w // 2, cy + 22), card_values[i], fill=ACCENT, font=get_font(22), anchor="mm")
        draw.text((cx + card_w // 2, cy + 46), card_labels[i], fill=TEXT_DIM, font=get_font(10), anchor="mm")

    # Bottom tagline
    font_sm = get_font(14)
    draw.text((635, 740), "docker compose up -d  ·  github.com/ramandagar/EvalDesk", fill=TEXT_DIM, font=font_sm, anchor="mm")

    img.save(os.path.join(OUT, "gallery_01_hero_1270x760.png"))
    print("Created: gallery_01_hero_1270x760.png")


def draw_gallery_2_features():
    """1270x760 — Feature breakdown."""
    img = Image.new("RGB", (1270, 760), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Title
    font_title = get_font(36)
    draw.text((635, 50), "How it works", fill=TEXT_WHITE, font=font_title, anchor="mm")

    # 4 feature cards
    cards = [
        ("1", "Write test cases", "Type questions in\nplain English.\nNo JSON needed."),
        ("2", "Run your agent", "Paste URL, hit Run.\nEvalDesk calls\nyour AI agent."),
        ("3", "Rate answers", "Pass / Fail / Partial\nwith keyboard\nshortcuts 1/2/3."),
        ("4", "Track quality", "Dashboard shows\npass rate trends\nand regressions."),
    ]

    card_w = 260
    card_h = 400
    gap = 30
    total = len(cards) * card_w + (len(cards) - 1) * gap
    start_x = (1270 - total) // 2
    y = 120

    font_card_title = get_font(20)
    font_card_body = get_font(15)

    for i, (num, title, body) in enumerate(cards):
        cx = start_x + i * (card_w + gap)
        # Card bg
        draw.rounded_rectangle([cx, y, cx + card_w, y + card_h], radius=12, fill=BG_PANEL, outline=BORDER)
        # Number circle
        draw.ellipse([cx + card_w // 2 - 25, y + 30, cx + card_w // 2 + 25, y + 80], fill=ACCENT)
        draw.text((cx + card_w // 2, y + 55), num, fill=BG_DARK, font=get_font(28), anchor="mm")
        # Title
        draw.text((cx + card_w // 2, y + 120), title, fill=TEXT_WHITE, font=font_card_title, anchor="mm")
        # Body lines
        for j, line in enumerate(body.split("\n")):
            draw.text((cx + card_w // 2, y + 180 + j * 28), line, fill=TEXT_GRAY, font=font_card_body, anchor="mm")

    # Comparison section at bottom
    font_cmp = get_font(18)
    draw.text((635, 590), "Why EvalDesk?", fill=TEXT_WHITE, font=get_font(28), anchor="mm")

    comps = [
        ("Open Source", "MIT license", True),
        ("Self-Hostable", "One Docker cmd", True),
        ("No-Code", "For domain experts", True),
        ("LLM-as-Judge", "Auto-score with AI", True),
    ]
    pill_w = 240
    total = len(comps) * pill_w + (len(comps) - 1) * 20
    sx = (1270 - total) // 2
    for i, (label, desc, _) in enumerate(comps):
        px = sx + i * (pill_w + 20)
        py = 650
        draw.rounded_rectangle([px, py, px + pill_w, py + 70], radius=10, fill=BG_PANEL, outline=ACCENT)
        draw.text((px + pill_w // 2, py + 24), label, fill=ACCENT, font=get_font(16), anchor="mm")
        draw.text((px + pill_w // 2, py + 48), desc, fill=TEXT_DIM, font=get_font(12), anchor="mm")

    img.save(os.path.join(OUT, "gallery_02_features_1270x760.png"))
    print("Created: gallery_02_features_1270x760.png")


def draw_gallery_3_usecases():
    """1270x760 — Use cases."""
    img = Image.new("RGB", (1270, 760), BG_DARK)
    draw = ImageDraw.Draw(img)

    font_title = get_font(36)
    draw.text((635, 50), "Built for domain experts", fill=TEXT_WHITE, font=font_title, anchor="mm")
    draw.text((635, 95), "The people who actually know if an AI answer is correct", fill=TEXT_GRAY, font=get_font(18), anchor="mm")

    use_cases = [
        ("Doctors", "Medical triage bots\nDiagnostic assistants"),
        ("Lawyers", "Contract review agents\nLegal research tools"),
        ("Teachers", "AI tutors\nGrading assistants"),
        ("Compliance", "Banking chatbots\nInsurance processors"),
        ("QA Teams", "Regression testing\nAI agent updates"),
        ("PMs", "Support bots\nFAQ agents"),
    ]

    cols = 3
    card_w = 340
    card_h = 180
    gap_x = 30
    gap_y = 24
    total_w = cols * card_w + (cols - 1) * gap_x
    sx = (1270 - total_w) // 2
    sy = 160

    for i, (role, desc) in enumerate(use_cases):
        col = i % cols
        row = i // cols
        cx = sx + col * (card_w + gap_x)
        cy = sy + row * (card_h + gap_y)
        draw.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=12, fill=BG_PANEL, outline=BORDER)
        # Role badge
        badge_w = len(role) * 14 + 24
        bx = cx + 20
        by = cy + 20
        draw.rounded_rectangle([bx, by, bx + badge_w, by + 30], radius=15, fill=ACCENT)
        draw.text((bx + badge_w // 2, by + 15), role, fill=BG_DARK, font=get_font(14), anchor="mm")
        # Description
        for j, line in enumerate(desc.split("\n")):
            draw.text((cx + 24, cy + 75 + j * 28), line, fill=TEXT_GRAY, font=get_font(16))

    # Bottom CTA
    draw.text((635, 700), "docker compose up -d  ·  github.com/ramandagar/EvalDesk", fill=TEXT_DIM, font=get_font(14), anchor="mm")

    img.save(os.path.join(OUT, "gallery_03_usecases_1270x760.png"))
    print("Created: gallery_03_usecases_1270x760.png")


if __name__ == "__main__":
    draw_thumbnail()
    draw_gallery_1_hero()
    draw_gallery_2_features()
    draw_gallery_3_usecases()
    print("\nAll assets generated in:", OUT)

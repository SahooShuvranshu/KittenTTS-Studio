#!/usr/bin/env python3
"""
Generate minimal retro-futurist brutalist OG Card (1200x630) and Logo (1024x1024) for Kitten-TTS 2 Studio.
Palette:
- Matte charcoal chassis: #090a0d, #0e1016, #11141b, #181c26
- Bone cream: #eeebe3
- Phosphor green: #00ff88
- Signal amber: #ff8800
- Borders: #282d3b, #383f52
- Hardware accents: rotary marks, segmented LED meters, telemetry HUD
"""

import math
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1200
HEIGHT = 630

# Colors
BG_COLOR = (9, 10, 13)         # #090a0d
CHASSIS_BG = (14, 16, 22)      # #0e1016
MODULE_BG = (17, 20, 27)       # #11141b
BORDER_COLOR = (42, 47, 60)    # #2a2f3c
BORDER_BRIGHT = (65, 73, 92)   # #41495c
BONE_CREAM = (238, 235, 227)   # #eeebe3
MUTED_TEXT = (150, 158, 175)   # #969eaf
DARK_TEXT = (95, 103, 120)     # #5f6778
PHOSPHOR_GREEN = (0, 255, 136) # #00ff88
GREEN_UNLIT = (12, 45, 26)     # #0c2d1a
SIGNAL_AMBER = (255, 136, 0)   # #ff8800
AMBER_UNLIT = (50, 28, 6)      # #321c06
ALERT_RED = (255, 55, 68)      # #ff3744
RED_UNLIT = (50, 10, 14)       # #320a0e

# Load fonts
font_title = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", 40)
font_badge = ImageFont.truetype("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf", 13)
font_body = ImageFont.truetype("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Regular.ttf", 13)
font_mono_sm = ImageFont.truetype("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Regular.ttf", 11)
font_stat_val = ImageFont.truetype("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf", 18)
font_stat_lbl = ImageFont.truetype("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf", 10)
font_att = ImageFont.truetype("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf", 12)

def get_masked_emblem():
    """Crop the emblem hardware plate and apply a smooth rounded corner alpha mask."""
    emblem_path = "/home/shuvransu/Projects/KittenTTS-Studio/kitten_tts_hardware_emblem.jpg"
    orig = Image.open(emblem_path)
    # The plate is centered at (512, 512). Crop 840x840 -> (92, 92, 932, 932)
    cropped = orig.crop((92, 92, 932, 932)).convert("RGBA")
    w, h = cropped.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([12, 12, w - 12, h - 12], radius=72, fill=255)
    cropped.putalpha(mask)
    return cropped

def update_logos():
    """Update frontend/assets/logo.png and docs/assets/logo.png with the transparent hardware emblem."""
    masked = get_masked_emblem()
    # High-resolution 1024x1024 version with transparent padding
    logo_1024 = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    resized_emb = masked.resize((960, 960), Image.Resampling.LANCZOS)
    logo_1024.paste(resized_emb, (32, 32), resized_emb)

    frontend_logo = "/home/shuvransu/Projects/KittenTTS-Studio/frontend/assets/logo.png"
    docs_logo = "/home/shuvransu/Projects/KittenTTS-Studio/docs/assets/logo.png"
    logo_1024.save(frontend_logo, "PNG", optimize=True)
    logo_1024.save(docs_logo, "PNG", optimize=True)
    print(f"Updated logos at {frontend_logo} and {docs_logo}")

def draw_hex_bolt(draw, cx, cy, radius=8):
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(22, 25, 33), outline=(60, 68, 85), width=1)
    hex_r = radius * 0.55
    points = []
    for i in range(6):
        angle = math.radians(60 * i + 30)
        px = cx + hex_r * math.cos(angle)
        py = cy + hex_r * math.sin(angle)
        points.append((px, py))
    draw.polygon(points, fill=(8, 9, 12), outline=(35, 40, 50))

def draw_rotary_dial(draw, cx, cy, radius=18, angle_deg=45):
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(20, 24, 32), outline=BORDER_BRIGHT, width=1)
    inner_r = radius - 4
    draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(12, 14, 18), outline=(45, 52, 66), width=1)
    rad = math.radians(angle_deg)
    nx1 = cx + (inner_r - 2) * math.cos(rad)
    ny1 = cy + (inner_r - 2) * math.sin(rad)
    nx0 = cx + 3 * math.cos(rad)
    ny0 = cy + 3 * math.sin(rad)
    draw.line([(nx0, ny0), (nx1, ny1)], fill=SIGNAL_AMBER, width=2)
    for deg in range(-120, 150, 30):
        trad = math.radians(deg)
        t0 = radius + 3
        t1 = radius + 6
        x0 = cx + t0 * math.cos(trad)
        y0 = cy + t0 * math.sin(trad)
        x1 = cx + t1 * math.cos(trad)
        y1 = cy + t1 * math.sin(trad)
        draw.line([(x0, y0), (x1, y1)], fill=DARK_TEXT, width=1)

def generate_og_card():
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 1. Dot Matrix Background
    for x in range(30, WIDTH, 30):
        for y in range(30, HEIGHT, 30):
            draw.point((x, y), fill=(22, 26, 35))

    # 2. Outer Technical Rack Bezel
    draw.rectangle([14, 14, WIDTH - 14, HEIGHT - 14], outline=BORDER_COLOR, width=2)
    draw.rectangle([18, 18, WIDTH - 18, HEIGHT - 18], outline=(18, 21, 28), width=1)

    # Corner Bolts
    draw_hex_bolt(draw, 34, 34, radius=9)
    draw_hex_bolt(draw, WIDTH - 34, 34, radius=9)
    draw_hex_bolt(draw, 34, HEIGHT - 34, radius=9)
    draw_hex_bolt(draw, WIDTH - 34, HEIGHT - 34, radius=9)
    draw_hex_bolt(draw, 34, HEIGHT // 2, radius=8)
    draw_hex_bolt(draw, WIDTH - 34, HEIGHT // 2, radius=8)

    # 3. Top Telemetry Header Strip
    header_y = 48
    draw.line([(24, header_y + 16), (WIDTH - 24, header_y + 16)], fill=BORDER_COLOR, width=1)

    draw.rectangle([54, header_y - 18, 220, header_y + 8], fill=MODULE_BG, outline=BORDER_COLOR)
    draw.text((64, header_y - 14), "[ UNIT: KT2-SYNTH-01 ]", fill=MUTED_TEXT, font=font_badge)

    spec_txt = "CLOCK: 24.0 kHz PCM  •  LATENCY: 0.12 RTF  •  ARCH: 1.7B TERNARY SLM"
    draw.text((245, header_y - 12), spec_txt, fill=DARK_TEXT, font=font_mono_sm)

    # Right Status Indicators
    draw.ellipse([WIDTH - 260, header_y - 10, WIDTH - 250, header_y], fill=SIGNAL_AMBER)
    draw.text((WIDTH - 242, header_y - 13), "READY", fill=MUTED_TEXT, font=font_mono_sm)
    draw.ellipse([WIDTH - 170, header_y - 10, WIDTH - 160, header_y], fill=PHOSPHOR_GREEN)
    draw.text((WIDTH - 152, header_y - 13), "ACTIVE: CPU", fill=PHOSPHOR_GREEN, font=font_mono_sm)

    # 4. Left Column: Main Typography & Controls
    left_x = 54

    # Eyebrow / Hardware Tag
    tag_y = 84
    draw.rectangle([left_x, tag_y, left_x + 360, tag_y + 26], fill=MODULE_BG, outline=SIGNAL_AMBER, width=2)
    draw.rectangle([left_x, tag_y, left_x + 6, tag_y + 26], fill=SIGNAL_AMBER)
    draw.text((left_x + 16, tag_y + 5), "■ KITTEN-TTS 2 STUDIO // SPEC-024", fill=SIGNAL_AMBER, font=font_badge)

    # Primary Headline
    h_y = 122
    draw.text((left_x, h_y), "ZERO-SHOT", fill=BONE_CREAM, font=font_title)
    draw.text((left_x, h_y + 46), "VOICE CLONING", fill=PHOSPHOR_GREEN, font=font_title)
    draw.text((left_x, h_y + 92), "ON CONSUMER CPU", fill=BONE_CREAM, font=font_title)

    # Specs Monospace Readout
    s_y = 278
    draw.text((left_x, s_y), "1.7B Ternary SLM  •  24kHz Broadcast Mono  •  100% Offline", fill=BONE_CREAM, font=font_body)
    draw.text((left_x, s_y + 20), "Strict 8 GB RAM Budget  •  Zero Cloud Dependencies", fill=MUTED_TEXT, font=font_body)

    # Hairline separator
    draw.line([(left_x, s_y + 50), (660, s_y + 50)], fill=BORDER_COLOR, width=1)

    # 5. Segmented VU Meter
    vu_y = 346
    draw.text((left_x, vu_y), "VU LEVEL (dB)", fill=MUTED_TEXT, font=font_stat_lbl)
    draw.text((left_x + 120, vu_y), "-48   -36   -24   -18   -12   -6   -3    0   +3", fill=DARK_TEXT, font=font_mono_sm)

    bar_x = left_x
    bar_y = vu_y + 16
    seg_w = 14
    seg_h = 16
    seg_gap = 3
    num_segs = 26
    for i in range(num_segs):
        sx = bar_x + i * (seg_w + seg_gap)
        if i < 16:
            color = PHOSPHOR_GREEN if i < 15 else GREEN_UNLIT
        elif i < 22:
            color = SIGNAL_AMBER if i < 20 else AMBER_UNLIT
        else:
            color = ALERT_RED if i < 21 else RED_UNLIT
        draw.rectangle([sx, bar_y, sx + seg_w, bar_y + seg_h], fill=color)

    draw.text((bar_x + num_segs * (seg_w + seg_gap) + 12, bar_y + 2), "-1.8 dB", fill=SIGNAL_AMBER, font=font_badge)

    # 6. Three Tactile Telemetry Cards
    card_y = 394
    c_w = 180
    c_h = 60

    # Card 1: Latency
    draw.rectangle([left_x, card_y, left_x + c_w, card_y + c_h], fill=MODULE_BG, outline=PHOSPHOR_GREEN, width=2)
    draw.line([(left_x + c_w + 1, card_y + 2), (left_x + c_w + 1, card_y + c_h + 2)], fill=(0, 0, 0), width=2)
    draw.line([(left_x + 2, card_y + c_h + 1), (left_x + c_w + 1, card_y + c_h + 1)], fill=(0, 0, 0), width=2)
    draw.text((left_x + 12, card_y + 6), "LATENCY", fill=MUTED_TEXT, font=font_stat_lbl)
    draw.text((left_x + 12, card_y + 20), "0.12 RTF", fill=PHOSPHOR_GREEN, font=font_stat_val)
    draw.text((left_x + 12, card_y + 42), "REAL-TIME CPU", fill=DARK_TEXT, font=font_mono_sm)

    # Card 2: Memory
    c2_x = left_x + c_w + 16
    draw.rectangle([c2_x, card_y, c2_x + c_w, card_y + c_h], fill=MODULE_BG, outline=SIGNAL_AMBER, width=2)
    draw.line([(c2_x + c_w + 1, card_y + 2), (c2_x + c_w + 1, card_y + c_h + 2)], fill=(0, 0, 0), width=2)
    draw.line([(c2_x + 2, card_y + c_h + 1), (c2_x + c_w + 1, card_y + c_h + 1)], fill=(0, 0, 0), width=2)
    draw.text((c2_x + 12, card_y + 6), "MEMORY FOOTPRINT", fill=MUTED_TEXT, font=font_stat_lbl)
    draw.text((c2_x + 12, card_y + 20), "1.03 GB", fill=SIGNAL_AMBER, font=font_stat_val)
    draw.text((c2_x + 12, card_y + 42), "8 GB BUDGET SAFE", fill=DARK_TEXT, font=font_mono_sm)

    # Card 3: Acceleration
    c3_x = c2_x + c_w + 16
    draw.rectangle([c3_x, card_y, c3_x + c_w, card_y + c_h], fill=MODULE_BG, outline=BORDER_BRIGHT, width=2)
    draw.line([(c3_x + c_w + 1, card_y + 2), (c3_x + c_w + 1, card_y + c_h + 2)], fill=(0, 0, 0), width=2)
    draw.line([(c3_x + 2, card_y + c_h + 1), (c3_x + c_w + 1, card_y + c_h + 1)], fill=(0, 0, 0), width=2)
    draw.text((c3_x + 12, card_y + 6), "VECTOR ENGINE", fill=MUTED_TEXT, font=font_stat_lbl)
    draw.text((c3_x + 12, card_y + 20), "CPU AVX2", fill=BONE_CREAM, font=font_stat_val)
    draw.text((c3_x + 12, card_y + 42), "ZERO GPU REQUIRED", fill=DARK_TEXT, font=font_mono_sm)

    # 7. Rotary indicator and Calibration Dial
    dial_x = left_x + 22
    dial_y = 496
    draw_rotary_dial(draw, dial_x, dial_y, radius=16, angle_deg=35)
    draw.text((dial_x + 26, dial_y - 12), "GAIN // CALIBRATED", fill=MUTED_TEXT, font=font_stat_lbl)
    draw.text((dial_x + 26, dial_y + 2), "+2.4 dB (NORMALIZED)", fill=BONE_CREAM, font=font_mono_sm)

    # Offline Pill next to rotary dial
    pill_x = dial_x + 220
    draw.rectangle([pill_x, dial_y - 12, pill_x + 190, dial_y + 14], fill=MODULE_BG, outline=BORDER_COLOR)
    draw.ellipse([pill_x + 10, dial_y - 4, pill_x + 18, dial_y + 4], fill=PHOSPHOR_GREEN)
    draw.text((pill_x + 26, dial_y - 7), "100% LOCAL SYNTHESIS", fill=MUTED_TEXT, font=font_mono_sm)

    # 8. Bottom Attribution
    att_y = 552
    draw.line([(left_x, att_y - 14), (660, att_y - 14)], fill=BORDER_COLOR, width=1)
    draw.text((left_x, att_y), "Built by Shuvransu with the help of Antigravity", fill=BONE_CREAM, font=font_att)
    draw.text((left_x, att_y + 18), "Offline Speech Synthesis & Zero-Shot Cloning Console", fill=DARK_TEXT, font=font_mono_sm)

    # 9. Right Column: Dedicated Industrial Hardware Module Bay with Clean Emblem
    bay_x = 690
    bay_y = 78
    bay_w = 466
    bay_h = 502

    # Brutalist drop shadow for module bay
    draw.rectangle([bay_x + 5, bay_y + 5, bay_x + bay_w + 5, bay_y + bay_h + 5], fill=(0, 0, 0))
    # Main Module Bay Chassis
    draw.rectangle([bay_x, bay_y, bay_x + bay_w, bay_y + bay_h], fill=CHASSIS_BG, outline=BORDER_BRIGHT, width=2)

    # Bay Header Strip
    draw.rectangle([bay_x, bay_y, bay_x + bay_w, bay_y + 32], fill=(20, 23, 32), outline=BORDER_COLOR)
    draw_hex_bolt(draw, bay_x + 16, bay_y + 16, radius=6)
    draw_hex_bolt(draw, bay_x + bay_w - 16, bay_y + 16, radius=6)
    draw.text((bay_x + 36, bay_y + 9), "MOD: EM-01 // TERNARY AUDIO CORE", fill=MUTED_TEXT, font=font_badge)
    draw.ellipse([bay_x + bay_w - 38, bay_y + 12, bay_x + bay_w - 30, bay_y + 20], fill=PHOSPHOR_GREEN)

    # Embed the Clean Transparent Masked Emblem
    masked_emb = get_masked_emblem()
    emb_size = 420
    resized_emb = masked_emb.resize((emb_size, emb_size), Image.Resampling.LANCZOS)
    emb_x = bay_x + (bay_w - emb_size) // 2
    emb_y = bay_y + 38

    # Recessed shadow under emblem
    draw.rectangle([emb_x + 3, emb_y + 3, emb_x + emb_size + 3, emb_y + emb_size + 3], fill=(5, 6, 8))
    # Paste emblem with alpha
    img.paste(resized_emb, (emb_x, emb_y), resized_emb)

    # Bay Footer Telemetry Strip
    foot_y = bay_y + bay_h - 36
    draw.rectangle([bay_x, foot_y, bay_x + bay_w, bay_y + bay_h], fill=(16, 18, 25), outline=BORDER_COLOR)
    draw.text((bay_x + 16, foot_y + 10), "TELEMETRY: 24kHz • MONO • 16-BIT PCM", fill=DARK_TEXT, font=font_mono_sm)
    draw.text((bay_x + bay_w - 140, foot_y + 10), "RACK: MOUNTED", fill=SIGNAL_AMBER, font=font_mono_sm)

    # Save outputs
    frontend_out = "/home/shuvransu/Projects/KittenTTS-Studio/frontend/assets/og-card.png"
    docs_out = "/home/shuvransu/Projects/KittenTTS-Studio/docs/assets/og-card.png"

    img.save(frontend_out, "PNG", optimize=True)
    img.save(docs_out, "PNG", optimize=True)
    print(f"Generated {frontend_out} and {docs_out}")

if __name__ == "__main__":
    update_logos()
    generate_og_card()

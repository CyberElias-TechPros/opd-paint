import sys, os, time, subprocess, wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import numpy as np

W, H = 720, 1280
FPS = 30

FONT_PATH_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_PATH_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

font_xs = ImageFont.truetype(FONT_PATH_REG, 16)
font_sm = ImageFont.truetype(FONT_PATH_REG, 20)
font_sm_bold = ImageFont.truetype(FONT_PATH_BOLD, 20)
font_md = ImageFont.truetype(FONT_PATH_REG, 24)
font_md_bold = ImageFont.truetype(FONT_PATH_BOLD, 24)
font_lg_bold = ImageFont.truetype(FONT_PATH_BOLD, 30)
font_xl_bold = ImageFont.truetype(FONT_PATH_BOLD, 38)
font_hook = ImageFont.truetype(FONT_PATH_BOLD, 31)

# Helper for wrapping text
def wrap_text(text, font, max_width):
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        test = f"{cur} {w}".strip()
        if font.getlength(test) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

# Load assets
IMG_SITE_RENDER = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.25 PM.jpeg').convert('RGB')
IMG_SITE_SCAFFOLD = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.14 PM.jpeg').convert('RGB')
IMG_BUCKET_MATT = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.06 PM (1).jpeg').convert('RGB')
IMG_BUCKET_SILK = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.08 PM.jpeg').convert('RGB')
IMG_FADED_WALL = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.11 PM.jpeg').convert('RGB')
IMG_ROOM_PREVIEW = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.34 PM.jpeg').convert('RGB')
IMG_VILLA_GRA = Image.open('opuda/WhatsApp Image 2026-10-21 at 8.46.21 AM.jpeg').convert('RGB')
IMG_LILAC_LOUNGE = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.38 PM.jpeg').convert('RGB')
IMG_BLUE_FENCE = Image.open('opuda/WhatsApp Image 2026-10-21 at 8.46.21 AM (2).jpeg').convert('RGB')
IMG_PORTICO = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.30 PM.jpeg').convert('RGB')
IMG_GATE = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.39 PM.jpeg').convert('RGB')
IMG_BRAND_MARK = Image.open('app/public/brand/mark-512.png').convert('RGBA')

# Precompute room color variants
room_arr = np.array(IMG_ROOM_PREVIEW, dtype=np.float32)
room_lum = 0.299 * room_arr[:,:,0] + 0.587 * room_arr[:,:,1] + 0.114 * room_arr[:,:,2]
rw, rh = IMG_ROOM_PREVIEW.size
room_mask = np.zeros((rh, rw), dtype=np.float32)
room_mask[:int(rh*0.78), :] = 1.0

def make_tinted(target_rgb):
    tr, tg, tb = target_rgb
    target_lum = 0.299 * tr + 0.587 * tg + 0.114 * tb
    tinted = (room_lum[:,:,None] / target_lum) * np.array([tr, tg, tb], dtype=np.float32)
    tinted = np.clip(tinted, 0, 255)
    blended = (room_arr * (1.0 - room_mask[:,:,None]*0.75) + tinted * (room_mask[:,:,None]*0.75)).astype(np.uint8)
    return Image.fromarray(blended)

IMG_ROOM_LILAC = make_tinted((209, 191, 213)) # Lilac Room OP-605
IMG_ROOM_BONNY = make_tinted((194, 193, 184)) # Bonny Haze OP-136
IMG_ROOM_PALM  = make_tinted((62, 92, 70))    # Palm Shadow OP-209

def fit_cover(im, target_w, target_h, scale=1.0, pan_x=0.5, pan_y=0.5):
    iw, ih = im.size
    aspect_target = target_w / target_h
    aspect_src = iw / ih

    if aspect_src > aspect_target:
        new_h = ih / scale
        new_w = new_h * aspect_target
    else:
        new_w = iw / scale
        new_h = new_w / aspect_target

    new_w = min(iw, max(10, new_w))
    new_h = min(ih, max(10, new_h))

    left = (iw - new_w) * pan_x
    top = (ih - new_h) * pan_y
    right = left + new_w
    bottom = top + new_h

    cropped = im.crop((int(left), int(top), int(right), int(bottom)))
    return cropped.resize((target_w, target_h), Image.LANCZOS)

def draw_subtitle_wrapped(base_im, speaker, text, subtext=None):
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    
    box_w = 660
    box_x = (W - box_w) // 2
    max_text_w = box_w - 48
    
    lines = wrap_text(f'"{text}"', font_md_bold, max_text_w)
    
    needed_h = 44 + len(lines) * 32 + (28 if subtext else 16)
    box_h = max(110, needed_h)
    box_y = 1040 - (box_h - 110)
    
    d.rounded_rectangle([box_x, box_y, box_x + box_w, box_y + box_h], radius=16, fill=(15, 18, 22, 235), outline=(255, 255, 255, 60), width=1)
    
    spk_colors = {
        'Daddy (London)': (245, 166, 35),
        'Woman': (52, 199, 89),
        'Neighbour': (90, 200, 250),
        'Voiceover': (255, 215, 0),
        'Opuda’s Paint': (52, 199, 89),
    }
    col = spk_colors.get(speaker, (52, 199, 89))
    d.text((box_x + 24, box_y + 14), speaker.upper(), font=font_sm_bold, fill=col)
    
    curr_y = box_y + 42
    for line in lines:
        d.text((box_x + 24, curr_y), line, font=font_md_bold, fill=(255, 255, 255))
        curr_y += 32
        
    if subtext:
        sub_lines = wrap_text(subtext, font_xs, max_text_w)
        for sline in sub_lines:
            d.text((box_x + 24, curr_y + 4), sline, font=font_xs, fill=(210, 215, 225))
            curr_y += 22
            
    return Image.alpha_composite(base_im.convert('RGBA'), overlay).convert('RGB')

def draw_video_call_ui(base_im, elapsed_sec):
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    
    mins = int(elapsed_sec // 60)
    secs = int(elapsed_sec % 60)
    time_str = f"{mins:02d}:{secs:02d}"
    
    # Left pill: call status
    d.rounded_rectangle([24, 48, 410, 102], radius=28, fill=(0, 0, 0, 190), outline=(255, 255, 255, 40))
    d.ellipse([42, 68, 56, 82], fill=(52, 199, 89))
    d.text((68, 62), "WhatsApp Video Call • " + time_str, font=font_sm, fill=(240, 240, 240))
    
    # Right pill: caller ID
    d.rounded_rectangle([424, 48, 696, 102], radius=28, fill=(0, 0, 0, 190), outline=(255, 255, 255, 40))
    d.text((444, 62), "UK: Daddy (London)", font=font_sm_bold, fill=(255, 215, 0))
    
    # Inset caller video pip
    pip_w, pip_h = 150, 190
    pip_x, pip_y = W - pip_w - 24, 116
    d.rounded_rectangle([pip_x-2, pip_y-2, pip_x + pip_w + 2, pip_y + pip_h + 2], radius=16, fill=(255, 255, 255, 120))
    d.rounded_rectangle([pip_x, pip_y, pip_x + pip_w, pip_y + pip_h], radius=14, fill=(35, 45, 60, 250))
    d.ellipse([pip_x + 45, pip_y + 35, pip_x + 105, pip_y + 95], fill=(70, 85, 110))
    d.ellipse([pip_x + 25, pip_y + 100, pip_x + 125, pip_y + 170], fill=(70, 85, 110))
    d.text((pip_x + 18, pip_y + 158), "Daddy in UK", font=font_xs, fill=(220, 220, 220))
    
    # Bottom controls
    cx = 260
    for label, col in [("Mute", (60, 60, 60)), ("Flip", (60, 60, 60)), ("End", (235, 50, 50))]:
        d.ellipse([cx, 1200, cx + 56, 1256], fill=col)
        cx += 76

    return Image.alpha_composite(base_im.convert('RGBA'), overlay).convert('RGB')

# -----------------------------------------------------------------------------
# RENDER FLAGSHIP AD (45 SECONDS)
# -----------------------------------------------------------------------------
print("==> RENDERING FLAGSHIP AD: opudas-approval-call-ad.mp4 (45s)...")
TOTAL_DURATION = 45.0
TOTAL_FRAMES = int(TOTAL_DURATION * FPS)
output_flagship = 'opudas-approval-call-ad.mp4'

cmd = [
    'ffmpeg', '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-s', f'{W}x{H}',
    '-pix_fmt', 'rgb24',
    '-r', str(FPS),
    '-i', '-',
    '-i', 'build_ad_assets/audio/master_audio.wav',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    output_flagship
]

proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

for frame_idx in range(TOTAL_FRAMES):
    t = frame_idx / FPS
    
    if t < 3.0:
        p = t / 3.0
        frame = fit_cover(IMG_SITE_RENDER, W, H, scale=1.0 + 0.12*p, pan_x=0.5, pan_y=0.45)
        frame = draw_video_call_ui(frame, t)
        
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        card_w, card_h = 660, 260
        cx = (W - card_w) // 2
        cy = 460
        d.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=24, fill=(0, 0, 0, 225), outline=(255, 215, 0, 200), width=3)
        
        d.text((cx + 32, cy + 28), "MY HUSBAND IS IN LONDON.", font=font_hook, fill=(255, 255, 255))
        d.text((cx + 32, cy + 82), "THE HOUSE IS IN PORT HARCOURT.", font=font_hook, fill=(255, 215, 0))
        d.text((cx + 32, cy + 136), "AND HE HAS OPINIONS.", font=font_hook, fill=(255, 80, 80))
        
        d.rounded_rectangle([cx + 32, cy + 196, cx + 420, cy + 240], radius=10, fill=(12, 107, 69, 230))
        d.text((cx + 46, cy + 206), "PORT HARCOURT LIVE SITE", font=font_sm_bold, fill=(255, 255, 255))
        
        frame = Image.alpha_composite(frame.convert('RGBA'), overlay).convert('RGB')
        
        if t >= 1.7:
            frame = draw_subtitle_wrapped(frame, "Woman", "Daddy, I dey the site oh.", "Supervising site work in Port Harcourt")

    elif t < 8.0:
        p = (t - 3.0) / 5.0
        bg = fit_cover(IMG_SITE_SCAFFOLD, W, H, scale=1.05 + 0.08*p, pan_x=0.5, pan_y=0.4)
        
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        bw, bh = 280, 380
        bucket_thumb = IMG_BUCKET_MATT.resize((bw, bh), Image.LANCZOS)
        overlay.paste(bucket_thumb, (40, 640))
        
        d.rounded_rectangle([40, 580, 320, 630], radius=12, fill=(12, 107, 69, 240), outline=(255, 255, 255, 80), width=1)
        d.text((54, 594), "OPUDA'S MATT • ON SITE", font=font_sm_bold, fill=(255, 255, 255))
        
        d.rounded_rectangle([30, 180, 690, 246], radius=16, fill=(200, 25, 35, 235), outline=(255, 255, 255, 100), width=2)
        d.text((54, 196), "EVERY FAMILY HAS THIS ARGUMENT.", font=font_lg_bold, fill=(255, 255, 255))
        
        frame = Image.alpha_composite(bg.convert('RGBA'), overlay).convert('RGB')
        frame = draw_video_call_ui(frame, t)
        
        if t < 4.2:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "Which one again?")
        elif t < 5.5:
            frame = draw_subtitle_wrapped(frame, "Woman", "The colour, Daddy. Which one we go use?")
        elif t < 6.9:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "Cream. Plain cream. I've told that painter.")
        elif t < 7.7:
            frame = draw_subtitle_wrapped(frame, "Woman", "Daddy, everybody house na cream?")
        else:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "Nobody regret cream.")

    elif t < 10.0:
        p = (t - 8.0) / 2.0
        wall = fit_cover(IMG_FADED_WALL, W, H, scale=1.0 + 0.1*p, pan_x=0.5, pan_y=0.5)
        wall = ImageOps.autocontrast(wall, cutoff=2)
        
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        d.rectangle([0, 0, W, H], fill=(10, 15, 25, 90))
        
        np.random.seed(frame_idx)
        for _ in range(35):
            rx = np.random.randint(0, W)
            ry = np.random.randint(0, H)
            d.line([(rx, ry), (rx - 15, ry + 45)], fill=(200, 220, 255, 140), width=2)
            
        card_w, card_h = 660, 140
        cx = (W - card_w) // 2
        cy = 380
        d.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=20, fill=(0, 0, 0, 235), outline=(255, 50, 50, 220), width=2)
        d.text((cx + 40, cy + 30), "RAIN. SUN. ONE WRONG COLOUR.", font=font_lg_bold, fill=(255, 80, 80))
        d.text((cx + 40, cy + 80), "Repainting costs 2x the labour and materials", font=font_sm, fill=(220, 220, 220))
        
        frame = Image.alpha_composite(wall.convert('RGBA'), overlay).convert('RGB')
        frame = draw_video_call_ui(frame, t)
        frame = draw_subtitle_wrapped(frame, "Daddy (London)", "...I no wan make we spend this money twice.", "You know how much enter this building.")

    elif t < 17.0:
        if t < 12.6:
            active_img = IMG_ROOM_LILAC
            active_name = "OP-605 Lilac Room"
            active_hex = "#D1BFD5"
            active_tag = "THE DELTA EDIT"
        elif t < 14.8:
            active_img = IMG_ROOM_BONNY
            active_name = "OP-136 Bonny Haze"
            active_hex = "#C2C1B8"
            active_tag = "BONNY RIVER HAZE"
        else:
            active_img = IMG_ROOM_PALM
            active_name = "OP-209 Palm Shadow"
            active_hex = "#3E5C46"
            active_tag = "RAIN SEASON COLLECTION"

        bg_phone = fit_cover(active_img, W, H, scale=1.02, pan_x=0.5, pan_y=0.4)
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        d.rectangle([0, 0, W, 170], fill=(15, 23, 20, 245))
        d.rounded_rectangle([30, 48, 220, 96], radius=10, fill=(12, 107, 69))
        d.text((46, 60), "ROOM PREVIEW", font=font_sm_bold, fill=(255, 255, 255))
        d.text((240, 60), "opudapaint.com/preview", font=font_sm, fill=(180, 200, 190))
        d.text((30, 116), "Tap wall to swap colour • Instant live simulation", font=font_sm, fill=(230, 235, 240))
        
        d.rounded_rectangle([30, 185, 690, 255], radius=16, fill=(12, 107, 69, 245), outline=(255, 215, 0, 200), width=2)
        d.text((48, 204), "59 COLOURS. YOUR WALL. BEFORE YOU BUY.", font=font_lg_bold, fill=(255, 255, 255))
        
        d.rounded_rectangle([30, 890, 690, 1010], radius=18, fill=(10, 15, 20, 240), outline=(255, 255, 255, 50))
        d.rectangle([54, 915, 114, 985], fill=active_hex, outline=(255, 255, 255), width=3)
        d.text((130, 922), active_name, font=font_lg_bold, fill=(255, 255, 255))
        d.text((130, 960), f"Active selection • {active_tag}", font=font_sm, fill=(200, 210, 220))
        
        tap_x = 450 + int(np.sin(t * 4) * 20)
        tap_y = 550 + int(np.cos(t * 4) * 15)
        d.ellipse([tap_x-15, tap_y-15, tap_x+15, tap_y+15], outline=(255, 255, 255, 220), width=4)
        d.ellipse([tap_x-30, tap_y-30, tap_x+30, tap_y+30], outline=(52, 199, 89, 160), width=2)
        
        frame = Image.alpha_composite(bg_phone.convert('RGBA'), overlay).convert('RGB')
        
        if t < 11.4:
            frame = draw_subtitle_wrapped(frame, "Woman", "Wait. Forget cream first. Look.")
        elif t < 12.7:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "Eh? You dey show me picture?")
        elif t < 14.5:
            frame = draw_subtitle_wrapped(frame, "Woman", "No na. Na this actual room. I snap am, I change the colour.")
        elif t < 15.8:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "You mean I fit see am before we buy?")
        else:
            frame = draw_subtitle_wrapped(frame, "Woman", "Yes na. Fifty-nine colours.", "Tested on your real room walls")

    elif t < 22.0:
        bg = Image.new('RGB', (W, H), (18, 22, 28))
        bw, bh = 340, 480
        matt_fit = IMG_BUCKET_MATT.resize((bw, bh), Image.LANCZOS)
        silk_fit = IMG_BUCKET_SILK.resize((bw, bh), Image.LANCZOS)
        bg.paste(matt_fit, (15, 340))
        bg.paste(silk_fit, (365, 340))
        
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        d.rounded_rectangle([30, 80, 690, 160], radius=16, fill=(12, 107, 69, 240), outline=(255, 255, 255, 80))
        d.text((54, 96), "MADE IN PORT HARCOURT.", font=font_lg_bold, fill=(255, 255, 255))
        d.text((54, 132), "Formulated specifically for the Nigerian climate", font=font_sm, fill=(200, 230, 210))
        
        d.rounded_rectangle([30, 180, 690, 280], radius=18, fill=(245, 166, 35, 245), outline=(255, 255, 255, 100), width=2)
        d.text((54, 196), "5-YEAR GUARANTEE ON MATT & SILK.*", font=font_lg_bold, fill=(10, 10, 10))
        d.text((54, 242), "*Subject to written guarantee terms. Applies to Matt & Silk only.", font=font_xs, fill=(40, 40, 40))
        
        d.rounded_rectangle([40, 840, 330, 900], radius=10, fill=(0, 0, 0, 220))
        d.text((56, 856), "OPUDA'S MATT • SMOOTH", font=font_sm_bold, fill=(255, 255, 255))
        
        d.rounded_rectangle([390, 840, 680, 900], radius=10, fill=(0, 0, 0, 220))
        d.text((406, 856), "OPUDA'S SILK • WASHABLE", font=font_sm_bold, fill=(255, 255, 255))
        
        frame = Image.alpha_composite(bg.convert('RGBA'), overlay).convert('RGB')
        
        if t < 18.6:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "But this one go stay? Sun dey here.")
        elif t < 20.2:
            frame = draw_subtitle_wrapped(frame, "Woman", "Opuda's get five-year guarantee for Matt and Silk.")
        elif t < 21.1:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "And na where dem make am?")
        else:
            frame = draw_subtitle_wrapped(frame, "Woman", "Port Harcourt, Daddy. Colour, made in Nigeria.")

    elif t < 25.0:
        p = (t - 22.0) / 3.0
        frame = fit_cover(IMG_ROOM_LILAC, W, H, scale=1.03 + 0.05*p, pan_x=0.5, pan_y=0.45)
        
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        card_w, card_h = 660, 210
        cx = (W - card_w) // 2
        cy = 340
        d.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=22, fill=(0, 0, 0, 230), outline=(52, 199, 89, 220), width=3)
        
        d.text((cx + 36, cy + 28), "COLOUR APPROVED! ✓", font=font_lg_bold, fill=(52, 199, 89))
        d.text((cx + 36, cy + 78), "OP-605 LILAC ROOM", font=font_xl_bold, fill=(209, 191, 213))
        d.text((cx + 36, cy + 140), "DON'T GUESS YOUR COLOUR. SEE IT FIRST.", font=font_md_bold, fill=(255, 215, 0))
        
        frame = Image.alpha_composite(frame.convert('RGBA'), overlay).convert('RGB')
        frame = draw_video_call_ui(frame, t)
        
        if t < 23.0:
            frame = draw_subtitle_wrapped(frame, "Woman", "So? Cream?")
        elif t < 24.1:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "...No. That lilac one. OP-605. Make we do am well.")
        elif t < 24.6:
            frame = draw_subtitle_wrapped(frame, "Woman", "You don agree?")
        else:
            frame = draw_subtitle_wrapped(frame, "Daddy (London)", "Send me the picture first.")

    elif t < 32.0:
        rev_t = t - 25.0
        if rev_t < 1.75:
            p = rev_t / 1.75
            frame = fit_cover(IMG_VILLA_GRA, W, H, scale=1.0 + 0.15*p, pan_x=0.5, pan_y=0.4)
            tag_title = "THE ARCHED VILLA"
            tag_sub = "GRA PHASE 2, PORT HARCOURT"
        elif rev_t < 3.5:
            p = (rev_t - 1.75) / 1.75
            frame = fit_cover(IMG_LILAC_LOUNGE, W, H, scale=1.0 + 0.12*p, pan_x=0.45, pan_y=0.4)
            tag_title = "THE LILAC LOUNGE"
            tag_sub = "OP-605 SILK FINISH • CHANDELIER HALL"
        elif rev_t < 5.25:
            p = (rev_t - 3.5) / 1.75
            frame = fit_cover(IMG_BLUE_FENCE, W, H, scale=1.02 + 0.14*p, pan_x=0.5, pan_y=0.4)
            tag_title = "BLUE BOUNDARY WALL"
            tag_sub = "RUMUOLA, PORT HARCOURT"
        else:
            p = (rev_t - 5.25) / 1.75
            frame = fit_cover(IMG_PORTICO, W, H, scale=1.0 + 0.15*p, pan_x=0.5, pan_y=0.35)
            tag_title = "CREEK-FACING FACADE"
            tag_sub = "WOJI, PORT HARCOURT"

        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        d.rounded_rectangle([30, 80, 690, 160], radius=18, fill=(0, 0, 0, 230), outline=(255, 215, 0, 220), width=2)
        d.text((54, 96), "WALLS. CEILINGS. FENCES. GATES.", font=font_lg_bold, fill=(255, 255, 255))
        d.text((54, 134), "REAL COMPLETED SITES ACROSS PORT HARCOURT", font=font_xs, fill=(255, 215, 0))
        
        d.rounded_rectangle([30, 1080, 690, 1190], radius=18, fill=(12, 107, 69, 235), outline=(255, 255, 255, 80), width=1)
        d.text((54, 1098), tag_title, font=font_lg_bold, fill=(255, 255, 255))
        d.text((54, 1144), tag_sub, font=font_sm, fill=(200, 235, 215))
        
        frame = Image.alpha_composite(frame.convert('RGBA'), overlay).convert('RGB')

    elif t < 38.0:
        p = (t - 32.0) / 6.0
        frame = fit_cover(IMG_GATE, W, H, scale=1.0 + 0.1*p, pan_x=0.5, pan_y=0.4)
        
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        d.rounded_rectangle([30, 120, 690, 230], radius=22, fill=(0, 0, 0, 235), outline=(255, 215, 0, 220), width=3)
        d.text((54, 142), "“WHO PAINTED YOUR HOUSE?”", font=font_lg_bold, fill=(255, 215, 0))
        d.text((54, 188), "The question every Nigerian homeowner wants to hear.", font=font_sm, fill=(230, 230, 230))
        
        frame = Image.alpha_composite(frame.convert('RGBA'), overlay).convert('RGB')
        
        if t < 34.2:
            frame = draw_subtitle_wrapped(frame, "Neighbour", "Eh! Who painted your house?")
        elif t < 35.4:
            frame = draw_subtitle_wrapped(frame, "Woman", "Opuda’s.")
        else:
            frame = draw_subtitle_wrapped(frame, "Woman", "Go try your colour first. Free.", "opudapaint.com")

    else:
        p = (t - 38.0) / 7.0
        bg = Image.new('RGB', (W, H), (14, 20, 17))
        
        overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        
        mark_w, mark_h = 90, 90
        brand_thumb = IMG_BRAND_MARK.resize((mark_w, mark_h), Image.LANCZOS)
        overlay.paste(brand_thumb, ((W - mark_w)//2, 60), brand_thumb)
        
        d.text(((W - 360)//2, 165), "OPUDA'S PAINT", font=font_xl_bold, fill=(255, 255, 255))
        d.text(((W - 300)//2, 220), "Colour, made in Nigeria.", font=font_md, fill=(52, 199, 89))
        
        bw, bh = 250, 340
        matt_thumb = IMG_BUCKET_MATT.resize((bw, bh), Image.LANCZOS)
        silk_thumb = IMG_BUCKET_SILK.resize((bw, bh), Image.LANCZOS)
        overlay.paste(matt_thumb, (80, 275))
        overlay.paste(silk_thumb, (390, 275))
        
        card_w, card_h = 660, 310
        cx = (W - card_w) // 2
        cy = 640
        d.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=24, fill=(12, 107, 69, 245), outline=(255, 215, 0, 220), width=3)
        
        d.text((cx + 40, cy + 24), "TRY YOUR COLOUR FREE", font=font_lg_bold, fill=(255, 215, 0))
        d.text((cx + 40, cy + 68), "opudapaint.com", font=font_xl_bold, fill=(255, 255, 255))
        d.text((cx + 40, cy + 120), "• 59 colours to explore on your own wall", font=font_sm, fill=(225, 245, 235))
        d.text((cx + 40, cy + 150), "• 5-year guarantee on Matt & Silk*", font=font_sm, fill=(225, 245, 235))
        
        d.rounded_rectangle([cx + 36, cy + 195, cx + card_w - 36, cy + 280], radius=16, fill=(37, 211, 102), outline=(255, 255, 255, 120), width=2)
        d.text((cx + 56, cy + 214), "WHATSAPP: 0902 642 4350", font=font_lg_bold, fill=(10, 10, 10))
        d.text((cx + 56, cy + 252), "Instant quote • Mon–Sat, 8am–6pm", font=font_xs, fill=(30, 30, 30))
        
        frame = Image.alpha_composite(bg.convert('RGBA'), overlay).convert('RGB')
        frame = draw_subtitle_wrapped(frame, "Opuda’s Paint", "Opuda’s Paint. Colour, made in Nigeria.", "Try your colour free at opudapaint.com, or WhatsApp 0902 642 4350 for a quote.")

    proc.stdin.write(frame.tobytes())

proc.stdin.close()
proc.wait()
print("Flagship video rendered successfully!")

# Copy video to app public for live preview
os.makedirs('app/public/videos', exist_ok=True)
import shutil
shutil.copyfile('opudas-approval-call-ad.mp4', 'app/public/videos/opudas-approval-call-ad.mp4')
print("Copied flagship video to app/public/videos/opudas-approval-call-ad.mp4")

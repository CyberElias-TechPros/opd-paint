import sys, os, time, subprocess, wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import numpy as np

W, H = 720, 1280
FPS = 30
TARGET_SR = 44100

FONT_PATH_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_PATH_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

font_xs = ImageFont.truetype(FONT_PATH_REG, 16)
font_sm = ImageFont.truetype(FONT_PATH_REG, 20)
font_sm_bold = ImageFont.truetype(FONT_PATH_BOLD, 20)
font_md = ImageFont.truetype(FONT_PATH_REG, 24)
font_md_bold = ImageFont.truetype(FONT_PATH_BOLD, 24)
font_lg_bold = ImageFont.truetype(FONT_PATH_BOLD, 30)
font_xl_bold = ImageFont.truetype(FONT_PATH_BOLD, 38)
font_hook = ImageFont.truetype(FONT_PATH_BOLD, 32)

IMG_BUCKET_MATT = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.06 PM (1).jpeg').convert('RGB')
IMG_BUCKET_SILK = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.08 PM.jpeg').convert('RGB')
IMG_ROOM_PREVIEW = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.34 PM.jpeg').convert('RGB')
IMG_LILAC_LOUNGE = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.38 PM.jpeg').convert('RGB')
IMG_VILLA_GRA = Image.open('opuda/WhatsApp Image 2026-10-21 at 8.46.21 AM.jpeg').convert('RGB')
IMG_BRAND_MARK = Image.open('app/public/brand/mark-512.png').convert('RGBA')

# Precompute tints
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

IMG_ROOM_LILAC = make_tinted((209, 191, 213)) # OP-605
IMG_ROOM_BONNY = make_tinted((194, 193, 184)) # OP-136
IMG_ROOM_PALM  = make_tinted((62, 92, 70))    # OP-209

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
    return im.crop((int(left), int(top), int(left + new_w), int(top + new_h))).resize((target_w, target_h), Image.LANCZOS)

# -----------------------------------------------------------------------------
# 1. RENDER "WHICH ONE?" (15 SECONDS)
# -----------------------------------------------------------------------------
print("==> RENDERING: opudas-which-one-15s.mp4...")
TOTAL_15 = 15.0
FRAMES_15 = int(TOTAL_15 * FPS)

# Afrobeat music track for 15s
t15 = np.arange(int(TOTAL_15 * TARGET_SR)) / TARGET_SR
audio15 = np.zeros(len(t15), dtype=np.float32)
# upbeat Afrobeat groove
BPM = 112
beat_dur = 60.0 / BPM
for b in range(int(TOTAL_15 / beat_dur)):
    b_idx = int(b * beat_dur * TARGET_SR)
    t_k = np.arange(int(0.2 * TARGET_SR)) / TARGET_SR
    k = np.sin(2 * np.pi * 55 * np.exp(-t_k*16) * t_k) * np.exp(-t_k*12) * 0.4
    if b_idx + len(k) < len(audio15):
        audio15[b_idx:b_idx+len(k)] += k
        
# WhatsApp chime at 14.2s
t_wa = np.arange(int(0.5 * TARGET_SR)) / TARGET_SR
wa = np.sin(2*np.pi*830*t_wa)*np.exp(-t_wa*10)*0.3 + np.sin(2*np.pi*1046*t_wa)*np.exp(-t_wa*10)*0.3
w_idx = int(14.0 * TARGET_SR)
if w_idx + len(wa) < len(audio15):
    audio15[w_idx:w_idx+len(wa)] += wa

audio15_int16 = (audio15 * 32767.0).astype(np.int16)
with wave.open('build_ad_assets/audio/audio_15s.wav', 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(TARGET_SR)
    wf.writeframes(audio15_int16.tobytes())

out15 = 'opudas-which-one-15s.mp4'
cmd15 = [
    'ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-s', f'{W}x{H}',
    '-pix_fmt', 'rgb24', '-r', str(FPS), '-i', '-',
    '-i', 'build_ad_assets/audio/audio_15s.wav',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out15
]
p15 = subprocess.Popen(cmd15, stdin=subprocess.PIPE)

for f_idx in range(FRAMES_15):
    t = f_idx / FPS
    if t < 2.0: # Original room
        bg = fit_cover(IMG_ROOM_PREVIEW, W, H, scale=1.02)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([40, 80, 680, 160], radius=18, fill=(0, 0, 0, 230), outline=(255, 215, 0), width=2)
        d.text((64, 102), "SAME ROOM. THREE MOODS. 🎨", font=font_lg_bold, fill=(255, 255, 255))
        d.rounded_rectangle([40, 1080, 680, 1170], radius=18, fill=(12, 107, 69, 230))
        d.text((64, 1106), "ORIGINAL BARE WALLS", font=font_lg_bold, fill=(255, 255, 255))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
    elif t < 5.0: # Option A: Lilac Room
        bg = fit_cover(IMG_ROOM_LILAC, W, H, scale=1.03)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([40, 80, 680, 170], radius=18, fill=(209, 191, 213, 240), outline=(255, 255, 255), width=2)
        d.text((64, 96), "OPTION A", font=font_sm_bold, fill=(60, 30, 70))
        d.text((64, 122), "LILAC ROOM • OP-605", font=font_lg_bold, fill=(40, 10, 50))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
    elif t < 8.0: # Option B: Bonny Evening
        bg = fit_cover(IMG_ROOM_BONNY, W, H, scale=1.03)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([40, 80, 680, 170], radius=18, fill=(194, 193, 184, 240), outline=(255, 255, 255), width=2)
        d.text((64, 96), "OPTION B", font=font_sm_bold, fill=(50, 50, 40))
        d.text((64, 122), "BONNY EVENING • OP-136", font=font_lg_bold, fill=(30, 30, 20))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
    elif t < 11.0: # Option C: Rain Season
        bg = fit_cover(IMG_ROOM_PALM, W, H, scale=1.03)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([40, 80, 680, 170], radius=18, fill=(62, 92, 70, 240), outline=(255, 255, 255), width=2)
        d.text((64, 96), "OPTION C", font=font_sm_bold, fill=(200, 240, 210))
        d.text((64, 122), "RAIN SEASON • OP-209", font=font_lg_bold, fill=(255, 255, 255))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
    else: # Split screen comparison + CTA
        frame = Image.new('RGB', (W, H), (14, 20, 17))
        # 3 horizontal strips
        h_strip = 250
        strip_a = IMG_ROOM_LILAC.resize((W, h_strip), Image.LANCZOS)
        strip_b = IMG_ROOM_BONNY.resize((W, h_strip), Image.LANCZOS)
        strip_c = IMG_ROOM_PALM.resize((W, h_strip), Image.LANCZOS)
        frame.paste(strip_a, (0, 180))
        frame.paste(strip_b, (0, 440))
        frame.paste(strip_c, (0, 700))
        
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        # Labels on strips
        d.rounded_rectangle([30, 200, 260, 250], radius=10, fill=(0, 0, 0, 220))
        d.text((46, 214), "A: LILAC ROOM", font=font_sm_bold, fill=(209, 191, 213))
        d.rounded_rectangle([30, 460, 280, 510], radius=10, fill=(0, 0, 0, 220))
        d.text((46, 474), "B: BONNY EVENING", font=font_sm_bold, fill=(194, 193, 184))
        d.rounded_rectangle([30, 720, 260, 770], radius=10, fill=(0, 0, 0, 220))
        d.text((46, 734), "C: RAIN SEASON", font=font_sm_bold, fill=(130, 200, 150))
        
        # Header banner
        d.rounded_rectangle([30, 40, 690, 150], radius=18, fill=(0, 0, 0, 240), outline=(255, 215, 0), width=2)
        d.text((54, 58), "WHICH ONE WOULD YOU CHOOSE?", font=font_lg_bold, fill=(255, 215, 0))
        d.text((54, 102), "COMMENT A, B OR C BELOW 👇", font=font_md_bold, fill=(255, 255, 255))
        
        # Footer CTA
        d.rounded_rectangle([30, 980, 690, 1220], radius=20, fill=(12, 107, 69, 245), outline=(255, 215, 0), width=2)
        d.text((54, 1004), "OPUDA'S PAINT", font=font_xl_bold, fill=(255, 255, 255))
        d.text((54, 1054), "Colour, made in Nigeria.", font=font_md, fill=(220, 245, 230))
        d.text((54, 1098), "Try free: opudapaint.com • WhatsApp 0902 642 4350", font=font_sm_bold, fill=(255, 215, 0))
        frame = Image.alpha_composite(frame.convert('RGBA'), ov).convert('RGB')
        
    p15.stdin.write(frame.tobytes())

p15.stdin.close()
p15.wait()
print("Saved opudas-which-one-15s.mp4 successfully!")

# Copy to app public
import shutil
shutil.copyfile(out15, f'app/public/videos/{out15}')
print(f"Copied {out15} to app/public/videos/")


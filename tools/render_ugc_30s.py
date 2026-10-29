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

IMG_BUCKET_MATT = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.06 PM (1).jpeg').convert('RGB')
IMG_BUCKET_SILK = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.08 PM.jpeg').convert('RGB')
IMG_ROOM_PREVIEW = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.34 PM.jpeg').convert('RGB')
IMG_LILAC_LOUNGE = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.38 PM.jpeg').convert('RGB')
IMG_SITE_SCAFFOLD = Image.open('opuda/WhatsApp Image 2026-10-21 at 3.09.14 PM.jpeg').convert('RGB')
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
    d.text((box_x + 24, box_y + 14), speaker.upper(), font=font_sm_bold, fill=(52, 199, 89))
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

# ----------------- SYNTHESIZE SPEECH FOR UGC -----------------
import espeakng_loader, ctypes
espeakng_loader.make_library_available()
lib = ctypes.cdll.LoadLibrary(str(espeakng_loader.get_library_path()))
AUDIO_OUTPUT_RETRIEVAL = 1
SR = lib.espeak_Initialize(AUDIO_OUTPUT_RETRIEVAL, 500, str(espeakng_loader.get_data_path()).encode(), 0)
SynthCallback = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)

def synth_speech(text, voice_name, pitch, speed):
    chunks = []
    def callback(wav_ptr, num_samples, events):
        if num_samples > 0:
            buf = ctypes.string_at(wav_ptr, num_samples * 2)
            chunks.append(buf)
        return 0
    cb = SynthCallback(callback)
    lib.espeak_SetSynthCallback(cb)
    lib.espeak_SetVoiceByName(voice_name.encode())
    lib.espeak_SetParameter(1, speed, 0)
    lib.espeak_SetParameter(2, pitch, 0)
    text_b = text.encode('utf-8')
    lib.espeak_Synth(text_b, len(text_b)+1, 0, 0, 0, 0x1000, None, None)
    lib.espeak_Synchronize()
    data = b''.join(chunks)
    return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0

ugc_lines = {
    'l1': ("Before you let anybody touch your wall, do this one thing.", 'en-ng+f2', 65, 140),
    'l2': ("You fit approve one colour for your phone, but when dem paint the whole room, e fit look different. And changing am? Na more money.", 'en-ng+f2', 66, 145),
    'l3': ("That’s why you should try Opuda’s Paint Room Preview. Photograph your room, try any of fifty-nine colours on your wall, and see the result before you buy.", 'en-ng+f2', 65, 145),
    'l4': ("The preview is free. Send them your room photo, and they can help you with a colour scheme, normally within one working day.", 'en-ng+f2', 66, 145),
    'l5': ("Before you spend money on paint, see your colour first. Opuda’s Paint. Try it free or WhatsApp for a quote.", 'en-ng+f2', 65, 140)
}

ugc_clips = {k: synth_speech(v[0], v[1], v[2], v[3]) for k, v in ugc_lines.items()}

TOTAL_30 = 30.0
FRAMES_30 = int(TOTAL_30 * FPS)
total_samples_30 = int(TOTAL_30 * TARGET_SR)
audio30 = np.zeros(total_samples_30, dtype=np.float32)

def place_ugc(key, start_sec):
    samples = ugc_clips[key]
    dur = len(samples) / SR
    num_target = int(dur * TARGET_SR)
    resampled = np.interp(np.linspace(0, len(samples)-1, num_target), np.arange(len(samples)), samples)
    start_idx = int(start_sec * TARGET_SR)
    end_idx = min(start_idx + num_target, total_samples_30)
    audio30[start_idx:end_idx] += resampled[:end_idx-start_idx] * 1.3

place_ugc('l1', 0.5)
place_ugc('l2', 3.5)
place_ugc('l3', 9.5)
place_ugc('l4', 18.2)
place_ugc('l5', 24.5)

# Background music groove
BPM = 108
beat_dur = 60.0 / BPM
for b in range(int(TOTAL_30 / beat_dur)):
    b_idx = int(b * beat_dur * TARGET_SR)
    t_k = np.arange(int(0.2 * TARGET_SR)) / TARGET_SR
    k = np.sin(2 * np.pi * 55 * np.exp(-t_k*16) * t_k) * np.exp(-t_k*12) * 0.25
    if b_idx + len(k) < len(audio30):
        audio30[b_idx:b_idx+len(k)] += k

# WhatsApp chime at 29.2s
t_wa = np.arange(int(0.5 * TARGET_SR)) / TARGET_SR
wa = (np.sin(2*np.pi*830*t_wa)*np.exp(-t_wa*10) + np.sin(2*np.pi*1046*t_wa)*np.exp(-t_wa*10)) * 0.3
w_idx = int(29.0 * TARGET_SR)
if w_idx + len(wa) < len(audio30):
    audio30[w_idx:w_idx+len(wa)] += wa

audio30 = audio30 * (0.95 / max(0.95, np.max(np.abs(audio30))))
audio30_int16 = (audio30 * 32767.0).astype(np.int16)
with wave.open('build_ad_assets/audio/audio_30s.wav', 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(TARGET_SR)
    wf.writeframes(audio30_int16.tobytes())

print("==> RENDERING: opudas-stopped-guessing-30s.mp4...")
out30 = 'opudas-stopped-guessing-30s.mp4'
cmd30 = [
    'ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-s', f'{W}x{H}',
    '-pix_fmt', 'rgb24', '-r', str(FPS), '-i', '-',
    '-i', 'build_ad_assets/audio/audio_30s.wav',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out30
]
p30 = subprocess.Popen(cmd30, stdin=subprocess.PIPE)

for f_idx in range(FRAMES_30):
    t = f_idx / FPS
    if t < 3.0: # Hook
        bg = fit_cover(IMG_ROOM_PREVIEW, W, H, scale=1.02)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([40, 80, 680, 200], radius=20, fill=(0, 0, 0, 230), outline=(255, 80, 80), width=3)
        d.text((64, 102), "DON'T LET THE PAINTER", font=font_lg_bold, fill=(255, 80, 80))
        d.text((64, 142), "CHOOSE FOR YOU.", font=font_xl_bold, fill=(255, 255, 255))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
        frame = draw_subtitle_wrapped(frame, "Homeowner", "Before you let anybody touch your wall, do this one thing.")
    elif t < 9.0: # Problem
        bg = fit_cover(IMG_SITE_SCAFFOLD, W, H, scale=1.04)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([40, 80, 680, 200], radius=20, fill=(0, 0, 0, 235), outline=(255, 215, 0), width=2)
        d.text((64, 102), "THE COLOUR YOU PICKED", font=font_lg_bold, fill=(52, 199, 89))
        d.text((64, 142), "vs THE COLOUR YOU GOT 😬", font=font_lg_bold, fill=(255, 80, 80))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
        frame = draw_subtitle_wrapped(frame, "Homeowner", "You fit approve one colour for phone, but when dem paint am, e fit look different. Changing am na more money.")
    elif t < 18.0: # Solution: Room preview demo
        active_img = IMG_ROOM_LILAC if t < 14.0 else IMG_ROOM_PALM
        bg = fit_cover(active_img, W, H, scale=1.02)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([30, 80, 690, 160], radius=18, fill=(12, 107, 69, 245), outline=(255, 215, 0), width=2)
        d.text((54, 98), "59 COLOURS. YOUR WALL. BEFORE YOU BUY.", font=font_md_bold, fill=(255, 255, 255))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
        frame = draw_subtitle_wrapped(frame, "Homeowner", "Photograph your room, try any of 59 colours on your wall, and see the result before you buy.")
    elif t < 24.0: # Offer
        bg = fit_cover(IMG_LILAC_LOUNGE, W, H, scale=1.03)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.rounded_rectangle([40, 80, 680, 220], radius=20, fill=(0, 0, 0, 235), outline=(52, 199, 89), width=3)
        d.text((64, 102), "FREE COLOUR PREVIEW", font=font_lg_bold, fill=(52, 199, 89))
        d.text((64, 146), "FREE COLOUR CONSULTATION", font=font_lg_bold, fill=(255, 215, 0))
        frame = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
        frame = draw_subtitle_wrapped(frame, "Homeowner", "The preview is free. Send them your room photo, and they help you with a colour scheme within one working day.")
    else: # CTA
        frame = Image.new('RGB', (W, H), (14, 20, 17))
        bw, bh = 250, 340
        matt_thumb = IMG_BUCKET_MATT.resize((bw, bh), Image.LANCZOS)
        silk_thumb = IMG_BUCKET_SILK.resize((bw, bh), Image.LANCZOS)
        frame.paste(matt_thumb, (80, 280))
        frame.paste(silk_thumb, (390, 280))
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        mark_w, mark_h = 90, 90
        brand_thumb = IMG_BRAND_MARK.resize((mark_w, mark_h), Image.LANCZOS)
        ov.paste(brand_thumb, ((W - mark_w)//2, 60), brand_thumb)
        d.text(((W - 360)//2, 165), "OPUDA'S PAINT", font=font_xl_bold, fill=(255, 255, 255))
        d.text(((W - 300)//2, 220), "Colour, made in Nigeria.", font=font_md, fill=(52, 199, 89))
        d.rounded_rectangle([30, 650, 690, 960], radius=22, fill=(12, 107, 69, 245), outline=(255, 215, 0), width=2)
        d.text((54, 674), "TRY YOUR COLOUR FREE", font=font_lg_bold, fill=(255, 215, 0))
        d.text((54, 718), "opudapaint.com", font=font_xl_bold, fill=(255, 255, 255))
        d.rounded_rectangle([50, 800, 670, 890], radius=16, fill=(37, 211, 102))
        d.text((74, 822), "WHATSAPP: 0902 642 4350", font=font_lg_bold, fill=(10, 10, 10))
        d.text((74, 858), "Instant quote • Mon–Sat, 8am–6pm", font=font_xs, fill=(30, 30, 30))
        frame = Image.alpha_composite(frame.convert('RGBA'), ov).convert('RGB')
        frame = draw_subtitle_wrapped(frame, "Opuda’s Paint", "Before you spend money on paint, see your colour first.", "Opuda’s Paint • WhatsApp 0902 642 4350")

    p30.stdin.write(frame.tobytes())

p30.stdin.close()
p30.wait()
print("Saved opudas-stopped-guessing-30s.mp4 successfully!")

import shutil
shutil.copyfile(out30, f'app/public/videos/{out30}')
print(f"Copied {out30} to app/public/videos/")

import espeakng_loader, ctypes, wave, os, math, struct
import numpy as np
import subprocess

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
    samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
    return samples

os.makedirs('build_ad_assets/audio', exist_ok=True)

# Generate dialogue lines
lines = {
    # Scene 1:
    'w_s1': ("Daddy, I dey the site oh.", 'en-ng+f2', 65, 140),
    # Scene 2:
    'f_s2_1': ("Which one again?", 'en-ng+m3', 38, 135),
    'w_s2_1': ("The colour, Daddy. Which one we go use?", 'en-ng+f2', 65, 145),
    'f_s2_2': ("Cream. Plain cream. I have told that painter.", 'en-ng+m3', 38, 135),
    'w_s2_2': ("Daddy, everybody house na cream?", 'en-ng+f2', 68, 145),
    'f_s2_3': ("Nobody regret cream.", 'en-ng+m3', 36, 135),
    # Scene 3:
    'f_s3': ("I no wan make we spend this money twice. You know how much enter this building.", 'en-ng+m3', 36, 135),
    # Scene 4:
    'w_s4_1': ("Wait. Forget cream first. Look.", 'en-ng+f2', 65, 140),
    'f_s4_1': ("Eh? You dey show me picture?", 'en-ng+m3', 42, 140),
    'w_s4_2': ("No na. Na this actual room. I snap am, I change the colour. See am.", 'en-ng+f2', 68, 145),
    'f_s4_2': ("You mean I fit see am before we buy?", 'en-ng+m3', 40, 135),
    'w_s4_3': ("Yes na. Fifty-nine colours.", 'en-ng+f2', 65, 140),
    # Scene 5:
    'f_s5_1': ("But this one go stay? Sun dey here.", 'en-ng+m3', 38, 135),
    'w_s5_1': ("Opuda's get five-year guarantee for Matt and Silk.", 'en-ng+f2', 66, 145),
    'f_s5_2': ("And na where dem make am?", 'en-ng+m3', 40, 140),
    'w_s5_2': ("Port Harcourt, Daddy. Colour, made in Nigeria.", 'en-ng+f2', 66, 145),
    # Scene 6:
    'w_s6_1': ("So? Cream?", 'en-ng+f2', 68, 145),
    'f_s6_1': ("No. That lilac one. OP-605. Make we do am well.", 'en-ng+m3', 38, 135),
    'w_s6_2': ("You don agree?", 'en-ng+f2', 70, 145),
    'f_s6_2': ("Send me the picture first.", 'en-ng+m3', 38, 135),
    # Scene 8:
    'n_s8_1': ("Eh! Who painted your house?", 'en-ng+m1', 46, 140),
    'w_s8_1': ("Opuda's.", 'en-ng+f2', 65, 135),
    'w_s8_2': ("Go try your colour first. Free.", 'en-ng+f2', 66, 140),
    # Scene 9 (Voiceover CTA):
    'vo_cta': ("Opuda's Paint. Colour, made in Nigeria. Try your colour free at opudapaint.com, or WhatsApp us for a quote.", 'en-ng+m1', 45, 140)
}

audio_clips = {}
for k, (txt, vname, pitch, spd) in lines.items():
    audio_clips[k] = synth_speech(txt, vname, pitch, spd)
    print(f"Generated {k}: {len(audio_clips[k])/SR:.2f}s")

# Total duration 45.0s at 44100Hz
TARGET_SR = 44100
total_samples = int(45.0 * TARGET_SR)
dialogue_track = np.zeros(total_samples, dtype=np.float32)

def place_clip(key, start_sec, gain=1.0):
    samples = audio_clips[key]
    # resample from SR (22050) to TARGET_SR (44100)
    dur = len(samples) / SR
    num_target = int(dur * TARGET_SR)
    resampled = np.interp(np.linspace(0, len(samples)-1, num_target), np.arange(len(samples)), samples) * gain
    start_idx = int(start_sec * TARGET_SR)
    end_idx = min(start_idx + num_target, total_samples)
    actual_len = end_idx - start_idx
    dialogue_track[start_idx:end_idx] += resampled[:actual_len]

# Timeline mapping (exact matching script):
place_clip('w_s1', 1.8) # Woman: "Daddy, I dey the site oh"

place_clip('f_s2_1', 3.2) # "Which one again?"
place_clip('w_s2_1', 4.3) # "The colour Daddy..."
place_clip('f_s2_2', 5.6) # "Cream. Plain cream..."
place_clip('w_s2_2', 7.0) # "Daddy everybody house na cream?"
place_clip('f_s2_3', 7.8) # "Nobody regret cream"

place_clip('f_s3', 8.4)   # "I no wan make we spend this money twice..."

place_clip('w_s4_1', 10.3) # "Wait. Forget cream first. Look."
place_clip('f_s4_1', 11.5) # "Eh? You dey show me picture?"
place_clip('w_s4_2', 12.8) # "No na. Na this actual room..."
place_clip('f_s4_2', 14.6) # "You mean I fit see am before we buy?"
place_clip('w_s4_3', 15.9) # "Yes na. 59 colours."

place_clip('f_s5_1', 17.2) # "But this one go stay? Sun dey here."
place_clip('w_s5_1', 18.7) # "Opuda's get 5-year guarantee..."
place_clip('f_s5_2', 20.3) # "And na where dem make am?"
place_clip('w_s5_2', 21.2) # "Port Harcourt Daddy..."

place_clip('w_s6_1', 22.4) # "So? Cream?"
place_clip('f_s6_1', 23.1) # "No. That lilac one..."
place_clip('w_s6_2', 24.2) # "You don agree?"
place_clip('f_s6_2', 24.7) # "Send me the picture first."

# Scene 7 (25.0 - 32.0): Music reveal / no dialogue

place_clip('n_s8_1', 32.8) # Neighbour: "Eh! Who painted your house?"
place_clip('w_s8_1', 34.5) # "Opuda's."
place_clip('w_s8_2', 35.6) # "Go try your colour first. Free."

place_clip('vo_cta', 38.3, 1.2) # Voiceover CTA

# ----------------- SFX GENERATION -----------------
sfx_track = np.zeros(total_samples, dtype=np.float32)

# 1. Phone ringtone (0.0 to 1.5s)
t_ring = np.arange(int(1.5 * TARGET_SR)) / TARGET_SR
ring_freq1, ring_freq2 = 440.0, 480.0 # standard dual tone
ring_pulse = (np.sin(2 * np.pi * ring_freq1 * t_ring) + np.sin(2 * np.pi * ring_freq2 * t_ring)) * 0.5
# pulse on/off
ring_gate = ((t_ring % 0.8) < 0.4).astype(np.float32)
sfx_track[:len(t_ring)] += ring_pulse * ring_gate * 0.25

# 2. Call connect chime (1.5 to 1.8s)
t_conn = np.arange(int(0.3 * TARGET_SR)) / TARGET_SR
chime1 = np.sin(2 * np.pi * 587.33 * t_conn) * np.exp(-t_conn * 8)
chime2 = np.sin(2 * np.pi * 880.00 * t_conn) * np.exp(-t_conn * 8)
conn_idx = int(1.5 * TARGET_SR)
sfx_track[conn_idx:conn_idx+len(t_conn)] += (chime1 + chime2) * 0.2

# 3. Ambient site noise (light hammer taps, construction room tone)
np.random.seed(42)
site_noise = np.random.normal(0, 0.015, total_samples).astype(np.float32)
# hammer taps at 4.0s, 6.5s, 9.2s
for tap_t in [4.0, 6.5, 9.2, 11.0]:
    tap_idx = int(tap_t * TARGET_SR)
    t_tap = np.arange(int(0.15 * TARGET_SR)) / TARGET_SR
    tap = np.sin(2 * np.pi * 1200 * t_tap) * np.exp(-t_tap * 40) * 0.15
    sfx_track[tap_idx:tap_idx+len(tap)] += tap
sfx_track[:int(25.0 * TARGET_SR)] += site_noise[:int(25.0 * TARGET_SR)] * 0.4

# 4. Color transition swooshes (Scene 4: at 10.8s, 12.5s, 14.2s)
for swoosh_t in [10.8, 12.5, 14.2]:
    sw_idx = int(swoosh_t * TARGET_SR)
    t_sw = np.arange(int(0.35 * TARGET_SR)) / TARGET_SR
    freq = np.linspace(400, 1200, len(t_sw))
    sw = np.sin(2 * np.pi * freq * t_sw) * np.sin(np.pi * t_sw / 0.35) * 0.15
    sfx_track[sw_idx:sw_idx+len(sw)] += sw

# 5. WhatsApp notification chime at 44.2s
t_wa = np.arange(int(0.6 * TARGET_SR)) / TARGET_SR
wa1 = np.sin(2 * np.pi * 830 * t_wa) * np.exp(-t_wa * 10) * 0.3
wa2 = np.sin(2 * np.pi * 1046 * (t_wa - 0.1).clip(min=0)) * np.exp(-(t_wa - 0.1).clip(min=0) * 10) * ((t_wa > 0.1).astype(np.float32)) * 0.35
wa_idx = int(44.0 * TARGET_SR)
sfx_track[wa_idx:wa_idx+len(t_wa)] += (wa1 + wa2)

# ----------------- AFROBEAT MUSIC TRACK -----------------
# 108 BPM -> 1 beat = 60 / 108 = 0.5556s
BPM = 108
BEAT_DUR = 60.0 / BPM
SIXTEENTH = BEAT_DUR / 4.0
music_track = np.zeros(total_samples, dtype=np.float32)

# Kick sample synthesis
t_kick = np.arange(int(0.25 * TARGET_SR)) / TARGET_SR
kick = np.sin(2 * np.pi * 55 * np.exp(-t_kick * 18) * t_kick) * np.exp(-t_kick * 14) * 0.5

# Snare / rimshot
t_snare = np.arange(int(0.2 * TARGET_SR)) / TARGET_SR
snare_noise = np.random.normal(0, 1, len(t_snare)) * np.exp(-t_snare * 25)
snare_tone = np.sin(2 * np.pi * 220 * t_snare) * np.exp(-t_snare * 20)
snare = (snare_noise * 0.4 + snare_tone * 0.3) * 0.4

# Shaker
t_shaker = np.arange(int(0.08 * TARGET_SR)) / TARGET_SR
shaker = np.random.normal(0, 1, len(t_shaker)) * np.exp(-t_shaker * 45) * 0.12

# Bass synth (Am - F - C - G progression)
# frequencies: A1=55, F1=43.65, C2=65.4, G1=49
bass_notes = [55.0, 43.65, 65.4, 49.0]

# Build loop across 45 seconds
curr_t = 0.0
beat_count = 0
while curr_t < 44.5:
    beat_idx = int(curr_t * TARGET_SR)
    bar_pos = (beat_count % 16)
    measure = beat_count // 4
    
    # Dynamics: ducked during dialogue (scenes 1-6), explodes in Scene 7 (reveal), dips slightly in Scene 8, warm outro in Scene 9
    if curr_t < 2.0:
        vol = 0.1
    elif curr_t < 24.5:
        vol = 0.28 # light background groove
    elif curr_t < 32.0:
        vol = 0.85 # FULL AFROBEAT DROP FOR REVEAL!
    elif curr_t < 38.0:
        vol = 0.35 # dips for neighbour question
    else:
        vol = 0.5  # warm resolution for CTA
    
    # Four-on-the-floor / syncopated Afrobeat kick
    if (beat_count % 4 == 0) or (beat_count % 4 == 2) or (beat_count % 4 == 3 and curr_t >= 25.0):
        k_len = min(len(kick), total_samples - beat_idx)
        music_track[beat_idx:beat_idx+k_len] += kick[:k_len] * vol
    
    # Rimshot / snare on beats 2 and 4
    if (beat_count % 4 == 1) or (beat_count % 4 == 3):
        s_len = min(len(snare), total_samples - beat_idx)
        music_track[beat_idx:beat_idx+s_len] += snare[:s_len] * vol
        
    # Shaker on every 16th note
    for s16 in range(4):
        shk_idx = int((curr_t + s16 * SIXTEENTH) * TARGET_SR)
        if shk_idx < total_samples:
            sh_len = min(len(shaker), total_samples - shk_idx)
            accent = 1.4 if s16 == 2 else 0.8
            music_track[shk_idx:shk_idx+sh_len] += shaker[:sh_len] * vol * accent
            
    # Bass note
    chord_idx = (measure % 4)
    freq = bass_notes[chord_idx]
    t_b = np.arange(int(BEAT_DUR * TARGET_SR * 0.8)) / TARGET_SR
    bass = np.sin(2 * np.pi * freq * t_b) * np.exp(-t_b * 2) * 0.35
    b_len = min(len(bass), total_samples - beat_idx)
    music_track[beat_idx:beat_idx+b_len] += bass[:b_len] * vol
    
    # Kalimba / Marimba melodic riff (especially active during Scene 7 reveal)
    if curr_t >= 10.0:
        notes = [440, 523.25, 659.25, 587.33, 783.99, 659.25]
        note_freq = notes[(beat_count * 2) % len(notes)]
        t_m = np.arange(int(SIXTEENTH * 2 * TARGET_SR)) / TARGET_SR
        melody = np.sin(2 * np.pi * note_freq * t_m) * np.exp(-t_m * 12) * 0.22
        m_idx = int((curr_t + SIXTEENTH) * TARGET_SR)
        if m_idx < total_samples:
            m_len = min(len(melody), total_samples - m_idx)
            music_track[m_idx:m_idx+m_len] += melody[:m_len] * vol

    curr_t += BEAT_DUR
    beat_count += 1

# Master mix
master = dialogue_track * 1.35 + sfx_track * 0.9 + music_track * 0.7
# Normalise / soft clamp to avoid clipping
peak = np.max(np.abs(master))
if peak > 0.95:
    master = master * (0.95 / peak)

master_int16 = (master * 32767.0).astype(np.int16)
wav_out = 'build_ad_assets/audio/master_audio.wav'
with wave.open(wav_out, 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(TARGET_SR)
    wf.writeframes(master_int16.tobytes())

print(f"Master audio generated successfully: {wav_out} ({len(master_int16)/TARGET_SR:.2f}s)")

/**
 * Gnani.ai (Vachana Speech Platform) Client
 * STT: Prisma v3.0 (https://api.vachana.ai/stt/v3)
 * TTS: Timbre v2.5 (https://api.vachana.ai/api/v1/tts/inference)
 */

let activeApiKey: string =
  localStorage.getItem('gnani_api_key') ||
  (import.meta as any).env?.VITE_GNANI_API_KEY ||
  'vach_1ytE2CY5X2EuitkqLVMc7S785bFHwt9Wft1IO8XXIX7fZxOPEPZxNB3gehfDSzQxOMlvXk6DizfmjRHeoYPccnuQAtKIvVPH_275b09f1a6cd2fa319111ab7a375ac39';

export function getGnaniApiKey(): string {
  return activeApiKey;
}

export function setGnaniApiKey(key: string) {
  activeApiKey = key.trim();
  localStorage.setItem('gnani_api_key', activeApiKey);
}

export let isGnaniKeyActive: boolean = true;
let currentAudio: HTMLAudioElement | null = null;
const audioCache = new Map<string, string>();

/**
 * Tests the Gnani API key live against the Vachana endpoint
 */
export async function testGnaniApiKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('https://api.vachana.ai/api/v1/tts/inference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': key.trim()
      },
      body: JSON.stringify({
        text: 'नमस्ते',
        voice: 'Nalini',
        model: 'timbre-v2.5',
        language: 'hi-IN'
      })
    });

    if (response.ok) {
      isGnaniKeyActive = true;
      return { success: true, message: 'Gnani.ai API Key is ACTIVE and verified (HTTP 200 OK)' };
    }

    const errData = await response.json().catch(() => ({}));
    const errorMsg = errData?.detail?.message || errData?.detail?.error_code || `HTTP ${response.status}`;
    isGnaniKeyActive = false;
    return { success: false, message: `Gnani.ai: ${errorMsg} (${response.status})` };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network connection failed' };
  }
}

/**
 * Text-to-Speech using Gnani.ai Timbre API with in-memory caching
 */
export async function synthesizeGnaniSpeech(
  text: string,
  languageCode: 'hi-IN' | 'kn-IN' | 'en-IN' = 'hi-IN'
): Promise<string> {
  const cleanText = text.trim();
  const cacheKey = `${languageCode}:${cleanText}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  const payload = {
    text: cleanText,
    voice: 'Nalini',
    model: 'timbre-v2.5',
    language: languageCode,
    speed: 1,
    audio_config: {
      container: 'wav',
      encoding: 'linear_pcm',
      sample_rate: 24000
    }
  };

  const response = await fetch('https://api.vachana.ai/api/v1/tts/inference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key-ID': activeApiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      isGnaniKeyActive = false;
    }
    const errorText = await response.text();
    throw new Error(`Gnani TTS failed (${response.status}): ${errorText}`);
  }

  isGnaniKeyActive = true;
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  audioCache.set(cacheKey, audioUrl);
  return audioUrl;
}

/**
 * Play synthesized Gnani audio with Barge-In capability
 */
export function playGnaniAudio(
  audioUrl: string,
  onStart?: () => void,
  onEnd?: () => void
): Promise<HTMLAudioElement> {
  stopGnaniAudio();

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    audio.onplay = () => {
      if (onStart) onStart();
    };

    audio.onended = () => {
      currentAudio = null;
      if (onEnd) onEnd();
      resolve(audio);
    };

    audio.onerror = (e) => {
      currentAudio = null;
      if (onEnd) onEnd();
      reject(e);
    };

    audio.play().catch((err) => {
      currentAudio = null;
      if (onEnd) onEnd();
      reject(err);
    });
  });
}

/**
 * Stops any active Gnani audio immediately (Barge-in)
 */
export function stopGnaniAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/**
 * Speech-to-Text using Gnani.ai Prisma v3.0 REST API
 */
export async function transcribeGnaniAudio(
  audioBlob: Blob,
  languageCode: 'hi-IN' | 'kn-IN' | 'en-IN' = 'hi-IN'
): Promise<{ transcript: string; latencySec: number }> {
  const formData = new FormData();
  formData.append('audio_file', audioBlob, 'audio.wav');
  formData.append('model', 'prisma-v3.0');
  formData.append('language_code', languageCode);

  const startTime = performance.now();
  const response = await fetch('https://api.vachana.ai/stt/v3', {
    method: 'POST',
    headers: {
      'X-API-Key-ID': activeApiKey
    },
    body: formData
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      isGnaniKeyActive = false;
    }
    const err = await response.text();
    throw new Error(`Gnani STT failed (${response.status}): ${err}`);
  }

  isGnaniKeyActive = true;
  const result = await response.json();
  const endTime = performance.now();
  const latency = (endTime - startTime) / 1000;

  const text = result.transcript || result.output?.literal || result.text || '';
  return {
    transcript: text.trim(),
    latencySec: latency
  };
}

/**
 * Encodes raw AudioContext Float32 PCM samples into standard 16kHz Mono 16-bit PCM WAV
 */
export function encodePcmToWav(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

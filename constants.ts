
import { Language } from './types';

// The existing constants are preserved
export const SUPABASE_URL = 'https://xscdwdnjujpkczfhqrgu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzY2R3ZG5qdWpwa2N6Zmhxcmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzEwNjgsImV4cCI6MjA3NjkwNzA2OH0.xuVAkWA5y1oDW_jC52I8JJXF-ovU-5LIBsY9yXzy6cA';

/**
 * Expanded Voice List mapping Gemini Prebuilt Voices to Character Personas
 * Each voice has distinct characteristics:
 * Zephyr: Neutral, calm, balanced.
 * Kore: High-pitch, female, soft, clear.
 * Puck: Energetic, youthful, bright.
 * Charon: Low-pitch, mature, deep, steady.
 * Fenrir: Deep, authoritative, gravelly.
 */
export const GREEK_VOICES = [
  { id: 'Zephyr', name: 'Minos (The Arbiter - Neutral/Calm)' },
  { id: 'Kore', name: 'Olympias (The Queen - Soft/Clear Female)' },
  { id: 'Puck', name: 'Alexander (The Great - Energetic/Bright)' },
  { id: 'Charon', name: 'Leonidas (The Guardian - Deep/Mature)' },
  { id: 'Fenrir', name: 'Agamemnon (The Overlord - Authoritative/Deep)' },
];

export const LANGUAGES: Language[] = [
  // =========================================================================
  // GLOBAL MAJOR LANGUAGES
  // =========================================================================
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'fa', name: 'Persian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'el', name: 'Greek' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  
  // =========================================================================
  // SPECIFIC DIALECTS & REGIONAL VARIANTS
  // =========================================================================
  { code: 'zh-yue', name: 'Cantonese (Yue)' },
  { code: 'fr-be', name: 'French (Belgian)' },
  { code: 'fr-qc', name: 'French (Canadian)' },
  { code: 'nl-be', name: 'Flemish (Belgian Dutch)' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'tl', name: 'Tagalog (Filipino)' },
  { code: 'en-tl', name: 'Taglish (Mix)' },
  { code: 'ceb', name: 'Cebuano (Bisaya)' },
  { code: 'sw', name: 'Swahili' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'ig', name: 'Igbo' },
  { code: 'zu', name: 'Zulu' },
  { code: 'byv', name: 'Medumba' },
  { code: 'nci', name: 'Nouchi (Ivory Coast Mix)' },
  { code: 'bci', name: 'Baoulé' },
  { code: 'dyu', name: 'Dioula' },
];

export const ORB_SIZE = 80;
export const POLLING_INTERVAL_MIN = 800;
export const POLLING_INTERVAL_MAX = 2000;
export const CHUNK_PUNCTUATION = /[.!?…]$/;
export const CHUNK_MIN_LENGTH = 40;
export const CHUNK_SILENCE_TIMEOUT = 800;

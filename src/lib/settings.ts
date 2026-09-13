import { safeGetItem, safeRemoveItem, safeSetItem } from "./storage";

/**
 * The Gemini API key lives under its own storage key, separate from the
 * learning data, so that exporting a backup or resetting the tracker never
 * carries the key along with it.
 */
export const SETTINGS_KEYS = {
  geminiApiKey: "learning-tracker:gemini-api-key",
} as const;

export function loadGeminiApiKey(): string {
  return safeGetItem(SETTINGS_KEYS.geminiApiKey) ?? "";
}

export function saveGeminiApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) safeSetItem(SETTINGS_KEYS.geminiApiKey, trimmed);
  else safeRemoveItem(SETTINGS_KEYS.geminiApiKey);
}

export function clearGeminiApiKey(): void {
  safeRemoveItem(SETTINGS_KEYS.geminiApiKey);
}

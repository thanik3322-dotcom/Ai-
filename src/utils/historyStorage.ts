import { SavedAnalysisRecord, VoiceAnalysisResult } from '../types/voiceHealth';

const STORAGE_KEY = 'ai_voice_health_history_v1';

export function loadAnalysisHistory(): SavedAnalysisRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAnalysisToHistory(
  result: VoiceAnalysisResult,
  customLabel?: string
): SavedAnalysisRecord[] {
  const existing = loadAnalysisHistory();
  const alreadyExists = existing.some((item) => item.id === result.id);
  if (alreadyExists) return existing;

  const topCondition = result.conditions[0];
  const record: SavedAnalysisRecord = {
    ...result,
    savedAt: new Date().toISOString(),
    label:
      customLabel ||
      (topCondition
        ? `${topCondition.name} (${topCondition.probabilityPercent}%)`
        : 'บันทึกการตรวจเสียง'),
  };

  const updated = [record, ...existing].slice(0, 25);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteHistoryRecord(id: string): SavedAnalysisRecord[] {
  const existing = loadAnalysisHistory();
  const updated = existing.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearAllHistory(): SavedAnalysisRecord[] {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

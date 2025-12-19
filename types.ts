
export interface Language {
  code: string;
  name: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface HistoryItem extends TranslationResult {
  id: string;
  timestamp: number;
}

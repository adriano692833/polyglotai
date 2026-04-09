export interface AuthUser {
  id: string;
  name: string;
  token: string;
}

export type TabId = 'dashboard' | 'practice' | 'reading' | 'sentences' | 'flashcards' | 'vocabulary' | 'challenge' | 'translator' | 'transcripts' | 'player';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  lang: string;
  status: string;
}

export interface Mistake {
  original: string;
  corrected: string;
  explanation: string;
  category: string;
}

export interface CheckResult {
  corrected: string;
  score: number;
  mistakes: Mistake[];
  praise: string;
  tip: string;
}

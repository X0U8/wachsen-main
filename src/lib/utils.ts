import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fontSize = {
  xs: 'var(--fs-xs, clamp(0.65rem, 0.6rem + 0.25vw, 0.75rem))',
  sm: 'var(--fs-sm, clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem))',
  base: 'var(--fs-base, clamp(0.875rem, 0.8rem + 0.35vw, 1rem))',
  lg: 'var(--fs-lg, clamp(1rem, 0.9rem + 0.5vw, 1.25rem))',
  xl: 'var(--fs-xl, clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem))',
  '2xl': 'var(--fs-2xl, clamp(1.5rem, 1.3rem + 1vw, 2rem))',
  '3xl': 'var(--fs-3xl, clamp(1.875rem, 1.5rem + 1.5vw, 2.5rem))',
  '4xl': 'var(--fs-4xl, clamp(1.75rem, 1.55rem + 0.8vw, 2.25rem))',
  '5xl': 'var(--fs-5xl, clamp(2.25rem, 1.95rem + 1.2vw, 3rem))',
};









export interface ParsedQuestion {
  id: number;
  text: string;
  type: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
  marks: number;
  negative_marks: number;
}

export interface ParsedSubject {
  subject: string;
  questions: ParsedQuestion[];
}

export function parseBracketFormat(
  text: string,
  fallbackSubjectName = 'Unknown'
): { subjects: ParsedSubject[] } {
  const subjects: ParsedSubject[] = [];
  let currentSubject: ParsedSubject | null = null;
  let currentQ: Partial<ParsedQuestion> & { options: string[] } | null = null;
  let currentTag: string | null = null;
  let contentBuf: string[] = [];

  const flushContent = () => {
    if (!currentTag || !currentQ) { contentBuf = []; return; }
    const value = contentBuf.join('\n').trim();
    if (!value) { contentBuf = []; return; }
    if (currentTag === 'OPT') {
      currentQ.options.push(value);
    } else if (currentTag === 'text') {
      currentQ.text = value;
    } else if (currentTag === 'type') {
      currentQ.type = value.toLowerCase().replace('true/false', 'true_false').replace('truefalse', 'true_false');
    } else if (currentTag === 'correct_answer') {
      currentQ.correct_answer = value;
    } else if (currentTag === 'explanation') {
      currentQ.explanation = value;
    } else if (currentTag === 'difficulty') {
      currentQ.difficulty = value.toLowerCase();
    } else if (currentTag === 'marks') {
      currentQ.marks = parseFloat(value) || 4;
    } else if (currentTag === 'negative_marks') {
      currentQ.negative_marks = parseFloat(value) || 0;
    }
    contentBuf = [];
    currentTag = null;
  };

  const flushQ = () => {
    flushContent();
    if (currentQ) {
      if (!currentSubject) currentSubject = { subject: fallbackSubjectName, questions: [] };
      const q: ParsedQuestion = {
        id: 0,
        text: currentQ.text || '',
        type: currentQ.type || 'mcq',
        correct_answer: currentQ.correct_answer || '',
        explanation: currentQ.explanation || '',
        difficulty: currentQ.difficulty || 'medium',
        marks: currentQ.marks ?? 4,
        negative_marks: currentQ.negative_marks ?? 0,
      };
      if (currentQ.options && currentQ.options.length > 0) q.options = currentQ.options;
      currentSubject.questions.push(q);
      currentQ = null;
    }
  };

  const flushSubject = () => {
    flushQ();
    if (currentSubject) { subjects.push(currentSubject); currentSubject = null; }
  };

  for (const rawLine of text.split('\n')) {
    
    if (rawLine[0] === '[') {
      const m = rawLine.match(/^\[([A-Z_/][A-Z0-9_/]*)\](.*)/);
      if (m) {
        const tag = m[1];
        const rest = m[2].trim();
        switch (tag) {
          case 'SUBJECT':
            flushSubject();
            currentSubject = { subject: rest || fallbackSubjectName, questions: [] };
            break;
          case '/SUBJECT':
            flushSubject();
            break;
          case 'Q':
            flushContent();
            if (currentQ) flushQ();
            currentQ = { options: [] };
            currentTag = 'text';
            if (rest) contentBuf.push(rest);
            break;
          case '/Q':
            flushQ();
            break;
          case 'TYPE':   flushContent(); currentTag = 'type';           if (rest) contentBuf.push(rest); break;
          case 'OPT':    flushContent(); currentTag = 'OPT';            if (rest) contentBuf.push(rest); break;
          case 'ANS':    flushContent(); currentTag = 'correct_answer'; if (rest) contentBuf.push(rest); break;
          case 'EXP':    flushContent(); currentTag = 'explanation';    if (rest) contentBuf.push(rest); break;
          case 'DIFF':   flushContent(); currentTag = 'difficulty';     if (rest) contentBuf.push(rest); break;
          case 'MARKS':  flushContent(); currentTag = 'marks';          if (rest) contentBuf.push(rest); break;
          case 'NEG':    flushContent(); currentTag = 'negative_marks'; if (rest) contentBuf.push(rest); break;
          default:
            
            if (currentTag !== null) contentBuf.push(rawLine);
        }
        continue;
      }
    }
    
    if (currentTag !== null) contentBuf.push(rawLine);
  }

  flushSubject();

  
  let id = 1;
  subjects.forEach(s => s.questions.forEach(q => { q.id = id++; }));

  return { subjects };
}


export function serializeToBracketFormat(subjects: ParsedSubject[]): string {
  const escLine = (s: string) => (s.startsWith('[') ? ' ' + s : s);
  const lines: string[] = [];
  for (const subj of subjects) {
    lines.push(`[SUBJECT] ${subj.subject || 'Unknown'}`);
    for (const q of subj.questions || []) {
      lines.push('[Q]');
      (q.text || '').split('\n').forEach(l => lines.push(escLine(l)));
      lines.push(`[TYPE] ${q.type || 'mcq'}`);
      (q.options || []).forEach(opt => lines.push(`[OPT] ${opt}`));
      lines.push(`[ANS] ${q.correct_answer || ''}`);
      lines.push(`[EXP] ${q.explanation || ''}`);
      lines.push(`[DIFF] ${q.difficulty || 'medium'}`);
      lines.push(`[MARKS] ${q.marks ?? 4}`);
      lines.push(`[NEG] ${q.negative_marks ?? 0}`);
      lines.push('[/Q]');
    }
    lines.push('[/SUBJECT]');
    lines.push('');
  }
  return lines.join('\n');
}

import { BASE_RULES } from './base-rules.js';
import { CH1_LABEL, CH1_SECTIONS, CH1_ITEMS } from './ch1-background.js';
import { CH2_LABEL, CH2_SECTIONS, CH2_ITEMS } from './ch2-requirements.js';
import { CH3_LABEL, CH3_SECTIONS, CH3_ITEMS } from './ch3-model.js';
import { CH4_LABEL, CH4_SECTIONS, CH4_ITEMS } from './ch4-ux.js';
import { CH5_LABEL, CH5_SECTIONS, CH5_ITEMS } from './ch5-architecture.js';
import { CH6_LABEL, CH6_SECTIONS, CH6_ITEMS } from './ch6-testing.js';
import { SALESFORCE_RULES, SALESFORCE_DATA_MODEL_ADDITION, SALESFORCE_EXISTING_STATE_PROMPT } from './flavor-salesforce.js';
import { OUTSYSTEMS_RULES_O11, OUTSYSTEMS_RULES_ODC } from './flavor-outsystems.js';
import { getClarificationPrompt } from './clarification.js';

// ── מבנה הפרקים ─────────────────────────────────────────────────────────────
export const CHAPTERS = [
  { id: 'ch1', label: CH1_LABEL, items: CH1_ITEMS, sections: CH1_SECTIONS },
  { id: 'ch2', label: CH2_LABEL, items: CH2_ITEMS, sections: CH2_SECTIONS },
  { id: 'ch3', label: CH3_LABEL, items: CH3_ITEMS, sections: CH3_SECTIONS },
  { id: 'ch4', label: CH4_LABEL, items: CH4_ITEMS, sections: CH4_SECTIONS },
  { id: 'ch5', label: CH5_LABEL, items: CH5_ITEMS, sections: CH5_SECTIONS },
  { id: 'ch6', label: CH6_LABEL, items: CH6_ITEMS, sections: CH6_SECTIONS },
];

// ── כל פריטי הצ'קליסט לשמירה ב-localStorage ──────────────────────────────
export const ALL_CHECKLIST_ITEMS = CHAPTERS.flatMap(ch =>
  ch.items.map(item => ({ ...item, chapterId: ch.id }))
);

// ── בניית פרומפט פרק ────────────────────────────────────────────────────────
function buildFlavorRules(flavor, osVersion) {
  if (flavor === 'salesforce') return SALESFORCE_RULES;
  if (flavor === 'outsystems') return osVersion === 'odc' ? OUTSYSTEMS_RULES_ODC : OUTSYSTEMS_RULES_O11;
  return '';
}

function buildSystemPrompt(flavor, osVersion) {
  const flavorRules = buildFlavorRules(flavor, osVersion);
  const flavorName = flavor === 'salesforce' ? 'Salesforce'
    : flavor === 'outsystems' ? `OutSystems ${osVersion === 'odc' ? 'ODC' : 'O11'}`
    : 'כללי';

  return `אתה "מלך האפיונים" — אנליסט בכיר ואדריכל מערכות עם ניסיון של 15+ שנה.
אתה כותב מסמכי אפיון מדויקים, מלאים וברמה מקצועית גבוהה.
טעם האפיון הנוכחי: ${flavorName}

${BASE_RULES}
${flavorRules}`;
}

function buildSectionContent(chapterId, sectionId, flavor) {
  const chapter = CHAPTERS.find(ch => ch.id === chapterId);
  if (!chapter) return '';
  const section = chapter.sections[sectionId];
  if (!section) return '';

  let content = section.template;

  // הוספות ספציפיות לטעמים
  if (flavor === 'salesforce' && chapterId === 'ch3' && sectionId === 'data-model') {
    content += '\n\n' + SALESFORCE_DATA_MODEL_ADDITION;
  }

  return content;
}

// ── בניית פרומפט לחלק אחד (chunk) ───────────────────────────────────────────
export function buildChapterPrompt(combinedText, chapterId, selectedSectionIds, flavor, osVersion) {
  const chapter = CHAPTERS.find(ch => ch.id === chapterId);
  if (!chapter) return null;

  const activeSections = chapter.items
    .filter(item => selectedSectionIds.includes(item.id))
    .map(item => buildSectionContent(chapterId, item.id, flavor))
    .filter(Boolean);

  if (activeSections.length === 0) return null;

  const systemPrompt = buildSystemPrompt(flavor, osVersion);
  const existingStateNote = flavor === 'salesforce' ? SALESFORCE_EXISTING_STATE_PROMPT : '';

  return `${systemPrompt}

═══════════════════════════════════════════════════
המשימה: הפק את ${chapter.label}
═══════════════════════════════════════════════════
הפק את הסעיפים המפורטים להלן בלבד. אל תוסיף סעיפים שלא ברשימה.
${existingStateNote}

דרישות איכות:
- כל דרישה — ספציפית, מדידה, ניתנת לבדיקה
- סמן כל פער מידע: [⚠ נדרש קלט: <מה חסר>]
- טבלאות — מלאות לחלוטין (אם חסר מידע — כתוב "לא ידוע" עם הערה)
- ללא הקדמות או סיכומים — התחל ישירות בתוכן

סעיפים להפקה:
${activeSections.join('\n\n---\n\n')}

═══════════════════════════════════════════════════
מסמכי מקור
═══════════════════════════════════════════════════
${combinedText}`;
}

// ── בניית פרומפט שאלות הבהרה ────────────────────────────────────────────────
export function buildClarificationPrompt(combinedText, flavor, osVersion) {
  const flavorRules = buildFlavorRules(flavor, osVersion);
  return getClarificationPrompt(combinedText, flavorRules);
}

// ── מיפוי פרקים לחלקי עיבוד (chunks) ────────────────────────────────────────

// רגיל: 3 קריאות — זוגות פרקים
export const CHUNK_MAP_NORMAL = {
  1: ['ch1', 'ch2'],
  2: ['ch3', 'ch4'],
  3: ['ch5', 'ch6'],
};

// גבוה: 6 קריאות — פרק לכל קריאה
export const CHUNK_MAP_HIGH = {
  1: ['ch1'], 2: ['ch2'], 3: ['ch3'],
  4: ['ch4'], 5: ['ch5'], 6: ['ch6'],
};

// בסיסי: קריאה אחת — כל הפרקים יחד
export const CHUNK_MAP_BASIC = {
  1: ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'],
};

// 2 chunks: first half / second half
export const CHUNK_MAP_2 = {
  1: ['ch1', 'ch2', 'ch3'],
  2: ['ch4', 'ch5', 'ch6'],
};

// 4 chunks
export const CHUNK_MAP_4 = {
  1: ['ch1', 'ch2'],
  2: ['ch3'],
  3: ['ch4'],
  4: ['ch5', 'ch6'],
};

// 5 chunks
export const CHUNK_MAP_5 = {
  1: ['ch1', 'ch2'],
  2: ['ch3'],
  3: ['ch4'],
  4: ['ch5'],
  5: ['ch6'],
};

export function getChunkMapForCount(n) {
  if (n <= 1) return CHUNK_MAP_BASIC;
  if (n === 2) return CHUNK_MAP_2;
  if (n === 3) return CHUNK_MAP_NORMAL;
  if (n === 4) return CHUNK_MAP_4;
  if (n === 5) return CHUNK_MAP_5;
  return CHUNK_MAP_HIGH;
}

// backward compat
export const CHUNK_MAP = CHUNK_MAP_NORMAL;

// ── Auto-depth: ניתוח מסמך לבחירת מספר קריאות ──────────────────────────────
export function buildAutoDepthPrompt(combinedText) {
  return `אתה מנתח דרישות. קרא את מסמכי המקור הבאים והחלט כמה קריאות API נדרשות כדי לייצר מסמך אפיון מלא ומדויק.

קריטריונים להחלטה:
- 1 קריאה: מסמך קצר ופשוט, מערכת קטנה עם מעט תהליכים
- 2-3 קריאות: מסמך בינוני, מספר מודולים ותהליכים
- 4-5 קריאות: מסמך מורכב, מספר מערכות ותהליכים רבים, הרבה טבלאות נדרשות
- 6 קריאות: מסמך ארוך ומורכב מאוד — אל תגיע ל-6 אלא אם באמת נדרש

החלטה מקסימלית: 6 קריאות.

השב אך ורק ב-JSON הבא, ללא שום טקסט נוסף:
{"chunks": <מספר שלם בין 1 ל-6>, "reason": "<סיבה קצרה בעברית, עד 20 מילה>"}

═══════════════════════════════════════════════════
מסמכי מקור
═══════════════════════════════════════════════════
${combinedText}`;
}

export function getChunkLabel(chunkNum, chunkMap = CHUNK_MAP_NORMAL) {
  const chapterIds = chunkMap[chunkNum] || [];
  return chapterIds
    .map(id => CHAPTERS.find(ch => ch.id === id)?.label || '')
    .join(' + ');
}

export function buildChunkPrompt(combinedText, chunkNum, selectedSectionIds, flavor, osVersion, chunkMap = CHUNK_MAP_NORMAL) {
  const chapterIds = chunkMap[chunkNum] || [];
  const prompts = chapterIds
    .map(chId => buildChapterPrompt(combinedText, chId, selectedSectionIds, flavor, osVersion))
    .filter(Boolean);

  if (prompts.length === 0) return null;
  if (prompts.length === 1) return prompts[0];

  // מספר פרקים באותו פרומפט
  const systemPrompt = buildSystemPrompt(flavor, osVersion);
  const chapters = chapterIds
    .map(chId => {
      const chapter = CHAPTERS.find(ch => ch.id === chId);
      const activeSections = chapter.items
        .filter(item => selectedSectionIds.includes(item.id))
        .map(item => buildSectionContent(chId, item.id, flavor))
        .filter(Boolean);
      if (activeSections.length === 0) return null;
      return `## ${chapter.label}\n\n${activeSections.join('\n\n---\n\n')}`;
    })
    .filter(Boolean);

  if (chapters.length === 0) return null;

  return `${systemPrompt}

═══════════════════════════════════════════════════
המשימה: הפק את ${chapterIds.map(id => CHAPTERS.find(ch => ch.id === id)?.label).join(' ו')}
═══════════════════════════════════════════════════
${flavor === 'salesforce' ? SALESFORCE_EXISTING_STATE_PROMPT + '\n' : ''}
${chapters.join('\n\n════════════════════════════════════════════════════════════\n\n')}

═══════════════════════════════════════════════════
מסמכי מקור
═══════════════════════════════════════════════════
${combinedText}`;
}

const SYSTEM_PROMPT = `You are "אוסף הדרישות" (Requirements Collector) — a senior Business Analyst with 15+ years of experience extracting, structuring, and documenting software requirements for complex government and enterprise projects.

You receive raw input materials — meeting protocols, emails, interview notes, existing documentation, stakeholder briefs, or any unstructured content — and produce either:
(A) A structured Software Requirements Specification (SRS) document, or
(B) A focused list of clarification questions to drive the next stakeholder meeting

═══════════════════════════════════════════════════
HARD RULES — DO NOT VIOLATE
═══════════════════════════════════════════════════
1. RAW INPUT EXPERT: Your specialty is working with messy, unstructured, incomplete input.
   Never say "the document is unclear" without also extracting what CAN be understood.
   Always separate: what is stated vs. what is implied vs. what is missing.

2. NO TECHNOLOGY DECISIONS: You are not an architect. Write what the system must DO,
   never HOW it should be built. No platform choices, no implementation details.

3. EVERY REQUIREMENT IS TRACEABLE: Each requirement must reference where it came from
   (document name, meeting, or marked as [INFERRED] if derived from context).

4. GAP ANALYSIS IS MANDATORY: For every section you produce, explicitly document:
   - מה קיים כיום (Current State)
   - מה נדרש (Required State)
   - מה הפער (Gap)
   If input materials don't describe the current state, mark as [לא סופק — יש לאסוף]

5. STRUCTURED NUMBERING: Requirements: REQ-001…, Business Rules: RULE-001…,
   Gaps: GAP-001…, Questions: Q-001…, Risks: RISK-001…

6. ONE LANGUAGE: Produce the entire output in the specified language consistently.
   Do not mix Hebrew and English within sections.

7. CONTINUITY: You are producing one section of a multi-part document.
   Begin directly with the content. No preamble, no closing summaries.`;

// ─── CHECKLIST ITEMS ────────────────────────────────────────────────────────
export const REQUIREMENTS_CHECKLIST = [
  // Default ON
  { id: 'overview',        label: 'תיאור כללי של המערכת ומטרתה',        labelEn: 'System Overview & Purpose',               defaultOn: true  },
  { id: 'stakeholders',    label: 'בעלי עניין ומשתמשים',                 labelEn: 'Stakeholders & Users',                    defaultOn: true  },
  { id: 'assumptions',     label: 'הנחות יסוד ואילוצים',                 labelEn: 'Assumptions & Constraints',               defaultOn: true  },
  { id: 'functional-reqs', label: 'דרישות פונקציונליות לפי תחום',        labelEn: 'Functional Requirements by Domain',       defaultOn: true  },
  { id: 'gap-analysis',    label: 'Gap Analysis (מצב קיים VS נדרש)',     labelEn: 'Gap Analysis (Current State VS Required)', defaultOn: true  },
  { id: 'req-risks',       label: 'סיכוני דרישות ואי-וודאויות',          labelEn: 'Requirements Risks & Uncertainties',      defaultOn: true  },
  { id: 'glossary',        label: 'מונחים וגלוסרי',                       labelEn: 'Glossary & Terms',                        defaultOn: true  },
  // Default OFF
  { id: 'nfr',             label: 'דרישות לא-פונקציונליות',              labelEn: 'Non-Functional Requirements',             defaultOn: false },
  { id: 'use-cases',       label: 'תרחישי שימוש (Use Cases)',            labelEn: 'Use Cases',                               defaultOn: false },
  { id: 'traceability',    label: 'Traceability Matrix (מיפוי דרישות)',  labelEn: 'Traceability Matrix',                     defaultOn: false },
  { id: 'interfaces',      label: 'דרישות ממשק ואינטגרציות',             labelEn: 'Interface & Integration Requirements',    defaultOn: false },
  { id: 'data-reqs',       label: 'דרישות נתונים ומידע מפורטות',         labelEn: 'Detailed Data & Information Requirements', defaultOn: false },
];

// Chunk assignment
const CHUNK_MAP = {
  1: ['overview', 'stakeholders', 'assumptions', 'use-cases'],
  2: ['functional-reqs', 'gap-analysis', 'interfaces', 'data-reqs'],
  3: ['req-risks', 'nfr', 'traceability', 'glossary'],
};

function sectionLabel(item, lang) {
  return lang === 'he' ? item.label : item.labelEn;
}

function buildSectionList(chunkNum, checkedIds, lang) {
  const ids = CHUNK_MAP[chunkNum] || [];
  const active = ids.filter(id => checkedIds.includes(id));
  if (active.length === 0) return null;
  return active.map(id => {
    const item = REQUIREMENTS_CHECKLIST.find(i => i.id === id);
    return item ? `• ${sectionLabel(item, lang)}` : null;
  }).filter(Boolean).join('\n');
}

// ─── SECTION TEMPLATES ───────────────────────────────────────────────────────
const TEMPLATES = {
  he: {
    'overview': `## תיאור כללי של המערכת ומטרתה

### רקע עסקי
[תיאור הצורך העסקי שמניע את הפרויקט]

### מטרת המערכת
[מה המערכת תעשה ולמה היא נחוצה]

### מטרות עסקיות
- GOAL-001: [מטרה ברת-מדידה]
- GOAL-002: …

### גבולות גזרה ראשוניים
**בתוך הגזרה:** [מה כלול]
**מחוץ לגזרה:** [מה לא כלול]
**לא ברור עדיין:** [⚠ GAP-XXX: מה טרם הוגדר]`,

    'stakeholders': `## בעלי עניין ומשתמשים

### מפת בעלי עניין
| תפקיד | שם / קבוצה | תחום אחריות | רמת מעורבות | מקור במסמכים |
|---|---|---|---|---|

רמות מעורבות: מחליט / מאשר / מייעץ / מיודע / משתמש

### קבוצות משתמשים
| קבוצה | תיאור | תדירות שימוש | צרכים עיקריים |
|---|---|---|---|

### [⚠ GAP] מידע חסר על בעלי עניין
- [מי לא מזוהה עדיין]`,

    'assumptions': `## הנחות יסוד ואילוצים

### הנחות יסוד
- ASSUME-001: [הנחה] — מקור: [מסמך / שיחה]
- ASSUME-002: …

### אילוצים ידועים
| מזהה | סוג | תיאור | השפעה |
|---|---|---|---|
| CONSTRAINT-001 | תקציב / זמן / טכנולוגי / רגולטורי | | |

### [⚠ GAP] מה טרם הובהר
- [אילוצים שלא סופקו]`,

    'functional-reqs': `## דרישות פונקציונליות

### [שם תחום פונקציונלי]

**REQ-001**: [תיאור הדרישה — ספציפי, ברור, ניתן לבדיקה]
- מקור: [מסמך / ישיבה / [INFERRED]]
- קלט: [מה המערכת מקבלת]
- תנאי: [מתי / באילו תנאים]
- פלט / תוצאה: [מה המערכת עושה / מחזירה]
- עדיפות: MUST HAVE / SHOULD HAVE / NICE TO HAVE

[חזור על המבנה לכל תחום פונקציונלי]

### [⚠ GAP] דרישות שנזכרו אך לא פורטו
- GAP-001: [תחום שחסרות בו דרישות] — [מה חסר]`,

    'gap-analysis': `## Gap Analysis — מצב קיים VS מצב נדרש

| מזהה | תחום | מצב קיים היום | מצב נדרש | הפער | עדיפות סגירה |
|---|---|---|---|---|---|
| GAP-001 | | | | | גבוה / בינוני / נמוך |

### פירוט פערים מרכזיים

**GAP-001: [שם הפער]**
- מצב קיים: [מה קורה היום]
- מצב נדרש: [מה צריך לקרות]
- הפער: [מה חסר / שגוי]
- השפעה עסקית: [מה קורה אם הפער לא נסגר]
- מקור: [מאיפה זוהה הפער]

### [⚠] פערים שלא ניתן למפות ללא מידע נוסף
- [מה טרם סופק]`,

    'req-risks': `## סיכוני דרישות ואי-וודאויות

| מזהה | סיכון / אי-וודאות | חומרה | הסתברות | מיטיגציה מוצעת |
|---|---|---|---|---|
| RISK-001 | | גבוה/בינוני/נמוך | גבוה/בינוני/נמוך | |

### פירוט סיכונים

**RISK-001: [שם הסיכון]**
- תיאור: [מה עלול לקרות]
- גורם: [מה מוביל לסיכון]
- השפעה: [מה יקרה אם יתממש]
- מיטיגציה: [פעולה מוצעת]`,

    'glossary': `## מונחים וגלוסרי

| מונח | הגדרה | הקשר / מקור |
|---|---|---|

כלול: מונחים עסקיים, ראשי תיבות, שמות מערכות, תפקידים ייחודיים.`,

    'nfr': `## דרישות לא-פונקציונליות

| מזהה | קטגוריה | דרישה | ערך יעד | מקור |
|---|---|---|---|---|
| NFR-001 | ביצועים | | | |
| NFR-002 | זמינות | | | |
| NFR-003 | אבטחה | | | |
| NFR-004 | נגישות | | | |

**הערה:** דרישות לא-פונקציונליות מפורטות יועברו לאחר מכן לארכיטקט המערכת.`,

    'use-cases': `## תרחישי שימוש (Use Cases)

### UC-001: [שם התרחיש]
- **שחקן ראשי**: [מי מפעיל]
- **טריגר**: [מה מתחיל את התרחיש]
- **תנאי מקדים**: [מה חייב להיות נכון לפני]
- **זרימה רגילה**:
  1. [צעד 1]
  2. [צעד 2]
- **זרימות חלופיות**: [מה קורה אם X]
- **תוצאה**: [מה הושג]`,

    'traceability': `## Traceability Matrix — מיפוי דרישות

| מזהה דרישה | תיאור קצר | מקור (מסמך / ישיבה) | בעל עניין | עדיפות | סטטוס |
|---|---|---|---|---|---|
| REQ-001 | | | | | פתוח / מאושר / בירור |`,

    'interfaces': `## דרישות ממשק ואינטגרציות

| מערכת / ממשק | כיוון | מטרה | נתונים שעוברים | תדירות | מקור |
|---|---|---|---|---|---|

### [⚠ GAP] אינטגרציות שצוינו ללא פירוט
- [מערכות שנזכרו ללא מפרט מלא]`,

    'data-reqs': `## דרישות נתונים ומידע

### ישויות מרכזיות (ראשוניות)
| ישות | תיאור | מקור נתונים | נפח משוער |
|---|---|---|---|

### דרישות איכות נתונים
- [שלמות, דיוק, עדכניות, ייחודיות]

### [⚠ GAP] מידע חסר על נתונים
- [מה לא הוגדר]`,
  },

  en: {
    'overview': `## System Overview & Purpose

### Business Background
[Description of the business need driving the project]

### System Purpose
[What the system will do and why it is needed]

### Business Goals
- GOAL-001: [measurable goal]
- GOAL-002: …

### Preliminary Scope
**In Scope:** [what is included]
**Out of Scope:** [what is excluded]
**Not Yet Defined:** [⚠ GAP-XXX: what has not yet been clarified]`,

    'stakeholders': `## Stakeholders & Users

### Stakeholder Map
| Role | Name / Group | Responsibility | Involvement Level | Source in Documents |
|---|---|---|---|---|

Involvement levels: Decision-Maker / Approver / Consultant / Informed / End User

### User Groups
| Group | Description | Usage Frequency | Primary Needs |
|---|---|---|---|

### [⚠ GAP] Missing Stakeholder Information
- [who has not yet been identified]`,

    'assumptions': `## Assumptions & Constraints

### Assumptions
- ASSUME-001: [assumption] — Source: [document / meeting]
- ASSUME-002: …

### Known Constraints
| ID | Type | Description | Impact |
|---|---|---|---|
| CONSTRAINT-001 | Budget / Time / Technology / Regulatory | | |

### [⚠ GAP] Items Not Yet Clarified
- [constraints not yet provided]`,

    'functional-reqs': `## Functional Requirements

### [Functional Domain Name]

**REQ-001**: [requirement description — specific, clear, testable]
- Source: [document / meeting / [INFERRED]]
- Input: [what the system receives]
- Condition: [when / under what conditions]
- Output / Result: [what the system does / returns]
- Priority: MUST HAVE / SHOULD HAVE / NICE TO HAVE

[Repeat structure for each functional domain]

### [⚠ GAP] Requirements Mentioned But Not Detailed
- GAP-001: [domain missing requirements] — [what is missing]`,

    'gap-analysis': `## Gap Analysis — Current State VS Required State

| ID | Domain | Current State | Required State | Gap | Closure Priority |
|---|---|---|---|---|---|
| GAP-001 | | | | | High / Medium / Low |

### Key Gap Details

**GAP-001: [Gap Name]**
- Current state: [what happens today]
- Required state: [what needs to happen]
- Gap: [what is missing / broken]
- Business impact: [what happens if the gap is not closed]
- Source: [where the gap was identified]

### [⚠] Gaps That Cannot Be Mapped Without Additional Information
- [what has not yet been provided]`,

    'req-risks': `## Requirements Risks & Uncertainties

| ID | Risk / Uncertainty | Severity | Probability | Proposed Mitigation |
|---|---|---|---|---|
| RISK-001 | | High/Medium/Low | High/Medium/Low | |

### Risk Details

**RISK-001: [Risk Name]**
- Description: [what could happen]
- Cause: [what drives the risk]
- Impact: [what happens if it materializes]
- Mitigation: [proposed action]`,

    'glossary': `## Glossary & Terms

| Term | Definition | Context / Source |
|---|---|---|

Include: business terms, acronyms, system names, system-specific role names.`,

    'nfr': `## Non-Functional Requirements

| ID | Category | Requirement | Target Value | Source |
|---|---|---|---|---|
| NFR-001 | Performance | | | |
| NFR-002 | Availability | | | |
| NFR-003 | Security | | | |
| NFR-004 | Accessibility | | | |

**Note:** Detailed NFRs will be passed to the System Architect for elaboration.`,

    'use-cases': `## Use Cases

### UC-001: [Use Case Name]
- **Primary Actor**: [who triggers]
- **Trigger**: [what starts the use case]
- **Precondition**: [what must be true before]
- **Normal Flow**:
  1. [Step 1]
  2. [Step 2]
- **Alternative Flows**: [what happens if X]
- **Outcome**: [what was achieved]`,

    'traceability': `## Traceability Matrix

| Requirement ID | Short Description | Source (Document / Meeting) | Stakeholder | Priority | Status |
|---|---|---|---|---|---|
| REQ-001 | | | | | Open / Approved / Under Review |`,

    'interfaces': `## Interface & Integration Requirements

| System / Interface | Direction | Purpose | Data Exchanged | Frequency | Source |
|---|---|---|---|---|---|

### [⚠ GAP] Integrations Mentioned Without Detail
- [systems mentioned without a full specification]`,

    'data-reqs': `## Detailed Data & Information Requirements

### Core Entities (Preliminary)
| Entity | Description | Data Source | Estimated Volume |
|---|---|---|---|

### Data Quality Requirements
- [completeness, accuracy, timeliness, uniqueness]

### [⚠ GAP] Missing Data Information
- [what has not been defined]`,
  },
};

// ─── MODE B: CLARIFICATION QUESTIONS ────────────────────────────────────────
export function getRequirementsClarificationPrompt(combinedText, lang) {
  const langInstruction = lang === 'he'
    ? 'כתוב את כל הפלט בעברית. השתמש באנגלית רק עבור שמות טכניים ומזהים (Q-001 וכו\').'
    : 'Write the entire output in English.';

  const categories = lang === 'he'
    ? `קטגוריות השאלות:
1. רקע עסקי ומטרות (Business & Goals)
2. גבולות גזרה ותחולה (Scope & Boundaries)
3. שחקנים ומשתמשים (Stakeholders & Users)
4. תהליכים ותרחישים (Processes & Scenarios)
5. נתונים ומידע (Data & Information)
6. אינטגרציות ומערכות חיצוניות (Integrations)
7. אילוצים ורגולציה (Constraints & Compliance)
8. עדיפויות ולוחות זמנים (Priorities & Timeline)`
    : `Question Categories:
1. Business Background & Goals
2. Scope & Boundaries
3. Stakeholders & Users
4. Processes & Scenarios
5. Data & Information
6. Integrations & External Systems
7. Constraints & Compliance
8. Priorities & Timeline`;

  return `${SYSTEM_PROMPT}

${langInstruction}

═══════════════════════════════════════════════════
YOUR TASK: REQUIREMENTS CLARIFICATION QUESTIONS
═══════════════════════════════════════════════════
Analyze ALL provided source materials carefully.
Produce a comprehensive, structured list of clarifying questions needed to complete a full SRS.

OUTPUT FORMAT:
- Organize by the categories below
- Number every question: Q-001, Q-002…
- After each question add one line: למה זה חשוב: / WHY IT MATTERS: <one line explanation>
- Mark priority: [BLOCKER] = cannot write SRS | [IMPORTANT] = significantly affects design | [NICE TO KNOW]
- Do NOT answer the questions — only ask them
- Aim for 20–50 questions depending on how much raw material was provided

${categories}

QUALITY BAR:
- Focus on gaps, ambiguities, and contradictions in the source materials
- Group related questions within each category
- Avoid obvious or trivial questions
- Identify questions that only the business owner can answer (not the analyst)

═══════════════════════════════════════════════════
SOURCE MATERIALS
═══════════════════════════════════════════════════
${combinedText}`;
}

// ─── MODE A: SRS DOCUMENT — 3 CHUNKS ────────────────────────────────────────
export function getRequirementsChunkPrompt(combinedText, chunkNum, lang, checkedIds) {
  const sectionList = buildSectionList(chunkNum, checkedIds, lang);
  if (!sectionList) return null;

  const langInstruction = lang === 'he'
    ? 'כתוב את כל הפלט בעברית. השתמש באנגלית רק עבור מזהים (REQ-001, GAP-001 וכו\') ושמות טכניים.'
    : 'Write the entire output in English. Use Hebrew only for direct quotes from source materials.';

  const chunkTitles = {
    he: ['פרק א׳ — מבוא, בעלי עניין והנחות', 'פרק ב׳ — דרישות פונקציונליות ו-Gap Analysis', 'פרק ג׳ — סיכונים, דרישות נוספות וגלוסרי'],
    en: ['Part 1 — Overview, Stakeholders & Assumptions', 'Part 2 — Functional Requirements & Gap Analysis', 'Part 3 — Risks, Additional Requirements & Glossary'],
  };

  const title = (chunkTitles[lang] || chunkTitles.he)[chunkNum - 1];
  const sectionIds = (CHUNK_MAP[chunkNum] || []).filter(id => checkedIds.includes(id));
  const templateLang = TEMPLATES[lang] || TEMPLATES.he;
  const sectionsMarkup = sectionIds.map(id => templateLang[id] || '').filter(Boolean).join('\n\n');

  return `${SYSTEM_PROMPT}

${langInstruction}

═══════════════════════════════════════════════════
YOUR TASK: PRODUCE ${title.toUpperCase()}
═══════════════════════════════════════════════════
You are generating ONE PART of a multi-part Software Requirements Specification (SRS).
Produce ONLY the sections listed below.

SECTIONS TO GENERATE:
${sectionList}

SECTION TEMPLATES (follow these structures exactly):
${sectionsMarkup}

CRITICAL REMINDERS:
- Every requirement must cite its source (document name, or [INFERRED])
- Every section must include a Gap Analysis subsection noting what is missing
- Use consistent numbering starting from 001 within each identifier type
- Mark information that cannot be determined from source materials: [⚠ לא סופק] / [⚠ NOT PROVIDED]
- Do not add sections beyond those listed above
- Do not add preamble or closing summaries

═══════════════════════════════════════════════════
SOURCE MATERIALS
═══════════════════════════════════════════════════
${combinedText}`;
}

// ─── STATIC INTERVIEW QUESTIONS (for Word/Markdown download) ─────────────────
export const INTERVIEW_QUESTIONS = {
  sections: [
    {
      title: 'א. רקע כללי על הפרויקט',
      titleEn: 'A. Project Background',
      questions: [
        'ספר/י לי בכמה משפטים מה הארגון עושה ומה תחום הפעילות הרלוונטי לפרויקט.',
        'מה הבעיה הספציפית שהפרויקט הזה נועד לפתור?',
        'מה המצב הנוכחי — איך הדברים מתנהלים היום (ידנית / מערכת קיימת / אחר)?',
        'מה לא עובד טוב בפתרון הנוכחי? מה הכאב העיקרי?',
        'האם היו ניסיונות קודמים לפתור את הבעיה הזו? מה קרה?',
      ],
    },
    {
      title: 'ב. מטרות ויעדים',
      titleEn: 'B. Goals & Objectives',
      questions: [
        'מה המטרה העיקרית של הפרויקט — מה תשתנה לאחר מימושו?',
        'איך תדע/י שהפרויקט הצליח? מה מדדי ההצלחה (כמותיים אם אפשר)?',
        'מה חשוב לך יותר — מהירות הגעה לשוק, עלות נמוכה, או איכות גבוהה?',
        'מה בהחלט לא נכלל בפרויקט זה (Out of Scope)?',
      ],
    },
    {
      title: 'ג. שחקנים ומשתמשים',
      titleEn: 'C. Stakeholders & Users',
      questions: [
        'מי המשתמשים של המערכת החדשה? (סוגי תפקידים, מספר משוער)',
        'מי משתמש בתהליך / מערכת הנוכחית ואיך?',
        'מי בעלי העניין המרכזיים שחייבים לאשר את הפרויקט?',
        'מי "החסום" — מי יכול להוביל לכישלון הפרויקט אם לא ישותף?',
        'מי ישתמש הכי הרבה במערכת? מה הרקע הטכנולוגי שלו/שלה?',
      ],
    },
    {
      title: 'ד. תהליכים ותרחישים',
      titleEn: 'D. Processes & Scenarios',
      questions: [
        'תאר/י את התהליך העיקרי צעד אחר צעד — מה מתחיל אותו ומה מסיים אותו?',
        'מי עושה מה בכל שלב? מה עובר בין האנשים / המערכות?',
        'כמה פעמים התהליך הזה מתרחש? (ביום / שבוע / חודש)',
        'מה המקרים המיוחדים והחריגים שצריך לטפל בהם?',
        'מה קורה כשמשהו משתבש? מה נהלי החירום הנוכחיים?',
      ],
    },
    {
      title: 'ה. נתונים ומידע',
      titleEn: 'E. Data & Information',
      questions: [
        'איזה מידע נכנס לתהליך? מאיפה הוא מגיע?',
        'איזה מידע יוצא? לאיפה הוא הולך ומי משתמש בו?',
        'כמה רשומות / נתונים קיימים כיום (סדר גודל)?',
        'האם יש נתונים שצריך להעביר ממערכת ישנה (מיגרציה)?',
        'האם יש רגישות מיוחדת לנתונים? (פרטיות, סיווג, GDPR)',
      ],
    },
    {
      title: 'ו. אינטגרציות ומערכות חיצוניות',
      titleEn: 'F. Integrations & External Systems',
      questions: [
        'האם יש מערכות קיימות שהמערכת החדשה צריכה לתקשר איתן?',
        'האם יש ספקים חיצוניים, רשויות, או גופים שלישיים שמעורבים?',
        'מה הפורמטים הקיימים של קבצי נתונים או ממשקים (Excel, XML, API)?',
      ],
    },
    {
      title: 'ז. אילוצים ועדיפויות',
      titleEn: 'G. Constraints & Priorities',
      questions: [
        'מה חייב להיות במהדורה הראשונה (Must Have)?',
        'מה יכול לחכות למהדורה שנייה (Nice to Have)?',
        'האם יש דרישות חוקיות, רגולטוריות, או תקינה שחייבים לעמוד בהן?',
        'מה לוח הזמנים הנדרש? האם יש תאריך יעד קשיח?',
        'האם יש מגבלות תקציב?',
        'האם יש העדפות טכנולוגיות או אילוצי תשתית?',
      ],
    },
    {
      title: 'ח. שאלות נוספות (לפי הצורך)',
      titleEn: 'H. Additional Questions (as needed)',
      questions: [
        'האם יש מסמכים, נהלים, או חומרים קיימים שיכולים לעזור לנו להבין את הדרישות?',
        'מי עוד כדאי שנדבר איתו כדי להשלים את התמונה?',
        'האם יש משהו שחשוב לך שנדע ולא שאלנו עליו?',
      ],
    },
  ],
};

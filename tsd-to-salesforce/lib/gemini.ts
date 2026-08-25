import { GeneratedFile } from '@/types/salesforce';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const DEPLOY_STEPS = [
  {
    id: 1,
    titleHe: 'אובייקטים ושדות',
    description: 'Custom Objects + Custom Fields',
    instructions:
      'לחץ Deploy, ולאחר מכן המתן לאישור ב-Salesforce Setup לפני שתמשיך לשלב הבא.',
  },
  {
    id: 2,
    titleHe: 'חוקי ולידציה',
    description: 'Validation Rules',
    instructions:
      'ודא שהאובייקטים מהשלב הקודם קיימים ב-Salesforce לפני שתבצע Deploy.',
  },
  {
    id: 3,
    titleHe: 'זרימות',
    description: 'Flows',
    instructions: 'זרימות יכולות לקחת כמה דקות להיטמע ב-Salesforce לאחר ה-Deploy.',
  },
  {
    id: 4,
    titleHe: 'הרשאות ו-Layouts',
    description: 'Permission Sets + Page Layouts',
    instructions:
      'לאחר ה-Deploy, הקצה את ה-Permission Sets למשתמשים הרלוונטיים דרך Salesforce Setup.',
  },
] as const;

const STEP_PROMPTS: Record<number, string> = {
  1: `You are a Salesforce architect. Analyze the following TSD (Technical Specification Document) and generate Salesforce Metadata XML files for:
- Custom Objects (.object-meta.xml)
- Custom Fields (inside each object file)

Rules:
- Output ONLY valid Salesforce Metadata API XML
- API version: 59.0
- Object and field API names must follow the Hebrew naming convention already used in the TSD (e.g. שם_אובייקט__c)
- Return a JSON array ONLY: [{ "filename": string, "content": string }]
- Filenames must follow SF metadata conventions, e.g. objects/MyObj__c.object-meta.xml
- No explanations, markdown fences, or any text outside the JSON array

TSD:
{TSD_CONTENT}`,

  2: `You are a Salesforce architect. Based on the following TSD, generate Salesforce Validation Rules XML.
Each validation rule must be embedded inside its parent object file.

Rules:
- API version: 59.0
- Return a JSON array ONLY: [{ "filename": string, "content": string }]
- Filenames: objects/ObjName__c/validationRules/RuleName.validationRule-meta.xml
- No explanations, markdown fences, or any text outside the JSON array

TSD:
{TSD_CONTENT}`,

  3: `You are a Salesforce architect. Based on the following TSD, generate Salesforce Flow Metadata XML files.
Create Screen Flows or Auto-launch Flows as appropriate.

Rules:
- API version: 59.0
- Return a JSON array ONLY: [{ "filename": string, "content": string }]
- Filenames: flows/FlowName.flow-meta.xml
- No explanations, markdown fences, or any text outside the JSON array

TSD:
{TSD_CONTENT}`,

  4: `You are a Salesforce architect. Based on the following TSD, generate:
- Permission Sets XML
- Page Layouts XML

Rules:
- API version: 59.0
- Return a JSON array ONLY: [{ "filename": string, "content": string }]
- Permission set filenames: permissionsets/PSName.permissionset-meta.xml
- Layout filenames: layouts/ObjName__c-Layout Name.layout-meta.xml
- No explanations, markdown fences, or any text outside the JSON array

TSD:
{TSD_CONTENT}`,
};

export async function generateStep(
  apiKey: string,
  tsdContent: string,
  step: number
): Promise<GeneratedFile[]> {
  const prompt = STEP_PROMPTS[step].replace('{TSD_CONTENT}', tsdContent);

  const res = await fetch(
    `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 65000, temperature: 0.1 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('') ?? '';

  // Strip possible markdown fences
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let files: GeneratedFile[];
  try {
    files = JSON.parse(jsonText);
  } catch {
    throw new Error('תגובת ה-AI אינה JSON תקין. נסה שוב.');
  }

  if (!Array.isArray(files)) throw new Error('תגובת ה-AI אינה מערך. נסה שוב.');
  return files;
}

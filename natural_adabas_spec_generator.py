#!/usr/bin/env python3
"""
Natural ADABAS Technical Specification Generator
מחולל אפיון טכני לקוד Natural ADABAS מיינפריים

Usage:
  1. Place this script in the same folder as your .txt Natural files
  2. Run: python natural_adabas_spec_generator.py
  3. Enter your Gemini API key when prompted
  4. Output: natural_adabas_spec.xlsx + knowledge_base.json + analyses.json

Requirements:
  pip install requests openpyxl
"""

import os
import re
import sys
import json
import time
import threading
import requests
import openpyxl
from pathlib import Path
from collections import defaultdict
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────────────────

GEMINI_MODEL  = "gemini-2.5-flash"
GEMINI_BASE   = "https://generativelanguage.googleapis.com/v1beta/models"
MAX_TOKENS    = 65000
TEMPERATURE   = 0.1

# Delay between API calls (seconds) to avoid rate limiting
API_DELAY     = 1.5

# Max characters sent per program to Gemini (to stay within token limits)
MAX_PROGRAM_CHARS = 120_000

# ──────────────────────────────────────────────────────────────────────────────
# STYLES
# ──────────────────────────────────────────────────────────────────────────────

HDR_FILL = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
HDR_FONT = Font(color="FFFFFF", bold=True, name="Arial", size=11)
ALT_FILL = PatternFill(start_color="EBF0FA", end_color="EBF0FA", fill_type="solid")
THIN     = Border(left=Side(style='thin'), right=Side(style='thin'),
                  top=Side(style='thin'),  bottom=Side(style='thin'))
WRAP_C   = Alignment(horizontal="center", vertical="center", wrap_text=True)
WRAP_R   = Alignment(horizontal="right",  vertical="top",    wrap_text=True)

def hdr(cell):
    cell.fill, cell.font, cell.alignment, cell.border = HDR_FILL, HDR_FONT, WRAP_C, THIN

def cell_style(cell, alt=False):
    if alt:
        cell.fill = ALT_FILL
    cell.alignment = WRAP_R
    cell.border     = THIN

def set_col_widths(ws, widths):
    for col_letter, w in widths.items():
        ws.column_dimensions[col_letter].width = w

def freeze_header(ws):
    ws.freeze_panes = "A2"

# ──────────────────────────────────────────────────────────────────────────────
# STATIC PARSER — extract metadata WITHOUT calling AI
# ──────────────────────────────────────────────────────────────────────────────

# Patterns for Natural ADABAS constructs
RE_DEFINE_DATA  = re.compile(r'DEFINE\s+DATA', re.IGNORECASE)
RE_END_DEFINE   = re.compile(r'END-DEFINE', re.IGNORECASE)
RE_VIEW_OF      = re.compile(r'VIEW\s+OF\s+([A-Z0-9_-]+)', re.IGNORECASE)
RE_CALLNAT      = re.compile(r"CALLNAT\s+['\"]?([A-Z0-9_-]+)['\"]?", re.IGNORECASE)
RE_PERFORM      = re.compile(r'PERFORM\s+([A-Z0-9_-]+)', re.IGNORECASE)
RE_DB_OP        = re.compile(r'\b(READ|FIND|STORE|UPDATE|DELETE|GET\s+SAME|HISTOGRAM)\b', re.IGNORECASE)
RE_PROGRAM_HDR  = re.compile(r'^\*\s*(?:PROGRAM|MODULE|NAME|ROUTINE)\s*[:\-]?\s*(\S+)', re.IGNORECASE)
RE_SUBR_DEF     = re.compile(r'^DEFINE\s+SUBROUTINE\s+([A-Z0-9_-]+)', re.IGNORECASE)
RE_END_SUBR     = re.compile(r'^END-SUBROUTINE', re.IGNORECASE)
RE_IF           = re.compile(r'^\s*IF\b', re.IGNORECASE)
RE_LOOP         = re.compile(r'^\s*(FOR|REPEAT|WHILE|READ|FIND)\b', re.IGNORECASE)


RE_END_PROG_SEMI     = re.compile(r'^\s*END\s*;?\s*$', re.IGNORECASE)
RE_PROG_NAME_CMT     = re.compile(r'^\*{1,2}\s*(?:PROGRAM|PROG|MODULE|NAME|ROUTINE)\s*[:\-]?\s*([A-Z0-9_-]+)', re.IGNORECASE)
RE_DEFINE_DATA_START = re.compile(r'^\s*DEFINE\s+DATA\b', re.IGNORECASE)
# *C** or *C* — common mainframe export separator between cataloged members
RE_CATALOG_SEP       = re.compile(r'^\*C\*+\s*$')


def _extract_name_from_segment(lines, stem, index):
    """
    Try to find a program name inside a segment.
    Looks for:
      1. *C** <NAME> style header on the line right after the separator
      2. * PROGRAM: / * NAME: comment
      3. Falls back to stem_PROGn
    """
    for line in lines[:15]:
        stripped = line.strip()
        # *C** PROGNAME  or  *C* PROGNAME
        m = re.match(r'^\*C\*+\s+([A-Z0-9_-]+)', stripped, re.IGNORECASE)
        if m:
            return m.group(1).upper()
        m = RE_PROG_NAME_CMT.match(stripped)
        if m:
            return m.group(1).upper()
    return f"{stem}_PROG{index + 1}"


def split_into_programs(content, filename):
    """
    Split a Natural ADABAS file into individual programs.

    Priority order:
      A. *C** separator lines  (mainframe export convention)
      B. Standalone END lines  (Natural language standard)
      C. Multiple DEFINE DATA  (heuristic)
      D. Whole file as one unit (fallback)
    """
    stem  = Path(filename).stem
    lines = content.splitlines()

    # ── Strategy A: *C** separator lines ────────────────────────────────────
    sep_indices = [i for i, l in enumerate(lines) if RE_CATALOG_SEP.match(l)]
    if sep_indices:
        segments = []
        boundaries = sep_indices + [len(lines)]
        for idx, start in enumerate(sep_indices):
            end     = boundaries[idx + 1]
            seg     = lines[start:end]
            name    = _extract_name_from_segment(seg, stem, idx)
            segments.append({'name': name, 'code': '\n'.join(seg)})
        if segments:
            return segments

    # ── Strategy B: standalone END lines ────────────────────────────────────
    segments = []
    current  = []

    for line in lines:
        current.append(line)
        if RE_END_PROG_SEMI.match(line):
            non_empty = [l for l in current if l.strip() and not l.strip().startswith('*')]
            if len(non_empty) >= 3:
                segments.append(current[:])
            current = []

    if current:
        non_empty = [l for l in current if l.strip() and not l.strip().startswith('*')]
        if len(non_empty) >= 3:
            segments.append(current)

    # If we found more than 1 segment, use them
    if len(segments) > 1:
        programs = []
        for i, seg_lines in enumerate(segments):
            name = _extract_name_from_segment(seg_lines, stem, i)
            programs.append({'name': name, 'code': '\n'.join(seg_lines)})
        return programs

    # ── Strategy C: split on DEFINE DATA blocks ──────────────────────────────
    split_points = [i for i, l in enumerate(lines) if RE_DEFINE_DATA_START.match(l)]

    if len(split_points) > 1:
        programs = []
        for idx, start in enumerate(split_points):
            end = split_points[idx + 1] if idx + 1 < len(split_points) else len(lines)
            seg = lines[start:end]
            name = _extract_name_from_segment(seg, stem, idx)
            programs.append({'name': name, 'code': '\n'.join(seg)})
        return programs

    # ── Fallback: whole file as one program ──────────────────────────────────
    return [{'name': stem, 'code': content}]


def parse_file(filepath):
    """Static parse of one .txt Natural file — no AI required."""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    lines    = content.splitlines()
    filename = os.path.basename(filepath)

    ddms      = set()
    callnats  = set()
    performs  = set()
    db_ops    = []

    for i, line in enumerate(lines, 1):
        s = line.strip()
        for m in RE_VIEW_OF.finditer(s):
            ddms.add(m.group(1).upper())
        for m in RE_CALLNAT.finditer(s):
            callnats.add(m.group(1).upper())
        for m in RE_PERFORM.finditer(s):
            performs.add(m.group(1).upper())
        for m in RE_DB_OP.finditer(s):
            db_ops.append({'op': m.group(1).upper(), 'line': i, 'context': s[:80]})

    programs = split_into_programs(content, filename)

    return {
        'filename' : filename,
        'content'  : content,
        'programs' : programs,
        'ddms'     : sorted(ddms),
        'callnats' : sorted(callnats),
        'performs' : sorted(performs),
        'db_ops'   : db_ops,
        'line_count': len(lines),
    }


def build_knowledge_base(files_data):
    """Build cross-reference map across all files."""
    ddm_to_files  = defaultdict(list)
    call_graph    = defaultdict(list)  # file → [called programs]
    all_ddms      = set()
    program_index = {}  # program_name → filename

    for fd in files_data:
        fname = fd['filename']
        for ddm in fd['ddms']:
            ddm_to_files[ddm].append(fname)
            all_ddms.add(ddm)
        for cn in fd['callnats']:
            call_graph[fname].append(cn)
        for prog in fd['programs']:
            program_index[prog['name'].upper()] = fname

    return {
        'ddm_to_files' : dict(ddm_to_files),
        'call_graph'   : dict(call_graph),
        'all_ddms'     : sorted(all_ddms),
        'program_index': program_index,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GEMINI API
# ──────────────────────────────────────────────────────────────────────────────

class _Spinner:
    """Print a progress dot every N seconds while an operation is running."""
    def __init__(self, interval=4):
        self._interval = interval
        self._stop     = threading.Event()
        self._thread   = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        while not self._stop.wait(self._interval):
            print(".", end="", flush=True)

    def __enter__(self):
        self._thread.start()
        return self

    def __exit__(self, *_):
        self._stop.set()
        self._thread.join()
        print()  # newline after dots


def call_gemini(api_key, prompt, attempt=0):
    """Call Gemini REST API with exponential-backoff retry."""
    url = f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={api_key}"
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": MAX_TOKENS, "temperature": TEMPERATURE},
    }
    try:
        resp = requests.post(url, json=body, timeout=180)
        if resp.status_code in (429, 503) and attempt < 4:
            wait = 2 ** attempt
            print(f"\n    ⏳ Rate limit / server busy — ממתין {wait}s...", end="", flush=True)
            time.sleep(wait)
            return call_gemini(api_key, prompt, attempt + 1)
        resp.raise_for_status()
        data = resp.json()
        parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts)
    except requests.RequestException as e:
        if attempt < 4:
            wait = 2 ** attempt
            print(f"\n    ⚠ Network error: {e} — ממתין {wait}s...", end="", flush=True)
            time.sleep(wait)
            return call_gemini(api_key, prompt, attempt + 1)
        raise


def strip_json_fences(text):
    """Remove ```json ... ``` markdown fences if present."""
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*```$',          '', text)
    return text.strip()


# ──────────────────────────────────────────────────────────────────────────────
# PROMPTS
# ──────────────────────────────────────────────────────────────────────────────

SYSTEM_CONTEXT = """אתה מנתח קוד Natural ADABAS מיינפריים בכיר.
ענה תמיד בעברית, מלבד שמות טכניים (DDM, שדות, שמות תוכניות).

רקע:
- Natural = שפת תכנות מיינפריים של Software AG
- ADABAS = בסיס נתונים מיינפריים של Software AG
- DDM (Data Definition Module) = הגדרת טבלה / ישות
- CALLNAT = קריאה לתת-תוכנית חיצונית
- PERFORM = קריאה לתת-שגרה באותו קובץ
- DEFINE DATA / VIEW OF DDM_NAME = הצהרת שימוש בטבלה
- READ / FIND / STORE / UPDATE / DELETE = פעולות בסיס הנתונים
"""

PROGRAM_ANALYSIS_PROMPT = """
{system_context}

=== הקשר הקובץ ===
קובץ: {filename}
תוכנית: {program_name}
DDMs בשימוש בקובץ כולו: {ddms}
קורא ל (CALLNAT): {callnats}
נקרא מ: {called_by}

=== קוד התוכנית ===
{code}

=== משימה ===
נתח את הקוד והחזר JSON תקני בלבד (ללא markdown fences, ללא טקסט נוסף).

{{
  "filename": "{filename}",
  "program_name": "{program_name}",
  "business_purpose": "מה התוכנית עושה — תיאור עסקי קצר",
  "complexity": "פשוט | בינוני | מורכב",

  "entities": [
    {{
      "name": "שם ה-DDM / ישות",
      "adabas_file": "מספר או שם קובץ ב-ADABAS",
      "description": "תיאור הישות",
      "fields": [
        {{
          "name": "שם שדה טכני",
          "label": "שם תצוגה בעברית",
          "type": "string | number | date | boolean | picklist | relation",
          "required": "כן | לא",
          "length": "אורך מקסימלי",
          "description": "תיאור השדה ומשמעותו"
        }}
      ]
    }}
  ],

  "workflows": [
    {{
      "name": "שם הזרימה / תהליך",
      "trigger": "on_create | on_update | on_delete | on_field_change | scheduled | manual",
      "trigger_details": "פירוט הטריגר — מה גורם לתהליך להתחיל",
      "actors": "מי מעורב — תפקידים / משתמשים",
      "steps": [
        "צעד 1: תיאור",
        "צעד 2: תיאור",
        "צעד 3: IF תנאי → נתיב א / נתיב ב"
      ],
      "business_rules": [
        {{
          "rule_id": "RULE-001",
          "name": "שם החוק",
          "logic": "IF תנאי THEN פעולה ELSE פעולה אחרת",
          "trigger": "מתי מופעל",
          "exceptions": "חריגות"
        }}
      ],
      "success_outcome": "תוצאה תקינה",
      "error_handling": "טיפול בשגיאות"
    }}
  ],

  "permissions": [
    {{
      "role": "שם תפקיד",
      "description": "תיאור התפקיד",
      "entity": "שם הישות",
      "read": "all | own | none",
      "create": "כן | לא",
      "update": "all | own | none",
      "delete": "all | own | none"
    }}
  ],

  "integrations": [
    {{
      "system": "שם המערכת / ממשק חיצוני",
      "direction": "כניסה | יציאה | דו-כיווני",
      "data": "אילו נתונים עוברים",
      "frequency": "ריאל-טיים | אצווה | לפי דרישה",
      "notes": "הערות נוספות"
    }}
  ],

  "dependencies": [
    {{
      "type": "CALLNAT | DDM | ADABAS_FILE",
      "name": "שם",
      "purpose": "מטרת השימוש"
    }}
  ],

  "glossary": [
    {{"term": "מונח", "definition": "הגדרה"}}
  ],

  "open_questions": ["שאלה פתוחה 1"]
}}
"""

DDM_EXTRACT_PROMPT = """
{system_context}

=== קובץ: {filename} ===
{code}

=== משימה ===
חלץ את הגדרות ה-DDM המלאות מהקוד (DEFINE DATA, VIEW OF, שמות שדות, סוגים, אורכים).
החזר JSON תקני בלבד (ללא markdown fences):

{{
  "ddms": [
    {{
      "name": "שם ה-DDM",
      "adabas_file": "מספר/שם קובץ ADABAS",
      "description": "תיאור",
      "fields": [
        {{
          "name": "שם שדה",
          "natural_name": "שם בנטורל",
          "type": "A | N | D | T | P | L",
          "length": "אורך",
          "level": "רמה 1/2/3",
          "description": "תיאור"
        }}
      ]
    }}
  ]
}}
"""


def build_program_prompt(fd, prog, kb, ddm_cache):
    """Build the analysis prompt for a single program."""
    filename     = fd['filename']
    prog_name    = prog['name']
    code         = prog['code'][:MAX_PROGRAM_CHARS]

    # Who calls this program?
    called_by = [f for f, calls in kb['call_graph'].items()
                 if prog_name.upper() in [c.upper() for c in calls]]

    # DDM context from earlier extractions
    ddm_context = ""
    for ddm_name in fd['ddms']:
        if ddm_name in ddm_cache:
            fields_summary = ", ".join(
                f.get('name', '') for f in ddm_cache[ddm_name].get('fields', [])[:15]
            )
            ddm_context += f"  {ddm_name}: [{fields_summary}]\n"

    return PROGRAM_ANALYSIS_PROMPT.format(
        system_context = SYSTEM_CONTEXT,
        filename       = filename,
        program_name   = prog_name,
        ddms           = ', '.join(fd['ddms']) or 'לא זוהו',
        callnats       = ', '.join(fd['callnats']) or 'אין',
        called_by      = ', '.join(called_by) or 'לא זוהה',
        code           = code,
    )


# ──────────────────────────────────────────────────────────────────────────────
# EXCEL BUILDER
# ──────────────────────────────────────────────────────────────────────────────

def add_header_row(ws, headers):
    ws.append(headers)
    for c in ws[ws.max_row]:
        hdr(c)
    freeze_header(ws)


def build_excel(analyses, kb, output_path):
    wb = openpyxl.Workbook()

    # ── 1. Summary ────────────────────────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "סיכום"
    add_header_row(ws1, ["קובץ", "תוכנית", "מטרה עסקית", "DDMs", "CALLNAT", "מורכבות"])

    for i, a in enumerate(analyses):
        if 'error' in a:
            ws1.append([a.get('filename', ''), a.get('program_name', ''), f"⚠ שגיאה: {a['error']}", '', '', ''])
        else:
            ents  = [e['name'] for e in a.get('entities', [])]
            deps  = [d['name'] for d in a.get('dependencies', []) if d.get('type') == 'CALLNAT']
            ws1.append([
                a.get('filename', ''),
                a.get('program_name', ''),
                a.get('business_purpose', ''),
                ', '.join(ents),
                ', '.join(deps),
                a.get('complexity', ''),
            ])
        for c in ws1[ws1.max_row]:
            cell_style(c, alt=(i % 2 == 0))

    set_col_widths(ws1, {'A':25,'B':25,'C':55,'D':30,'E':30,'F':15})

    # ── 2. Entities ───────────────────────────────────────────────────────────
    ws2 = wb.create_sheet("ישויות")
    add_header_row(ws2, ["קובץ", "תוכנית", "ישות / DDM", "קובץ ADABAS", "תיאור ישות"])

    i = 0
    for a in analyses:
        for e in a.get('entities', []):
            ws2.append([
                a.get('filename', ''), a.get('program_name', ''),
                e.get('name', ''), e.get('adabas_file', ''), e.get('description', ''),
            ])
            for c in ws2[ws2.max_row]: cell_style(c, alt=(i % 2 == 0))
            i += 1

    set_col_widths(ws2, {'A':25,'B':25,'C':25,'D':15,'E':55})

    # ── 3. Fields ─────────────────────────────────────────────────────────────
    ws3 = wb.create_sheet("שדות")
    add_header_row(ws3, ["קובץ", "תוכנית", "ישות", "שם שדה", "תווית", "סוג", "אורך", "חובה", "תיאור"])

    i = 0
    for a in analyses:
        for e in a.get('entities', []):
            entity_name = e.get('name', '')
            for f in e.get('fields', []):
                ws3.append([
                    a.get('filename', ''), a.get('program_name', ''), entity_name,
                    f.get('name', ''), f.get('label', ''), f.get('type', ''),
                    f.get('length', ''), f.get('required', ''), f.get('description', ''),
                ])
                for c in ws3[ws3.max_row]: cell_style(c, alt=(i % 2 == 0))
                i += 1

    set_col_widths(ws3, {'A':20,'B':20,'C':20,'D':20,'E':20,'F':12,'G':10,'H':10,'I':45})

    # ── 4. Workflows ──────────────────────────────────────────────────────────
    ws4 = wb.create_sheet("זרימות עבודה")
    add_header_row(ws4, ["קובץ", "תוכנית", "שם זרימה", "טריגר", "פירוט טריגר", "שחקנים", "צעדים", "תוצאה תקינה", "טיפול בשגיאות"])

    i = 0
    for a in analyses:
        for wf in a.get('workflows', []):
            steps_text = '\n'.join(wf.get('steps', []))
            ws4.append([
                a.get('filename', ''), a.get('program_name', ''),
                wf.get('name', ''), wf.get('trigger', ''), wf.get('trigger_details', ''),
                wf.get('actors', ''), steps_text,
                wf.get('success_outcome', ''), wf.get('error_handling', ''),
            ])
            for c in ws4[ws4.max_row]: cell_style(c, alt=(i % 2 == 0))
            i += 1

    set_col_widths(ws4, {'A':20,'B':20,'C':30,'D':18,'E':35,'F':25,'G':60,'H':40,'I':40})

    # ── 5. Business Rules ─────────────────────────────────────────────────────
    ws5 = wb.create_sheet("חוקי עסק")
    add_header_row(ws5, ["קובץ", "תוכנית", "זרימה", "RULE ID", "שם החוק", "לוגיקה", "טריגר", "חריגות"])

    i = 0
    for a in analyses:
        for wf in a.get('workflows', []):
            wf_name = wf.get('name', '')
            for rule in wf.get('business_rules', []):
                ws5.append([
                    a.get('filename', ''), a.get('program_name', ''), wf_name,
                    rule.get('rule_id', ''), rule.get('name', ''),
                    rule.get('logic', ''), rule.get('trigger', ''), rule.get('exceptions', ''),
                ])
                for c in ws5[ws5.max_row]: cell_style(c, alt=(i % 2 == 0))
                i += 1

    set_col_widths(ws5, {'A':20,'B':20,'C':25,'D':12,'E':30,'F':60,'G':30,'H':30})

    # ── 6. Permissions ────────────────────────────────────────────────────────
    ws6 = wb.create_sheet("הרשאות ותפקידים")
    add_header_row(ws6, ["קובץ", "תוכנית", "תפקיד", "תיאור תפקיד", "ישות", "קריאה", "יצירה", "עדכון", "מחיקה"])

    i = 0
    for a in analyses:
        for p in a.get('permissions', []):
            ws6.append([
                a.get('filename', ''), a.get('program_name', ''),
                p.get('role', ''), p.get('description', ''), p.get('entity', ''),
                p.get('read', ''), p.get('create', ''),
                p.get('update', ''), p.get('delete', ''),
            ])
            for c in ws6[ws6.max_row]: cell_style(c, alt=(i % 2 == 0))
            i += 1

    set_col_widths(ws6, {'A':20,'B':20,'C':25,'D':40,'E':20,'F':12,'G':12,'H':12,'I':12})

    # ── 7. Integrations ───────────────────────────────────────────────────────
    ws7 = wb.create_sheet("אינטגרציות")
    add_header_row(ws7, ["קובץ", "תוכנית", "מערכת", "כיוון", "נתונים", "תדירות", "הערות"])

    i = 0
    for a in analyses:
        for intg in a.get('integrations', []):
            ws7.append([
                a.get('filename', ''), a.get('program_name', ''),
                intg.get('system', ''), intg.get('direction', ''),
                intg.get('data', ''), intg.get('frequency', ''), intg.get('notes', ''),
            ])
            for c in ws7[ws7.max_row]: cell_style(c, alt=(i % 2 == 0))
            i += 1

    set_col_widths(ws7, {'A':20,'B':20,'C':25,'D':15,'E':50,'F':18,'G':40})

    # ── 8. Call Graph ─────────────────────────────────────────────────────────
    ws8 = wb.create_sheet("גרף קריאות")
    add_header_row(ws8, ["קובץ מקור", "תוכנית מקור", "סוג", "קובץ/תוכנית יעד", "מטרה"])

    i = 0
    for a in analyses:
        for dep in a.get('dependencies', []):
            ws8.append([
                a.get('filename', ''), a.get('program_name', ''),
                dep.get('type', ''), dep.get('name', ''), dep.get('purpose', ''),
            ])
            for c in ws8[ws8.max_row]: cell_style(c, alt=(i % 2 == 0))
            i += 1

    set_col_widths(ws8, {'A':25,'B':25,'C':15,'D':25,'E':50})

    # ── 9. Glossary ───────────────────────────────────────────────────────────
    ws9 = wb.create_sheet("גלוסרי")
    add_header_row(ws9, ["מונח", "הגדרה", "קובץ"])

    seen  = set()
    i = 0
    for a in analyses:
        for g in a.get('glossary', []):
            term = g.get('term', '')
            if term and term not in seen:
                seen.add(term)
                ws9.append([term, g.get('definition', ''), a.get('filename', '')])
                for c in ws9[ws9.max_row]: cell_style(c, alt=(i % 2 == 0))
                i += 1

    set_col_widths(ws9, {'A':30,'B':65,'C':25})

    # ── 10. Open Questions ────────────────────────────────────────────────────
    ws10 = wb.create_sheet("שאלות פתוחות")
    add_header_row(ws10, ["קובץ", "תוכנית", "שאלה"])

    i = 0
    for a in analyses:
        for q in a.get('open_questions', []):
            ws10.append([a.get('filename', ''), a.get('program_name', ''), q])
            for c in ws10[ws10.max_row]: cell_style(c, alt=(i % 2 == 0))
            i += 1

    set_col_widths(ws10, {'A':25,'B':25,'C':80})

    wb.save(output_path)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 62)
    print("  Natural ADABAS → מחולל אפיון טכני  ")
    print("=" * 62)

    # ── Get API key ────────────────────────────────────────────────────────────
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        api_key = input("\nהכנס מפתח Gemini API: ").strip()
    if not api_key:
        print("שגיאה: מפתח API חסר. הפסקת הרצה.")
        sys.exit(1)

    # ── Find .txt files ────────────────────────────────────────────────────────
    txt_files = sorted(Path('.').glob('*.txt'))
    if not txt_files:
        print("לא נמצאו קבצי .txt בתיקייה הנוכחית.")
        sys.exit(1)

    print(f"\nנמצאו {len(txt_files)} קבצים:")
    for fp in txt_files:
        print(f"  {fp.name:35s}  {fp.stat().st_size/1024:.0f} KB")

    # ── PHASE 1: Static parse ──────────────────────────────────────────────────
    print("\n── שלב 1: ניתוח סטטי ────────────────────────────────────")
    files_data = []
    total_programs = 0
    for fp in txt_files:
        fd = parse_file(fp)
        files_data.append(fd)
        n_prog = len(fd['programs'])
        total_programs += n_prog
        print(f"  {fd['filename']:35s} "
              f"תוכניות: {n_prog:3d}  DDMs: {', '.join(fd['ddms']) or '—'}  "
              f"CALLNATs: {len(fd['callnats'])}")

    print(f"\n  סה\"כ תוכניות/שגרות: {total_programs}")

    # ── PHASE 2: Knowledge base ────────────────────────────────────────────────
    print("\n── שלב 2: בניית Knowledge Base ────────────────────────────")
    kb = build_knowledge_base(files_data)
    print(f"  DDMs ייחודיים: {len(kb['all_ddms'])}")
    print(f"  קשרי CALLNAT:  {sum(len(v) for v in kb['call_graph'].values())}")

    kb_path = Path('knowledge_base.json')
    with open(kb_path, 'w', encoding='utf-8') as f:
        json.dump(kb, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {kb_path} נשמר")

    # ── PHASE 3: Gemini analysis ───────────────────────────────────────────────
    print(f"\n── שלב 3: ניתוח AI ({total_programs} תוכניות) ────────────────────")
    analyses  = []
    ddm_cache = {}          # DDM name → field list, built as we go
    errors    = 0
    prog_num  = 0

    for fd in files_data:
        for prog in fd['programs']:
            prog_num += 1
            label = f"[{prog_num}/{total_programs}] {fd['filename']} › {prog['name']}"
            print(f"  {label}")

            try:
                prompt   = build_program_prompt(fd, prog, kb, ddm_cache)
                print(f"    ⏳ שולח ל-Gemini", end="", flush=True)
                with _Spinner(interval=4):
                    raw_resp = call_gemini(api_key, prompt)
                cleaned  = strip_json_fences(raw_resp)
                analysis = json.loads(cleaned)
                analyses.append(analysis)

                # Cache any DDM field definitions we got back
                for e in analysis.get('entities', []):
                    ddm_cache[e['name']] = e

                n_req  = sum(len(wf.get('business_rules', [])) for wf in analysis.get('workflows', []))
                n_wf   = len(analysis.get('workflows', []))
                n_ent  = len(analysis.get('entities', []))
                print(f"    ✓ ישויות:{n_ent}  זרימות:{n_wf}  חוקים:{n_req}  "
                      f"מורכבות:{analysis.get('complexity','')}")

            except json.JSONDecodeError as e:
                print(f"    ⚠ JSON parse error: {e}")
                analyses.append({'filename': fd['filename'], 'program_name': prog['name'],
                                 'error': f"JSON parse: {e}"})
                errors += 1
            except Exception as e:
                print(f"    ⚠ {e}")
                analyses.append({'filename': fd['filename'], 'program_name': prog['name'],
                                 'error': str(e)})
                errors += 1

            time.sleep(API_DELAY)

    # Save raw analyses
    analyses_path = Path('analyses.json')
    with open(analyses_path, 'w', encoding='utf-8') as f:
        json.dump(analyses, f, ensure_ascii=False, indent=2)
    print(f"\n  ✓ {analyses_path} נשמר")

    # ── PHASE 4: Build Excel ───────────────────────────────────────────────────
    print("\n── שלב 4: בניית Excel ─────────────────────────────────────")
    output_path = Path('natural_adabas_spec.xlsx')
    build_excel(analyses, kb, output_path)

    # ── Summary ────────────────────────────────────────────────────────────────
    print("\n" + "=" * 62)
    print("  הושלם!")
    print(f"  ✓ {output_path}")
    print(f"  ✓ {kb_path}")
    print(f"  ✓ {analyses_path}")
    if errors:
        print(f"  ⚠ {errors} תוכניות נכשלו — בדוק analyses.json")

    # Print sheet summary
    successful = [a for a in analyses if 'error' not in a]
    total_entities  = sum(len(a.get('entities', []))    for a in successful)
    total_fields    = sum(len(f) for a in successful
                          for e in a.get('entities', [])
                          for f in [e.get('fields', [])])
    total_workflows = sum(len(a.get('workflows', []))   for a in successful)
    total_rules     = sum(len(wf.get('business_rules', []))
                          for a in successful for wf in a.get('workflows', []))
    total_perms     = sum(len(a.get('permissions', [])) for a in successful)

    print(f"\n  סטטיסטיקות:")
    print(f"    תוכניות שנותחו:  {len(successful):>5}")
    print(f"    ישויות (DDMs):   {total_entities:>5}")
    print(f"    שדות:            {total_fields:>5}")
    print(f"    זרימות עבודה:    {total_workflows:>5}")
    print(f"    חוקי עסק:        {total_rules:>5}")
    print(f"    הרשאות:          {total_perms:>5}")
    print("=" * 62)


if __name__ == "__main__":
    main()

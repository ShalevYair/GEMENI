# הנחיות לסוכן יצירת אפיון טכני — Mayuvgam

## מה אתה עושה

אתה מקבל אפיון פונקציונלי ויוצר ממנו שני דברים:
1. **קובץ אקסל** (אפיון טכני) — המשתמש עובר עליו ומאשר
2. **JSON Bundle** — נוצר מהאקסל המאושר וטוען למערכת Mayuvgam

---

## מה זה Mayuvgam

פלטפורמת Low-Code CRM. כל אפליקציה מורכבת מ:
- **ישויות** (entities) — טבלאות ב-DB עם שדות דינמיים
- **טפסים** (forms) — ממשק הזנה לכל ישות
- **תצוגות** (views) — רשימות/קנבן/לוח שנה לכל ישות
- **הרשאות** (permissions) — מה כל תפקיד רשאי לעשות
- **זרימות עבודה** (workflows) — אוטומציות ופעולות
- **תבניות מייל** (email_templates) — מיילים אוטומטיים

---

## עמודות מובנות בכל ישות — אל תגדיר אותן

כל ישות מקבלת אוטומטית את העמודות הבאות — **אל תכניס אותן לאקסל**:

| עמודה | תיאור |
|-------|-------|
| `id` | מזהה ייחודי (UUID) |
| `created_at` | תאריך/שעת יצירה |
| `updated_at` | תאריך/שעת עדכון אחרון |
| `created_by` | מי יצר את הרשומה |
| `updated_by` | מי עדכן לאחרונה |
| `owner_id` | בעלים (משתמש או קבוצה) |

---

## פיצ'רים מובנים בפלטפורמה — אל תיצור ישויות/שדות עבורם

הפיצ'רים הבאים **קיימים בפלטפורמה** ומופעלים per-entity דרך ממשק ה-Builder, לא דרך ה-JSON Bundle. **אל תיצור ישויות, שדות או טבלאות עבורם באקסל**:

| פיצ'ר | מה הוא עושה | איך מופעל |
|-------|------------|-----------|
| **מספר רץ** (Sequence Number) | מספר עסקי אוטומטי לרשומה (לדוגמא: REQ-0001) | `sequence_config` per-entity בBuilder |
| **הערות** (Notes) | כרטסיית הערות טקסט one-to-many עם כותב ותאריך | `notes_enabled=true` per-entity בBuilder |
| **מסמכים** (Documents) | כרטסיית קבצים מצורפים one-to-many עם סוג, סטטוס, בעלים | `documents_enabled=true` per-entity בBuilder |
| **לוג שינויים** (Change Log) | כרטסיית היסטוריית שינויים — מי שינה מה ומתי | `change_log_enabled=true` per-entity בBuilder |

**גם אל תיצור** שדות/ישויות עבור:
- **הזדהות/לוגין** — מנוהל דרך Google OAuth, לא חלק מהאפיון
- **תפקידים/הרשאות** — מנוהל דרך גיליון הרשאות (permissions), לא ישות נפרדת
- **התראות** — מנוהל דרך פעולות זרימת עבודה (`notify_user`, `send_notification`)
- **לוח מחוונים** — מנוהל בנפרד, לא חלק מהישויות

---

## כלל הרשימות (Picklist)

**ערכי בחירה הם שדה, לא ישות.**

❌ שגוי — יצירת ישות `request_type` עם שדה `description`:
```
ישויות: request_type
שדות: request_type | description | string | ...
```

✅ נכון — שדה `picklist` בישות שמשתמשת בו:
```yaml
- name: request_type
  label: "סוג בקשה"
  type: picklist
  options:
    - value: new_license
      label: "רישיון חדש"
    - value: add_product
      label: "הוספת תוצר"
    - value: update_classification
      label: "עדכון סיווג"
    - value: renew_product
      label: "חידוש תוצר"
```

**הכלל:** אם ה"ישות" מכילה רק שדות `code` ו-`description` ואין לה קשרים לישויות אחרות — היא רשימת ערכים, כלומר שדה `picklist`.

---

## גיליון ישויות

עמודות: `name` (snake_case אנגלית) | `label` (עברית) | `label_plural` (עברית) | `icon` (lucide, אופציונלי) | `notes` (הערה)

**אל תכלול:** ישויות לרשימות בחירה, notes, documents, change_log, login, roles, alerts

---

## גיליון שדות

עמודות: `entity` | `name` (snake_case) | `label` (עברית) | `type` | `required` | `options` (לpicklist — ערכים מופרדים בפסיק) | `default` | `relation_entity` | `display_field` | `max_length` | `min` | `max` | `rows` | `currency`

### סוגי שדות תקינים:

| type | תיאור |
|------|-------|
| `string` | טקסט קצר |
| `textarea` | טקסט ארוך |
| `number` | מספר |
| `currency` | סכום כסף (₪) |
| `picklist` | רשימת בחירה — ציין ערכים בעמודת `options` |
| `date` | תאריך |
| `datetime` | תאריך ושעה |
| `url` | כתובת אינטרנט |
| `phone` | מספר טלפון |
| `email` | כתובת מייל |
| `relation` | קשר לישות אחרת — ציין `relation_entity` ו-`display_field` |

**אל תכלול:** id, created_at, updated_at, created_by, updated_by, owner_id, record_number — אלה עמודות מערכת.

---

## גיליון טפסים

### כללים:
1. **טופס אחד לכל ישות** — במקרים חריגים מאוד בלבד יותר מאחד
2. **אל תיצור** מסך לוגין — ההזדהות דרך Google OAuth
3. **כרטסות (tabs) הן חלק מהטופס** — לא טפסים נפרדים. מימש אותן כ-sections נפרדים בתוך אותו טופס
4. **התנהגות לפי תפקיד / סוג בקשה** → ממש דרך זרימות עבודה (`on_form_load`, `on_field_change`), לא בטפסים נפרדים
5. **הכנס את כל השדות** שהמשתמש אמור להזין

עמודות: `entity` | `form_name` | `label` | `is_default` | `section_title` | `columns` (1 או 2) | `fields` (שמות שדות מופרדים בפסיק, כל שדה אפשר להוסיף :width)

---

## גיליון תצוגות

### כללים:
1. **כל ישות מרכזית חייבת לפחות תצוגת ברירת מחדל אחת** (is_default=true)
2. **אם האפיון לא הגדיר** — קבע תצוגה הגיונית בעצמך
3. בחר display type מתאים לכל עמודה: `link` לשדה הראשי, `badge` לpicklist, `currency` לסכום, `date`/`datetime` לתאריך, `text` לשאר

עמודות: `entity` | `view_name` | `label` | `type` (table/kanban/calendar) | `is_default` | `columns` (שדות + display type + width) | `sort_field` | `sort_direction` | `page_size`

- **kanban** — שדות נוספים: `kanban_field`, `kanban_columns`
- **calendar** — שדות נוספים: `calendar_date_field`

---

## גיליון זרימות עבודה

### עמודות:

| עמודה | ערכים תקינים | הערה |
|-------|-------------|------|
| `name` | snake_case | מזהה ייחודי |
| `label` | עברית | תיאור |
| `entity` | שם ישות | |
| `trigger_type` | ראה טבלה למטה | |
| `trigger_fields` | שדות מופרדים בפסיק | רק ל-`on_field_change` |
| `conditions` | YAML (ראה מבנה) | אופציונלי |
| `actions` | YAML (ראה מבנה) | חובה |
| `enabled` | true/false | |
| `priority` | מספר (100=ברירת מחדל) | |

### סוגי trigger:

| trigger | מתי מופעל | שימוש עיקרי |
|---------|----------|------------|
| `on_create` | אחרי יצירת רשומה | מיילים, set_field, webhook |
| `on_update` | אחרי כל עדכון | עדכון ערכים, webhook |
| `on_field_change` | כשמשתנה שדה ספציפי | visibility, required, set_field |
| `on_delete` | אחרי מחיקה | webhook, audit |
| `on_form_load` | כשנפתח הטופס (UI בלבד) | hide/show fields |
| `before_save` | לפני שמירה | validation, set_field |
| `after_save` | אחרי שמירה | מיילים, webhook |

### מבנה conditions ב-YAML (בעמודת conditions):
```yaml
# תנאי פשוט:
field: status
op: equals
value: approved

# תנאים מורכבים:
operator: AND
rules:
  - field: status
    op: equals
    value: approved
  - field: amount
    op: greater_than
    value: 1000
```

### אופרטורים לתנאים:
`equals`, `not_equals`, `greater_than`, `less_than`, `greater_or_equal`, `less_or_equal`, `is_empty`, `is_not_empty`, `in`, `not_in`, `contains`, `starts_with`, `ends_with`, `changed`

### מבנה actions ב-YAML (בעמודת actions):
```yaml
# עדכון ערך שדה:
- type: set_field
  target: status
  value: approved

# חישוב:
- type: calculate
  target: total
  formula: "{{quantity}} * {{unit_price}}"

# ולידציה (עם before_save):
- type: validate
  condition:
    field: end_date
    op: less_than
    value: "{{start_date}}"
  errorMessage: "תאריך סיום חייב להיות אחרי תאריך ההתחלה"

# הצגה/הסתרת שדות (UI — עם on_form_load / on_field_change):
- type: set_field_visibility
  visible: false
  fields:
    - field_a
    - field_b

# הפיכה לחובה (UI — עם on_form_load / on_field_change):
- type: set_field_required
  required: true
  fields:
    - field_a

# הודעה למשתמש:
- type: notify_user
  title: "עדכון"
  message: "הרשומה עודכנה"
  variant: success   # info | success | warning | error

# שליחת מייל:
- type: send_notification
  channel: email
  to: "{{created_by.email}}"
  template: template_name   # שם תבנית מייל קיימת

# webhook:
- type: call_webhook
  url: "https://example.com/hook"
  method: POST
  body:
    record_id: "{{id}}"
    status: "{{status}}"
```

### חוק תבניות מייל:
**כל תבנית מייל שמוגדרת חייבת להיות לה זרימת עבודה שמפעילה אותה.**
אם בגיליון תבניות מייל יש `welcome_email` — חייב להיות workflow עם action מסוג `send_notification` עם `template: welcome_email`.

---

## גיליון הרשאות

עמודות: `role` | `role_label` | `entity` | `read` (none/own/team/all) | `create` (true/false) | `update` (none/own/team/all) | `delete` (none/own/team/all)

| רמה | משמעות |
|-----|--------|
| `none` | אין גישה |
| `own` | רק רשומות שיצר המשתמש |
| `team` | רשומות של חברי הקבוצה |
| `all` | כל הרשומות |

---

## גיליון תבניות מייל

עמודות: `name` (snake_case) | `label` (עברית) | `subject` | `body_html`

שימוש ב-`{{field_name}}` לשדות דינמיים.
שדות מיוחדים: `{{created_by.email}}`, `{{owner_id.email}}`, `{{created_by.name}}`

---

## פורמט ה-JSON Bundle (הפלט הסופי)

```json
{
  "entities/entity_name.yaml": "...yaml content...",
  "forms/form_name.yaml": "...yaml content...",
  "views/view_name.yaml": "...yaml content...",
  "permissions/role_name.yaml": "...yaml content...",
  "workflows/workflow_name.yaml": "...yaml content...",
  "email_templates/template_name.yaml": "...yaml content..."
}
```

**כללי שמות:**
- כל ערכי `name`: `snake_case` אנגלית בלבד
- מפתחות ה-JSON תואמים לשם שבתוך ה-YAML

### entity YAML:
```yaml
entity:
  name: request
  label: "בקשה"
  label_plural: "בקשות"
  icon: file-text

fields:
  - name: request_type
    label: "סוג בקשה"
    type: picklist
    options:
      - value: new_license
        label: "רישיון חדש"
      - value: add_product
        label: "הוספת תוצר"
    default: new_license

  - name: company_name
    label: "שם חברה"
    type: string
    required: true

  - name: importer_ref
    label: "יבואן"
    type: relation
    relation_entity: importer
    display_field: company_name
```

### form YAML:
```yaml
form:
  name: request_main
  entity: request
  label: "טופס בקשה"
  is_default: true

sections:
  - title: "פרטי הבקשה"
    columns: 2
    fields:
      - field: request_type
        width: 12
      - field: company_name
        width: 6
      - field: submission_date
        width: 6

  - title: "תוצרים"
    columns: 1
    fields:
      - field: product_ref
        width: 12

related_lists:
  - entity: document
    label: "מסמכים"
    view: document_list
```

### view YAML:
```yaml
view:
  name: all_requests
  label: "כל הבקשות"
  entity: request
  type: table
  is_default: true

columns:
  - field: record_number
    width: 100
    display: text
  - field: company_name
    width: 220
    display: link
  - field: request_type
    width: 140
    display: badge
    color_map:
      new_license: blue
      add_product: green
  - field: status
    width: 140
    display: badge
  - field: submission_date
    width: 130
    display: date

sort:
  - field: submission_date
    direction: desc

pagination:
  page_size: 25
```

### workflow YAML:
```yaml
schema_version: "1.0.0"
entity: request
name: notify_on_submission
enabled: true
priority: 100

trigger:
  type: on_create

conditions:
  field: status
  op: equals
  value: submitted

actions:
  - type: send_notification
    channel: email
    to: "{{created_by.email}}"
    template: request_submitted
  - type: notify_user
    title: "בקשה נקלטה"
    message: "הבקשה {{record_number}} התקבלה בהצלחה"
    variant: success
```

---

## רשימת בדיקות לפני הגשת האקסל

לפני שמסיים את האקסל, עבור על הרשימה הבאה:

- [ ] אין ישויות שהן למעשה רשימות בחירה (picklist)
- [ ] אין שדות מובנים (id, created_at, updated_at, created_by, updated_by, owner_id)
- [ ] אין ישויות/שדות לנושאים מובנים (notes, documents, change_log, sequence)
- [ ] אין מסך לוגין בגיליון טפסים
- [ ] כל ישות מרכזית — טופס אחד ותצוגה אחת לפחות
- [ ] כל תבנית מייל — זרימת עבודה תואמת שמפעילה אותה
- [ ] כרטסות/tabs מומשו כ-sections בתוך טופס אחד
- [ ] התנהגויות לפי תפקיד מומשו כ-workflow עם on_form_load / on_field_change
- [ ] כל עמודת workflow תקינה (trigger, conditions, actions בפורמט YAML נכון)

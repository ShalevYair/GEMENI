# Mayuvgam Platform — AI Configuration Guide

## What Are These Files?

You will receive up to three inputs:
1. **`AI_INSTRUCTIONS.md`** (this file) — complete reference for all types and formats
2. **`mayuvgam-examples.json`** — working examples of every configuration type
3. **`mayuvgam-current.json`** — the current live app state (downloaded from Builder)

Your job: produce an updated `mayuvgam-current.json` based on the user's requirements.

---

## How to Respond

- Return **only** the JSON — no explanation before or after
- Keep all existing keys unless explicitly asked to remove them
- Add new keys as needed
- Ensure all YAML values are valid (quote strings with special chars, correct indentation)
- Never change the `name` of an existing entity — it maps to a real DB table

---

## Bundle Format

```json
{
  "entities/snake_case_name.yaml":        "...yaml...",
  "forms/snake_case_name.yaml":           "...yaml...",
  "views/snake_case_name.yaml":           "...yaml...",
  "permissions/role_name.yaml":           "...yaml...",
  "workflows/snake_case_name.yaml":       "...yaml...",
  "email_templates/snake_case_name.yaml": "...yaml..."
}
```

**Naming rules:**
- All `name` values: `snake_case`, English only (e.g. `customer_order`)
- Keys follow the same pattern as the `name` field inside the YAML

---

## Field Types

| Type | Description | Extra options |
|------|-------------|---------------|
| `string` | Short text | `max_length`, `required` |
| `textarea` | Long text | `rows` |
| `number` | Integer or decimal | `min`, `max` |
| `currency` | Monetary value (₪) | `currency: ILS` |
| `picklist` | Dropdown from fixed list | `options` (list of `{value, label}`), `default` |
| `date` | Date only | — |
| `datetime` | Date + time | — |
| `url` | Web address | — |
| `phone` | Phone number | — |
| `email` | Email address | — |
| `relation` | Link to another entity's record | `relation_entity`, `display_field` |

---

## entities/name.yaml

```yaml
entity:
  name: project
  label: "פרויקט"
  label_plural: "פרויקטים"
  icon: "folder"

fields:
  - name: title
    label: "כותרת"
    type: string
    required: true
    max_length: 200

  - name: description
    label: "תיאור"
    type: textarea
    rows: 4

  - name: status
    label: "סטטוס"
    type: picklist
    options:
      - value: open
        label: "פתוח"
      - value: in_progress
        label: "בעבודה"
      - value: closed
        label: "סגור"
    default: open

  - name: budget
    label: "תקציב"
    type: currency
    currency: ILS

  - name: due_date
    label: "תאריך יעד"
    type: date

  - name: owner_ref
    label: "לקוח"
    type: relation
    relation_entity: account
    display_field: name
```

---

## forms/name.yaml

```yaml
form:
  name: project_main
  entity: project
  label: "טופס פרויקט"
  is_default: true

sections:
  - title: "פרטים כלליים"
    columns: 2
    fields:
      - field: title
        width: 12
      - field: status
        width: 6
      - field: due_date
        width: 6

  - title: "כספים"
    columns: 1
    fields:
      - field: budget
        width: 12

related_lists:
  - entity: task
    label: "משימות"
    view: task_list
```

---

## views/name.yaml

### Table view

```yaml
view:
  name: all_projects
  label: "כל הפרויקטים"
  entity: project
  type: table
  is_default: true

columns:
  - field: title
    width: 280
    display: link
  - field: status
    width: 140
    display: badge
    color_map:
      open: green
      in_progress: blue
      closed: gray
  - field: budget
    width: 120
    display: currency
  - field: due_date
    width: 120
    display: date

sort:
  - field: due_date
    direction: asc

pagination:
  page_size: 25
```

### Kanban view

```yaml
view:
  name: project_kanban
  label: "לוח קנבן"
  entity: project
  type: kanban
  is_default: false

kanban_field: status
kanban_columns:
  - open
  - in_progress
  - closed

columns:
  - field: title
    display: link
  - field: due_date
    display: date
```

### Calendar view

```yaml
view:
  name: project_calendar
  label: "לוח שנה"
  entity: project
  type: calendar
  is_default: false

calendar_date_field: due_date

columns:
  - field: title
    display: link
```

---

## permissions/role_name.yaml

```yaml
role:
  name: manager
  label: "מנהל"

permissions:
  project:
    read:   all
    create: true
    update: all
    delete: own
  account:
    read:   all
    create: true
    update: team
    delete: none
```

Permission levels:
- `none` — no access
- `own` — only records the user created
- `team` — records owned by members of the user's group
- `all` — all records

---

## workflows/name.yaml

### Trigger types

| Type | When it fires |
|------|---------------|
| `on_create` | After a new record is saved |
| `on_update` | After any field changes |
| `on_field_change` | After a specific field changes |
| `on_delete` | After a record is deleted |
| `on_form_load` | When the form opens (UI only) |
| `before_save` | Before the record is written |
| `after_save` | After the record is written |

### Condition operators

`equals`, `not_equals`, `greater_than`, `less_than`, `greater_or_equal`, `less_or_equal`, `is_empty`, `is_not_empty`, `in`, `not_in`, `contains`, `starts_with`, `ends_with`, `changed`

### Action types

- `set_field` — set a field value (static or `"{{field_name}}"` template)
- `calculate` — numeric formula using `{{field}}` references
- `validate` — block save with error message (use with `before_save`)
- `notify_user` — in-app toast (variants: `info`, `success`, `warning`, `error`)
- `send_notification` — email/sms/in_app via template
- `call_webhook` — HTTP request with headers and body
- `set_field_visibility` — show/hide fields (use with `on_form_load`/`on_field_change`)
- `set_field_required` — make fields mandatory/optional
- `run_workflow` — chain another workflow

### Complete workflow example

```yaml
schema_version: "1.0.0"
entity: project
name: notify_on_create
enabled: true
priority: 100
trigger:
  type: on_create
actions:
  - type: send_notification
    channel: email
    to: "{{created_by.email}}"
    template: project_created
  - type: notify_user
    title: "פרויקט נוצר"
    message: "הפרויקט {{title}} נפתח בהצלחה"
    variant: success
```

---

## email_templates/name.yaml

```yaml
email_template:
  name: welcome_email
  label: "מייל ברוך הבא"

subject: "ברוך הבא, {{company_name}}!"

body_html: |
  <h2>שלום {{contact_name}},</h2>
  <p>פתחנו עבורך רשומה חדשה במערכת.</p>
  <p>סטטוס: <strong>{{status}}</strong></p>
```

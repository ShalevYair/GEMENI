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
  name: project          # unique, snake_case, English
  label: "פרויקט"
  label_plural: "פרויקטים"
  icon: "folder"         # lucide icon name (optional)

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
    relation_entity: account   # name of the related entity
    display_field: name        # field from related entity to display
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
    columns: 2          # 1 or 2
    fields:
      - field: title
        width: 12       # 1-12; 12 = full width, 6 = half (when columns: 2)
      - field: status
        width: 6
      - field: due_date
        width: 6

  - title: "כספים"
    columns: 1
    fields:
      - field: budget
        width: 12

related_lists:          # optional: show child records inline
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
    display: link       # link | text | badge | currency | date | datetime
  - field: status
    width: 140
    display: badge
    color_map:          # color per picklist value
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
    direction: asc      # asc | desc

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

kanban_field: status        # picklist field used as columns
kanban_columns:
  - open
  - in_progress
  - closed

columns:                    # fields shown on each card
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

calendar_date_field: due_date  # date or datetime field

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
    read:   all    # none | own | team | all
    create: true   # true | false
    update: all    # none | own | team | all
    delete: own    # none | own | team | all
  account:
    read:   all
    create: true
    update: team
    delete: none
```

Permission levels:
- `none` — no access
- `own` — only records the user created (`owner_id = me`)
- `team` — records owned by members of the user's group
- `all` — all records

---

## workflows/name.yaml

### Trigger types

| Type | When it fires | Notes |
|------|---------------|-------|
| `on_create` | After a new record is saved | — |
| `on_update` | After any field changes | — |
| `on_field_change` | After a specific field changes | Add `fields: [field_name]` |
| `on_delete` | After a record is deleted | Actions cannot modify the record |
| `on_form_load` | When the form opens (UI only) | Use for visibility/required rules |
| `before_save` | Before the record is written | Use for validate + set_field |
| `after_save` | After the record is written | Use for notifications/webhooks |

### Conditions

```yaml
conditions:
  operator: AND          # AND | OR | NOT
  rules:
    - field: status
      op: equals
      value: closed

    - operator: OR       # nested group
      rules:
        - field: budget
          op: greater_than
          value: 50000
        - field: priority
          op: equals
          value: high
```

#### Condition operators

| Operator | Description | value required? |
|----------|-------------|-----------------|
| `equals` | exact match | yes |
| `not_equals` | not equal | yes |
| `greater_than` | > (number or date) | yes |
| `less_than` | < (number or date) | yes |
| `greater_or_equal` | >= | yes |
| `less_or_equal` | <= | yes |
| `is_empty` | null or empty string | no |
| `is_not_empty` | not null and not empty | no |
| `in` | value in list | yes (array or comma-separated string) |
| `not_in` | value not in list | yes |
| `contains` | string contains substring | yes |
| `starts_with` | string starts with | yes |
| `ends_with` | string ends with | yes |
| `changed` | field value changed (on_update only) | no |

### Actions

#### set_field — set a field value

```yaml
- type: set_field
  target: status         # field name on this entity
  value: closed          # static value
```

Dynamic value using another field:
```yaml
- type: set_field
  target: summary
  value: "{{title}} - {{status}}"
```

#### calculate — numeric formula

```yaml
- type: calculate
  target: total_price
  formula: "{{quantity}} * {{unit_price}}"
```

Supported operators: `+`, `-`, `*`, `/`, `()`

#### validate — block save with error

```yaml
- type: validate
  condition:
    field: end_date
    op: less_than
    value: "{{start_date}}"
  errorMessage: "תאריך סיום חייב להיות אחרי תאריך התחלה"
```

Use with `before_save` trigger. If condition is true → save is blocked with the message.

#### notify_user — in-app toast notification

```yaml
- type: notify_user
  title: "עדכון"
  message: "הרשומה עודכנה בהצלחה"
  variant: success       # info | success | warning | error
```

#### send_notification — email / SMS / in-app

```yaml
- type: send_notification
  channel: email         # email | sms | in_app
  to: "{{owner_id.email}}"    # dynamic field reference
  template: welcome_email     # name of an email_template
```

Common `to` patterns:
- `"{{created_by.email}}"` — record creator's email
- `"{{owner_id.email}}"` — record owner's email
- `"manager@company.com"` — static address

#### call_webhook — HTTP request

```yaml
- type: call_webhook
  url: "https://hooks.example.com/notify"
  method: POST           # GET | POST | PUT | PATCH | DELETE
  headers:
    Authorization: "Bearer {{env.WEBHOOK_SECRET}}"
    Content-Type: "application/json"
  body:
    record_id: "{{id}}"
    status: "{{status}}"
    updated_by: "{{updated_by}}"
```

#### set_field_visibility — show/hide fields (on_form_load / on_field_change)

```yaml
- type: set_field_visibility
  visible: false
  fields:
    - internal_notes
    - admin_only_field
```

#### set_field_required — make fields mandatory/optional

```yaml
- type: set_field_required
  required: true
  fields:
    - phone
    - company_name
```

#### run_workflow — chain another workflow

```yaml
- type: run_workflow
  workflow_id: "abc123-workflow-id"
  workflow_name: "שם הזרימה (לתצוגה בלבד)"
```

⚠️ **Loop warning:** do not create circular chains (A → B → A).

---

## email_templates/name.yaml

```yaml
email_template:
  name: welcome_email    # unique, snake_case, English
  label: "מייל ברוך הבא"

subject: "ברוך הבא, {{company_name}}!"

body_html: |
  <h2>שלום {{applicant_first_name}},</h2>
  <p>פתחנו עבורך רשומה חדשה במערכת.</p>
  <p>מספר רישיון: <strong>{{license_number}}</strong></p>
  <p>סטטוס נוכחי: <em>{{status}}</em></p>
  <hr>
  <p>לכל שאלה פנו אלינו.</p>
```

Dynamic fields: use `{{field_name}}` anywhere in subject or body.
For related-entity fields: `{{owner_id.email}}`, `{{created_by.name}}`.

---

## Complete workflow examples

### Example 1 — on_create with email notification

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

### Example 2 — before_save validation

```yaml
schema_version: "1.0.0"
entity: project
name: validate_dates
enabled: true
priority: 10
trigger:
  type: before_save
actions:
  - type: validate
    condition:
      field: end_date
      op: less_than
      value: "{{start_date}}"
    errorMessage: "תאריך סיום חייב להיות אחרי תאריך ההתחלה"
```

### Example 3 — on_field_change with visibility

```yaml
schema_version: "1.0.0"
entity: project
name: toggle_fields_on_type
enabled: true
priority: 100
trigger:
  type: on_field_change
  fields:
    - project_type
conditions:
  field: project_type
  op: equals
  value: internal
actions:
  - type: set_field_visibility
    visible: false
    fields:
      - client_name
      - contract_number
  - type: set_field_required
    required: false
    fields:
      - client_name
```

### Example 4 — on_update with complex conditions + webhook

```yaml
schema_version: "1.0.0"
entity: project
name: alert_on_overdue
enabled: true
priority: 50
trigger:
  type: on_update
conditions:
  operator: AND
  rules:
    - field: status
      op: not_equals
      value: closed
    - field: due_date
      op: less_than
      value: "{{today}}"
    - operator: OR
      rules:
        - field: budget
          op: greater_than
          value: 100000
        - field: priority
          op: equals
          value: high
actions:
  - type: call_webhook
    url: "https://hooks.slack.com/services/XXX"
    method: POST
    body:
      text: "פרויקט {{title}} באיחור!"
  - type: set_field
    target: status
    value: overdue
```

### Example 5 — on_delete notification

```yaml
schema_version: "1.0.0"
entity: project
name: log_deletion
enabled: true
priority: 100
trigger:
  type: on_delete
actions:
  - type: call_webhook
    url: "https://audit.example.com/log"
    method: POST
    body:
      event: deleted
      record_id: "{{id}}"
      deleted_by: "{{updated_by}}"
```

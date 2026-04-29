# Prompt: Extract Salesforce Org → deployed.json

Use this prompt in **Claude Desktop** with a Salesforce MCP server connected. It will produce a `deployed.json` file matching the SF Architect Agent schema.

---

## Prompt to copy

```
You are connected to a Salesforce org via the SF MCP server. Your task is to produce a single deployed.json file that captures the current state of the org, formatted to be consumed by the SF Architect Agent (Israeli Ministry of Transportation).

Output: ONE JSON file matching the schema below. Do not include any prose outside the JSON.

## Schema

{
  "_metadata": {
    "captured_at": "<ISO-8601 datetime>",
    "source": "snapshot-builder",
    "api_version": "<API version used>",
    "edition": "<Salesforce edition>"
  },
  "objects": [
    {
      "api_name": "<Hebrew + __c, e.g. רישיון_רכב__c>",
      "label": "<Hebrew label>",
      "label_plural": "<Hebrew plural label>",
      "purpose": "<short business purpose>",
      "owd": "Private | Read | Read/Write | Public | ControlledByParent",
      "record_types": ["<list>"],
      "domain": "<business domain>"
    }
  ],
  "fields": [
    {
      "object": "<object api_name>",
      "api_name": "<field api_name>",
      "label": "<Hebrew label>",
      "type": "<Text(255) | Date | Picklist | Formula(Date) | Lookup(Account) | etc.>",
      "required": false,
      "unique": false,
      "default_value": null,
      "formula": null,
      "picklist_values": [],
      "help_text": "",
      "business_logic": "<why this field exists>",
      "fls_visible_to": ["<Permission Set api_names>"],
      "rtl": true
    }
  ],
  "automations": [
    {
      "type": "Flow | Apex | Approval Process | Validation Rule",
      "api_name": "<English api_name>",
      "object": "<object api_name or null>",
      "trigger": "Before Save | After Save | Scheduled | Platform Event | Record-Triggered",
      "purpose": "<short>",
      "active": true
    }
  ],
  "permissions": [
    {
      "type": "Permission Set | Permission Set Group | Profile",
      "api_name": "<English api_name>",
      "label": "<label>",
      "object_perms": [
        { "object": "<api_name>", "crud": "CRUD | RU | R" }
      ],
      "field_perms_count": 0,
      "assigned_users_count": 0
    }
  ],
  "integrations": [
    {
      "type": "Named Credential | External Credential | Connected App",
      "api_name": "<English api_name>",
      "endpoint": "<URL>",
      "auth_type": "OAuth | JWT | Named Principal | Anonymous",
      "used_by": ["<list of Apex classes / Flows>"]
    }
  ],
  "layouts": [
    {
      "type": "Page Layout | Lightning Page | Quick Action | LWC",
      "api_name": "<api_name>",
      "object": "<object api_name>",
      "purpose": "<short>"
    }
  ]
}

## Instructions

1. Use the SF MCP tools to query the org:
   - List all CUSTOM objects (skip standard objects unless heavily customized).
   - For each object: get its label, OWD, record types, all custom fields with their full metadata.
   - List all ACTIVE Flows, Apex Classes (signatures only), Approval Processes, Validation Rules.
   - List all Permission Sets and Permission Set Groups (skip system profiles).
   - List all Named Credentials, External Credentials, Connected Apps (DO NOT include secrets).
   - List Page Layouts and Lightning Pages per object.

2. Hebrew handling: object and field api_names should remain as they are in the org (typically Hebrew + __c). Labels are Hebrew.

3. Output: a single, valid JSON object. No markdown fences, no preamble, no explanation.

4. If a section has zero items in the org, return an empty array for that section — do not omit the key.

5. Save the output as deployed.json — I will upload it to the SF Architect Agent.
```

---

## How to use

1. Open Claude Desktop with the Salesforce MCP server configured and connected to your org.
2. Paste the prompt above.
3. Wait for Claude to query the org and produce the JSON.
4. Save the output as `deployed.json`.
5. Upload to the SF Architect Agent (this app).

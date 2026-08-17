# SuiteMigration Admin Toolkit — Deployment Guide

Step-by-step instructions to deploy and use the SuiteMigration Admin Toolkit (bulk record deletion) in your NetSuite account.

---

## 1. Overview

The toolkit safely deletes NetSuite records in bulk using a background process. It consists of two scripts:

| Script | Type | Purpose |
|--------|------|---------|
| `Del_SuiteLet.js` | Suitelet | User interface — select subsidiary, External ID criteria, record type and date filter; preview and confirm; watch progress |
| `Del_MapReduce.js` | Map/Reduce | Performs the bulk deletion asynchronously in the background |
| `SM_About.js` | Module | Content for the "About SuiteMigration" tab. Loaded by the Suitelet — no script record needed |

**How they work together:** the Suitelet collects your selection, then submits a Map/Reduce task with 7 script parameters. The Map/Reduce builds a saved search from those parameters and deletes the matching records. The Suitelet polls the task status to show live progress and the final deleted/failed counts.

> ⚠️ **Deletions are permanent and cannot be undone.** Test in a Sandbox account before running in Production.

---

## 2. Upload Script Files

1. Navigate to **Documents > Files > SuiteScripts**
2. Click **Add File** and upload all three files into the **same folder**:
   - `Del_SuiteLet.js`
   - `Del_MapReduce.js`
   - `SM_About.js`

> ⚠️ **All three files must be in the same File Cabinet folder.** `Del_SuiteLet.js` loads the
> About content with the relative path `./SM_About` — if that file is missing or sits in a
> different folder, the Suitelet will fail to load.
>
> Only `Del_SuiteLet.js` and `Del_MapReduce.js` need script records. `SM_About.js` is a plain
> module — upload it and nothing more.

## 3. Create the Map/Reduce Script

1. Navigate to **Customization > Scripting > Scripts > New**
2. Select the file `Del_MapReduce.js`
3. Click **Create Script Record**
4. Enter:
   - **Name:** `SuiteMigration Admin Toolkit – Delete Records` *(or any preferred name)*
   - **ID:** `_sm_toolkit_delete_mr` **(Mandatory — used in the code)**

> **Important:** Enter IDs **without** the `customscript_` / `custscript_` prefix. NetSuite adds it automatically.

---

## 4. Add Script Parameters

Go to the **Parameters** subtab and add all **7** parameters. All are **Free-Form Text**.

| # | Label *(any preferred name)* | ID **(Mandatory)** | Type | Purpose |
|---|------------------------------|--------------------|------|---------|
| 1 | Record Type | `_sm_recordtype` | Free-Form Text | Which record type to delete |
| 2 | Subsidiary | `_sm_subsidiary` | Free-Form Text | Internal ID of the target subsidiary |
| 3 | External ID | `_sm_externalid` | Free-Form Text | External ID criteria (`all` / `populated` / `blank` / `sm_match`) |
| 4 | Transaction Date From | `_sm_trandate_from` | Free-Form Text | Optional start of transaction date range |
| 5 | Transaction Date To | `_sm_trandate_to` | Free-Form Text | End of transaction date range |
| 6 | Created Date From | `_sm_createddate_from` | Free-Form Text | Optional start of creation date range |
| 7 | Created Date To | `_sm_createddate_to` | Free-Form Text | End of creation date range |

Click **Save**.

---

## 5. Deploy the Map/Reduce Script

1. Open the Map/Reduce script record
2. Click **Deploy Script**
3. Configure:
   - **Title:** `Delete Records Deployment` *(or any preferred title)*
   - **ID:** `_sm_toolkit_delete_mr` **(Mandatory — used in the code)**
   - **Log Level:** Debug
   - **Status:** Released
   - **Execute As Role:** Administrator *(or an appropriate role)*
4. Click **Save**

---

## 6. Create the Suitelet Script

1. Navigate to **Customization > Scripting > Scripts > New**
2. Select the file `Del_SuiteLet.js`
3. Click **Create Script Record**
4. Enter:
   - **Name:** `SuiteMigration Admin Toolkit` *(or any preferred name)*
   - **ID:** `_sm_toolkit_suitelet` *(any preferred ID — not referenced in code)*
5. Click **Save**

---

## 7. Deploy the Suitelet Script

1. Open the Suitelet script record
2. Click **Deploy Script**
3. Configure:
   - **Title:** `SuiteMigration Admin Toolkit` *(or any preferred title)*
   - **ID:** `_sm_toolkit_suitelet_deploy` *(any preferred ID)*
   - **Log Level:** Debug
   - **Status:** Released
   - **Execute As Role:** Administrator *(or an appropriate role)*
   - **Audience > Roles:** Administrator
4. Click **Save**

---

## 8. Using the Toolkit

1. Open the Suitelet deployment record
2. Copy the **External URL** (or Internal URL) and open it in your browser

The page has two tabs:

| Tab | Contents |
|-----|----------|
| **Delete Records** | The deletion form |
| **About SuiteMigration** | Product information and links |

### On the Delete Records tab

**Step 1 — Subsidiary** *(required)*
Select the target subsidiary. Only active subsidiaries are listed.

**Step 2 — External ID** *(required)* — which records to target, based on their External ID:

| Option | Deletes |
|--------|---------|
| All records (Blank + All populated values) | Every record, with or without an External ID |
| All populated values | Records that have an External ID (any value) |
| Blank | Records with no External ID |
| All populated values that match SuiteMigration | Records whose External ID matches the SuiteMigration format |

**Step 3 — Record Type** *(required)*
Choose a single record type, or a group option (see §9).

**Step 4 — Date Filter** *(required)*

| Option | Behaviour |
|--------|-----------|
| **Created Date** *(default)* | Filters by the date each record was created. Available for all record types |
| **Transaction Date** | Filters by transaction date. Available for transaction types only |
| **No Date Filter** | Deletes every matching record, with no date filtering |

If a date range is selected:
- The **To** date is **required**
- The **From** date is **optional** — leave it blank to delete everything up to and including the To date
- All dates are **inclusive** — both From and To fall within the range
- Date fields show a format hint matching your account's date preference (e.g. `MM/DD/YYYY` or `DD/MM/YYYY`)

**Step 5 — Preview Deletion**
The **Preview Deletion** button stays greyed out until Subsidiary, External ID and Record Type are selected (and a To date, if a date range is chosen).

Clicking it opens a **confirmation modal** showing exactly what will be deleted, with a permanent-action warning. Choose:
- **Cancel** — closes the modal, nothing is deleted
- **Delete Records** — starts the deletion

**Step 6 — Progress**
The Map/Reduce runs in the background and the page shows live progress:
- *"Scanning records…"* while the search runs
- *"Deleting: 8,400 of 20,000 records"* with a percentage that reflects the **actual number of records processed**
- On completion, a summary: **Total — Deleted: X · Failed: Y** (failures shown in red)

For group options, the page additionally shows:
- The record type currently being processed
- A per-type list with each type's own **Deleted / Failed** counts and status (Completed / Processing / Pending)
- Types with failures are highlighted so issues can be traced to the exact record type
- Types are processed one at a time in dependency order (payments before invoices, transactions before entities)

---

## 9. Supported Record Types

### Group options

| Option | Expands to |
|--------|-----------|
| **All Records** | All transactions (below) + Projects, Customers, Vendors, Employees, Items |
| **All Entities (Customers, Vendors, Employees, Items, Projects)** | Projects, Customers, Vendors, Employees, Items |
| **All Transactions (including Journal Entries)** | Deposits, Customer Payments, Credit Memos, Invoices, Cash Refunds, Cash Sales, Vendor Payments, Vendor Credits, Vendor Bills, Purchase Orders, Checks, Cash Expenses, Credit Card Refunds, Credit Card Charges, Transfers, Journal Entries, Journal Entries matching SuiteMigration Trial Balance push |

### Individual record types

**Entities** (Created Date filtering only — no transaction date):

| Label | Internal value |
|-------|----------------|
| Customers | `customer` |
| Vendors | `vendor` |
| Employees | `employee` |
| Items | `item` |
| Projects | `job` |

**Transactions** (support both Created Date and Transaction Date):

| Label | Internal value |
|-------|----------------|
| Invoices | `invoice` |
| Customer Payments | `customerpayment` |
| Credit Memos | `creditmemo` |
| Vendor Bills | `vendorbill` |
| Vendor Payments | `vendorpayment` |
| Vendor Credits | `vendorcredit` |
| Checks | `check` |
| Deposits | `deposit` |
| Cash Sales | `cashsale` |
| Cash Refunds | `cashrefund` |
| Cash Expenses | `cashexpense` |
| Credit Card Charges | `creditcardcharge` |
| Credit Card Refunds | `creditcardrefund` |
| Purchase Orders | `purchaseorder` |
| Transfers | `transfer` |
| Journal Entries | `journalentry` |
| Journal Entries matching SuiteMigration Trial Balance push | `journalentry_sm` |

---

## 10. Record Selection Criteria

Filters are combined with **AND** — a record is deleted only if it satisfies all applied conditions:

```
Subsidiary                              (always applied)
AND  Date filter                        (if Created Date or Transaction Date is selected)
AND  Record-type-specific condition     (only for the special types below)
AND  External ID condition              (unless "All records" is selected)
```

### External ID conditions

| Option | Filter applied |
|--------|----------------|
| All records (Blank + All populated values) | *(none)* |
| All populated values | `externalid IS NOT NULL` |
| Blank | `externalid IS NULL` |
| All populated values that match SuiteMigration | External ID matches the SuiteMigration format: `{org_id}__{source_id}__{prefix}_{id}` with prefixes `cmp_` / `txn_` / `itm_`, or begins with `sm_net` / `sm_rebuild` / `sm_manual` |

### Special record types

Three record types are not standard NetSuite record types — they are Checks or Journal Entries identified by a SuiteMigration External ID pattern:

| Toolkit record type | Stored in NetSuite as | Identified by External ID |
|---------------------|-----------------------|---------------------------|
| Cash Expenses | Check | ends with `__cex_chk` |
| Transfers | Journal Entry | ends with `__trf_jrn` |
| Journal Entries matching SuiteMigration Trial Balance push | Journal Entry | contains `sm_net` / `sm_rebuild` / `sm_manual` |

To keep them separate, the plain types explicitly exclude them:

| Record type | Also excludes |
|-------------|---------------|
| Checks | External IDs ending `__cex_chk` |
| Journal Entries | External IDs ending `__trf_jrn`, and those containing `sm_net` / `sm_rebuild` / `sm_manual` |

> **Note:** because these three types are defined by having a SuiteMigration External ID, selecting **Blank** with them correctly returns **no records** — a record with no External ID cannot be one of them.

### Date filtering details

- Only one date range applies at a time, chosen via the **Date Filter** dropdown
- **Transaction Date** applies to transaction types only. For entity types the option is unavailable; in a group deletion, entity types automatically fall back to **Created Date**
- **Created Date** searches `datecreated` for entities and transactions, and `created` for items
- The **From** date is optional; leave it blank to delete everything up to and including the **To** date
- All dates are inclusive

### Cascade behaviour

Deleting a **Customer** also deletes its sub-customers and contacts, and clears vendor/employee/subsidiary relationships that would otherwise block deletion. The number of records actually removed can therefore exceed the top-level count shown in the progress bar.

**Items** are searched across all item subtypes: Inventory, Non-Inventory, Service, Assembly, Kit and Group.

---

## 11. Required IDs Reference

These IDs are referenced in the code and **must match exactly**, or the tool will fail.

| Item | Enter in NetSuite | Final System ID |
|------|-------------------|-----------------|
| Map/Reduce Script | `_sm_toolkit_delete_mr` | `customscript_sm_toolkit_delete_mr` |
| Map/Reduce Deployment | `_sm_toolkit_delete_mr` | `customdeploy_sm_toolkit_delete_mr` |
| Parameter — Record Type | `_sm_recordtype` | `custscript_sm_recordtype` |
| Parameter — Subsidiary | `_sm_subsidiary` | `custscript_sm_subsidiary` |
| Parameter — External ID | `_sm_externalid` | `custscript_sm_externalid` |
| Parameter — Transaction Date From | `_sm_trandate_from` | `custscript_sm_trandate_from` |
| Parameter — Transaction Date To | `_sm_trandate_to` | `custscript_sm_trandate_to` |
| Parameter — Created Date From | `_sm_createddate_from` | `custscript_sm_createddate_from` |
| Parameter — Created Date To | `_sm_createddate_to` | `custscript_sm_createddate_to` |

> The Suitelet's own script and deployment IDs are **not** referenced in code — you may use any IDs for those.

---

## 12. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| *"Script not found"* / task fails to submit | Map/Reduce **Script ID** or **Deployment ID** does not match the table in §11 |
| *"Missing required parameters: record type or subsidiary"* | One or more script **parameter IDs** don't match §11, or parameters weren't saved on the script record |
| *"A delete task is already running"* | A previous Map/Reduce deployment is still processing — wait for it to finish |
| Progress completes but no **Deleted / Failed** counts shown | The counts are passed via `N/cache`; the page falls back to a plain "Completed" message. Check the Map/Reduce execution log for the `Summary` audit entry |
| Deletion returns 0 records | Check your filter combination — e.g. **Blank** External ID with Cash Expenses, Transfers or SM Trial Balance JEs correctly matches nothing (see §10) |
| Records fail to delete | Usually dependent records or references block deletion. Check the Map/Reduce execution log for `Delete Failed` entries |

### Modules used

Both scripts use standard NetSuite modules only — no external dependencies:

- **Suitelet:** `N/ui/serverWidget`, `N/task`, `N/log`, `N/search`, `N/url`, `N/runtime`, `N/format`, `N/cache`
- **Map/Reduce:** `N/search`, `N/record`, `N/runtime`, `N/log`, `N/cache`

---

*SuiteMigration Admin Toolkit · Publisher: SuiteMigration · Provided "AS IS" without warranty of any kind.*

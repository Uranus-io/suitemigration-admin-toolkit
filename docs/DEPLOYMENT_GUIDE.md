# SuiteMigration Admin Toolkit: Deployment Guide

How to install the toolkit in your NetSuite account, and how to use it once it's in. Budget about fifteen minutes for setup if you've deployed NetSuite scripts before.

---

## 1. Overview

Two scripts do the work.

| Script | Type | Purpose |
|--------|------|---------|
| `SuiteMigration_AdminToolkit_SuiteLet.js` | Suitelet | The user interface. Pick a subsidiary, External ID criteria, record type and date filter, confirm, then watch it run |
| `SuiteMigration_AdminToolkit_MapReduce.js` | Map/Reduce | Does the deleting, in the background |

The Suitelet takes what you selected and hands it to the Map/Reduce as seven script parameters. The Map/Reduce turns those into a saved search and deletes what it finds. While that happens the Suitelet polls the task status, which is how you get live progress and the deleted and failed counts at the end.

> ⚠️ **Deletions are permanent and cannot be undone.** Test in a Sandbox account before you run this in Production.

---

## 2. Upload Script Files

1. Go to **Documents > Files > SuiteScripts**
2. Click **Add File** and upload both:
   - `SuiteMigration_AdminToolkit_SuiteLet.js`
   - `SuiteMigration_AdminToolkit_MapReduce.js`

## 3. Create the Map/Reduce Script

1. Go to **Customization > Scripting > Scripts > New**
2. Select `SuiteMigration_AdminToolkit_MapReduce.js`
3. Click **Create Script Record**
4. Fill in:
   - **Name:** `SuiteMigration Admin Toolkit - Delete Records`, or whatever you like
   - **ID:** `_sm_toolkit_delete_mr`. **This one is mandatory.** The code looks for it by name

> **Watch out:** enter IDs **without** the `customscript_` or `custscript_` prefix. NetSuite adds that itself.

---

## 4. Add Script Parameters

Open the **Parameters** subtab and add all seven. Every one is **Free-Form Text**.

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
3. Set:
   - **Title:** `Delete Records Deployment`, or anything
   - **ID:** `_sm_toolkit_delete_mr`. **Mandatory**, same reason as above
   - **Log Level:** Debug
   - **Status:** Testing
   - **Execute As Role:** Administrator, or another role that can delete these records
4. Click **Save**

---

## 6. Create the Suitelet Script

1. Go to **Customization > Scripting > Scripts > New**
2. Select `SuiteMigration_AdminToolkit_SuiteLet.js`
3. Click **Create Script Record**
4. Fill in:
   - **Name:** `SuiteMigration Admin Toolkit`, or anything
   - **ID:** `_sm_toolkit_suitelet`, or any ID you like. Nothing in the code refers to it
5. Click **Save**

---

## 7. Deploy the Suitelet Script

1. Open the Suitelet script record
2. Click **Deploy Script**
3. Set:
   - **Title:** `SuiteMigration Admin Toolkit`, or anything
   - **ID:** `_sm_toolkit_suitelet_deploy`, or any ID
   - **Log Level:** Debug
   - **Status:** Released
   - **Execute As Role:** Administrator, or another appropriate role
   - **Audience > Roles:** Administrator
4. Click **Save**

---

## 8. Using the Toolkit

Open the Suitelet deployment record, copy the **External URL** (the Internal URL works too), and open it in your browser.

You get two tabs:

| Tab | Contents |
|-----|----------|
| **Delete Records** | The deletion form |
| **About SuiteMigration** | Product information and links |

### On the Delete Records tab

**Step 1: Subsidiary** *(required)*
Pick the target subsidiary. Only active ones are listed.

**Step 2: External ID** *(required)*
This decides which records to target, based on their External ID.

| Option | Deletes |
|--------|---------|
| All records (Blank + All populated values) | Every record, with or without an External ID |
| All populated values | Records that have an External ID (any value) |
| Blank | Records with no External ID |
| All populated values that match SuiteMigration | Records whose External ID matches the SuiteMigration format |

**Step 3: Record Type** *(required)*
One record type, or a group option. See §9.

**Step 4: Date Filter** *(required)*

| Option | Behaviour |
|--------|-----------|
| **Created Date** *(default)* | Filters by the date each record was created. Works for every record type |
| **Transaction Date** | Filters by transaction date. Transaction types only |
| **All Dates** | No date filtering. Deletes every matching record |

Pick a date range and a few rules apply. The **To** date is required. The **From** date isn't, so leave it blank to delete everything up to and including the To date. Both ends are inclusive. The date fields show a format hint that follows your account's date preference, so you'll see either `MM/DD/YYYY` or `DD/MM/YYYY`.

**Step 5: Preview Deletion**
The **Preview Deletion** button stays greyed out until you've chosen a Subsidiary, an External ID option and a Record Type, plus a To date if you picked a date range.

Clicking it opens a confirmation modal. The modal restates your criteria, the subsidiary, record type, External ID option and dates, and warns you that this cannot be undone. It doesn't list the individual records. From there, **Cancel** closes it and deletes nothing, **Delete Records** starts the job.

**Step 6: Progress**
The Map/Reduce runs in the background while the page reports on it. You'll see `Scanning records...` while the search runs, then `Deleting: 8,400 of 20,000 records` with a percentage based on how many records have actually been processed. When it finishes you get a summary line with the total deleted and the total failed, with failures in red.

Group options add a bit more:

- Which record type is being processed right now
- A per-type list, each with its own deleted and failed counts and a status of Completed, Processing or Pending
- Types with failures are highlighted, so you can trace a problem to the exact type
- Types run one at a time in dependency order, payments before invoices, transactions before entities

---

## 9. Supported Record Types

### Group options

| Option | Expands to |
|--------|-----------|
| **All Records** | All transactions (below) + Projects, Customers, Vendors, Employees, Items |
| **All Entities (Customers, Vendors, Employees, Items, Projects)** | Projects, Customers, Vendors, Employees, Items |
| **All Transactions (including Journal Entries)** | Deposits, Customer Payments, Credit Memos, Invoices, Cash Refunds, Cash Sales, Vendor Payments, Vendor Credits, Vendor Bills, Purchase Orders, Checks, Cash Expenses, Credit Card Refunds, Credit Card Charges, Transfers, Journal Entries, Journal Entries matching SuiteMigration Trial Balance push |

### Individual record types

**Entities.** Created Date filtering only, there's no transaction date to filter on.

| Label | Internal value |
|-------|----------------|
| Customers | `customer` |
| Vendors | `vendor` |
| Employees | `employee` |
| Items | `item` |
| Projects | `job` |

**Transactions.** These support both Created Date and Transaction Date.

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

Filters combine with **AND**, so a record has to satisfy every condition that applies before it's deleted:

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

Three of the types in the dropdown aren't NetSuite record types at all. They're Checks or Journal Entries picked out by a SuiteMigration External ID pattern.

| Toolkit record type | Stored in NetSuite as | Identified by External ID |
|---------------------|-----------------------|---------------------------|
| Cash Expenses | Check | ends with `__cex_chk` |
| Transfers | Journal Entry | ends with `__trf_jrn` |
| Journal Entries matching SuiteMigration Trial Balance push | Journal Entry | contains `sm_net` / `sm_rebuild` / `sm_manual` |

So that they don't overlap, the plain types exclude them:

| Record type | Also excludes |
|-------------|---------------|
| Checks | External IDs ending `__cex_chk` |
| Journal Entries | External IDs ending `__trf_jrn`, and those containing `sm_net` / `sm_rebuild` / `sm_manual` |

> **Note:** these three types are defined by having a SuiteMigration External ID, so choosing **Blank** with any of them returns nothing. That's correct, not a bug. A record with no External ID can't be one of them.

### Date filtering details

- Only one date range applies at a time, whichever you chose in the **Date Filter** dropdown
- **Transaction Date** covers transaction types only. Entity types don't offer it, and in a group deletion they quietly fall back to **Created Date**
- **Created Date** searches `datecreated` for entities and transactions, but `created` for items
- The **From** date is optional. Leave it blank to delete everything up to and including the **To** date
- Both ends of a range are inclusive

### Cascade behaviour

Deleting a **Customer** does more than delete that customer. It also removes the sub-customers beneath it and their contacts, working from the deepest level up, and clears vendor, employee and subsidiary relationships that would otherwise block the delete. The records actually removed can therefore outnumber the top-level count in the progress bar, so read this section before you confirm a customer deletion.

**Items** are searched across all six item subtypes: Inventory, Non-Inventory, Service, Assembly, Kit and Group.

---

## 11. Required IDs Reference

The code refers to these IDs directly. They **must match exactly** or the tool won't run.

| Item | Enter in NetSuite | Final System ID |
|------|-------------------|-----------------|
| Map/Reduce Script | `_sm_toolkit_delete_mr` | `customscript_sm_toolkit_delete_mr` |
| Map/Reduce Deployment | `_sm_toolkit_delete_mr` | `customdeploy_sm_toolkit_delete_mr` |
| Parameter, Record Type | `_sm_recordtype` | `custscript_sm_recordtype` |
| Parameter, Subsidiary | `_sm_subsidiary` | `custscript_sm_subsidiary` |
| Parameter, External ID | `_sm_externalid` | `custscript_sm_externalid` |
| Parameter, Transaction Date From | `_sm_trandate_from` | `custscript_sm_trandate_from` |
| Parameter, Transaction Date To | `_sm_trandate_to` | `custscript_sm_trandate_to` |
| Parameter, Created Date From | `_sm_createddate_from` | `custscript_sm_createddate_from` |
| Parameter, Created Date To | `_sm_createddate_to` | `custscript_sm_createddate_to` |

> The Suitelet's own script and deployment IDs are **not** in the code, so use whatever you want for those.

---

## 12. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| *"Script not found"*, or the task never submits | The Map/Reduce **Script ID** or **Deployment ID** doesn't match §11 |
| *"Missing required parameters: record type or subsidiary"* | A script **parameter ID** doesn't match §11, or the parameters were never saved on the script record |
| *"A delete task is already running"* | An earlier Map/Reduce deployment is still going. Wait for it |
| Progress finishes but no **Deleted / Failed** counts appear | The counts travel via `N/cache`, and the page fell back to a plain "Completed" message. The numbers are still in the Map/Reduce execution log, under the `Summary` audit entry |
| Deletion returns 0 records | Check your filter combination. **Blank** External ID with Cash Expenses, Transfers or SM Trial Balance JEs matches nothing by design (see §10) |
| Records fail to delete | Almost always a dependent record or reference blocking the delete. Look for `Delete Failed` entries in the Map/Reduce execution log |

### Modules used

Both scripts stick to standard NetSuite modules. Nothing external.

- **Suitelet:** `N/ui/serverWidget`, `N/task`, `N/log`, `N/search`, `N/url`, `N/runtime`, `N/format`, `N/cache`
- **Map/Reduce:** `N/search`, `N/record`, `N/runtime`, `N/log`, `N/cache`

---

*SuiteMigration Admin Toolkit · Publisher: SuiteMigration · Provided "AS IS" without warranty of any kind.*

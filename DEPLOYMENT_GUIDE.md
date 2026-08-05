# NetSuite Record Deletion Tool - Deployment Guide

**Latest Script Version: v1.0** | **Last Updated: 2026-05-11**

This guide provides step-by-step instructions to deploy the Record Deletion Tool in your NetSuite account.

---

## Overview

The Record Deletion Tool consists of two scripts:
- **Suitelet** - Provides a user interface to select subsidiary and record type
- **Map/Reduce** - Performs the bulk deletion in the background

---

## Step 1: Upload Script Files

1. Navigate to **Documents > Files > File Cabinet**
2. Open or create the folder: **SuiteScripts**
3. Click **Add File** and upload both files:
   - `Del_SuiteLet.js`
   - `Del_MapReduce.js`

---

## Step 2: Create Map/Reduce Script

1. Navigate to **Customization > Scripting > Scripts > New**
2. Select the uploaded file: `Del_MapReduce.js`
3. Click **Create Script Record**
4. Fill in the following fields:

| Field | Value |
|-------|-------|
| Name | Delete Records Map/Reduce (or any preferred ID)
| ID | `_delete1` (NetSuite will prefix with `customscript`) |
| Description | Map/Reduce script for bulk record deletion |

5. Click **Save**

---

## Step 3: Add Script Parameters

After saving the script, you need to add six parameters:

1. On the script record, go to the **Parameters** subtab
2. Click **New Parameter** and create the first parameter:

| Field | Value |
|-------|-------|
| Label | Record Type |
| ID | `_recordtype` (NetSuite will prefix with `custscript`) |
| Type | Free-Form Text |

3. Click **Save & New** and create the second parameter:

| Field | Value |
|-------|-------|
| Label | Subsidiary |
| ID | `_subsidiary` (NetSuite will prefix with `custscript`) |
| Type | Free-Form Text |

4. Click **Save & New** and create the third parameter:

| Field | Value |
|-------|-------|
| Label | Push Mode |
| ID | `_pushmode` (NetSuite will prefix with `custscript`) |
| Type | Free-Form Text |

5. Click **Save & New** and create the fourth parameter:

| Field | Value |
|-------|-------|
| Label | Transaction Date From |
| ID | `_trandatefrom` (NetSuite will prefix with `custscript`) |
| Type | Free-Form Text |

6. Click **Save & New** and create the fifth parameter:

| Field | Value |
|-------|-------|
| Label | Transaction Date To |
| ID | `_trandateto` (NetSuite will prefix with `custscript`) |
| Type | Free-Form Text |

7. Click **Save & New** and create the sixth parameter:

| Field | Value |
|-------|-------|
| Label | Created Date From |
| ID | `_createddatefrom` (NetSuite will prefix with `custscript`) |
| Type | Free-Form Text |

8. Click **Save & New** and create the seventh parameter:

| Field | Value |
|-------|-------|
| Label | Created Date To |
| ID | `_createddateto` (NetSuite will prefix with `custscript`) |
| Type | Free-Form Text |

9. Click **Save**

> **Important**: Enter the ID without the `custscript_` prefix. NetSuite automatically adds it.
> - Enter `_recordtype` → becomes `custscript_recordtype`
> - Enter `_subsidiary` → becomes `custscript_subsidiary`
> - Enter `_pushmode` → becomes `custscript_pushmode`
> - Enter `_trandatefrom` → becomes `custscript_trandatefrom`
> - Enter `_trandateto` → becomes `custscript_trandateto`
> - Enter `_createddatefrom` → becomes `custscript_createddatefrom`
> - Enter `_createddateto` → becomes `custscript_createddateto`

---

## Step 4: Deploy Map/Reduce Script

1. On the script record, go to the **Deployments** subtab
2. Click **New Deployment**
3. Fill in the following fields:

| Field | Value |
|-------|-------|
| Title | Delete Records Deployment (or any preferred ID)
| ID | `_delete2` (NetSuite will prefix with `customdeploy`) |
| Status | Released |
| Log Level | Debug |
| Execute As Role | Administrator (or appropriate role) |

4. Click **Save**

---

## Step 5: Create Suitelet Script

1. Navigate to **Customization > Scripting > Scripts > New**
2. Select the uploaded file: `Del_SuiteLet.js`
3. Click **Create Script Record**
4. Fill in the following fields:

| Field | Value |
|-------|-------|
| Name | Delete Records Suitelet |
| ID | `_delete_suitelet` (or any preferred ID) |
| Description | User interface for bulk record deletion |

5. Click **Save**

---

## Step 6: Deploy Suitelet Script

1. On the script record, go to the **Deployments** subtab
2. Click **New Deployment**
3. Fill in the following fields:

| Field | Value |
|-------|-------|
| Title | Delete Records UI (or any preferred ID)
| ID | `_delete_suitelet_deploy` (or any preferred ID) |
| Status | Released |
| Log Level | Debug |
| Execute As Role | Administrator (or appropriate role) |
| Audience > Roles | Select roles that should have access |

4. Click **Save**

---

## Step 7: Access the Tool

After deployment, you can access the tool via:

1. Go to the Suitelet deployment record
2. Copy the **External URL** or **Internal URL**
3. Open the URL in your browser


## Usage

1. Open the Suitelet URL
2. Select a **Subsidiary** from the dropdown
3. Select a **Record Type** to delete — choose an individual type or a group option:
   - **All Records**: Processes all record types sequentially
   - **All Cust/Vend/Emp/Item Records**: Processes all entity and item types
   - **All Transactions (incl. JEs)**: Processes all transaction types
4. Choose a **Delete by Date** option:
   - **All Records**: Deletes all records for the selected subsidiary and record type (no date filtering)
   - **Transaction Date Range**: Filters by transaction date (transactions only — not available for Customers, Vendors, Employees, or Items)
   - **Creation Date Range** (default): Filters by creation date (available for all record types)
5. If using a date range option:
   - The **To** date is required
   - The **From** date is optional — leave it blank to delete all records up to and including the To date
6. A **confirmation message** will appear at the bottom showing exactly what will be deleted
7. Click **Delete Records**
8. Wait for the process to complete
9. A "Completed" message will be displayed

> **Note**: When using a group option (All Records, All Entities, All Transactions), each record type is processed sequentially in dependency-safe order (e.g., deposits are deleted before customer payments, payments are deleted before invoices). The progress page shows the status of each type as it processes.

---

## Supported Record Types

The tool supports deleting the following record types:
- Projects
- Customers
- Vendors
- Employees
- Items
- Journal Entries
- Deposits
- Invoices
- Cash Sales
- Customer Payments
- Credit Memos
- Vendor Bills
- Vendor Payments
- Vendor Credits
- Checks
- Credit Card Charges
- Credit Card Refunds
- Purchase Orders
- Cash Refunds
- Cash Expenses
- Transfers

---

## Filter Criteria

Records are selected for deletion based on:
- **Subsidiary**: Matches the selected subsidiary (always required)
- **Delete by Date**:
  - **All Records**: No date filtering — deletes all records for the subsidiary and record type
  - **Transaction Date Range**: Filters by transaction date (transactions only)
  - **Creation Date Range**: Filters by creation date (all record types)

### Date Range Details

| Date Range | Field Used | Applies To | From Date | Inclusive? |
|------------|-----------|------------|-----------|------------|
| Transaction Date | `trandate` | Transactions only (Journal Entries, Deposits, Cash Sales, Invoices, Payments, Bills, Credit Memos, Checks, Purchase Orders, Cash Refunds, Cash Expenses, Credit Card Charges, Credit Card Refunds, Transfers) | Optional | Yes |
| Creation Date | `datecreated` | Entities (Customers, Vendors, Employees) | Optional | Yes |
| Creation Date | `created` | Items | Optional | Yes |

**Important notes:**
- Only **one** date range is used at a time (selected via the Delete by Date dropdown).
- **Transaction Date Range** is not available for Entities (Customers, Vendors, Employees) and Items — the option is automatically hidden.
- The **From** date is optional. When omitted, all records up to and including the **To** date are selected.
- When both From and To are provided, the `within` operator is used. When only To is provided, `onorbefore` is used.
- All dates are **inclusive** — the start and end dates are included in the range.

---

## Upgrading from Previous Version

If you previously deployed the tool with the old parameters (`custscript_datefrom`, `custscript_dateto`), you need to:

1. Remove the old parameters: `custscript_datefrom` and `custscript_dateto`
2. Add the new parameters as described in Step 3:
   - `custscript_pushmode`
   - `custscript_trandatefrom`
   - `custscript_trandateto`
   - `custscript_createddatefrom`
   - `custscript_createddateto`
3. Upload the updated script files

---

## Troubleshooting

### Important: IDs Must Match Exactly

The following IDs are hardcoded in the script and **must match exactly** in NetSuite:

| What to Create | Required ID | Full ID After Save |
|----------------|-------------|-------------------|
| Map/Reduce Script | `_delete1` | `customscript_delete1` |
| Map/Reduce Deployment | `_delete2` | `customdeploy_delete2` |
| Parameter 1 | `_recordtype` | `custscript_recordtype` |
| Parameter 2 | `_subsidiary` | `custscript_subsidiary` |
| Parameter 3 | `_pushmode` | `custscript_pushmode` |
| Parameter 4 | `_trandatefrom` | `custscript_trandatefrom` |
| Parameter 5 | `_trandateto` | `custscript_trandateto` |
| Parameter 6 | `_createddatefrom` | `custscript_createddatefrom` |
| Parameter 7 | `_createddateto` | `custscript_createddateto` |

> **If any ID doesn't match, the tool will fail with errors.**

---


### Records not being deleted

**Cause**: Records don't match the filter criteria or have dependencies.

**Solution**:
- Verify records exist in the selected subsidiary
- Verify records fall within the specified date range
- Check if records have linked transactions preventing deletion
- For entities/items, only Creation Date Range is available (Transaction Date Range option is hidden)

---

## Script IDs Reference

| Component | ID |
|-----------|-----|
| Map/Reduce Script | `customscript_delete1` |
| Map/Reduce Deployment | `customdeploy_delete2` |
| Script Parameter - Record Type | `custscript_recordtype` |
| Script Parameter - Subsidiary | `custscript_subsidiary` |
| Script Parameter - Transaction Date From | `custscript_trandatefrom` |
| Script Parameter - Transaction Date To | `custscript_trandateto` |
| Script Parameter - Created Date From | `custscript_createddatefrom` |
| Script Parameter - Created Date To | `custscript_createddateto` |

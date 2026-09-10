# SuiteMigration Admin Toolkit

A free NetSuite utility for administrators and consultants that deletes records in bulk. Useful when you're re-running a migration, clearing down a Sandbox, or pulling test data out of an account.

Built and published by [SuiteMigration](https://suitemigration.com).

> ⚠️ **Deletions are permanent and cannot be undone.** Test in a Sandbox account before you run this in Production.

---

## What it does

- Delete by **subsidiary**, **record type** and **date range**
- Target records by **External ID**: all, populated, blank, or matching the SuiteMigration format
- Pick a single record type, or a group (**All Records**, **All Entities**, **All Transactions**) covering the 22 types the toolkit supports
- **Review before deleting.** A confirmation modal restates the criteria the job will run with
- **Live progress**, with counts as the job works through the records and per-type deleted and failed totals

---

## What it looks like

Pick a subsidiary, an External ID option, a record type and a date filter:

<p align="center">
  <img src="docs/images/main-screen.png" width="70%" alt="The SuiteMigration Admin Toolkit main screen">
</p>

Nothing is deleted until you confirm. The modal restates the criteria the job
will use:

<p align="center">
  <img src="docs/images/confirm-deletion.png" width="70%" alt="The Confirm Deletion dialog">
</p>

Progress is reported while the deletion runs, with deleted and failed totals:

<p align="center">
  <img src="docs/images/deletion-complete.png" width="70%" alt="A completed deletion showing the total deleted and failed counts">
</p>

---

## How it compares

A saved search will find the records, but it can't delete them. NetSuite's
native bulk delete is Mass Update, and its delete actions cover activities,
cases, files, reports and website redirects. None of them touch transactions or
entities, so clearing those means deleting inline, one record at a time, or
writing your own script.

| | Admin Toolkit | Native NetSuite methods |
|---|:---:|:---:|
| Find records by subsidiary, date and External ID | ✅ | ✅ |
| Review the criteria before anything is deleted | ✅ | ✅ |
| Supports entity deletion (customers, vendors, employees, items, projects) | ✅ | ❌ |
| Supports 17 transaction selections, including invoices, credit memos, customer payments, vendor bills, vendor payments, purchase orders, cash sales, deposits, checks, transfers and journal entries | ✅ | ❌ |
| All six item subtypes in one selection (inventory, non-inventory, service, assembly, kit and group) | ✅ | ❌ |
| Delete activities, cases, files, reports and website redirects | ❌ | ✅ |
| Target records whose External IDs match SuiteMigration-generated formats | ✅ | ❌ |
| Delete multiple record types in one run | ✅ | ❌ |
| Deletion order handled for you | ✅ | ❌ |
| Sub-customers and their contacts processed first, children before parents | ✅ | ❌ |
| Live deleted and failed counts as it runs | ✅ | ❌ |
| Save the criteria and re-run them later | ❌ | ✅ |
| No installation required | ❌ | ✅ |

For activities and files, use Mass Update. It's native and there's nothing to
install. This toolkit is for the entities and transactions a migration leaves
behind.

NetSuite also won't delete a record that something else depends on, like a
customer with invoices against it, or a bill with a payment already applied.
Records have to come out in the right sequence, so a group run works through the
22 supported types in dependency order.

Deleting a customer reaches past the records your criteria matched. It also
processes that customer's sub-customers and their contacts, deepest level first,
so the number of records touched can exceed the count you started from. Read the
deployment guide before you confirm one.

Individual deletions can still fail. Permissions, a closed period, a workflow or
another script can each block a record, as can NetSuite's own validation, which
is why every run reports failed totals next to the deleted ones.

---

## Repository structure

```
.
├── docs/
│   └── DEPLOYMENT_GUIDE.md    Setup instructions, script IDs and parameters
└── scripts/
    ├── SuiteMigration_AdminToolkit_SuiteLet.js    Suitelet, the user interface
    └── SuiteMigration_AdminToolkit_MapReduce.js   Map/Reduce, does the deleting
```

---

## Installation

Upload both files from `scripts/` into the same File Cabinet folder
(`Documents > Files > SuiteScripts`), then create the script records. That means
two script records, one of which needs seven parameters with IDs that have to
match exactly.

Full instructions, including those IDs:
**[Read the deployment guide](docs/DEPLOYMENT_GUIDE.md)**

---

## Documentation

The [support article](https://support.suitemigration.com/deletion-scripts/) on
the SuiteMigration support site walks through the setup.

---

## Licence

Free and source available under the **SuiteMigration Free Utility License**. You
can install, run, inspect and modify the scripts, either inside your own
organisation or for clients during a consulting engagement. You can't
redistribute, re-host, white-label or otherwise republish the source, and you
can't bundle it into a paid product or commercial service. See [LICENSE](LICENSE)
for the exact terms.

Provided "AS IS" without warranty of any kind.

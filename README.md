# SuiteMigration Admin Toolkit

A free NetSuite utility for Administrators and Consultants that deletes records in bulk — useful when re-running a migration, clearing down a Sandbox, or removing test data from an account.

Built and published by [SuiteMigration](https://suitemigration.com).

> ⚠️ **Deletions are permanent and cannot be undone.** Test in a Sandbox account before running in Production.

---

## What it does

- Delete by **subsidiary**, **record type** and **date range**
- Target records by **External ID** — all, populated, blank, or matching the SuiteMigration format
- Delete a single record type, or a group (**All Records**, **All Entities**, **All Transactions**)
- **Preview before deleting** — a confirmation modal shows exactly what will be removed
- **Live progress** — real record counts as they are deleted, with per-type deleted/failed totals

---

## Repository structure

```
.
├── docs/
│   └── DEPLOYMENT_GUIDE.md    Setup instructions, script IDs and parameters
└── scripts/
    ├── SuiteMigration_AdminToolkit_SuiteLet.js    Suitelet — the user interface
    └── SuiteMigration_AdminToolkit_MapReduce.js   Map/Reduce — performs the deletion
```

---

## Installation

Upload both files from `scripts/` to the same File Cabinet folder
(*Documents > Files > SuiteScripts*), then create the script records.

Full instructions, including the required script and parameter IDs:
**[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)**

---

## Documentation

**[Support article](https://support.suitemigration.com/deletion-scripts/)** — setup walkthrough
on the SuiteMigration support site.

---

## Licence

Provided under the **SuiteMigration Free Utility License** — see [LICENSE](LICENSE).

Provided "AS IS" without warranty of any kind.

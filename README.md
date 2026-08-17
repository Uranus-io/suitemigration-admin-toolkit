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
└── src/
    └── scripts/
        ├── Del_SuiteLet.js    Suitelet — the user interface
        ├── Del_MapReduce.js   Map/Reduce — performs the deletion
        └── SM_About.js        Content for the About tab (loaded by the Suitelet)
```

---

## Installation

Upload all three files from `src/scripts/` to the **same** File Cabinet folder
(*Documents > Files > SuiteScripts*), then create the script records.

`Del_SuiteLet.js` loads `SM_About.js` via the relative path `./SM_About`, so the two must sit
together. `SM_About.js` needs no script record of its own.

Full instructions, including the required script and parameter IDs:
**[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)**

---

## Documentation

**[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** — step-by-step setup, script IDs, parameters,
record selection criteria and troubleshooting.

---

## Licence

Provided under the **SuiteMigration Free Utility License** — see [LICENSE](LICENSE)
or <https://suitemigration.com/license>.

Provided "AS IS" without warranty of any kind.

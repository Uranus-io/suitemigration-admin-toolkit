# Release process

The toolkit runs inside each customer's own NetSuite account. Once it is installed
we have no way to push anything to it, so a release only reaches people if the
installed script notices the release and tells them. That is what this process
exists to support.

Two things make it work: a **version tag** on every release, and a **manifest**
the running script can read.

## Versioning

Versions are `MAJOR.MINOR.PATCH`, and which number you bump is not cosmetic. It
decides what installed copies of the toolkit show their users.

| Bump | Use it for | What users see |
| --- | --- | --- |
| Patch (`1.0.0` to `1.0.1`) | Typo, wording, internal cleanup | Nothing |
| Minor (`1.0.0` to `1.1.0`) | New feature or improvement | Soft notice in the Updates tab |
| Major (`1.0.0` to `2.0.0`) | Breaking change, new deployment steps | Soft notice in the Updates tab |

Anything **below** `minimumVersion` in the manifest gets the loud alert on the
Delete Records tab, whichever number changed. Being exactly at it counts as fine,
so `minimumVersion` is the lowest version you consider acceptable, not the highest
one you consider broken. To put everyone on 1.1.0, set `minimumVersion` to
`1.1.0`, not `1.0.0`.

The version lives in two places and they must match:

- `scripts/SuiteMigration_AdminToolkit_SuiteLet.js`, as `SCRIPT_VERSION`
- `scripts/SuiteMigration_AdminToolkit_MapReduce.js`, as `SCRIPT_VERSION`

Both files also carry `@version` in their header comment. Keep it in step; the
running code reads the constant, not the comment.

## The manifest

`version.json` at the repo root is the source of truth:

```json
{
	"latestVersion": "1.1.0",
	"minimumVersion": "1.0.0",
	"releaseUrl": "https://github.com/Uranus-io/suitemigration-admin-toolkit/releases/latest",
	"summary": "One line describing what changed."
}
```

- `latestVersion`: the newest release. Installed copies below it may show a notice.
- `minimumVersion`: the lowest version you consider acceptable. Anything below it
  gets the important alert; an account exactly at it is treated as current. Set it
  to the release you want everyone on.
- `releaseUrl`: where the alert sends people.
- `summary`: one line, shown in the alert. Keep it short; it renders inline.

Installed copies of the toolkit read this file directly from the repo, at the URL
in `UPDATE_MANIFEST_URL` in the Suitelet:

```
https://raw.githubusercontent.com/Uranus-io/suitemigration-admin-toolkit/main/version.json
```

That is this same `version.json`, on `main`, served by GitHub. There is nothing to deploy
and no second copy to keep in step: merging a change to `version.json` publishes
it. The repo must stay public for this to work.

### Raising the floor after a release

`minimumVersion` is the reason this is a manifest and not just a version number.
If we find a problem in a release that already shipped, raise `minimumVersion`
above the affected versions and merge that to `main`. Every account below the new
floor starts seeing the important alert within its cache window, and nobody has
to upload a new script for that to happen.

## Cutting a release

1. Bump `SCRIPT_VERSION` in both scripts and `@version` in both headers.
2. Update `version.json`. Set `latestVersion` always, and `minimumVersion` only if this
   release is one everyone should be on.
3. Merge to `main`.
4. Tag and push:

   ```bash
   git tag -a v1.1.0 -m "v1.1.0"
   git push origin v1.1.0
   ```

5. Create the GitHub release, attaching both script files:

   ```bash
   gh release create v1.1.0 \
     --title "v1.1.0" \
     --notes "What changed, in plain terms." \
     scripts/SuiteMigration_AdminToolkit_SuiteLet.js \
     scripts/SuiteMigration_AdminToolkit_MapReduce.js
   ```

Step 2 is the one that makes any of it visible to customers. Until `version.json`
on `main` changes, installed copies keep reporting whatever it said before, so a
release that skips it ships silently.

## How the check behaves

Worth knowing when you are deciding what to put in a release:

- The Suitelet checks on page render and caches the answer for six hours per
  account, so a manifest change takes up to six hours to reach everyone. GitHub
  caches raw files for a few minutes on top of that.
- If the call fails or times out, the script stays silent, with no alert and no error.
  The Updates tab says the check could not be completed rather than claiming the
  account is up to date.
- An account running a version newer than `latestVersion` is left alone, so
  pre-release and locally edited copies are never told to update backwards.

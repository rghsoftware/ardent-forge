# Skill: Release

## Purpose

Prepare and publish a new version of Ardent Forge by bumping versions, updating the changelog, tagging the release, and monitoring the CI/CD pipeline through to Play Store deployment.

## When to use

- User says "release", "cut a release", "publish a version", "tag a release"
- User wants to bump the version and push a new build
- User says "ship it", "deploy", "push to Play Store"

## Prerequisites

- All intended changes are merged into the target branch
- CI is green on the target branch (no failing checks)
- User has push access and secrets are configured in GitHub

## Workflow

### Step 1: Determine release type and version

1. Read the current version from `package.json` (source of truth)
2. Confirm with `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` -- all three must match
3. Ask the user what kind of release this is:

| Release type      | Branch    | Tag example      | GitHub Release |
| ----------------- | --------- | ---------------- | -------------- |
| Alpha             | `develop` | `v1.0.0-alpha.1` | Pre-release    |
| Beta              | `develop` | `v1.0.0-beta.3`  | Pre-release    |
| Release candidate | `develop` | `v1.0.0-rc.1`    | Pre-release    |
| Stable            | `main`    | `v1.0.0`         | Stable         |

4. Derive the new version using semver. For pre-release, increment the pre-release number. For stable, drop the pre-release suffix (or bump major/minor/patch per user input).

### Step 2: Pre-flight checklist

Verify each item before proceeding. Stop and report any failures.

- [ ] On the correct branch (`develop` for pre-release, `main` for stable)
- [ ] Working tree is clean (`git status` shows no uncommitted changes)
- [ ] All tests pass (`bun run test`)
- [ ] Lint passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] No pending Supabase migrations that haven't been tested locally (`ls supabase/migrations/`)
- [ ] For stable releases: `develop` has been merged into `main`

### Step 3: Bump versions

Update the version string in all four files:

1. `package.json` -- `"version": "X.Y.Z..."` field
2. `src-tauri/tauri.conf.json` -- `"version": "X.Y.Z..."` field
3. `src-tauri/Cargo.toml` -- `version = "X.Y.Z..."` field
4. `src-tauri/gen/android/app/tauri.properties` -- bump `tauri.android.versionCode` and set `tauri.android.versionName`

All three manifest files (1-3) must contain the identical version string (without the `v` prefix).

**Version code (Android):** The `versionCode` in `tauri.properties` must be strictly greater than the previous value. Read the current value and increment by 1. CI will override this with `1000000 + github.run_number`, but the committed value serves as a floor and prevents conflicts if the CI formula ever resets. Never reuse or decrease a version code -- Play Store rejects uploads with duplicate or lower codes.

### Step 4: Update CHANGELOG.md

1. Read the current `CHANGELOG.md`
2. Gather changes since the last release tag: `git log $(git describe --tags --abbrev=0)..HEAD --oneline`
3. Add a new section at the top (below the header) using the established format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Features

- **Feature name** -- description (#PR)

### Improvements

- Description (#PR)

### Bug Fixes

- Description (#PR)
```

4. Categorize commits into Features, Improvements, and Bug Fixes
5. Omit empty sections
6. Use past tense, link PR numbers where available

### Step 5: Commit version bump

1. Stage the four version files (`package.json`, `tauri.conf.json`, `Cargo.toml`, `tauri.properties`) and `CHANGELOG.md`
2. Commit with message: `chore(release): bump version to X.Y.Z`
3. Do NOT push yet -- present the commit to the user for review

### Step 6: Tag and push

After user confirms:

1. Create an annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
2. Push the commit and tag: `git push origin <branch> --follow-tags`

This triggers the `release.yml` GitHub Actions workflow.

### Step 7: Monitor CI/CD pipeline

1. Check workflow status: `gh run list --workflow=release.yml --limit 1`
2. Report the three job statuses to the user:
   - **build-release** -- Signed AAB build
   - **migrate** -- Supabase database migrations
   - **publish** -- GitHub Release creation + Play Store upload
3. If any job fails: `gh run view <run-id> --log-failed` to surface the error
4. Link the user to the GitHub Actions run for live monitoring

### Step 8: Post-release verification

Once the pipeline succeeds, verify:

- [ ] GitHub Release exists at the correct tag with AAB attached
- [ ] Release is marked as pre-release or stable (matching the tag type)
- [ ] Play Store internal track shows the new version (user must verify manually)

### Step 9: Post-release cleanup (stable releases only)

For stable releases, prompt the user about:

1. Merge `main` back into `develop` to pick up the version bump
2. Start the next pre-release cycle (e.g., bump to `X.Y+1.0-alpha.1` on `develop`)

## Failure Recovery

| Failure point              | Recovery                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pre-flight check fails     | Fix the issue, re-run the check                                                                                                    |
| Build job fails            | Check `gh run view --log-failed`, fix, delete the tag (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), re-tag after fix |
| Migration job fails        | Check Supabase logs, fix migration, delete tag, re-tag                                                                             |
| Publish job fails          | Can often be re-run: `gh run rerun <run-id> --failed`                                                                              |
| Tag pushed on wrong branch | Delete remote tag, reset, re-tag on correct branch                                                                                 |

## Rules

- Never skip the pre-flight checklist
- Never push a tag without user confirmation
- All four version files must be updated atomically in a single commit
- Changelog entries must reference PR numbers where available
- Pre-release tags must come from `develop`; stable tags from `main`
- Do not amend the version bump commit after tagging -- if changes are needed, delete the tag, amend, re-tag
- Use `bun` and `bunx` for all commands, never `npm`/`npx`/`yarn`

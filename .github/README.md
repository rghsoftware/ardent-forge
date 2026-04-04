# CI/CD Pipeline Setup

Guide for configuring the Ardent Forge CI/CD pipeline.

## Prerequisites

- GitHub repository with Actions enabled
- Google Play Console project with the app already uploaded manually (first upload cannot be done via API)
- Google Cloud service account with Play Console access
- Android upload keystore (.jks file)
- Supabase project with CLI access

## Required GitHub Secrets

Configure these in **Settings > Secrets and variables > Actions**:

| Secret                             | Description                                                | How to obtain                                        |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| `KEYSTORE_BASE64`                  | Base64-encoded Android upload keystore                     | `base64 -w 0 upload-key.jks`                         |
| `KEYSTORE_PASSWORD`                | Password for the keystore file                             | Set during keystore creation                         |
| `KEY_ALIAS`                        | Alias of the signing key within the keystore               | Set during keystore creation                         |
| `KEY_PASSWORD`                     | Password for the signing key                               | Set during keystore creation                         |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Full JSON contents of the Play Console service account key | Google Cloud Console > IAM > Service Accounts > Keys |
| `SUPABASE_PROJECT_REF`             | Supabase project reference ID                              | Supabase Dashboard > Project Settings > General      |
| `SUPABASE_ACCESS_TOKEN`            | Supabase personal access token                             | https://supabase.com/dashboard/account/tokens        |

## First-Time Setup

### 1. Create an Android upload keystore

```bash
keytool -genkey -v -keystore upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Encode it for GitHub Secrets:

```bash
base64 -w 0 upload-key.jks | pbcopy  # macOS
base64 -w 0 upload-key.jks | xclip   # Linux
```

### 2. Set up Google Play Console service account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google Play Android Developer API**
3. Create a Service Account under **IAM & Admin > Service Accounts**
4. Generate a JSON key for the service account
5. In **Google Play Console > Users and Permissions**, invite the service account email
6. Grant **Release Manager** permissions scoped to the Ardent Forge app

### 3. First manual Play Store upload

The Google Play Developer API cannot create a new app listing. You must manually upload the first AAB:

1. Build a signed AAB locally: `bunx tauri android build --target aarch64 --aab`
2. Go to **Google Play Console > Internal testing**
3. Create a new release and upload the AAB
4. After this first upload, the CI pipeline can handle subsequent releases

### 4. Configure Supabase access

1. Get your project reference from **Supabase Dashboard > Project Settings > General**
2. Generate a personal access token at https://supabase.com/dashboard/account/tokens
3. Add both as GitHub Secrets

## Workflows

### CI (`ci.yml`)

Triggered on pull requests to `develop` and `main`. Runs three parallel jobs:

- **validate** -- ESLint, TypeScript typecheck, Vitest unit tests
- **e2e** -- Playwright E2E tests against local Supabase
- **android-debug** -- Debug APK build to verify compilation

### Release (`release.yml`)

Triggered when a version tag (`v*`) is pushed. Three jobs:

- **build-release** -- Builds a signed AAB (parallel with migrate)
- **migrate** -- Runs Supabase migrations against production (parallel with build-release)
- **publish** -- Creates GitHub Release + uploads to Play Store internal track (waits for both above)

### Triggering a release

```bash
# Pre-release (from develop branch)
git tag v1.0.0-alpha.1
git push origin v1.0.0-alpha.1

# Stable release (from main branch)
git tag v1.0.0
git push origin v1.0.0
```

### Tag conventions

| Pattern          | Branch  | Play Store     | GitHub Release |
| ---------------- | ------- | -------------- | -------------- |
| `v1.0.0-alpha.1` | develop | Internal track | Pre-release    |
| `v1.0.0-beta.1`  | develop | Internal track | Pre-release    |
| `v1.0.0-rc.1`    | develop | Internal track | Pre-release    |
| `v1.0.0`         | main    | Internal track | Stable release |

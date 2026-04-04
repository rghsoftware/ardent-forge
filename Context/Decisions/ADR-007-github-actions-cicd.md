# ADR-007: GitHub Actions for CI/CD Pipeline

**Status:** Proposed
**Date:** 2026-04-04
**Feature:** [011-ci-cd-pipeline](../Features/011-ci-cd-pipeline/Spec.md)

## Context

Ardent Forge needs a CI/CD pipeline for automated testing, Android builds, Play Store deployment, and Supabase migrations. The project has zero existing CI infrastructure. The codebase is hosted on GitHub (rghsoftware/ardent-forge).

## Decision

Use **GitHub Actions** as the sole CI/CD platform.

## Options Considered

### 1. GitHub Actions (chosen)

- Native GitHub integration (status checks, PR gates, release triggers, secrets)
- No additional service to manage or pay for
- Rich ecosystem of community actions for Android SDK, Rust, Play Store upload
- Free tier generous for private repos (2,000 min/month)
- `ubuntu-latest` runners include Docker (needed for local Supabase in E2E)

### 2. CircleCI

- Powerful caching and parallelism
- Requires external service account and webhook setup
- Android builds need a dedicated resource class or Docker image
- Additional vendor dependency for a solo developer

### 3. Self-hosted runners (GitHub Actions)

- Full control over environment and caching
- Requires infrastructure management, security hardening
- Overkill for current team size and build volume

### 4. Fastlane (as build orchestrator)

- Mature Android build and deploy tooling
- Ruby dependency adds complexity to the toolchain
- Tauri builds via `bun tauri android build`, not `gradlew` directly, so Fastlane's Gradle integration adds limited value
- Could be layered on later if needed

## Rationale

GitHub Actions is the simplest path from zero to a working pipeline. The repository is already on GitHub, secrets management is built in, and the community action ecosystem covers every tool in the stack (Android SDK, Rust, Bun, Supabase CLI, Play Store upload). For a solo developer, minimizing external service dependencies reduces operational overhead.

## Consequences

- All CI/CD configuration lives in `.github/workflows/` within the repository
- Build minutes are consumed from the GitHub Actions free tier (2,000 min/month for private repos)
- Android release builds (~15-20 min cold, ~8-10 min cached) will be the largest consumer of minutes
- Future desktop or iOS pipelines can be added as additional workflow files without changing the CI platform
- If build volume exceeds free tier, GitHub Actions billing or self-hosted runners become the next decision point

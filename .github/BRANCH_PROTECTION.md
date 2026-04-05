# Branch Protection Configuration

Recommended branch protection rules for the Ardent Forge repository.

## `develop` branch

| Setting                             | Value                              |
| ----------------------------------- | ---------------------------------- |
| Require pull request before merging | Yes                                |
| Required approvals                  | 1                                  |
| Require status checks to pass       | Yes                                |
| Required status checks              | `validate`, `e2e`, `android-debug` |
| Require branches to be up to date   | Yes                                |
| Restrict force pushes               | Yes                                |

## `main` branch

| Setting                             | Value                              |
| ----------------------------------- | ---------------------------------- |
| Require pull request before merging | Yes                                |
| Required approvals                  | 1                                  |
| Require status checks to pass       | Yes                                |
| Required status checks              | `validate`, `e2e`, `android-debug` |
| Require branches to be up to date   | Yes                                |
| Restrict force pushes               | Yes                                |
| Restrict deletions                  | Yes                                |

## Tag protection

Tags matching `v*` trigger the release workflow. Consider adding a tag protection rule to prevent accidental or unauthorized tag creation.

## Setup

1. Go to **Settings > Branches** in the GitHub repository
2. Add a branch protection rule for each branch above
3. Enable the status checks listed -- they correspond to job names in `.github/workflows/ci.yml`
4. Go to **Settings > Tags** to add tag protection rules

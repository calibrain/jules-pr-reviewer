# ADR-004: Incremental diffing on synchronize events

## Status
Superseded (calibrain fork): every run now reviews the full PR diff.

`before...head` stops being "the PR's new changes" as soon as the base branch is merged or rebased into the PR: it then holds the base's commits, and the PR's own changes are never reviewed. It also only covered the latest push when earlier runs had failed. Findings dedupe keeps already-posted, still-open findings from being repeated.

## Date
2026-06-14

## Context
When a PR is updated (`synchronize` event), the GitHub API provides the full PR diff. Re-reviewing the entire diff is wasteful: it costs LLM tokens, takes longer, and re-posts comments on unchanged code. We want to review only the new changes.

## Decision
On `synchronize` events, use `github.context.payload.before` (the SHA before the push) and `pr.head.sha` (the new SHA) to request only the incremental diff via the GitHub compare API (`/repos/{owner}/{repo}/compare/{base}...{head}`). On `opened` and `reopened` events, use the full PR diff (`pr.base.sha...pr.head.sha`).

## Alternatives Considered

### Always use full PR diff
- Pros: Simple, consistent behavior across event types
- Cons: Wastes tokens and re-reviews unchanged code
- Rejected: Unnecessarily expensive and produces duplicate comments on unchanged lines

### Use git history to compute diff
- Pros: Full control over diff generation
- Cons: Requires a full checkout, more complex, slower
- Rejected: The compare API is simpler and doesn't require a full checkout

### Review only the latest commit
- Pros: Smallest possible diff
- Cons: A push can include multiple commits; the compare API captures all of them
- Rejected: Misses changes from earlier commits in a multi-commit push

## Consequences
- This only works when `payload.before` is available (it is on `synchronize`)
- The `before` SHA is missing on forced pushes — handled gracefully by falling back to full diff
- Review comments are correctly scoped to the incremental changes
- Token usage is reduced for multi-push PRs

# ADR-0017: Use GitHub Sub-Issues for Epic → Task Linking

## Status

Accepted

## Context

We use GitHub-native project management (ADR-0011): Milestones for epics, Issues for tasks, Labels for metadata. Previously, epic tracking issues used markdown task lists (checkboxes) to reference child issues. This has drawbacks:

- Checkboxes are not machine-readable — `gh` CLI can't query parent/child relationships
- No automatic progress tracking (GitHub doesn't count checked boxes as issue progress)
- Manual maintenance burden — checkboxes get stale
- No bidirectional navigation (child → parent) in the GitHub UI

GitHub now supports native **sub-issues** via the GraphQL API (`addSubIssue` mutation). Sub-issues provide:

- Automatic progress bars on parent issues
- Bidirectional links (parent ↔ child) visible in the UI
- Machine-queryable via GraphQL
- Native support in GitHub Projects boards

## Decision

**Always use GitHub sub-issues** (via `addSubIssue` GraphQL mutation) to link task issues to their epic tracking issue. Never use markdown checkboxes for parent/child relationships.

### How to Link

```bash
# Get node IDs
PARENT=$(gh api graphql -f query='query { repository(owner:"zenprocess", name:"aigrija") { issue(number:EPIC_NUM) { id } } }' --jq '.data.repository.issue.id')
CHILD=$(gh api graphql -f query='query { repository(owner:"zenprocess", name:"aigrija") { issue(number:TASK_NUM) { id } } }' --jq '.data.repository.issue.id')

# Link
gh api graphql -f query="mutation { addSubIssue(input: { issueId: \"$PARENT\", subIssueId: \"$CHILD\" }) { issue { number } subIssue { number } } }"
```

### Epic Body Template

Epic tracking issues should describe the scope and context. Sub-issues provide the task list automatically — no need for a manual checklist.

## Consequences

- `/epic` skill must be updated to use `addSubIssue` when creating task issues
- `/complete-task` can query parent via GraphQL to check sibling progress
- All future epics use sub-issues, not markdown checklists
- Existing epics with checkboxes can be migrated opportunistically

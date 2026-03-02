# ADR-0011: GitHub-Native Project Management

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu

## Context

ai-grija.ro is a small project (1–3 active contributors) that needs lightweight task tracking without the overhead of external project management tools. We already use GitHub for source control and CI/CD. Adding a separate tracker creates context-switching and sync overhead.

Requirements:
- Track epics (large features), tasks (individual issues), and bugs
- Assign priority and complexity labels
- Support automated workflows via `gh` CLI and Claude Code agents
- Zero additional SaaS cost
- Works in GitHub-only environments (Code4Romania contribution flow)

## Options Considered

### Option A: Jira

- **Tradeoff**: Industry standard but expensive for small teams, requires separate login, no native `gh` CLI integration. Rejected.

### Option B: Linear

- **Tradeoff**: Excellent UX, GitHub sync available. Still a separate tool with its own API, cost, and onboarding. Rejected.

### Option C: ZenDev MCP

- **Tradeoff**: AI-native project management via MCP. Experimental, adds external dependency, not portable to Code4Romania contributors. Rejected.

### Option D: GitHub Issues + Milestones + Labels

- **Tracking**: Issues for tasks and bugs, Milestones for epics
- **Labels**: Structured taxonomy for status, priority, complexity, agent assignment
- **CLI**: Full `gh` CLI support — scriptable, automatable
- **Cost**: Zero
- **Portability**: Every GitHub user already has access

## Decision

**Option D: GitHub Issues + Milestones + Labels**, with structured label taxonomy and Claude Code skill files for automation.

### Label Taxonomy

| Label | Color | Purpose |
|-------|-------|---------|
| `epic` | `#7057ff` | Tracking issue for a milestone |
| `in-progress` | `#fbca04` | Currently being worked on |
| `blocked` | `#d93f0b` | Cannot proceed |
| `auto-detected` | `#bfdadc` | Created by `/scan`, not human |
| `priority:high` | `#b60205` | Urgent |
| `priority:med` | `#e4e669` | Normal priority |
| `priority:low` | `#0e8a16` | Backlog |
| `complexity:high` | `#d93f0b` | More than 4 hours estimated |
| `complexity:med` | `#fbca04` | 1–4 hours estimated |
| `complexity:low` | `#0e8a16` | Less than 1 hour estimated |
| `agent:ts-fullstack` | `#1d76db` | TypeScript implementation agent |
| `agent:go-backend` | `#1d76db` | Go backend agent |
| `agent:devops-cf` | `#1d76db` | DevOps / Cloudflare agent |

### Skills

| Skill | Command | Action |
|-------|---------|--------|
| Create epic | `/epic "Title"` | Creates Milestone + pinned tracking issue with `epic` label |
| List epics | `/epic list` | Shows all milestones with open/closed issue counts |
| Start task | `/start-task 12` | Assigns issue, adds `in-progress` label, loads context |
| Complete task | `/complete-task 12` | Runs QA gates, closes issue with summary comment |
| Auto-detect bugs | `/scan` | Scans codebase, creates issues with `auto-detected` label |
| Run tests | `/test` | Runs `tsc --noEmit` + `vitest run` + `playwright test` |

### Workflow

```
/epic "Feature X"            → Milestone + tracking issue #1
gh issue create -m "Feature X" -t "Subtask A" → Issue #2
/start-task 2                → Label + assign #2
... implement ...
/complete-task 2             → QA gates + close #2
```

## Consequences

**Positive**:
- Zero additional cost or tooling
- `gh` CLI enables full automation from Claude Code agents
- Familiar interface for Code4Romania contributors
- Issues, PRs, and milestones are co-located — no context-switching

**Negative**:
- GitHub Issues lacks advanced views (Kanban, timeline) without GitHub Projects
- No built-in time tracking or workload balancing
- Label taxonomy must be bootstrapped per repo via `scripts/setup.sh`

**Risks**:
- If the project scales beyond ~5 contributors, GitHub Issues alone may become insufficient — at that point, enable GitHub Projects (board view) on top of the same issue structure without migrating data

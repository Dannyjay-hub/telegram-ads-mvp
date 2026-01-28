---
description: Backup and push changes to git after every significant edit
---

# Backup Workflow

// turbo-all

After making any significant code changes (adding features, fixing bugs, refactoring), ALWAYS run this workflow:

1. Stage all changes:
```bash
git add -A
```

2. Commit with a descriptive message:
```bash
git commit -m "wip: <brief description of changes>"
```

3. Push to remote (if remote exists):
```bash
git push origin main 2>/dev/null || echo "No remote configured"
```

## When to run this workflow:
- After adding new functionality
- After fixing a bug
- Before attempting any risky operation (git checkout, reset, etc.)
- Every 15-20 minutes during active development
- Before ending a session

## CRITICAL: Never run destructive git commands (checkout, reset, clean) without first committing changes!

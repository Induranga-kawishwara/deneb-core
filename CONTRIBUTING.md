# Contributing to Deneb Core

Welcome to the Deneb Core monorepo! This document provides instructions and guidelines for developers, interns, and contributors.

---

## 🛠 Prerequisites & Development Setup

- **Node.js**: `v20+` or `v22+`
- **Package Manager**: `npm` / `pnpm`
- **Monorepo Structure**:
  - `cli/deneb-cli/`: CLI tool and the Deneb Adaptive Refactoring Compiler (`arc/`)
  - `packages/`: UI framework component library, design system tokens, and recipes
  - `doc/`: Architecture documents, engineering roadmaps, and Architecture Decision Records (`doc/adr/`)

### Setup
```bash
git clone <repo-url>
cd deneb/core
npm install
```

---

## 🧪 Testing Guidelines

Before opening a pull request or submitting code, ensure the full test suite passes cleanly:

```bash
# Run ARC compiler test suite
npm test
# or directly:
node --test cli/deneb-cli/src/arc/__tests__/arc.test.cjs
```

All 67 tests must pass with exit code `0`. If you introduce a new compiler transform, recipe, or heuristic:
1. Add an automated test case in `cli/deneb-cli/src/arc/__tests__/arc.test.cjs`.
2. Ensure existing tests remain green.

---

## 📐 Architecture Decision Records (ADRs)

If your work introduces a new architectural pattern, changes compiler heuristics, or alters data structures:
1. Review [`doc/adr/ADR-0001-adr-template.md`](./doc/adr/ADR-0001-adr-template.md).
2. Create a new record: `doc/adr/ADR-XXXX-<short-title>.md`.
3. Submit the ADR alongside your PR for mentor / team review.

---

## 📝 Pull Request (PR) Template

When opening a pull request, include the following template in the PR description:

```markdown
### Summary
A concise summary of changes and the issue/requirement addressed.

### Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Performance improvement
- [ ] Architectural change (includes ADR)
- [ ] Documentation update

### Testing & Verification
- [ ] `node --test cli/deneb-cli/src/arc/__tests__/arc.test.cjs` passed with 0 failures
- [ ] Added new unit tests for changes
- [ ] Verified idempotency of transformations

### Checklist
- [ ] Code adheres to the established style guidelines
- [ ] Comments & docstrings are preserved and updated
- [ ] Relevant documentation updated
```

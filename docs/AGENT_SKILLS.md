# Skill routing

Load only skills relevant to the current task. Skill use does not authorize delegation, new chats, configuration changes or merging.


Select skills by the task, read their `SKILL.md` before applying them, and use the names available in the current session. These rules also apply when a local `AGENTS.override.md` is active. If a skill is unavailable, report the limitation and continue independent work with the project guidance; keep skill installation and global configuration changes within the user's requested scope.

| Skill / family | When to use it here |
| --- | --- |
| **Impeccable** (`impeccable:impeccable`) | UI design, implementation or refinement: layout, typography, colors, responsive behavior, accessibility, interaction states and UX copy. Read `DESIGN.md` and `.impeccable/surface.md`; preserve the existing interface for focused changes. Follow its context-loading and relevant playbook instructions. |
| **Ponytail** (`engineering-suite-ponytail:entry-ponytail` → `ponytail`) | Every coding task: implementation, bug fixes, refactoring, code design, review and dependency choices. Prefer existing helpers, Node/browser standard APIs and the smallest complete solution. Use `ponytail-review` for complexity reviews, `ponytail-audit` for requested whole-repo bloat audits, and `code-simplification` for behavior-preserving clarity work. |
| **Matt Pocock: `diagnosing-bugs`** | Broken behavior, errors, failing checks or performance regressions; establish the cause before changing code. |
| **Matt Pocock: `codebase-design`** | Module interfaces, responsibility boundaries, test seams or architecture improvements; keep the depth of the exercise proportional to this small native-module app. |
| **Matt Pocock: `domain-modeling`** | Clarifying domain terms (decks, zones, roles, identity, legality) or writing a glossary/ADR. |
| **Matt Pocock: `tdd`** | Requested test-first development, red/green work or integration tests. Use existing native Node test boundaries and follow the skill's seam-agreement workflow; routine verification alone does not require TDD. |
| **Matt Pocock: `code-review`** | Reviewing a branch, PR or changes since a specified point for project standards and issue acceptance criteria. Ponytail review adds a complexity lens. Follow current session rules for any subagents. |
| **Matt Pocock: `prototype`** | A requested throwaway experiment to answer a UI, state-model or logic question. Use Impeccable too when the experiment has an interface. |
| **Matt Pocock: `research`** | Requested investigation of APIs, documentation or technical facts against primary sources, with findings captured in the repo. |
| **Matt Pocock: `grilling`** | The user asks to stress-test a plan or decision. Keep routine implementation moving without starting an unsolicited interview. |
| **Matt Pocock: `pr`** | Writing or updating a PR description. |
| **Matt Pocock: `writing-for-agents`** | Editing agent instructions, skills or documents intended for agents. |
| **Matt Pocock: `wizard`** | A requested guided workflow for steps only the human can perform; account for the user's shell/platform. |

Combine skills when their responsibilities overlap: UI implementation uses Impeccable and Ponytail; a UI bug also uses `diagnosing-bugs`. Load only the relevant skills. Preserve acceptance criteria, deck data and required verification when simplifying.

Other Matt Pocock workflows, such as `to-spec`, `to-tickets`, `triage`, `wayfinder` or handoff/orchestration skills, apply only when available and requested for that workflow. Keep planning in this repository's GitHub Issues and PRs. Use tool-specific setup skills (hooks, TypeScript boundaries, test-data migrations) only for an explicit matching request; this project remains dependency-free browser JavaScript and Node. Skill selection itself does not authorize new chats, delegation, publishing or configuration changes.

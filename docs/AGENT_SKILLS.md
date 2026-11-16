# Skill routing

Select from the skills available in this session using their descriptions and the actual task. Read a selected skill's `SKILL.md` before applying it; load only its relevant playbook/references. This page adds project-specific routing, not a second catalog of every installed skill.

| Task | Route |
| --- | --- |
| UI design, implementation, review or copy | Impeccable; read `DESIGN.md` and `.impeccable/surface.md`. Preserve the existing interface for focused changes and use current source/browser evidence. |
| Coding, refactoring, review or dependency choices | Ponytail entry skill, then its routed workflow. Prefer existing helpers and Node/browser APIs; preserve behavior, data and required verification. |
| Broken behavior, errors or performance regressions | `diagnosing-bugs`; establish the cause before changing code. Combine with UI/coding guidance where relevant. |
| Agent instructions or skills | `writing-for-agents`. |
| PR description | `pr`, with the repository template and actual validation evidence. |
| Module boundaries, terminology, test-first work or experiments | Relevant `codebase-design`, `domain-modeling`, `tdd` or `prototype` skill when its session description matches. Keep scope proportional to this app. |

Explicit requests for other available skills follow their session instructions. Skill selection does not authorize delegation, extra chats, installation, global configuration changes or merging. Project/user scope governs generic examples. If a skill is unavailable, report that limitation and continue independent work using project guidance; installation remains a separate decision. Use [DEVELOPMENT.md](DEVELOPMENT.md) for verification and delivery.

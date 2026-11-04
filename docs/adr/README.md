# Architecture decision records

Roadmap 22.03.01–.03. Four records, because four decisions explain most of what
this project is and is not.

| # | Decision | Date | Status |
| --- | --- | --- | --- |
| [0001](0001-static-site-and-one-small-service.md) | A prerendered static site plus one small service — no database, no CMS, no commerce platform | 2026-11-03 | accepted |
| [0002](0002-typed-data-over-a-cms.md) | Typed data files in Git as the single source of truth, not a content management system | 2026-11-03 | accepted |
| [0003](0003-no-e-commerce-at-launch.md) | No e-commerce at launch | 2026-11-03 | accepted |
| [0004](0004-native-android-app.md) | A native Android app reading the generated bundle, with a local outbox | 2026-11-03 | accepted |

Each record answers three questions: **what was decided**, **what was rejected and
why**, and **what would make us come back**. The third is the one that keeps an ADR
useful — a decision without an exit condition is a habit.

## How to add one

Number sequentially, keep the four headings (Status / Context / Decision /
Consequences), name the options that were rejected, and state the trigger for
revisiting it. Add the row above. A record is not revised in place once accepted:
supersede it with a new one and change its Status line to `superseded by 000N`.

The reason to write them down at all is that the next person to look at this
repository — a developer, or the same developer in a year — will otherwise re-litigate
a settled question, or "fix" a deliberate constraint. "Why is there no cart?" and
"Why can't marketing publish a colour?" both have answers here.

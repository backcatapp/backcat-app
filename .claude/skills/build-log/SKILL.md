---
name: build-log
description: Record a day's shipped work in the vault Build Log and tick sprint checkboxes. Use after a working session that shipped something, or when the user says "log today", "update the build log", or "end of day".
---

# Build Log update

The vault is the source of truth for sprint tracking:

- Build Log: `G:\Obsidian\MyNet\10 Projects\Backcat\Sprint\Build Log.md`
- Sprint checklists: `G:\Obsidian\MyNet\10 Projects\Backcat\Sprint\Dev Sprint (Days 1-14).md` (days 1–14) and `Marketing Sprint (Days 15-30).md`
- Decision Log: `G:\Obsidian\MyNet\10 Projects\Backcat\Decision Log.md`

## Steps

1. **Gather what actually happened this session**: what shipped, what was verified (and how), what broke, real measured numbers (costs, durations, counts, eval scores). Check `git log` since the last Build Log entry if unsure.
2. **Write the Build Log entry** (newest first, `## Day N — Title`):
   - What shipped, with commit hashes.
   - A "Verified, and how" section — only claims that were actually checked.
   - An "Honest gap" section for anything untested or cut — with an open `- [ ]` checkbox.
   - Failures worth posting (this feeds the public posts — the honest version makes the post easy).
3. **Tick checkboxes** in the sprint note for completed items only. Do not tick partially done items — add a carryover line to the next day instead.
4. **New decisions made today?** Add a one-line row to the Decision Log (newest on top) and mirror it in `docs/DECISIONS.md` in the repo.
5. If the architecture changed, update BOTH the vault `Architecture.md` and repo `docs/ARCHITECTURE.md`.

## Rules

- **Never invent numbers.** `[bracketed]` figures in vault docs are placeholders — replace only with measured reality, and only when you have the measurement.
- Write the honest version including failures; the Build Log is the raw material for public recaps and the day-30 case study.
- Keep the vault's voice: plain, specific, no hype.

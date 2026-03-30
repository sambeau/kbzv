# Copilot Instructions

This project uses **Kanbanzai** for workflow management via MCP.

## Required: Read AGENTS.md

Read `AGENTS.md` in the project root before doing any work. It contains the
workflow rules and points to the skill files you need to follow.

## Quick Reference

- Call `status` to see project state
- Call `next` to see the work queue
- Read `.agents/skills/kanbanzai-getting-started/SKILL.md` at session start
- Follow stage gates in `.agents/skills/kanbanzai-workflow/SKILL.md`
- Use kanbanzai MCP tools for all workflow operations — do not write
  `.kbz/` files or `work/` documents directly without using `doc` and
  `entity` tools

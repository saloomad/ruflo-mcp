# Muse (Deezoh) — Cloud Worker

This folder is the sync point between **Deezoh** (Saleem's Muse agent, running
in the cloud) and the local agent system on ASUSSNAP.

## What lives here

- `AGENTS.md` — how Deezoh works, how to customize him, what he can/can't do
- `MEMORY.md` — durable facts Deezoh keeps about Saleem and the work
- `CURRENT.md` — what Deezoh is currently focused on
- `skills/` — reusable skills Deezoh has built (each with its own SKILL.md)
- `projects/` — work projects and deliverables
- `issues/` — open issues and blockers
- `mail/` — inbox for local agents to send Deezoh things (Deezoh never
  overwrites or deletes what's put here; he replies with new files)
- `acceptance/` — acceptance criteria and sign-offs for delivered work

## How sync works

Deezoh copies new work here over SSH. Local agents read from here.
To give Deezoh something to do, drop a note in `cowork/` or tell Saleem.

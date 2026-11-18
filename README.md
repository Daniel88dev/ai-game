# Merge Conflict (working title)

A turn-based, pixel-art RPG about a junior developer who starts their career the week the AI era begins.
Bugs are monsters, Jira tickets are quests, and your attributes decide how well you (and your AI tools) fix things.

This repository holds **Act I: "Before the Wave"** (Epic: *Lumen 2.0*), about an hour of play:

- Walk around the Lumen Ledger office and talk to six people: **Priya** (PM), **Marta** (Staff Engineer, your mentor),
  **Lena** (QA), **Kofi** (SRE, on call), **Jace** (the rival junior who ships everything with PILOT) and **Gideon** (CTO).
- **8 tickets** that unlock in a chain (Bug, Story, Task, Spike), ending in the Act I boss:

  | Ticket | Who | What you do |
  |---|---|---|
  | LUM-7 Login crashes for users without an avatar | Priya | Fight the NullPointer Beetle |
  | LUM-14 Add "Export to CSV" button | Priya | Fight the Off-by-One Imp |
  | LUM-22 Review Jace's PR #42 | Marta | **Code Review** minigame |
  | LUM-27 Why does the test suite take 9 minutes? | Lena | **CI Pipeline** minigame (flaky tests) |
  | LUM-29 Cover the budget calculator with tests | Lena | **Coverage Crawl** minigame |
  | LUM-31 Dashboard gets slower every hour | Kofi | Fight the Memory Leak Slime (grows every turn) |
  | LUM-35 The avatar crash is back | Priya | Fight the Regression Revenant (comes back unless you write a test) |
  | LUM-33 Balance shows -0.00 for some users | Priya | **Boss:** the Heisenbug (hides from debuggers, needs 3 clues from logging) |

- Turn-based fights: **Debug**, **Read stack trace** (clues to the root cause), **Write test** (softens hits, stops
  regressions), **Ask PILOT** (strong, costs tokens, can hallucinate), **Coffee**. Heavy attacks are telegraphed.
- All **7 attributes**: Logic, Rigor, Velocity (craft), Prompt Craft, Orchestration (AI), Focus, Domain Insight (shared).
  They change fights *and* minigames (more release minutes, a suspicious-line heat map, previews of where test inputs go).
- The **no-AI path is as viable as the AI path**: Focus refills at the coffee machine, and so does your token budget.
  Bots in `playthrough.test.ts` finish the whole act with a craft-only build and an AI-heavy build.
- Choices (asking clarifying questions, how you answer Jace and Gideon) and play style feed the hidden
  Understanding / Leverage axes that will pick the ending.
- Save and load (localStorage, manual slot + autosave), **export** a save to a `.json` file and **import** it again.
  Saves are versioned; v1 saves from the first slice load and migrate.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain + application tests (Vitest), including full Act I playthroughs
VITE_BALANCE_REPORT=1 npx vitest run playthrough --silent=false   # print a balance report
npm run build      # typecheck + production build into dist/
```

Controls: `WASD`/arrows walk, `E`/`Space` interact, `1`-`5` choose options and actions, `R` retreat, `Q` Jira board, `C` character, `Esc` menu. Minigames are played with the mouse (code review also takes `1`-`4` for the comment type).

## Architecture

Game rules live in a framework-free domain layer. Phaser and React are adapters around it.

```
src/
  domain/            pure TypeScript, no Phaser, no React, no DOM
    commands.ts      Command union (MoveHero, Interact, ChooseDialogueOption, TakeBattleAction, ...)
    events.ts        DomainEvent union (HeroMoved, QuestAccepted, HeroDebugged, BattleWon, LeveledUp, ...)
    decide.ts        decide(state, command) -> events | rejection   (all rules live here)
    evolve.ts        evolve(state, event) -> state                   (pure fold, no validation)
    queries.ts       read models for the UI: getHud, getBattle, getDialogue, getQuestLog, getWorld, ...
    hero/ quest/ combat/ dialogue/ world/   aggregates and value objects
    minigames/       one bounded context per minigame (ciPipeline, coverage, codeReview), each a pure
                     start/decide/evolve module behind a small registry; views.ts = their read models
    content/         data: NPCs + dialogue trees, quests (Act I chain), enemies, encounters
    shared/rng.ts    seeded PRNG; the seed is part of the state, so fights are reproducible
  application/
    gameService.ts   command bus + event publisher (dispatch -> decide -> evolve -> publish)
    battleLog.ts     projection: events -> battle log lines
    saveGame.ts      save file format (versioned + validated), SaveStore port, save/load/export/import use cases
    autosave.ts      autosave policy (which events trigger it)
  infrastructure/    adapters: localStorage SaveStore, file download/upload
  game/              Phaser 4: textures generated from pixel grids, OfficeScene, BattleScene
  ui/                React 19 overlay: HUD, dialogue, battle panel, menu, quest board, character sheet
  runtime.ts         composition root
```

The flow is a classic "decider":

1. Phaser or React sends a **command** to `GameService.dispatch`.
2. `decide` validates it against the current state and returns **events** (or a rejection reason).
3. `evolve` folds the events into the new state.
4. Listeners get the events: Phaser animates them, the battle log projection turns them into text, the UI store shows toasts, the autosave policy may save.
5. React re-renders from **queries** over the new state (`useSyncExternalStore`).

The battle scene replays each event through the domain's own `evolve`, so the HP bars move step by step (your hit first, then the bug's answer) without duplicating any rule in the view.

Saves are state snapshots with a `format` + `version` header, a validator, and `migrate()` steps (v1 -> v2 adds the three new attributes and story flags).

Minigames follow the contract from `design/minigames.md` §18: the core starts a session from a hero snapshot, routes `PlayMinigame` moves to the minigame's own decider, and only learns the final grade (`MinigameFinished`). Minigame events carry their own `cost` (tokens, Focus) that the root `evolve` applies to the hero.

### Art

All sprites are pixel grids in code (`src/game/gfx/sprites.ts`, `tiles.ts`) in the "Dark Mode 24" palette from the art direction doc. They are placeholders until the real tileset and sprites arrive; swapping in PNG atlases only touches `BootScene`.

## Deploy

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`.
One-time setup: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
The Vite build uses relative asset paths (`base: './'`), so it works under `/<repo>/`.

`.github/workflows/ci.yml` runs typecheck, tests and a build on pull requests.

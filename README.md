# Merge Conflict (working title)

A turn-based, pixel-art RPG about a junior developer who starts their career the week the AI era begins.
Bugs are monsters, Jira tickets are quests, and your attributes decide how well you (and your AI tools) fix things.

This repository holds the **first playable vertical slice**:

- Walk around the Lumen Ledger office (tile-based, 4 directions).
- Talk to **Priya** (PM). She hands you ticket **LUM-7**, "Login crashes for users without an avatar". You can ask a clarifying question first.
- A **NullPointer Beetle** appears by your desk. Fight it in a turn-based battle:
  - **Debug**: manual fix, scales with Logic, often slides off the bug's "null shell" until you know the root cause.
  - **Read stack trace**: costs Focus, reveals the root cause (Debug never misses after that and hits harder).
  - **Ask PILOT**: AI patch, costs tokens, strong, but can hallucinate and heal the bug.
  - **Coffee**: restores Focus and some HP (2 cups per fight).
  - Every third enemy turn is a telegraphed heavy attack.
- Win, go back to Priya, merge the PR. Gain XP, level up, spend attribute points.
- Save and load (localStorage, manual slot + autosave), **export** a save to a `.json` file and **import** it again.
- The coffee machine heals you and autosaves. Marta (Staff Engineer) gives hints.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain + application unit tests (Vitest)
npm run build      # typecheck + production build into dist/
```

Controls: `WASD`/arrows walk, `E`/`Space` interact, `1`-`4` choose options and actions, `R` retreat, `Q` Jira board, `C` character, `Esc` menu.

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
    content/         data: NPCs + dialogue trees, quests, enemies, encounters
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

Saves are state snapshots with a `format` + `version` header and a validator, and a `migrate()` hook for future versions.

### Art

All sprites are pixel grids in code (`src/game/gfx/sprites.ts`, `tiles.ts`) in the "Dark Mode 24" palette from the art direction doc. They are placeholders until the real tileset and sprites arrive; swapping in PNG atlases only touches `BootScene`.

## Deploy

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`.
One-time setup: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
The Vite build uses relative asset paths (`base: './'`), so it works under `/<repo>/`.

`.github/workflows/ci.yml` runs typecheck, tests and a build on pull requests.

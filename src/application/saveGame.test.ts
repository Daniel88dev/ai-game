import { describe, expect, it } from 'vitest';
import { newGame, startBattle, ENEMIES } from '../domain';
import { MemorySaveStore } from '../infrastructure/localStorageSaveStore';
import { deserialize, SaveError, SaveGameService, serialize } from './saveGame';
import { GameService } from './gameService';
import { shouldAutosave } from './autosave';

const clock = () => new Date('2026-11-18T10:00:00Z');

describe('save files', () => {
  it('round-trips a game state', () => {
    const s = { ...newGame('Ada'), quests: { 'LUM-7': { status: 'inProgress' as const, clarified: true } } };
    const back = deserialize(serialize(s, clock())).state;
    expect(back).toEqual(s);
  });

  it('refuses to save during a fight', () => {
    const s = { ...newGame(), battle: startBattle('lum7-beetle', ENEMIES.nullPointerBeetle!) };
    expect(() => serialize(s)).toThrow(SaveError);
  });

  it.each([
    ['not json', 'not valid JSON'],
    ['{"format":"other"}', 'not a Merge Conflict save'],
    ['{"format":"merge-conflict-save","version":99,"state":{}}', 'newer version'],
    ['{"format":"merge-conflict-save","version":1,"state":{"hero":{}}}', 'damaged'],
  ])('rejects bad input %s', (raw, msg) => {
    expect(() => deserialize(raw)).toThrow(msg);
  });

  it('saves to slots, lists them and exports a dated file', () => {
    const svc = new SaveGameService(new MemorySaveStore(), clock);
    expect(svc.latest()).toBeNull();
    svc.save(newGame('Ada'), 'auto');
    expect(svc.list()).toEqual([{ slot: 'auto', savedAt: '2026-11-18T10:00:00.000Z', heroName: 'Ada', level: 1 }]);
    expect(svc.load('auto').hero.name).toBe('Ada');
    const file = svc.exportFile(newGame('Bo'));
    expect(file.filename).toBe('merge-conflict-2026-11-18-10-00-00.json');
    expect(svc.importFile(file.content).hero.name).toBe('Bo');
  });
});

describe('GameService', () => {
  it('publishes events and notifies subscribers only for accepted commands', () => {
    const game = new GameService(newGame());
    const seen: string[] = [];
    let notified = 0;
    game.onEvents((events) => seen.push(...events.map((e) => e.type)));
    game.subscribe(() => notified++);
    expect(game.dispatch({ type: 'Interact' }).ok).toBe(false);
    expect(game.dispatch({ type: 'MoveHero', direction: 'up' }).ok).toBe(true);
    expect(seen).toEqual(['HeroMoved']);
    expect(notified).toBe(1);
    expect(game.getState().turn).toBe(1);
  });

  it('autosaves on rest and quest milestones only', () => {
    expect(shouldAutosave([{ type: 'HeroMoved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, facing: 'right' }])).toBe(false);
    expect(shouldAutosave([{ type: 'QuestAccepted', questId: 'LUM-7' }])).toBe(true);
  });
});

import { decide, evolveAll, newGame, type Command, type DomainEvent, type GameState } from '../domain';

export type EventListener = (events: readonly DomainEvent[], state: GameState) => void;
export type StateListener = () => void;

export interface DispatchResult {
  readonly ok: boolean;
  readonly events: readonly DomainEvent[];
  readonly reason?: string;
}

/**
 * Application service: the command bus and the event publisher in one small class.
 *
 *   dispatch(command) -> decide -> evolve -> publish events -> notify state listeners
 *
 * React reads state via `subscribe`/`getState` (useSyncExternalStore);
 * Phaser listens to events for animation. Neither mutates state directly.
 */
export class GameService {
  private state: GameState;
  private readonly eventListeners = new Set<EventListener>();
  private readonly stateListeners = new Set<StateListener>();

  constructor(initial: GameState = newGame()) {
    this.state = initial;
  }

  getState = (): GameState => this.state;

  dispatch = (command: Command): DispatchResult => {
    const decision = decide(this.state, command);
    if (!decision.ok) return { ok: false, events: [], reason: decision.reason };
    this.state = { ...evolveAll(this.state, decision.events), turn: this.state.turn + 1 };
    for (const l of this.eventListeners) l(decision.events, this.state);
    for (const l of this.stateListeners) l();
    return { ok: true, events: decision.events };
  };

  /** Replace the whole state (new game, load, import). Listeners get a synthetic reset. */
  reset(state: GameState): void {
    this.state = state;
    for (const l of this.eventListeners) l([], this.state);
    for (const l of this.stateListeners) l();
  }

  onEvents(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  subscribe = (listener: StateListener): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };
}

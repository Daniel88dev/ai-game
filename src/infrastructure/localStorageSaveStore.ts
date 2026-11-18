import type { SaveSlot, SaveStore } from '../application/saveGame';

const KEY_PREFIX = 'merge-conflict:save:';

/** SaveStore adapter backed by window.localStorage. */
export class LocalStorageSaveStore implements SaveStore {
  constructor(private readonly storage: Storage = window.localStorage) {}

  read(slot: SaveSlot): string | null {
    try {
      return this.storage.getItem(KEY_PREFIX + slot);
    } catch {
      return null; // private mode / blocked storage
    }
  }

  write(slot: SaveSlot, data: string): void {
    this.storage.setItem(KEY_PREFIX + slot, data);
  }

  remove(slot: SaveSlot): void {
    this.storage.removeItem(KEY_PREFIX + slot);
  }
}

/** In-memory adapter for tests and for browsers that block storage. */
export class MemorySaveStore implements SaveStore {
  private readonly data = new Map<SaveSlot, string>();
  read(slot: SaveSlot): string | null {
    return this.data.get(slot) ?? null;
  }
  write(slot: SaveSlot, data: string): void {
    this.data.set(slot, data);
  }
  remove(slot: SaveSlot): void {
    this.data.delete(slot);
  }
}

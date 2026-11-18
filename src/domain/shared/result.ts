/** Outcome of deciding a command: either the events it produced, or why it was rejected. */
export type Decision<E> =
  | { readonly ok: true; readonly events: readonly E[] }
  | { readonly ok: false; readonly reason: string };

export const accept = <E>(...events: E[]): Decision<E> => ({ ok: true, events });
export const reject = <E>(reason: string): Decision<E> => ({ ok: false, reason });

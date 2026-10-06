export const READ_BUDGET_MS = 8_000;
export class ReadTimeoutError extends Error {
  constructor() { super("Permintaan terlalu lama. Coba lagi."); this.name = "ReadTimeoutError"; }
}
/** Bound reads only. Never use this helper to retry or bound a financial mutation. */
export function withinReadBudget<T>(operation: PromiseLike<T>, milliseconds = READ_BUDGET_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ReadTimeoutError()), milliseconds);
    Promise.resolve(operation).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export class NoTransitionFoundError extends Error {
  constructor(from: any, to: any) {
    super(`No transition path found from '${from}' to '${to}'`);
  }
}

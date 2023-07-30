export class EntityInFinalStateError extends Error {
  constructor(state: any) {
    super(`Entity is in a final state: ${state}`);
  }
}

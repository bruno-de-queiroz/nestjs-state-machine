export type Transition = string;

export const asTransition = <T, U extends keyof T>(
  a: T[U],
  b: T[U],
): Transition => `${a}->${b}` as Transition;

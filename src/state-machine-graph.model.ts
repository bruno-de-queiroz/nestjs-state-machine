import { NoTransitionFoundError } from './no-transition-found.error';

export type StateMachineNode<T, U extends keyof T> = {
  state: T[U];
  next?: T[U] | StateMachineNode<T, U> | Array<T[U] | StateMachineNode<T, U>>;
};

export interface StateMachineGraphOptions<T, U extends keyof T> {
  root: StateMachineNode<T, U>;
  manual?: T[U][];
  strict?: boolean;
}

export class StateMachineGraph<T, U extends keyof T> {
  private readonly map: Map<T[U], T[U][]>;
  private readonly manual: Map<T[U], boolean>;
  private readonly strict: boolean;

  constructor(private readonly options: StateMachineGraphOptions<T, U>) {
    this.map = StateMachineGraph.build(options.root);
    this.manual = (options.manual ?? []).reduce(
      (a, b) => a.set(b, true),
      new Map(),
    );
    this.strict = options.strict === true;
  }

  static build<T, U extends keyof T>(
    node: StateMachineNode<T, U>,
  ): Map<T[U], T[U][]> {
    const reduce = (
      node: T[U] | StateMachineNode<T, U>,
      map: Map<T[U], T[U][]>,
      auto: Map<T[U], boolean>,
    ): Map<T[U], T[U][]> => {
      const current = node as StateMachineNode<T, U>;
      const next = Array.isArray(current.next) ? current.next : [current.next];

      for (const it of next) {
        if (typeof it === 'object') {
          const nextNode = it as StateMachineNode<T, U>;
          map.set(current.state, [
            ...(map.get(current.state) ?? []),
            nextNode.state,
          ]);
          reduce(nextNode, map, auto);
        } else {
          map.set(current.state, [...(map.get(current.state) ?? []), it]);
        }
      }

      return map;
    };

    return reduce(node, new Map(), new Map());
  }

  diagram(): string {
    const print = (
      state: T[U],
      indent: string = '',
      isLast: boolean = true,
      prev: string = '',
    ): string => {
      prev += indent;
      if (isLast) {
        prev += '└─';
        indent += '  ';
      } else {
        prev += '├─';
        indent += '│ ';
      }
      prev += `${this.manual.get(state) === true ? `${state}(*)` : state}\n`;
      const transitions = this.map.get(state);
      if (Array.isArray(transitions)) {
        prev = transitions.reduce(
          (a, nextState, idx) =>
            print(nextState, indent, idx === transitions.length - 1, a),
          prev,
        );
      }

      return prev;
    };

    return `\n${print(this.options.root.state)}\n(*) Only manual transitions`;
  }

  getNextStates(state: T[U], includeManual: boolean = true): T[U][] {
    return (this.map.get(state) || []).filter((it) =>
      includeManual ? true : this.manual.get(it) !== true,
    );
  }

  isFinalState(state: T[U]): boolean {
    return !this.map.has(state);
  }

  transitions(a: T[U], b: T[U]): T[U][] {
    const queue: Array<[T[U], T[U][]]> = [[a, [a]]];
    const visited: Set<T[U]> = new Set<T[U]>();
    visited.add(a);

    while (queue.length > 0) {
      const [currentState, path] = queue.shift()!;
      if (currentState === b) {
        return path.slice(1); // Exclude the startState from the path
      }

      const nextStates = this.getNextStates(currentState);
      for (const nextState of nextStates) {
        if (!visited.has(nextState)) {
          visited.add(nextState);
          queue.push([nextState, [...path, nextState]]);
        }
      }
    }

    if (this.strict) {
      throw new NoTransitionFoundError(a, b);
    }

    return [];
  }
}

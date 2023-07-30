import { StateMachineGraph } from './state-machine-graph.model';

enum State {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  SYNCHRONIZED = 'SYNCHRONIZED',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

class Stateful {
  state: State;
}

describe('StateMachineGraph', () => {
  const graph = new StateMachineGraph<Stateful, 'state'>({
    root: {
      state: State.CREATED,
      next: [
        {
          state: State.PROCESSING,
          next: [State.SYNCHRONIZED, State.EXPIRED, State.CANCELLED],
        },
        {
          state: State.SYNCHRONIZED,
          next: [
            State.FULFILLED,
            { state: State.FAILED, next: State.FULFILLED },
            State.CANCELLED,
          ],
        },
        State.EXPIRED,
        State.CANCELLED,
      ],
    },
    manual: [State.FAILED, State.EXPIRED, State.CANCELLED],
    strict: false,
  });

  describe('getNextStates', () => {
    it.each([
      {
        state: State.CREATED,
        expected: [
          State.PROCESSING,
          State.SYNCHRONIZED,
          State.EXPIRED,
          State.CANCELLED,
        ],
      },
      {
        state: State.PROCESSING,
        expected: [State.SYNCHRONIZED, State.EXPIRED, State.CANCELLED],
      },
      {
        state: State.SYNCHRONIZED,
        expected: [State.FULFILLED, State.FAILED, State.CANCELLED],
      },
      {
        state: State.FAILED,
        expected: [State.FULFILLED],
      },
    ])(
      `Must return all next states of a state $state`,
      ({ state, expected }) => {
        expect(graph.getNextStates(state)).toStrictEqual(expected);
      },
    );

    it.each([
      {
        state: State.CREATED,
        expected: [State.PROCESSING, State.SYNCHRONIZED],
      },
      {
        state: State.PROCESSING,
        expected: [State.SYNCHRONIZED],
      },
      {
        state: State.SYNCHRONIZED,
        expected: [State.FULFILLED],
      },
      {
        state: State.FAILED,
        expected: [State.FULFILLED],
      },
    ])(
      `Must return only non-manual possible next states of a state $state`,
      ({ state, expected }) => {
        expect(graph.getNextStates(state, false)).toStrictEqual(expected);
      },
    );
  });

  describe('transitions', () => {
    it.each([
      {
        from: State.CREATED,
        to: State.FULFILLED,
        expected: [State.SYNCHRONIZED, State.FULFILLED],
      },
      {
        from: State.PROCESSING,
        to: State.FULFILLED,
        expected: [State.SYNCHRONIZED, State.FULFILLED],
      },
      {
        from: State.CREATED,
        to: State.CANCELLED,
        expected: [State.CANCELLED],
      },
      {
        from: State.CREATED,
        to: State.EXPIRED,
        expected: [State.EXPIRED],
      },
      {
        from: State.PROCESSING,
        to: State.CANCELLED,
        expected: [State.CANCELLED],
      },
      {
        from: State.PROCESSING,
        to: State.EXPIRED,
        expected: [State.EXPIRED],
      },
      {
        from: State.PROCESSING,
        to: State.FAILED,
        expected: [State.SYNCHRONIZED, State.FAILED],
      },
      {
        from: State.PROCESSING,
        to: State.CREATED,
        expected: [],
      },
      {
        from: State.FULFILLED,
        to: State.CREATED,
        expected: [],
      },
      {
        from: State.SYNCHRONIZED,
        to: State.CREATED,
        expected: [],
      },
      {
        from: State.SYNCHRONIZED,
        to: State.PROCESSING,
        expected: [],
      },
    ])(
      `Must return shortest path of transitions between state $from and $to`,
      ({ from, to, expected }) => {
        expect(graph.transitions(from, to)).toStrictEqual(expected);
      },
    );
  });

  describe('isFinalState', () => {
    it.each([State.FULFILLED, State.CANCELLED, State.EXPIRED])(
      'Must return true when a checking if %p is final',
      (state) => {
        expect(graph.isFinalState(state)).toBeTruthy();
      },
    );

    it.each([
      State.CREATED,
      State.PROCESSING,
      State.SYNCHRONIZED,
      State.FAILED,
    ])('Must return false when a checking if %p is final', (state) => {
      expect(graph.isFinalState(state)).toBeFalsy();
    });
  });

  describe('diagram', () => {
    it('Must show the complete diagram of the state-machine', () => {
      expect(graph.diagram()).toBe(`
└─CREATED
  ├─PROCESSING
  │ ├─SYNCHRONIZED
  │ │ ├─FULFILLED
  │ │ ├─FAILED(*)
  │ │ │ └─FULFILLED
  │ │ └─CANCELLED(*)
  │ ├─EXPIRED(*)
  │ └─CANCELLED(*)
  ├─SYNCHRONIZED
  │ ├─FULFILLED
  │ ├─FAILED(*)
  │ │ └─FULFILLED
  │ └─CANCELLED(*)
  ├─EXPIRED(*)
  └─CANCELLED(*)

(*) Only manual transitions`);
    });
  });
});

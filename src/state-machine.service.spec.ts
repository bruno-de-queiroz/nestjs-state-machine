
import {
  from,
  map,
  mergeMap,
  Observable,
  of,
  take,
  takeLast,
  throwIfEmpty,
} from 'rxjs';
import { Injectable } from '@nestjs/common';
import { CanTransition } from './can-transition.interface';
import { asTransition, Transition } from './transition.type';
import { isDefined } from 'class-validator';
import { StateMachineGraph } from './state-machine-graph.model';
import { EntityInFinalStateError } from './entity-in-final-state.error';
import { or } from './rx-extensions/or';
import { StateMachineService } from './state-machine.service';

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
  state: State = State.CREATED;
}

describe('StateMachineService', () => {
  describe('transition', () => {
    it('Must return the input when no transition path is present for a graph that is not strict', (done) => {
      const service = new StateMachineService<Stateful, 'state'>('state', new StateMachineGraph<Stateful, "state">({
        root: {
          state: State.CREATED,
          next: []
        },
      }), new Map())

      const input = new Stateful();
      service.transition(input, State.CREATED)
        .subscribe(data => {
          expect(data.state).toBe(State.CREATED);
          done();
        })
    })
  })
});
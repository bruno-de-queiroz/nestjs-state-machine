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

@Injectable()
export class StateMachineService<T, U extends keyof T> {
  constructor(
    private readonly field: U,
    private readonly graph: StateMachineGraph<T, U>,
    private readonly guards: Map<Transition, CanTransition<T>>,
  ) {}

  transition(input: T, b: T[U]): Observable<T> {
    return of(b)
      .pipe(map((it) => this.graph.transitions(input[this.field], it)))
      .pipe(
        mergeMap((transitions) =>
          or(
            transitions.length > 0,
            () => this.transitionAll(input, transitions),
            () => of(input),
          ),
        ),
      );
  }

  next(input: T): Observable<T> {
    return from(this.graph.getNextStates(input[this.field], false))
      .pipe(take(1))
      .pipe(mergeMap((it) => this.transitionAll(input, [it])))
      .pipe(throwIfEmpty(() => new EntityInFinalStateError(input[this.field])));
  }

  private transitionAll(input: T, states: T[U][]) {
    return from(states)
      .pipe(
        mergeMap((b) =>
          of(asTransition<T, U>(input[this.field], b))
            .pipe(map((it) => this.guards.get(it)))
            .pipe(
              mergeMap((guard) =>
                or(
                  isDefined(guard),
                  () => guard.canTransition(input),
                  () => of(input),
                ).pipe(map((it) => Object.assign(it, { [this.field]: b }))),
              ),
            ),
        ),
      )
      .pipe(takeLast(1));
  }
}

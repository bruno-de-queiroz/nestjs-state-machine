import { DynamicModule, Module } from '@nestjs/common';
import { CanTransition } from './can-transition.interface';
import { Transition } from './transition.type';
import { Type } from '@nestjs/common/interfaces/type.interface';
import { StateMachineService } from './state-machine.service';
import { getTransition } from './transition-guard.decorator';
import { ForwardReference } from '@nestjs/common/interfaces/modules/forward-reference.interface';
import {
  StateMachineGraph,
  StateMachineGraphOptions,
} from './state-machine-graph.model';

export type ModuleOptions<T, U extends keyof T> = {
  entity: Type<T>;
  field: U;
  imports?: Array<
    Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference
  >;
  graph: StateMachineGraphOptions<T, U>;
  guards: Type<CanTransition<T>>[];
};

@Module({})
export class StateMachineModule {
  static forFeature<T, U extends keyof T>(
    options: ModuleOptions<T, U>,
  ): DynamicModule {
    const guards = options.guards;
    return {
      module: StateMachineModule,
      imports: options.imports,
      providers: [
        ...guards,
        {
          provide: Map<Transition, CanTransition<T>>,
          inject: [...guards],
          useFactory: (...arr: CanTransition<T>[]) => {
            return arr.reduce(
              (a, b) => a.set(getTransition(b), b),
              new Map<Transition, CanTransition<T>>(),
            );
          },
        },
        {
          provide: StateMachineGraph<T, U>,
          useValue: new StateMachineGraph(options.graph),
        },
        {
          provide: StateMachineService<T, U>,
          inject: [StateMachineGraph<T, U>, Map<Transition, CanTransition<T>>],
          useFactory: (
            graph: StateMachineGraph<T, U>,
            guards: Map<Transition, CanTransition<T>>,
          ) => {
            return new StateMachineService<T, U>(options.field, graph, guards);
          },
        },
      ],
      exports: [StateMachineService<T, U>],
    };
  }
}

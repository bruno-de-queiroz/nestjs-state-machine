import 'reflect-metadata';
import { INJECTABLE_WATERMARK } from '@nestjs/common/constants';
import { asTransition } from './transition.type';
import { CanTransition } from './can-transition.interface';

export const TRANSITION_KEY = '__transition__';

export const TransitionGuard =
  <K, U extends keyof K>(a: K[U], b: K[U]) =>
  <T extends new (...args: any[]) => CanTransition<K>>(target: T) => {
    Reflect.defineProperty(target.prototype, TRANSITION_KEY, {
      value: asTransition(a, b),
      enumerable: false,
      writable: false,
    });
    Reflect.defineMetadata(INJECTABLE_WATERMARK, true, target);
  };

export const getTransition = <T>(target: CanTransition<T>): string => {
  return Reflect.get(target, TRANSITION_KEY);
};

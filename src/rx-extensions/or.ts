import { Observable, of, OperatorFunction } from 'rxjs';

export const or = <T>(
  condition: boolean,
  a: OperatorFunction<boolean, T>,
  b: OperatorFunction<boolean, T>,
): Observable<T> => {
  return of(condition).pipe(condition ? a : b);
};

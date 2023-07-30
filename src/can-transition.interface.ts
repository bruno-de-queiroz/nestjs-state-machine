import { Observable } from 'rxjs';

export interface CanTransition<T> {
  canTransition(data: T): Observable<T>;
}

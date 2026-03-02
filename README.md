# nestjs-state-machine

Declarative state machine module for NestJS with transition guards, automatic path finding, and full DI support.

```bash
npm i nestjs-state-machine
```

## Features

- **Declarative graph** — define states and transitions as a tree, the module builds the adjacency map
- **Transition guards** — injectable classes that approve or reject transitions via RxJS Observables
- **Auto path finding** — BFS shortest path between any two states, calling guards along the way
- **Manual transitions** — mark states that can only be reached explicitly (e.g. `cancelled`, `failed`)
- **Strict mode** — throw when no transition path exists, or silently return the entity
- **ASCII diagrams** — `graph.diagram()` prints the full state tree for debugging
- **Type-safe** — generic over entity type and status field, compile-time state validation

## Quick start

```typescript
import { StateMachineModule, TransitionGuard, CanTransition, StateMachineService } from 'nestjs-state-machine';

// 1. Define your entity
class Order {
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
}

// 2. Register the module
@Module({
  imports: [
    StateMachineModule.forFeature({
      entity: Order,
      field: 'status',
      graph: {
        root: {
          state: 'pending',
          next: [
            {
              state: 'processing',
              next: [
                { state: 'shipped', next: 'delivered' },
                'cancelled',
              ],
            },
            'cancelled',
          ],
        },
        manual: ['cancelled'],
        strict: true,
      },
      guards: [ValidatePayment],
    }),
  ],
})
export class OrderModule {}
```

## Transition guards

Guards are injectable classes decorated with `@TransitionGuard`. They run automatically when traversing their specific transition.

```typescript
@TransitionGuard<Order, 'status'>('pending', 'processing')
class ValidatePayment implements CanTransition<Order> {
  constructor(private readonly payments: PaymentService) {}

  canTransition(order: Order): Observable<Order> {
    return from(this.payments.verify(order)).pipe(
      map(() => order),
    );
  }
}
```

Guards receive full NestJS dependency injection. If a guard throws or the Observable errors, the transition is rejected.

## Service API

Inject `StateMachineService<T, U>` where `T` is your entity and `U` is the status field key.

```typescript
@Injectable()
class OrderService {
  constructor(
    private readonly stateMachine: StateMachineService<Order, 'status'>,
  ) {}
}
```

### `transition(entity: T, to: T[U]): Observable<T>`

Finds the shortest path from the current state to the target state and executes all transitions in sequence, calling guards for each step.

```typescript
this.stateMachine.transition(order, 'delivered')
  .subscribe(result => console.log(result.status)); // 'delivered'
```

### `next(entity: T): Observable<T>`

Moves the entity to the next non-manual state. Follows declaration order in the `next` array.

```typescript
this.stateMachine.next(order)
  .subscribe(result => console.log(result.status)); // 'processing'
```

Throws `EntityInFinalStateError` if no further non-manual transitions exist.

## Graph options

```typescript
interface StateMachineGraphOptions<T, U extends keyof T> {
  root: StateMachineNode<T, U>;  // State tree definition
  manual?: T[U][];               // States only reachable via explicit transition()
  strict?: boolean;              // Throw NoTransitionFoundError when no path exists (default: false)
}
```

### State nodes

States can be defined as strings (leaf nodes) or objects (with children):

```typescript
{
  state: 'processing',
  next: [
    { state: 'shipped', next: 'delivered' },  // object node with child
    'cancelled',                                // string leaf node
  ],
}
```

### Diagram

Call `graph.diagram()` to visualize the state tree:

```
└─pending
  ├─processing
  │ ├─shipped
  │ │ └─delivered
  │ └─cancelled(*)
  └─cancelled(*)

(*) Only manual transitions
```

## License

MIT

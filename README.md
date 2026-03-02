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

## Async configuration

Use `forFeatureAsync` when the graph comes from `ConfigService` or any other injected provider:

```typescript
StateMachineModule.forFeatureAsync({
  entity: Order,
  field: 'status',
  guards: [ValidatePayment],
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    root: config.get('orderGraph'),
    manual: config.get('manualStates'),
    strict: true,
  }),
})
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

## Examples

### Pull Request workflow

CI must pass before merging, reviewers can request changes, and anyone can close at any time.

```typescript
class PullRequest {
  status: 'draft' | 'open' | 'review' | 'changes_requested' | 'approved' | 'merged' | 'closed';
}

// CI pipeline guard — blocks merge if checks fail
@TransitionGuard<PullRequest, 'status'>('approved', 'merged')
class CiMustPass implements CanTransition<PullRequest> {
  constructor(private readonly ci: CiService) {}

  canTransition(pr: PullRequest): Observable<PullRequest> {
    return from(this.ci.getStatus(pr)).pipe(
      map(status => {
        if (status !== 'green') throw new Error('CI checks have not passed');
        return pr;
      }),
    );
  }
}

// Notify author when changes are requested
@TransitionGuard<PullRequest, 'status'>('review', 'changes_requested')
class NotifyAuthor implements CanTransition<PullRequest> {
  constructor(private readonly notifications: NotificationService) {}

  canTransition(pr: PullRequest): Observable<PullRequest> {
    return from(this.notifications.send(pr, 'Changes requested')).pipe(map(() => pr));
  }
}

StateMachineModule.forFeature({
  entity: PullRequest,
  field: 'status',
  graph: {
    root: {
      state: 'draft',
      next: {
        state: 'open',
        next: [
          {
            state: 'review',
            next: [
              {
                state: 'changes_requested',
                next: 'review',  // back to review after fixes
              },
              { state: 'approved', next: 'merged' },
            ],
          },
          'closed',
        ],
      },
    },
    manual: ['closed'],
    strict: true,
  },
  guards: [CiMustPass, NotifyAuthor],
})
```

```
└─draft
  └─open
    ├─review
    │ ├─changes_requested
    │ │ └─review
    │ └─approved
    │   └─merged
    └─closed(*)
```

```typescript
// Auto-advance: draft → open → review
stateMachine.transition(pr, 'review').subscribe();

// Reviewer requests changes: review → changes_requested
stateMachine.transition(pr, 'changes_requested').subscribe();

// Author pushes fixes, back to review, then all the way to merged
stateMachine.transition(pr, 'merged').subscribe();
// Calls: changes_requested → review → approved → merged (CI guard fires on approved→merged)
```

---

### Super Mario power-ups

Classic power-up chain with a guard that checks if Mario has a mushroom before getting fire flower.

```typescript
class Mario {
  power: 'small' | 'big' | 'fire' | 'star' | 'dead';
}

@TransitionGuard<Mario, 'power'>('big', 'fire')
class RequiresMushroom implements CanTransition<Mario> {
  constructor(private readonly inventory: InventoryService) {}

  canTransition(mario: Mario): Observable<Mario> {
    return from(this.inventory.has(mario, 'fire-flower')).pipe(
      map(has => {
        if (!has) throw new Error('Need a fire flower!');
        return mario;
      }),
    );
  }
}

StateMachineModule.forFeature({
  entity: Mario,
  field: 'power',
  graph: {
    root: {
      state: 'small',
      next: [
        {
          state: 'big',
          next: [
            { state: 'fire', next: 'star' },
            'star',
          ],
        },
        'star',
        'dead',
      ],
    },
    manual: ['dead'],
    strict: true,
  },
  guards: [RequiresMushroom],
})
```

```
└─small
  ├─big
  │ ├─fire
  │ │ └─star
  │ └─star
  ├─star
  └─dead(*)
```

```typescript
// Power up: small → big → fire (guard checks for fire flower)
stateMachine.transition(mario, 'fire').subscribe();

// Get star from any state
stateMachine.transition(mario, 'star').subscribe();

// Automatic next power-up (skips dead since it's manual)
stateMachine.next(mario).subscribe(); // small → big
```

---

### Job interview pipeline

Multi-stage hiring process with automatic rejections and offer approval guards.

```typescript
class Candidate {
  stage: 'applied' | 'screening' | 'phone' | 'onsite' | 'offer' | 'hired' | 'rejected';
}

@TransitionGuard<Candidate, 'stage'>('onsite', 'offer')
class BudgetApproval implements CanTransition<Candidate> {
  constructor(
    private readonly budget: BudgetService,
    private readonly salary: SalaryService,
  ) {}

  canTransition(candidate: Candidate): Observable<Candidate> {
    return from(this.salary.calculate(candidate)).pipe(
      mergeMap(amount => this.budget.approve(amount)),
      map(() => candidate),
    );
  }
}

@TransitionGuard<Candidate, 'stage'>('offer', 'hired')
class BackgroundCheck implements CanTransition<Candidate> {
  constructor(private readonly checks: BackgroundCheckService) {}

  canTransition(candidate: Candidate): Observable<Candidate> {
    return from(this.checks.run(candidate)).pipe(
      map(result => {
        if (!result.passed) throw new Error('Background check failed');
        return candidate;
      }),
    );
  }
}

StateMachineModule.forFeature({
  entity: Candidate,
  field: 'stage',
  graph: {
    root: {
      state: 'applied',
      next: [
        {
          state: 'screening',
          next: [
            {
              state: 'phone',
              next: [
                {
                  state: 'onsite',
                  next: [
                    { state: 'offer', next: 'hired' },
                    'rejected',
                  ],
                },
                'rejected',
              ],
            },
            'rejected',
          ],
        },
        'rejected',
      ],
    },
    manual: ['rejected'],
    strict: true,
  },
  guards: [BudgetApproval, BackgroundCheck],
})
```

```
└─applied
  ├─screening
  │ ├─phone
  │ │ ├─onsite
  │ │ │ ├─offer
  │ │ │ │ └─hired
  │ │ │ └─rejected(*)
  │ │ └─rejected(*)
  │ └─rejected(*)
  └─rejected(*)
```

```typescript
// Fast-track: applied → screening → phone → onsite → offer → hired
// BudgetApproval fires on onsite→offer, BackgroundCheck fires on offer→hired
stateMachine.transition(candidate, 'hired').subscribe();

// Reject at any stage
stateMachine.transition(candidate, 'rejected').subscribe();

// Step-by-step advancement
stateMachine.next(candidate).subscribe(); // applied → screening
stateMachine.next(candidate).subscribe(); // screening → phone
```

## License

MIT

# StateMachineModule 

A simple module to manage a state-machine in a more nestjsish way

## Requirements

* Node.js (https://nodejs.dev/en/learn/how-to-install-nodejs/)


## Installation
```bash
$ npm i --save bruno-de-queiroz/nestjs-state-machine
```

## Usage

Considering this example:
```typescript
class TestEntity {
  status:
    | 'pending'
    | 'processed'
    | 'synchronized'
    | 'fulfilled'
    | 'failed'
    | 'cancelled';
}
```
### Initialization

```typescript
StateMachineModule.forFeature({
    entity: TestEntity,
    field: 'status',
    graph: {
      root: {
        state: 'pending',
        next: [
          {
            state: 'processed',
            next: [
              {
                state: 'synchronized',
                next: [
                  'fulfilled',
                  {
                    state: 'failed',
                    next: 'fulfilled',
                  },
                  'cancelled',
                ],
              },
              'cancelled',
            ],
          },
          'cancelled',
        ],
      },
      manual: ['cancelled', 'failed'],
      strict: true,
    },
    guards: [
      TestTransitionWithInjected,
    ],
})
```

### Transition guard declaration
```typescript
@TransitionGuard<TestEntity, 'status'>('processed', 'synchronized')
class TestTransitionWithInjected implements CanTransition<TestEntity> {
  constructor(private readonly service: Service) {}

  canTransition(input: TestEntity): Observable<TestEntity> {
    return of(input)
            .pipe(filter(() => this.service.validate()))
            .pipe(map(() => input));
  }
}
```

### Service injection

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
class MyService {
  constructor(private readonly stateMachine: StateMachineService<TestEntity, 'status'>) {}
}
```

#### Service methods

##### `transition(input: T, to: T[U]): Observable<T>`
This method will make all the transitions till the targeted state calling the registered guards for each transition, and returns the entity as `Observable<T>`.

```typescript
this.stateMachie.transition(new TestEntity(), 'fulfilled')
        .subscribe(data => expect(data.status).toBe('fulfilled'));
```

##### `next(input: T): Observable<T>`
This method will call the next transition that is not manual and returns the entity as `Observable<T>`. The order in the `next` field of the graph declaration is preserved. 

```typescript
StateMachineModule.forFeature({
  entity: TestEntity,
  field: 'status',
  graph: {
    root: {
      state: 'pending',
      next: [
        { state: 'processed', next: 'fulfilled' },
        'synchronized',
        'cancelled',
      ],
    },
    manual: ['cancelled'],
    strict: true,
  },
  guards: [
    TestTransitionWithInjected,
  ],
})

// ...
this.stateMachie.next(new TestEntity({ status: 'pending' }))
  .subscribe(data => expect(data.status).toBe('processed'));

// ...
this.stateMachie.next(new TestEntity({ status: 'processed' }))
  .subscribe(data => expect(data.status).toBe('fulfilled'));
```

## Test

```bash
# tests
$ npm run test

# test coverage
$ npm run test:cov
```

### Commit convention

See https://www.conventionalcommits.org/en/v1.0.0/#summary

### Versioning

See https://semver.org/

### Auto-versioning based on commit messages

See https://github.com/semantic-release/semantic-release

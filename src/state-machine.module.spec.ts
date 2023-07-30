import { Global, INestApplication, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StateMachineModule } from './state-machine.module';
import { StateMachineService } from './state-machine.service';
import { TransitionGuard } from './transition-guard.decorator';
import { CanTransition } from './can-transition.interface';
import { filter, map, Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StateMachineNode } from './state-machine-graph.model';

class TestEntity {
  status:
    | 'pending'
    | 'processed'
    | 'synchronized'
    | 'fulfilled'
    | 'failed'
    | 'cancelled';
}

const TestEntityGraph: StateMachineNode<TestEntity, 'status'> = {
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
};

@Injectable()
class Service {
  validate(): boolean {
    return true;
  }
}

@Global()
@Module({
  providers: [Service],
  exports: [Service],
})
class AnotherModule {}

@TransitionGuard<TestEntity, 'status'>('pending', 'processed')
class TestSuccessTransition implements CanTransition<TestEntity> {
  public calls: number = 0;

  canTransition(data: TestEntity): Observable<TestEntity> {
    this.calls = this.calls + 1;
    return of(data);
  }

  clear() {
    this.calls = 0;
  }
}

@TransitionGuard<TestEntity, 'status'>('failed', 'fulfilled')
class TestFailTransition implements CanTransition<TestEntity> {
  canTransition(): Observable<TestEntity> {
    return throwError(() => new Error('Failed'));
  }
}

@TransitionGuard<TestEntity, 'status'>('processed', 'synchronized')
class TestTransitionWithInjected implements CanTransition<TestEntity> {
  constructor(private readonly service: Service) {}

  canTransition(input: TestEntity): Observable<TestEntity> {
    return of(input)
      .pipe(filter(() => this.service.validate()))
      .pipe(map(() => input));
  }
}

describe('StateMachineModule', () => {
  jest.setTimeout(3000);
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        AnotherModule,
        StateMachineModule.forFeature({
          entity: TestEntity,
          field: 'status',
          graph: {
            root: TestEntityGraph,
            manual: ['cancelled', 'failed'],
            strict: true,
          },
          guards: [
            TestSuccessTransition,
            TestFailTransition,
            TestTransitionWithInjected,
          ],
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('transition', () => {
    let guard: TestSuccessTransition;

    beforeAll(() => {
      guard = app.get(TestSuccessTransition);
    });

    afterEach(() => {
      guard.clear();
    });

    it('Must fail when no transition path is found', (done) => {
      const service = app.get(StateMachineService<TestEntity, 'status'>);
      const entity = { status: 'fulfilled' } as any;
      service
        .transition(entity, 'pending')
        .pipe(catchError((e) => of(e)))
        .subscribe((error) => {
          expect(error.message).toBe(
            "No transition path found from 'fulfilled' to 'pending'",
          );
          expect(entity.status).toBe('fulfilled');
          done();
        });
    });

    it('Must call all the guards registered for all transitions present between the current state and the desired state ', (done) => {
      const service = app.get(StateMachineService<TestEntity, 'status'>);
      service
        .transition({ status: 'pending' }, 'fulfilled')
        .subscribe((data) => {
          expect(data.status).toBe('fulfilled');
          expect(guard.calls).toBe(1);
          done();
        });
    });

    it('Must return the object if no guard is registered', (done) => {
      const service = app.get(StateMachineService<TestEntity, 'status'>);
      service
        .transition({ status: 'synchronized' }, 'fulfilled')
        .subscribe((data) => {
          expect(data.status).toBe('fulfilled');
          expect(guard.calls).toBe(0);
          done();
        });
    });

    it('Must return the object with the state updated if the guard checks succeeds', (done) => {
      const service = app.get(StateMachineService<TestEntity, 'status'>);
      service
        .transition({ status: 'pending' }, 'fulfilled')
        .subscribe((data) => {
          expect(data.status).toBe('fulfilled');
          expect(guard.calls).toBe(1);
          done();
        });
    });

    it('Must return the object with no changes in state if the guard fails', (done) => {
      const service = app.get(StateMachineService<TestEntity, 'status'>);
      const entity = { status: 'failed' };
      service
        .transition(entity as any, 'fulfilled')
        .pipe(catchError((e) => of(e)))
        .subscribe((data) => {
          expect(data.message).toBe(`Failed`);
          expect(entity.status).toBe('failed');
          done();
        });
    });
  });

  describe('next', () => {
    let guard: TestSuccessTransition;

    beforeAll(() => {
      guard = app.get(TestSuccessTransition);
    });

    afterEach(() => {
      guard.clear();
    });

    it('Must move the entity to the next auto transitionable state', (done) => {
      const service = app.get(StateMachineService<TestEntity, 'status'>);
      service.next({ status: 'pending' }).subscribe((data) => {
        expect(data.status).toBe('processed');
        done();
      });
    });

    it('Must fail if the entity is in a final state', (done) => {
      const service = app.get(StateMachineService<TestEntity, 'status'>);
      service
        .next({ status: 'fulfilled' })
        .pipe(catchError((e) => of(e)))
        .subscribe((error) => {
          expect(error.message).toBe('Entity is in a final state: fulfilled');
          done();
        });
    });
  });
});

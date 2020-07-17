import Qappx from '../../src/index';
const TEST = 'TEST'

describe('Store', () => {
  it('committing mutations', () => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      }
    })
    store.commit(TEST, 2)
    expect(store.state.a).toBe(3)
  })

  it('committing with object style', () => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        [TEST] (state, payload) {
          state.a += payload.amount
        }
      }
    })
    store.commit({
      type: TEST,
      amount: 2
    })
    expect(store.state.a).toBe(3)
  })

  it('asserts committed type', () => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        // Maybe registered with undefined type accidentally
        // if the user has typo in a constant type
        undefined (state, n) {
          state.a += n
        }
      }
    })
    expect(() => {
      store.commit(undefined, 2)
    }).toThrowError(/expects string as the type, but found undefined/)
    expect(store.state.a).toBe(1)
  })

  it('dispatching actions, sync', () => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      },
      actions: {
        [TEST] ({ commit }, n) {
          commit(TEST, n)
        }
      }
    })
    store.dispatch(TEST, 2)
    expect(store.state.a).toBe(3)
  })

  it('dispatching with object style', () => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      },
      actions: {
        [TEST] ({ commit }, payload) {
          commit(TEST, payload.amount)
        }
      }
    })
    store.dispatch({
      type: TEST,
      amount: 2
    })
    expect(store.state.a).toBe(3)
  })

  it('dispatching actions, with returned Promise', done => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      },
      actions: {
        [TEST] ({ commit }, n) {
          return new Promise(resolve => {
            setTimeout(() => {
              commit(TEST, n)
              resolve()
            }, 0)
          })
        }
      }
    })
    expect(store.state.a).toBe(1)
    store.dispatch(TEST, 2).then(() => {
      expect(store.state.a).toBe(3)
      done()
    })
  })

  it('composing actions with async/await', done => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      },
      actions: {
        [TEST] ({ commit }, n) {
          return new Promise(resolve => {
            setTimeout(() => {
              commit(TEST, n)
              resolve()
            }, 0)
          })
        },
        two: async ({ commit, dispatch }, n) => {
          await dispatch(TEST, 1)
          expect(store.state.a).toBe(2)
          commit(TEST, n)
        }
      }
    })
    expect(store.state.a).toBe(1)
    store.dispatch('two', 3).then(() => {
      expect(store.state.a).toBe(5)
      done()
    })
  })

  it('detecting action Promise errors', done => {
    const store = new Qappx.Store({
      actions: {
        [TEST] () {
          return new Promise((resolve, reject) => {
            reject('no')
          })
        }
      }
    })
    const thenSpy = jasmine.createSpy()
    store.dispatch(TEST)
      .then(thenSpy)
      .catch(err => {
        expect(thenSpy).not.toHaveBeenCalled()
        expect(err).toBe('no')
        done()
      })
  })

  it('asserts dispatched type', () => {
    const store = new Qappx.Store({
      state: {
        a: 1
      },
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      },
      actions: {
        // Maybe registered with undefined type accidentally
        // if the user has typo in a constant type
        undefined ({ commit }, n) {
          commit(TEST, n)
        }
      }
    })
    expect(() => {
      store.dispatch(undefined, 2)
    }).toThrowError(/expects string as the type, but found undefined/)
    expect(store.state.a).toBe(1)
  })

  it('getters', () => {
    const store = new Qappx.Store({
      state: {
        a: 0
      },
      getters: {
        state: state => state.a > 0 ? 'hasAny' : 'none'
      },
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      },
      actions: {
        check ({ getters }, value) {
          // check for exposing getters into actions
          expect(getters.state).toBe(value)
        }
      }
    })
    expect(store.getters.state).toBe('none')
    store.dispatch('check', 'none')

    store.commit(TEST, 1)

    expect(store.getters.state).toBe('hasAny')
    store.dispatch('check', 'hasAny')
  })

  it('should accept state as function', () => {
    const store = new Qappx.Store({
      state: () => ({
        a: 1
      }),
      mutations: {
        [TEST] (state, n) {
          state.a += n
        }
      }
    })
    expect(store.state.a).toBe(1)
    store.commit(TEST, 2)
    expect(store.state.a).toBe(3)
  })

  it('should not call root state function twice', () => {
    const spy = jasmine.createSpy().and.returnValue(1)
    new Qappx.Store({
      state: spy
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('subscribe: should handle subscriptions / unsubscriptions', () => {
    const subscribeSpy = jasmine.createSpy()
    const secondSubscribeSpy = jasmine.createSpy()
    const testPayload = 2
    const store = new Qappx.Store({
      state: {},
      mutations: {
        [TEST]: () => {}
      }
    })

    const unsubscribe = store.subscribe(subscribeSpy)
    store.subscribe(secondSubscribeSpy)
    store.commit(TEST, testPayload)
    unsubscribe()
    store.commit(TEST, testPayload)

    expect(subscribeSpy).toHaveBeenCalledWith(
      { type: TEST, payload: testPayload },
      store.state
    )
    expect(secondSubscribeSpy).toHaveBeenCalled()
    expect(subscribeSpy.calls.count()).toBe(1)
    expect(secondSubscribeSpy.calls.count()).toBe(2)
  })
})

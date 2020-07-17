import ModuleCollection from './module/module-collection';
import {
  forEachValue, isPromise, assert, isObject,
} from './util';

/**
 * 生成并加入订阅对象
 * @param {Function} fn handler
 * @param {Array} subs 订阅数组
 */
function genericSubscribe(fn, subs) {
  if (subs.indexOf(fn) < 0) {
    subs.push(fn);
  }
  return () => {
    const i = subs.indexOf(fn);
    if (i > -1) {
      subs.splice(i, 1);
    }
  };
}

/**
 * 统一参数
 * @param {*} type
 * @param {*} payload
 * @param {*} options
 */
function unifyObjectStyle(type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload;
    payload = type;
    type = type.type;
  }
  assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`);
  return { type, payload, options };
}

/**
 * 重置store
 * @param {*} store
 */
function resetStore(store) {
  store._actions = Object.create(null);
  store._mutations = Object.create(null);
  store._wrappedGetters = Object.create(null);
  store._modulesNamespaceMap = Object.create(null);

  const { state } = store;
  // 重新安装最新的module，设置action，mutation，getter
  installModule(store, state, [], store._modules.root, true);

  // 将state和getter赋值到store上
  resetStoreVM(store, state);
}

/**
 * 安装module，设置action，mutation，getter
 * @param {*} store
 * @param {*} rootState
 * @param {*} path
 * @param {*} module
 * @param {*} hot
 */
function installModule(store, rootState, path, module, hot) {
  const isRoot = !path.length;
  const namespace = store._modules.getNamespace(path);

  // 注册到namespace map
  if (module.namespaced) {
    if (store._modulesNamespaceMap[namespace]) {
      console.error(`[qappx] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`);
    }
    store._modulesNamespaceMap[namespace] = module;
  }

  // 设置到父state上
  if (!isRoot && !hot) {
    const parentState = getNestedState(rootState, path.slice(0, -1));
    const moduleName = path[path.length - 1];
    if (moduleName in parentState) {
      console.warn(
        `[qappx] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`,
      );
    }
    parentState[moduleName] = module.state;
  }

  const local = makeLocalContext(store, namespace, path);
  module.context = local;

  // 注册mutation
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key;
    registerMutation(store, namespacedType, mutation, local);
  });

  // 注册action
  module.forEachAction((action, key) => {
    const type = action.root ? key : namespace + key;
    const handler = action.handler || action;
    registerAction(store, type, handler, local);
  });

  // 注册getter
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key;
    registerGetter(store, namespacedType, getter, local);
  });

  // 安装 子module
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot);
  });
}

/**
 * 将state和getter赋值到store上
 * @param {*} store
 * @param {*} state
 */
function resetStoreVM(store, state) {
  store.$$state = state;
  store.getters = {};
  store._makeLocalGettersCache = Object.create(null);

  forEachValue(store._wrappedGetters, (fn, key) => {
    Object.defineProperty(store.getters, key, {
      get: () => fn(store),
      enumerable: true, // for local getters
    });
  });
}

/**
 * 获取模块context（dispatch, commit, getters and state）
 * 如果没有设置namespace，则使用根store
 */
function makeLocalContext(store, namespace, path) {
  const noNamespace = namespace === '';
  const local = {
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options);
      const { payload, options } = args;
      let { type } = args;

      if (!options || !options.root) {
        type = namespace + type;
        if (!store._actions[type]) {
          console.error(`[qappx] unknown local action type: ${args.type}, global type: ${type}`);
          return;
        }
      }
      return store.dispatch(type, payload);
    },
    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options);
      const { payload, options } = args;
      let { type } = args;

      if (!options || !options.root) {
        type = namespace + type;
        if (!store._mutations[type]) {
          console.error(`[qappx] unknown local mutation type: ${args.type}, global type: ${type}`);
          return;
        }
      }
      store.commit(type, payload, options);
    },
  };

  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters
        : () => makeLocalGetters(store, namespace),
    },
    state: {
      get: () => getNestedState(store.state, path),
    },
  });
  return local;
}

/**
 * 获取local getters
 * @param {*} store
 * @param {*} namespace
 */
function makeLocalGetters(store, namespace) {
  if (!store._makeLocalGettersCache[namespace]) {
    const gettersProxy = {};
    const splitPos = namespace.length;
    Object.keys(store.getters).forEach((type) => {
      if (type.slice(0, splitPos) !== namespace) return;

      const localType = type.slice(splitPos);

      Object.defineProperty(gettersProxy, localType, {
        get: () => store.getters[type],
        enumerable: true,
      });
    });
    store._makeLocalGettersCache[namespace] = gettersProxy;
  }
  return store._makeLocalGettersCache[namespace];
}

/**
 * 注册mutation
 * @param {*} store
 * @param {*} type
 * @param {*} handler
 * @param {*} local
 */
function registerMutation(store, type, handler, local) {
  const entry = store._mutations[type] || (store._mutations[type] = []);
  entry.push((payload) => {
    handler.call(store, local.state, payload);
  });
}

/**
 * 注册action
 * @param {*} store
 * @param {*} type
 * @param {*} handler
 * @param {*} local
 */
function registerAction(store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = []);
  entry.push((payload, cb) => {
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state,
    }, payload, cb);
    if (!isPromise(res)) {
      // eslint-disable-next-line no-undef
      res = Promise.resolve(res);
    }
    return res;
  });
}

/**
 * 注册getter
 * @param {*} store
 * @param {*} type
 * @param {*} rawGetter
 * @param {*} local
 */
function registerGetter(store, type, rawGetter, local) {
  if (store._wrappedGetters[type]) {
    console.error(`[qappx] duplicate getter key: ${type}`);
    return;
  }
  store._wrappedGetters[type] = function wrappedGetter({ state, getters }) {
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      state, // root state
      getters, // root getters
    );
  };
}

/**
 * 获取嵌套state
 * @param {*} state
 * @param {*} path
 */
function getNestedState(state, path) {
  return path.length
    ? path.reduce((stateObj, key) => stateObj[key], state)
    : state;
}

/**
 * 全局store
 */
export class Store {
  constructor(options = {}) {
    assert(this instanceof Store, 'store must be called with the new operator.');

    // action初始化
    this._actions = Object.create(null);
    this._actionSubscribers = [];

    // mutations初始化
    this._mutations = Object.create(null);
    this._subscribers = [];

    // getter初始化
    this._wrappedGetters = Object.create(null);

    // local getter 缓存初始化
    this._makeLocalGettersCache = Object.create(null);

    // dispatch，commit初始化
    const store = this;
    const { dispatch, commit } = this;
    this.dispatch = function boundDispatch(type, payload) {
      return dispatch.call(store, type, payload);
    };
    this.commit = function boundCommit(type, payload) {
      return commit.call(store, type, payload);
    };

    // 生成 module树
    this._modules = new ModuleCollection(options);
    this._modulesNamespaceMap = Object.create(null);

    // 根state
    const { state } = this._modules.root;

    // 初始化 root module，同时递归注册 sub modules
    installModule(this, state, [], this._modules.root);

    // 设置store上的state和getter
    resetStoreVM(this, state);

    // 应用 plugins
    const { plugins = [] } = options;
    plugins.forEach((plugin) => plugin(this));
  }

  get state() {
    return this.$$state;
  }

  set state(v) {
    assert(false, 'use store.replaceState() to explicit replace store state.');
  }

  /**
   * 分发 action
   * @param {*} _type
   * @param {*} _payload
   */
  dispatch(_type, _payload) {
    // check 参数
    const { type, payload } = unifyObjectStyle(_type, _payload);
    const action = { type, payload };
    const entry = this._actions[type];
    if (!entry) {
      console.error(`[qappx] unknown action type: ${type}`);
      return;
    }

    try {
      this._actionSubscribers
        .filter((sub) => sub.before)
        .forEach((sub) => sub.before(action, this.state));
    } catch (e) {
      console.warn('[qappx] error in before action subscribers: ');
      console.error(e);
    }

    const result = entry.length > 1
      // eslint-disable-next-line no-undef
      ? Promise.all(entry.map((handler) => handler(payload)))
      : entry[0](payload);

    return result.then((res) => {
      try {
        this._actionSubscribers
          .filter((sub) => sub.after)
          .forEach((sub) => sub.after(action, this.state));
      } catch (e) {
        console.warn('[qappx] error in after action subscribers: ');
        console.error(e);
      }
      return res;
    });
  }

  /**
   * 提交 mutation
   * @param {*} _type
   * @param {*} _payload
   */
  commit(_type, _payload) {
    // check 参数
    const { type, payload } = unifyObjectStyle(_type, _payload);
    const entry = this._mutations[type];
    if (!entry) {
      console.error(`[qappx] unknown mutation type: ${type}`);
      return;
    }
    entry.forEach((handler) => {
      handler(payload);
    });
    this._subscribers.forEach((sub) => sub({ type, payload }, this.state));
  }

  /**
   * 订阅 store 的 mutation
   * @param {*} fn
   */
  subscribe(fn) {
    return genericSubscribe(fn, this._subscribers);
  }

  /**
   * 订阅 store 的 action
   * @param {*} fn
   */
  subscribeAction(fn) {
    const subs = typeof fn === 'function' ? { before: fn } : fn;
    return genericSubscribe(subs, this._actionSubscribers);
  }

  /**
   * 替换 store 的根状态，仅用状态合并或时光旅行调试
   * @param {*} state
   */
  replaceState(state) {
    this.$$state = state;
  }

  /**
   * 注册一个动态模块
   * @param {*} path
   * @param {*} rawModule
   * @param {*} options
   */
  registerModule(path, rawModule, options = {}) {
    if (typeof path === 'string') path = [path];

    assert(Array.isArray(path), 'module path must be a string or an Array.');
    assert(path.length > 0, 'cannot register the root module by using registerModule.');

    this._modules.register(path, rawModule);

    // 安装module，设置action，mutation，getter
    installModule(this, this.state, path, this._modules.get(path), options.preserveState);

    // 将state和getter赋值到store上
    resetStoreVM(this, this.state);
  }

  /**
   * 卸载一个动态模块
   * @param {*} path
   */
  unregisterModule(path) {
    if (typeof path === 'string') path = [path];
    assert(Array.isArray(path), 'module path must be a string or an Array.');

    this._modules.unregister(path);

    // 获取父state
    const parentState = getNestedState(this.state, path.slice(0, -1));
    delete parentState[path[path.length - 1]];

    resetStore(this);
  }
}

/**
 * 安装store
 * @param {*} store 全局store实例
 * @param {*} apply 挂载的页面名称(优先)
* @param {*} exclude 排除的页面名称
 */
export function installStore(store, { apply = [], exclude = [] } = {}) {
  return {
    install(VmClass) {
      if (typeof apply === 'string') apply = [apply];
      assert(Array.isArray(apply), 'apply pages must be a string or an Array.');
      if (typeof exclude === 'string') exclude = [exclude];
      assert(Array.isArray(exclude), 'exclude pages must be a string or an Array.');

      VmClass.mixin({
        onInit() {
          const page = this.$page;
          if (!page.name) return;

          if (apply.length) {
            if (apply.indexOf(page.name) > -1) {
              this.$store = store;
              this.$set('$$state', store.state);
            }
          } else {
            if (exclude.indexOf(page.name) > -1) return;

            this.$store = store;
            this.$set('$$state', store.state);
          }
        },
      });
    },
  };
}

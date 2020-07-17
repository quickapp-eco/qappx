/**
 * forEach for object
 */
export function forEachValue(obj, fn) {
  Object.keys(obj).forEach((key) => fn(obj[key], key));
}

export function isObject(obj) {
  return obj !== null && typeof obj === 'object';
}

export function isValidMap(map) {
  return Array.isArray(map) || isObject(map);
}

export function isPromise(val) {
  return val && typeof val.then === 'function';
}

export function assert(condition, msg) {
  if (!condition) throw new Error(`[qappx] ${msg}`);
}

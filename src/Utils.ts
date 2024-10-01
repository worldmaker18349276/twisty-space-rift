
export function assert(cond: boolean): asserts cond {
  if (!cond) throw new Error("assertion fail");
}

export type Result<R, E = string> =
  | {ok: true, result: R}
  | {ok: false, error: E};

export namespace Result {
  export function ok<R, E>(result: R): Result<R, E> {
    return {ok:true, result};
  }
  export function err<R, E>(error: E): Result<R, E> {
    return {ok:false, error};
  }
}

export function indices(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; i++)
    res.push(i);
  return res;
}

export function mod(x: number, n: number): number {
  return (x % n + n) % n;
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

export function zip<A, B>(a: A[], b: B[]): [A, B][] {
  return indices(Math.min(a.length, b.length)).map(i => [a[i], b[i]]);
}

export function rotate<A>(a: A[], n: number): A[] {
  n = (n % a.length + a.length) % a.length;
  if (n === 0) return a;
  return [...a.slice(n), ...a.slice(0, n)];
}

export function unrollUntilLoopback<A>(a: A, next: (a: A) => A): A[] {
  const res = [a];
  while (true) {
    a = next(a);
    if (a === res[0]) break;
    res.push(a);
  }
  return res;
}

export function append<K, V>(map: Map<K, V[]>, key: K, values: V[]) {
  const slots = map.get(key);
  if (slots === undefined) {
    map.set(key, Array.from(values));
  } else {
    slots.push(...values);
  }
}

export type CyclicPerm = number[];
export function cyclicSort(list: number[]): number[] {
  const min_index = list.indexOf(Math.min(...list));
  return rotate(list, min_index);
}
export function asCyclicPerm(list: number[]): CyclicPerm {
  return cyclicSort(list);
}
export function applyCyclicPerm(perm: CyclicPerm, n: number, value: number): number {
  const i = perm.indexOf(value);
  if (i === -1) return value;
  return perm[mod(i+n, perm.length)];
}
export function applyCyclicPerm_(perm: CyclicPerm, value: CyclicPerm): CyclicPerm {
  return cyclicSort(value.map(v => applyCyclicPerm(perm, 1, v)));
}
export function reverseCyclicPerm(perm: CyclicPerm): CyclicPerm {
  return rotate(perm, 1).reverse();
}
export function cmp(a1: readonly number[], a2: readonly number[]): number {
    for (let i = 0; i < a1.length && i < a2.length; i++) {
      const cmp = a1[i] - a2[i];
      if (cmp !== 0) return cmp;
    }
    return a1.length - a2.length;
}
export function cmpOn<V>(key: (value: V) => readonly number[]): (value1: V, value2: V) => number {
  return (value1, value2) => cmp(key(value1), key(value2));
}

export type Digraph = [from:number, to:number][];
export function isDAG(digraph: Digraph): boolean {
  return digraph.every(([below, above]) => !isReachable(digraph, above, below));
}
export function isReachable(digraph: Digraph, from: number, to: number): boolean {
  if (from === to) return true;
  const res = new Set<number>([from]);
  for (const curr of res)
    for (const [i, j] of digraph)
      if (i === curr) {
        if (j === to) return true;
        res.add(j);
      }
  return false;
}
export function allReachable(digraph: Digraph, from: number): Set<number> {
  const res = new Set<number>([from]);
  for (const curr of res)
    for (const [i, j] of digraph)
      if (i === curr)
        res.add(j);
  return res;
}


export function assert(cond: boolean): asserts cond {
  if (!cond) throw new Error("assertion fail");
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

export function cyclicSort(cyclic: number[]): number[] {
  const perm = [...cyclic];
  const min_index = perm.indexOf(Math.min(...perm))
  return rotate(perm, min_index);
}
export function applyPerm(perm: number[], n: number, value: number): number {
  const i = perm.indexOf(value);
  if (i === -1) return value;
  return perm[mod(i+n, perm.length)];
}
export function reversePerm(perm: number[]): number[] {
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

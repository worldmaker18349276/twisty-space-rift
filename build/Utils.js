export function assert(cond) {
    if (!cond)
        throw new Error("assertion fail");
}
export var Result;
(function (Result) {
    function ok(result) {
        return { ok: true, result };
    }
    Result.ok = ok;
    function err(error) {
        return { ok: false, error };
    }
    Result.err = err;
})(Result || (Result = {}));
export function indices(n) {
    const res = [];
    for (let i = 0; i < n; i++)
        res.push(i);
    return res;
}
export function mod(x, n) {
    return (x % n + n) % n;
}
export function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
}
export function zip(a, b) {
    return indices(Math.min(a.length, b.length)).map(i => [a[i], b[i]]);
}
export function rotate(a, n) {
    n = (n % a.length + a.length) % a.length;
    if (n === 0)
        return a;
    return [...a.slice(n), ...a.slice(0, n)];
}
export function unrollUntilLoopback(a, next) {
    const res = [a];
    while (true) {
        a = next(a);
        if (a === res[0])
            break;
        res.push(a);
    }
    return res;
}
export function append(map, key, values) {
    const slots = map.get(key);
    if (slots === undefined) {
        map.set(key, Array.from(values));
    }
    else {
        slots.push(...values);
    }
}
export function cyclicSort(list) {
    const min_index = list.indexOf(Math.min(...list));
    return rotate(list, min_index);
}
export function asCyclicPerm(list) {
    return cyclicSort(list);
}
export function applyCyclicPerm(perm, n, value) {
    const i = perm.indexOf(value);
    if (i === -1)
        return value;
    return perm[mod(i + n, perm.length)];
}
export function applyCyclicPerm_(perm, value) {
    return cyclicSort(value.map(v => applyCyclicPerm(perm, 1, v)));
}
export function reverseCyclicPerm(perm) {
    return rotate(perm, 1).reverse();
}
export function cmp(a1, a2) {
    for (let i = 0; i < a1.length && i < a2.length; i++) {
        const cmp = a1[i] - a2[i];
        if (cmp !== 0)
            return cmp;
    }
    return a1.length - a2.length;
}
export function cmpOn(key) {
    return (value1, value2) => cmp(key(value1), key(value2));
}
export function isDAG(digraph) {
    return digraph.every(([below, above]) => !isReachable(digraph, above, below));
}
export function isReachable(digraph, from, to) {
    if (from === to)
        return true;
    const res = new Set([from]);
    for (const curr of res)
        for (const [i, j] of digraph)
            if (i === curr) {
                if (j === to)
                    return true;
                res.add(j);
            }
    return false;
}
export function allReachable(digraph, from) {
    const res = new Set([from]);
    for (const curr of res)
        for (const [i, j] of digraph)
            if (i === curr)
                res.add(j);
    return res;
}
//# sourceMappingURL=Utils.js.map
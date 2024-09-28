export function assert(cond) {
    if (!cond)
        throw new Error("assertion fail");
}
export function indices(n) {
    const res = [];
    for (let i = 0; i < n; i++)
        res.push(i);
    return res;
}
export function mod(x, n) {
    return (x % n + n) % n;
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
export function cyclicSort(cyclic) {
    const perm = [...cyclic];
    const min_index = perm.indexOf(Math.min(...perm));
    return rotate(perm, min_index);
}
export function applyPerm(perm, n, value) {
    const i = perm.indexOf(value);
    if (i === -1)
        return value;
    return perm[mod(i + n, perm.length)];
}
export function reversePerm(perm) {
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
//# sourceMappingURL=Utils.js.map
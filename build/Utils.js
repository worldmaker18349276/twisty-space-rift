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
//# sourceMappingURL=Utils.js.map
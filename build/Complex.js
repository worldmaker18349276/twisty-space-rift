export function c(x, y = 0) {
    return [x, y];
}
export function add(...zs) {
    const r = [0, 0];
    for (const z of zs) {
        r[0] += z[0];
        r[1] += z[1];
    }
    return r;
}
export function mul(...zs) {
    const r = [1, 0];
    for (const z of zs) {
        [r[0], r[1]] = [r[0] * z[0] - r[1] * z[1], r[0] * z[1] + r[1] * z[0]];
    }
    return r;
}
export function pow(z, pow) {
    const [r, phi] = toRPhi(z[0], z[1]);
    const [r_, phi_] = [r ** pow, phi * pow];
    return toXY(r_, phi_);
}
export function conjugate(z) {
    return [z[0], -z[1]];
}
export function toRPhi(x, y) {
    return [Math.sqrt(x * x + y * y), Math.atan2(y, x)];
}
export function toXY(r, phi) {
    return [r * Math.cos(phi), r * Math.sin(phi)];
}
function hue2rgb(p, q, t) {
    t = (t % 1 + 1) % 1;
    if (t < 1 / 6)
        return p + (q - p) * 6 * t;
    if (t < 1 / 2)
        return q;
    if (t < 2 / 3)
        return q + (p - q) * 6 * (t - 1 / 2);
    return p;
}
function hsl2rgb(h, s, l) {
    const a = l < 0.5 ? l * s : (1 - l) * s;
    const p = l - a;
    const q = l + a;
    const r = hue2rgb(p, q, h + 1 / 3);
    const g = hue2rgb(p, q, h);
    const b = hue2rgb(p, q, h - 1 / 3);
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
export function toColor([x, y]) {
    const [r, phi] = toRPhi(x, y);
    return hsl2rgb(phi / (Math.PI * 2), Math.tanh(r), 0.5);
}
//# sourceMappingURL=Complex.js.map
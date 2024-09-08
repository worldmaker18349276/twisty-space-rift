
export type ComplexNumber = [x:number, y:number];
export type ComplexFunction = (z: ComplexNumber) => ComplexNumber;

export function c(x: number, y: number = 0): ComplexNumber {
  return [x, y];
}
export function omega(s: number): ComplexNumber {
  return [Math.cos(Math.PI*2*s), Math.sin(Math.PI*2*s)];
}
export function add(...zs: ComplexNumber[]): ComplexNumber {
  const r: ComplexNumber = [0, 0];
  for (const z of zs) {
    r[0] += z[0];
    r[1] += z[1];
  }
  return r;
}
export function mul(...zs: ComplexNumber[]): ComplexNumber {
  const r: ComplexNumber = [1, 0];
  for (const z of zs) {
    [r[0], r[1]] = [r[0]*z[0]-r[1]*z[1], r[0]*z[1]+r[1]*z[0]];
  }
  return r;
}
export function pow(z: ComplexNumber, pow: number): ComplexNumber {
  const [r, phi] = toRPhi(z[0], z[1]);
  const [r_, phi_] = [r**pow, phi*pow];
  return toXY(r_, phi_);
}
export function conjugate(z: ComplexNumber): ComplexNumber {
  return [z[0], -z[1]];
}

export function toRPhi(x: number, y: number): [r:number, phi:number] {
  return [Math.sqrt(x*x+y*y), Math.atan2(y, x)];
}
export function toXY(r: number, phi: number): [x:number, y:number] {
  return [r*Math.cos(phi), r*Math.sin(phi)];
}
function hue2rgb(p: number, q: number, t: number): number {
  t = (t % 1 + 1) % 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return q + (p - q) * 6 * (t - 1/2);
  return p;
}
function hsl2rgb(h: number, s: number, l: number): [r:number, g:number, b:number] {
  const a = l < 0.5 ? l * s : (1 - l) * s;
  const p = l - a;
  const q = l + a;

  const r = hue2rgb(p, q, h + 1/3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1/3);

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
export function toColor([x, y]: ComplexNumber): [r:number, g:number, b:number] {
  const [r, phi] = toRPhi(x, y);
  return hsl2rgb(phi / (Math.PI*2), Math.tanh(r), 0.5);
}

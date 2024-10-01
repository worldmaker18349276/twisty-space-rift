import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";
import { assert } from "./Utils.js";

export type CoordinateSystem = {
  width_pixel: number;
  height_pixel: number;
  x_range: [Geo.Distance, Geo.Distance];
  y_range: [Geo.Distance, Geo.Distance];
};

export type CanvasPos = [number, number];
export type CanvasMatrix = [m11:number, m12:number, m21:number, m22:number, m41:number, m42:number];

export function makeCoordinateSystem(arg: {
  width_pixel: number;
  height_pixel: number;
  x_range: [Geo.Distance, Geo.Distance];
  y_range: [Geo.Distance, Geo.Distance];
}): CoordinateSystem {
  const x_scale = arg.width_pixel / (arg.x_range[1] - arg.x_range[0]);
  const y_scale = arg.height_pixel / (arg.y_range[1] - arg.y_range[0]);
  const scale = Math.min(x_scale, y_scale);
  const x_center = (arg.x_range[1] + arg.x_range[0]) / 2;
  const y_center = (arg.y_range[1] + arg.y_range[0]) / 2;
  return {
    width_pixel: arg.width_pixel,
    height_pixel: arg.height_pixel,
    x_range: [x_center - arg.width_pixel / scale / 2, x_center + arg.width_pixel / scale / 2],
    y_range: [y_center - arg.height_pixel / scale / 2, y_center + arg.height_pixel / scale / 2],
  };
}

// pixel per unit
export function getScale(cs: CoordinateSystem): number {
  return cs.width_pixel / (cs.x_range[1] - cs.x_range[0]);
}
export function toViewport(cs: CoordinateSystem, point: Geo.Point): CanvasPos {
  const x = (point[0] - cs.x_range[0]) / (cs.x_range[1] - cs.x_range[0]) * cs.width_pixel;
  const y = (cs.y_range[1] - point[1]) / (cs.y_range[1] - cs.y_range[0]) * cs.height_pixel;
  return [x, y];
}
export function toCoordinate(cs: CoordinateSystem, pos: CanvasPos): Geo.Point {
  const x = pos[0] / cs.width_pixel * (cs.x_range[1] - cs.x_range[0]) + cs.x_range[0];
  const y = cs.y_range[1] - pos[1] / cs.height_pixel * (cs.y_range[1] - cs.y_range[0]);
  return [x, y];
}
export function toCanvasMatrix(cs: CoordinateSystem, m: Geo.Matrix2x3): CanvasMatrix {
  const x_scale = cs.width_pixel / (cs.x_range[1] - cs.x_range[0]);
  const y_scale = cs.height_pixel / (cs.y_range[1] - cs.y_range[0]);
  const to_viewport: Geo.Matrix2x3 = [
    [x_scale, 0, -cs.x_range[0] * x_scale],
    [0, -y_scale, cs.y_range[1] * y_scale],
  ];
  const m_ = Geo.compose(Geo.inverse(to_viewport), m, to_viewport);

  return [m_[0][0], m_[1][0], m_[0][1], m_[1][1], m_[0][2], m_[1][2]];
}
export function inverse(m: CanvasMatrix): CanvasMatrix {
  const m_ = Geo.inverse([
    [m[0], m[2], m[4]],
    [m[1], m[3], m[5]],
  ]);
  return [m_[0][0], m_[1][0], m_[0][1], m_[1][1], m_[0][2], m_[1][2]];
}

function moveTo(path: Path2D, cs: CoordinateSystem, point: Geo.Point): void {
  // console.log("moveTo", point[0], point[1]);
  const [x, y] = toViewport(cs, point);
  path.moveTo(x, y);
}

function lineTo(path: Path2D, cs: CoordinateSystem, point: Geo.Point): void {
  // console.log("lineTo", point[0], point[1]);
  const [x, y] = toViewport(cs, point);
  path.lineTo(x, y);
}

function arcTo(path: Path2D, cs: CoordinateSystem, control: Geo.Point, point: Geo.Point, radius: number): void {
  // console.log("arcTo", control[0], control[1], point[0], point[1], radius);
  const [x_, y_] = toViewport(cs, control);
  const [x, y] = toViewport(cs, point);
  const r = radius * getScale(cs);
  path.arcTo(x_, y_, x, y, r);
  // path.lineTo(x_, y_);
  // path.lineTo(x, y);
}

function drawPath<T>(path2D: Path2D, cs: CoordinateSystem, path: Geo.Path<T>, hide?: boolean[]): void {
  for (let i = 0; i < path.segs.length; i++) {
    const seg = path.segs[i];
    if (hide?.[i]) {
      moveTo(path2D, cs, seg.target);
    } else if (seg.type === Geo.PathSegType.Line) {
      lineTo(path2D, cs, seg.target);
    } else {
      let angle = seg.len;
      let turn = 0;
      while (angle > Math.PI/2) {
        turn += 1;
        angle = angle - Math.PI/2;
      }

      let start = Geo.getStartPoint(path, i);
      for (let n = 0; n < turn; n++) {
        let d = Geo.rot90(Geo.sub(start, seg.circle.center));
        if (seg.circle.radius < 0)
          d = Geo.mul(d, -1);
        const ctrl = Geo.add(start, d);
        const end = Geo.add(seg.circle.center, d);
        arcTo(path2D, cs, ctrl, end, Math.abs(seg.circle.radius));
        lineTo(path2D, cs, end);
        start = end;
      }
      {
        const ang = Geo.angleBetween(seg.circle.center, start, seg.target);
        const d = Geo.mul(Geo.rot90(Geo.sub(start, seg.circle.center)), Math.tan(ang / 2));
        const ctrl = Geo.add(start, d);
        arcTo(path2D, cs, ctrl, seg.target, Math.abs(seg.circle.radius));
        lineTo(path2D, cs, seg.target);
      }
    }
  }
}

export function clipPaths<T>(cs: CoordinateSystem, paths: Geo.Path<T>[]): Path2D {
  const path2D = new Path2D();

  const a: Geo.Point = [cs.x_range[0], cs.y_range[0]];
  const b: Geo.Point = [cs.x_range[0], cs.y_range[1]];
  const c: Geo.Point = [cs.x_range[1], cs.y_range[1]];
  const d: Geo.Point = [cs.x_range[1], cs.y_range[0]];
  moveTo(path2D, cs, a);
  for (const path of paths) {
    lineTo(path2D, cs, Geo.getStartPoint(path, 0));
    drawPath(path2D, cs, path);
    lineTo(path2D, cs, a);
  }
  lineTo(path2D, cs, b);
  lineTo(path2D, cs, c);
  lineTo(path2D, cs, d);
  path2D.closePath();
  return path2D;
}

export function toCanvasPath<T>(cs: CoordinateSystem, path: Geo.Path<T>, hide?: boolean[]): Path2D {
  const path2D = new Path2D();
  moveTo(path2D, cs, Geo.getStartPoint(path, 0));
  drawPath(path2D, cs, path, hide);
  // path cannot be closed if some segments is hiding
  if (hide === undefined && path.is_closed) {
    path2D.closePath();
  }
  return path2D;
}

export function toCanvas(image: ImageData): HTMLCanvasElement {
  const temp = document.createElement("canvas");
  temp.width = image.width;
  temp.height = image.height;
  const ctx = temp.getContext("2d")!;
  ctx.putImageData(image, 0, 0);
  return temp;
}
export function drawComplex(
  cs: CoordinateSystem,
  f: Complex.ComplexFunction,
  x_range: [Geo.Distance, Geo.Distance],
  y_range: [Geo.Distance, Geo.Distance],
): {canvas:HTMLCanvasElement, trans:CanvasMatrix} {
  const min = toViewport(cs, [x_range[0], y_range[0]]);
  const max = toViewport(cs, [x_range[1], y_range[1]]);
  const width = Math.round(Math.abs(min[0] - max[0]));
  const height = Math.round(Math.abs(min[1] - max[1]));
  const imin = Math.round(Math.min(min[0], max[0]));
  const jmin = Math.round(Math.min(min[1], max[1]));
  const imax = imin + width;
  const jmax = jmin + height;

  const image = new ImageData(width, height);
  for (let i = imin; i < imax; i++) {
    for (let j = jmin; j < jmax; j++) {
      const z = toCoordinate(cs, [i, j]);
      const rgb = Complex.toColor(f(z));
      const n = 4*((i - imin)+(j - jmin)*width);
      image.data[n] = rgb[0];
      image.data[n+1] = rgb[1];
      image.data[n+2] = rgb[2];
      image.data[n+3] = 255;
    }
  }
  
  const trans: CanvasMatrix = [1, 0, 0, 1, imin, jmin];
  return {canvas: toCanvas(image), trans};
}


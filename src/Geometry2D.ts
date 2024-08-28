
function indices(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; i++)
    res.push(i);
  return res;
}

export type Vector2 = [x:number, y:number];
export type Matrix2x3 = [[number, number, number], [number, number, number]];

export function add(v: Vector2, w: Vector2): Vector2 {
  return [v[0] + w[0], v[1] + w[1]];
}
export function sub(v: Vector2, w: Vector2): Vector2 {
  return [v[0] - w[0], v[1] - w[1]];
}
export function mul(v: Vector2, c: number): Vector2 {
  return [v[0] * c, v[1] * c];
}
export function norm(v: Vector2): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}
export function normalize(v: Vector2): Vector2 {
  return mul(v, 1/norm(v));
}
export function dot(v: Vector2, w: Vector2): number {
  return v[0] * w[0] + v[1] * w[1];
}
export function cross(v: Vector2, w: Vector2): number {
  return v[0] * w[1] - v[1] * w[0];
}
export function rot90(v: Vector2): Vector2 {
  return [-v[1], v[0]];
}
// -pi ~ pi
export function angleBetween(center: Vector2, start: Vector2, end: Vector2): Angle {
  const v = normalize(sub(start, center));
  const w = normalize(sub(end, center));
  return Math.atan2(cross(v, w), dot(v, w));
}

export function mod(x: number, n: number): number {
  return (x % n + n) % n;
}
// -pi ~ pi  =>  0 ~ 2pi
export function as0to2pi(angle: Angle): Angle {
  return mod(angle, Math.PI*2);
}

export function inangle(angle: Angle, range: [from:Angle, to:Angle], n: number = 1): boolean {
  const rel_angle = mod(angle - range[0], Math.PI*2*n);
  return rel_angle < range[1] - range[0];
}

export function transform(point: Vector2, trans: Matrix2x3): Vector2 {
  return [
    trans[0][0] * point[0] + trans[0][1] * point[1] + trans[0][2],
    trans[1][0] * point[0] + trans[1][1] * point[1] + trans[1][2],
  ];
}

export function rotate(angle: Angle): Matrix2x3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [ c,-s, 0],
    [ s, c, 0],
  ];
}

export function rotateAround(angle: Angle, center: Vector2): Matrix2x3 {
  return compose(
    translate(mul(center, -1)),
    rotate(angle),
    translate(center),
  );
}

export function translate(shift: Vector2): Matrix2x3 {
  return [
    [ 1, 0, shift[0]],
    [ 0, 1, shift[1]],
  ];
}

export function copyTransformation(trans: Matrix2x3): Matrix2x3 {
  return [
    [trans[0][0], trans[0][1], trans[0][2]],
    [trans[1][0], trans[1][1], trans[1][2]],
  ];
}

export function inverse(trans: Matrix2x3): Matrix2x3 {
  const det = trans[0][0] * trans[1][1] - trans[0][1] * trans[1][0];
  return [
    [trans[1][1] / det, -trans[0][1] / det, (trans[1][2]*trans[0][1] - trans[0][2]*trans[1][1]) / det],
    [-trans[1][0] / det, trans[0][0] / det, (trans[0][2]*trans[1][0] - trans[1][2]*trans[0][0]) / det],
  ];
}

export function getRotationPart(trans: Matrix2x3): Matrix2x3 {
  return [
    [trans[0][0], trans[0][1], 0],
    [trans[1][0], trans[1][1], 0],
  ];
}

export function id_trans(): Matrix2x3 {
  return [
    [ 1, 0, 0],
    [ 0, 1, 0],
  ];
}

function compose_(trans1: Matrix2x3, trans2: Matrix2x3): Matrix2x3 {
  const r = [
    [0,0,0],
    [0,0,0],
    [0,0,1],
  ];
  
  const last_row = [0,0,1];
  
  for (const i of indices(3)) {
    for (const j of indices(3)) {
      for (const k of indices(3)) {
        r[i][j] += (trans2[i] ?? last_row)[k] * (trans1[k] ?? last_row)[j];
      }
    }
  }

  return [r[0], r[1]] as Matrix2x3;
}

// transform(p, compose(t1, t2)) = transform(transform(p, t1), t2)
export function compose(...transs: Matrix2x3[]): Matrix2x3 {
  if (transs.length === 0) return id_trans();
  if (transs.length === 1) return copyTransformation(transs[0]);
  return transs.reduce((a, b) => compose_(a, b));
}


export type Distance = number;
export type Angle = number;
export type Point = Vector2;
export type Normal = Vector2;
export type RigidTransformation = Matrix2x3;

export function transformPoint(point: Point, trans: RigidTransformation): Point {
  return transform(point, trans);
}

export type DirectionalCircle = {
  radius: Distance; // can be negative, indicating opposite direction
  center: Point;
};

export function flipCircle(circle: DirectionalCircle): DirectionalCircle {
  return {
    radius: -circle.radius,
    center: [...circle.center],
  };
}

export function transformCircle(circle: DirectionalCircle, trans: RigidTransformation): DirectionalCircle {
  return {
    radius: circle.radius,
    center: transformPoint(circle.center, trans),
  };
}

export type DirectionalLine = {
  center: Point;
  direction: Normal;
};

export function flipLine(line: DirectionalLine): DirectionalLine {
  return {
    center: line.center,
    direction: mul(line.direction, -1),
  };
}

export function transformLine(line: DirectionalLine, trans: RigidTransformation): DirectionalLine {
  return {
    center: transformPoint(line.center, trans),
    direction: transform(line.direction, getRotationPart(trans)),
  };
}

export function projectToLine(line: DirectionalLine, point: Point): Distance {
  return dot(line.direction, sub(point, line.center));
}

// point on the left side has positive distance
export function distanceToLine(line: DirectionalLine, point: Point): Distance {
  return cross(line.direction, sub(point, line.center));
}

export function getPointOnLine(line: DirectionalLine, coordinate: Distance): Point {
  return add(line.center, mul(line.direction, coordinate));
}

export enum PathSegType { Arc, Line }
export type PathSegLine<T> =
  { type: PathSegType.Line, target: Point, line: DirectionalLine, len: Distance, source: T };
export type PathSegArc<T> =
  { type: PathSegType.Arc, target: Point, circle: DirectionalCircle, len: Angle, source: T };
export type PathSeg<T> = PathSegLine<T> | PathSegArc<T>;

// angle between segments should not be larger than PI
// arc should not be closed to 2PI
// path should not intersect with itself
// closed path should be counterclockwise
export type Path<T> =
  | { is_closed: false, start: Point, segs: PathSeg<T>[] }
  | { is_closed: true, segs: PathSeg<T>[] };

export function makePathSegLine<T>(start: Point, end: Point, source: T): PathSegLine<T> {
  return {
    type: PathSegType.Line,
    target: end,
    line: {
      center: start,
      direction: normalize(sub(end, start)),
    },
    len: norm(sub(end, start)),
    source,
  };
}

export function makePathSegArc<T>(start: Point, end: Point, circle: DirectionalCircle, source: T): PathSegArc<T> {
  return {
    type: PathSegType.Arc,
    target: end,
    circle,
    len: circle.radius > 0 ?
      as0to2pi(angleBetween(circle.center, start, end))
      : as0to2pi(angleBetween(circle.center, end, start)),
    source,
  };
}

export function getStartPoint<T>(path: Path<T>, index: number = 0): Point {
  return index > 0 ?
      path.segs[index - 1].target
    : path.is_closed ?
      path.segs[path.segs.length - 1].target
    : path.start;
}

export function transformPath<T>(path: Path<T>, trans: RigidTransformation): Path<T> {
  const segs: PathSeg<T>[] = path.segs.map(seg => {
    if (seg.type === PathSegType.Arc) {
      return {
        type: seg.type,
        target: transformPoint(seg.target, trans),
        circle: transformCircle(seg.circle, trans),
        len: seg.len,
        source: seg.source,
      };
    } else {
      return {
        type: seg.type,
        target: transformPoint(seg.target, trans),
        line: transformLine(seg.line, trans),
        len: seg.len,
        source: seg.source,
      };
    }
  });

  if (path.is_closed) {
    return { is_closed: path.is_closed, segs };
  } else {
    return { is_closed: path.is_closed, start: transformPoint(path.start, trans), segs };
  }
}

export function flipPath<T>(path: Path<T>): Path<T> {
  const segs: PathSeg<T>[] = path.segs.map((seg, i) => {
    const target = getStartPoint(path, i);
    if (seg.type === PathSegType.Arc) {
      return {
        type: seg.type,
        target,
        circle: flipCircle(seg.circle),
        len: seg.len,
        source: seg.source,
      };
    } else {
      return {
        type: seg.type,
        target,
        line: flipLine(seg.line),
        len: seg.len,
        source: seg.source,
      };
    }
  }).reverse();

  if (path.is_closed) {
    return {
      is_closed: path.is_closed,
      segs,
    };
  } else {
    return {
      is_closed: path.is_closed,
      start: path.segs[path.segs.length - 1].target,
      segs,
    };
  }
}

export function scalePath<T>(path: Path<T>, scale: number): Path<T> {
  const segs: PathSeg<T>[] = path.segs.map(seg => {
    if (seg.type === PathSegType.Arc) {
      return {
        type: seg.type,
        target: mul(seg.target, scale),
        circle: {
          center: mul(seg.circle.center, scale),
          radius: seg.circle.radius * scale,
        },
        len: seg.len,
        source: seg.source,
      };
    } else {
      return {
        type: seg.type,
        target: mul(seg.target, scale),
        line: {
          center: mul(seg.line.center, scale),
          direction: seg.line.direction,
        },
        len: seg.len * scale,
        source: seg.source,
      };
    }
  });

  if (path.is_closed) {
    return { is_closed: path.is_closed, segs };
  } else {
    return { is_closed: path.is_closed, start: mul(path.start, scale), segs };
  }
}


export function intersectCircles(
  circle1: DirectionalCircle,
  circle2: DirectionalCircle,
): {points: [Point, Point], angles: [Angle, Angle]} | undefined {
  const ab_vec = sub(circle2.center, circle1.center);
  const c = norm(ab_vec);
  const a = Math.abs(circle1.radius);
  const b = Math.abs(circle2.radius);
  const A = Math.acos((c*c + b*b - a*a) / (2*b*c));
  const B = Math.acos((c*c + a*a - b*b) / (2*a*c));
  if (Number.isNaN(A) || Number.isNaN(B)) return undefined;
  const v = mul(normalize(ab_vec), a);
  const point1 = add(circle1.center, transform(v, rotate(-B)));
  const point2 = add(circle1.center, transform(v, rotate(+B)));
  const points: [Point, Point] =
    (circle1.radius > 0) === (circle1.radius > 0) ? [point1, point2] : [point2, point1];
  const angles: [Angle, Angle] = [
    (circle1.radius > 0 ? A * 2 : 2 * Math.PI - A * 2),
    (circle1.radius > 0 ? B * 2 : 2 * Math.PI - B * 2),
  ];
  return {
    points,
    angles,
  };
}

export function intersectLines(
  line1: DirectionalLine,
  line2: DirectionalLine,
): {point: Point, ccw: boolean} | undefined {
  const s = cross(line1.direction, line2.direction);
  const x = -distanceToLine(line1, line2.center) / s;
  if (Number.isNaN(x)) return undefined;
  const point = getPointOnLine(line2, x);
  return {point, ccw: s > 0};
}

export function intersectLineAndCircle(
  line1: DirectionalLine,
  circle2: DirectionalCircle,
): {points: [Point, Point], angle: Angle, len: Distance} | undefined {
  const d = -distanceToLine(line1, circle2.center);
  let angle = 2 * Math.acos(d / Math.abs(circle2.radius));
  let len = 2 * Math.sqrt(circle2.radius * circle2.radius - d * d);
  if (Number.isNaN(angle) || Number.isNaN(len)) return undefined;
  if (circle2.radius < 0) angle = 2 * Math.PI - angle;
  if (circle2.radius < 0) len = -len;
  const x = projectToLine(line1, circle2.center);
  const point1 = getPointOnLine(line1, x - len / 2);
  const point2 = getPointOnLine(line1, x + len / 2);
  return {
    points: [point1, point2],
    angle,
    len,
  };
}


export enum CutSourceType { Seg, LeftCut, RightCut }
export type CutSource<T, S> =
  | {
    type: CutSourceType.Seg;
    ref: PathSegLine<T>;
    from: Distance | undefined;
    to: Distance | undefined;
  }
  | {
    type: CutSourceType.Seg;
    ref: PathSegArc<T>;
    from: Angle | undefined;
    to: Angle | undefined;
  }
  | {
    type: CutSourceType.LeftCut | CutSourceType.RightCut;
    ref: PathSegLine<S>;
    from: Distance | undefined;
    to: Distance | undefined;
  }
  | {
    type: CutSourceType.LeftCut | CutSourceType.RightCut;
    ref: PathSegArc<S>;
    from: Angle | undefined;
    to: Angle | undefined;
  };

function flipPathSeg<T>(seg: PathSeg<T>): PathSeg<T> {
  if (seg.type === PathSegType.Line) {
    return {
      type: seg.type,
      target: sub(seg.target, mul(seg.line.direction, seg.len)),
      line: flipLine(seg.line),
      len: seg.len,
      source: seg.source,
    };
  } else {
    return {
      type: seg.type,
      target:
        add(
          seg.circle.center,
          transform(
            sub(seg.target, seg.circle.center),
            rotate(-Math.sign(seg.circle.radius) * seg.len)
          ),
        ),
      circle: flipCircle(seg.circle),
      len: seg.len,
      source: seg.source,
    };
  }
}

function cutPathSeg<T, S>(source: CutSource<T, S>): PathSeg<CutSource<T, S>> {
  if (source.type === CutSourceType.RightCut) {
    let res = cutPathSeg({
      type: CutSourceType.LeftCut,
      ref: source.ref,
      from: source.to,
      to: source.from,
    } as CutSource<T, S>);
    res = flipPathSeg(res);
    res.source = source;
    return res;
  }

  const seg = source.ref;
  const from = source.from ?? 0;
  const to = source.to ?? seg.len;
  if (seg.type === PathSegType.Line) {
    return {
      type: seg.type,
      target: sub(seg.target, mul(seg.line.direction, seg.len - to)),
      line: seg.line,
      len: to - from,
      source,
    };
  } else {
    return {
      type: seg.type,
      target:
        add(
          seg.circle.center,
          transform(
            sub(seg.target, seg.circle.center),
            rotate(-Math.sign(seg.circle.radius) * (seg.len - to)),
          ),
        ),
      circle: seg.circle,
      len: to - from,
      source,
    };
  }
}

export function cutPath<T, S>(
  path: Path<T>,
  from: [index:number, t:Distance|Angle],
  to: [index:number, t:Distance|Angle],
  type: CutSourceType.Seg,
): PathSeg<CutSource<T, S>>[];
export function cutPath<T, S>(
  path: Path<S>,
  from: [index:number, t:Distance|Angle],
  to: [index:number, t:Distance|Angle],
  type: CutSourceType.LeftCut | CutSourceType.RightCut,
): PathSeg<CutSource<T, S>>[];
export function cutPath<T, S>(
  path: Path<T> | Path<S>,
  from: [index:number, t:Distance|Angle],
  to: [index:number, t:Distance|Angle],
  type: CutSourceType,
): PathSeg<CutSource<T, S>>[] {
  const is_forward = type !== CutSourceType.RightCut;
  
  const sources: CutSource<T, S>[] = [];

  const is_single_section =
    is_forward ? from[0] === to[0] && from[1] < to[1] : from[0] === to[0] && from[1] > to[1];
  if (is_single_section) {
    sources.push({
      type,
      ref: path.segs[from[0]],
      from: from[1],
      to: to[1],
    } as CutSource<T, S>);

  } else {
    // first
    let i = from[0];
    sources.push({
      type,
      ref: path.segs[from[0]],
      from: from[1],
      to: undefined,
    } as CutSource<T, S>);

    while (true) {
      i = is_forward ? (i + 1) % path.segs.length : (i + path.segs.length - 1) % path.segs.length;
      sources.push({
        type,
        ref: path.segs[i],
        from: undefined,
        to: i === to[0] ? to[1] : undefined,
      } as CutSource<T, S>);
      if (i === to[0]) break;
    }
  }
  return sources.map(source => cutPathSeg(source));
}

function getSegCoordinate<T>(start: Point, seg: PathSegLine<T>, point: Point): Distance;
function getSegCoordinate<T>(start: Point, seg: PathSegArc<T>, point: Point): Angle;
function getSegCoordinate<T>(start: Point, seg: PathSeg<T>, point: Point): Distance|Angle {
  if (seg.type === PathSegType.Line) {
    return dot(seg.line.direction, sub(point, start));
  } else {
    return as0to2pi(angleBetween(seg.circle.center, start, point) * Math.sign(seg.circle.radius));
  }
}

export type IntersectionInfo = {
  point: Point,
  ccw: boolean,
  pos1: [index:number, t:Distance|Angle],
  pos2: [index:number, t:Distance|Angle],
};

export type CutIncidenceCondition = {
  index_of_path: number,
  incident_with_cut_start_or_end: boolean,
  considered_as_incident: boolean,
};

export function intersectPaths<T, S>(
  path1: Path<T>,
  path2: Path<S>,
  cond?: CutIncidenceCondition,
): IntersectionInfo[] | undefined {
  console.assert(path1.is_closed);
  console.assert(!path2.is_closed);

  let intersections: IntersectionInfo[] = [];

  for (const i of indices(path1.segs.length)) {
    const start1 = getStartPoint(path1, i);
    const seg1 = path1.segs[i];
    for (const j of indices(path2.segs.length)) {
      const start2 = getStartPoint(path2, j);
      const seg2 = path2.segs[j];
      if (seg1.type === PathSegType.Line && seg2.type === PathSegType.Line) {
        const res = intersectLines(seg1.line, seg2.line);
        if (res === undefined) continue;
        const t1 = getSegCoordinate(start1, seg1, res.point);
        const t2 = getSegCoordinate(start2, seg2, res.point);
        intersections.push({
          point: res.point,
          ccw: res.ccw,
          pos1: [i, t1],
          pos2: [j, t2],
        });
      } else if (seg1.type === PathSegType.Arc && seg2.type === PathSegType.Arc) {
        const res = intersectCircles(seg1.circle, seg2.circle);
        if (res === undefined) continue;
        for (const k of indices(2)) {
          const t1 = getSegCoordinate(start1, seg1, res.points[k]);
          const t2 = getSegCoordinate(start2, seg2, res.points[k]);
          intersections.push({
            point: res.points[k],
            ccw: k === 1,
            pos1: [i, t1],
            pos2: [j, t2],
          });
        }
      } else if (seg1.type === PathSegType.Line && seg2.type === PathSegType.Arc) {
        const res = intersectLineAndCircle(seg1.line, seg2.circle);
        if (res === undefined) continue;
        for (const k of indices(2)) {
          const t1 = getSegCoordinate(start1, seg1, res.points[k]);
          const t2 = getSegCoordinate(start2, seg2, res.points[k]);
          intersections.push({
            point: res.points[k],
            ccw: k === 1,
            pos1: [i, t1],
            pos2: [j, t2],
          });
        }
      } else if (seg1.type === PathSegType.Arc && seg2.type === PathSegType.Line) {
        const res = intersectLineAndCircle(seg2.line, seg1.circle);
        if (res === undefined) continue;
        for (const k of indices(2)) {
          const t1 = getSegCoordinate(start1, seg1, res.points[k]);
          const t2 = getSegCoordinate(start2, seg2, res.points[k]);
          intersections.push({
            point: res.points[k],
            ccw: k === 0,
            pos1: [i, t1],
            pos2: [j, t2],
          });
        }
      }
    }
  }

  if (cond !== undefined) {
    const EPS = 1e-3;
    const index1 = cond.index_of_path;
    const t1 = 0;
    const index1_ = (index1 + path1.segs.length - 1) % path1.segs.length;
    const t1_ = path1.segs[index1_].len;
    const index2 = cond.incident_with_cut_start_or_end ? 0 : path2.segs.length - 1;
    const t2 = cond.incident_with_cut_start_or_end ? 0 : path2.segs[index2].len;
    const include = cond.considered_as_incident;

    let is_path_incident1 = false;
    let is_path_incident2 = false;
    intersections = intersections
      .flatMap(({ccw, point, pos1, pos2}) => {
        if (
          pos1[0] === index1
          && Math.abs(pos1[1] - t1) < EPS
          && pos2[0] === index2
          && Math.abs(pos2[1] - t2) < EPS
        ) {
          is_path_incident1 = true;
          pos1 = [index1, t1];
          pos2 = [index2, t2];
          if (!include)
            return [];
        }

        if (
          pos1[0] === index1_
          && Math.abs(pos1[1] - t1_) < EPS
          && pos2[0] === index2
          && Math.abs(pos2[1] - t2) < EPS
        ) {
          is_path_incident2 = true;
          pos1 = [index1_, t1_];
          pos2 = [index2, t2];
          return [];
        }

        return [{ ccw, point, pos1, pos2 }];
      });

    if (!(is_path_incident1 && is_path_incident2)) {
      return undefined;
    }
  }
  
  intersections = intersections
    .filter(({pos1, pos2}) =>
      (pos1[1] >= 0 && pos1[1] <= path1.segs[pos1[0]].len)
      && (pos2[1] >= 0 && pos2[1] <= path2.segs[pos2[0]].len)
    );
  return intersections;
}

export function cutRegion<T, S>(
  path: Path<T>,
  cut: Path<S>,
  cond?: CutIncidenceCondition,
): Path<CutSource<T, S>>[] | undefined {
  console.assert(path.is_closed);
  console.assert(!cut.is_closed);

  const intersections = intersectPaths(path, cut, cond);
  
  if (intersections === undefined) {
    return undefined;
  }

  if (intersections.length === 0) {
    const segs = path.segs.map(seg => cutPathSeg({
      type: CutSourceType.Seg,
      ref: seg,
      from: undefined,
      to: undefined,
    } as CutSource<T, S>));
    return [
      path.is_closed ?
        { is_closed: path.is_closed, segs }
      : { is_closed: path.is_closed, start: path.start, segs }
    ];
  }

  const order1 = indices(intersections.length)
    .sort((a, b) =>
      (intersections[a].pos1[0] - intersections[b].pos1[0])
      || (intersections[a].pos1[1] - intersections[b].pos1[1])
    );
  const order2 = indices(intersections.length)
    .sort((a, b) =>
      (intersections[a].pos2[0] - intersections[b].pos2[0])
      || (intersections[a].pos2[1] - intersections[b].pos2[1])
    );

  const res: Path<CutSource<T, S>>[] = [];
  const order1_indices = new Set(indices(order1.length));
  for (const _ of indices(intersections.length)) {
    if (order1_indices.size === 0) break;

    const segs: PathSeg<CutSource<T, S>>[] = [];

    const [first_order1_index,] = order1_indices;
    let order1_index = first_order1_index;
    for (const _ of indices(intersections.length)) {
      const order1_index_from = order1_index;
      const order1_index_to = (order1_index_from + 1) % order1.length;
      
      console.assert(order1_indices.has(order1_index_from));
      order1_indices.delete(order1_index_from);
      
      const index_from = order1[order1_index_from];
      const index_to = order1[order1_index_to];
      const intersection_from = intersections[index_from];
      const intersection_to = intersections[index_to];

      segs.push(...cutPath<T, S>(path, intersection_from.pos1, intersection_to.pos1, CutSourceType.Seg));
 
      const order2_index_from = order2.indexOf(index_to);
      console.assert(order2_index_from !== -1);
      const order2_index_to =
        intersection_to.ccw ? (order2_index_from + 1) % order2.length
        : (order2_index_from + order2.length - 1) % order2.length;
      const index_from_ = order2[order2_index_from];
      const index_to_ = order2[order2_index_to];
      const intersection_from_ = intersections[index_from_];
      const intersection_to_ = intersections[index_to_];
      
      console.assert(intersection_to === intersection_from_);
      if (intersection_from_.ccw === intersection_to_.ccw)
        return undefined;
      if (!cut.is_closed && intersection_to.ccw && order2_index_from === order2.length - 1)
        return undefined;
      if (!cut.is_closed && !intersection_to.ccw && order2_index_from === 0)
        return undefined;
      
      segs.push(...cutPath<T, S>(
        cut, intersection_from_.pos2, intersection_to_.pos2,
        intersection_from_.ccw ? CutSourceType.LeftCut : CutSourceType.RightCut
      ));

      order1_index = order1.indexOf(index_to_);
      console.assert(order1_index !== -1);
      if (order1_index === first_order1_index) break;
    }
    console.assert(order1_index === first_order1_index);

    res.push({is_closed: true, segs});
  }
  console.assert(order1_indices.size === 0);

  return res;
}

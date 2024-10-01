import { assert, clamp, indices, mod } from "./Utils.js";
export function add(v, w) {
    return [v[0] + w[0], v[1] + w[1]];
}
export function sub(v, w) {
    return [v[0] - w[0], v[1] - w[1]];
}
export function mul(v, c) {
    return [v[0] * c, v[1] * c];
}
export function norm(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}
export function normalize(v) {
    return mul(v, 1 / norm(v));
}
export function dot(v, w) {
    return v[0] * w[0] + v[1] * w[1];
}
export function cross(v, w) {
    return v[0] * w[1] - v[1] * w[0];
}
export function rot90(v) {
    return [-v[1], v[0]];
}
// -pi ~ pi
export function angleBetween(center, start, end) {
    const v = normalize(sub(start, center));
    const w = normalize(sub(end, center));
    return Math.atan2(cross(v, w), dot(v, w));
}
export function as_0_2pi(angle) {
    return mod(angle, Math.PI * 2);
}
export function as_npi_pi(angle) {
    return mod(angle + Math.PI, Math.PI * 2) - Math.PI;
}
export function transform(point, trans) {
    return [
        trans[0][0] * point[0] + trans[0][1] * point[1] + trans[0][2],
        trans[1][0] * point[0] + trans[1][1] * point[1] + trans[1][2],
    ];
}
export function rotate(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [c, -s, 0],
        [s, c, 0],
    ];
}
export function rotateAround(angle, center) {
    return compose(translate(mul(center, -1)), rotate(angle), translate(center));
}
export function translate(shift) {
    return [
        [1, 0, shift[0]],
        [0, 1, shift[1]],
    ];
}
export function copyTransformation(trans) {
    return [
        [trans[0][0], trans[0][1], trans[0][2]],
        [trans[1][0], trans[1][1], trans[1][2]],
    ];
}
export function inverse(trans) {
    const det = trans[0][0] * trans[1][1] - trans[0][1] * trans[1][0];
    return [
        [trans[1][1] / det, -trans[0][1] / det, (trans[1][2] * trans[0][1] - trans[0][2] * trans[1][1]) / det],
        [-trans[1][0] / det, trans[0][0] / det, (trans[0][2] * trans[1][0] - trans[1][2] * trans[0][0]) / det],
    ];
}
export function getRotationPart(trans) {
    return [
        [trans[0][0], trans[0][1], 0],
        [trans[1][0], trans[1][1], 0],
    ];
}
export function id_trans() {
    return [
        [1, 0, 0],
        [0, 1, 0],
    ];
}
function compose_(trans1, trans2) {
    var _a, _b;
    const r = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 1],
    ];
    const last_row = [0, 0, 1];
    for (const i of indices(3)) {
        for (const j of indices(3)) {
            for (const k of indices(3)) {
                r[i][j] += ((_a = trans2[i]) !== null && _a !== void 0 ? _a : last_row)[k] * ((_b = trans1[k]) !== null && _b !== void 0 ? _b : last_row)[j];
            }
        }
    }
    return [r[0], r[1]];
}
// transform(p, compose(t1, t2)) = transform(transform(p, t1), t2)
export function compose(...transs) {
    if (transs.length === 0)
        return id_trans();
    if (transs.length === 1)
        return copyTransformation(transs[0]);
    return transs.reduce((a, b) => compose_(a, b));
}
export function transformPoint(point, trans) {
    return transform(point, trans);
}
export function flipCircle(circle) {
    return {
        radius: -circle.radius,
        center: [...circle.center],
    };
}
export function transformCircle(circle, trans) {
    return {
        radius: circle.radius,
        center: transformPoint(circle.center, trans),
    };
}
export function flipLine(line) {
    return {
        center: line.center,
        direction: mul(line.direction, -1),
    };
}
export function transformLine(line, trans) {
    return {
        center: transformPoint(line.center, trans),
        direction: transform(line.direction, getRotationPart(trans)),
    };
}
export function projectToLine(line, point) {
    return dot(line.direction, sub(point, line.center));
}
// point on the left side has positive distance
export function distanceToLine(line, point) {
    return cross(line.direction, sub(point, line.center));
}
export function getPointOnLine(line, coordinate) {
    return add(line.center, mul(line.direction, coordinate));
}
export var PathSegType;
(function (PathSegType) {
    PathSegType["Arc"] = "Arc";
    PathSegType["Line"] = "Line";
})(PathSegType || (PathSegType = {}));
export function pathSegToString(path, index) {
    if (path.segs[index].type === PathSegType.Line) {
        return `line([${getStartPoint(path, index)}], [${getEndPoint(path, index)}])`;
    }
    else {
        const seg = path.segs[index];
        assert(seg.type === PathSegType.Arc);
        return `arc([${getStartPoint(path, index)}], [${getEndPoint(path, index)}], c=[${seg.circle.center}])`;
    }
}
export function makePathSegLine(start, end, source) {
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
export function makePathSegArc(start, end, circle, source) {
    return {
        type: PathSegType.Arc,
        target: end,
        circle,
        len: circle.radius > 0 ?
            as_0_2pi(angleBetween(circle.center, start, end))
            : as_0_2pi(angleBetween(circle.center, end, start)),
        source,
    };
}
export function getStartPoint(path, index = 0) {
    return index > 0 ?
        path.segs[index - 1].target
        : path.is_closed ?
            path.segs[path.segs.length - 1].target
            : path.start;
}
export function getEndPoint(path, index) {
    return index !== undefined
        ? path.segs[index].target
        : path.segs[path.segs.length - 1].target;
}
export function transformPath(path, trans) {
    const segs = path.segs.map(seg => {
        if (seg.type === PathSegType.Arc) {
            return {
                type: seg.type,
                target: transformPoint(seg.target, trans),
                circle: transformCircle(seg.circle, trans),
                len: seg.len,
                source: seg.source,
            };
        }
        else {
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
    }
    else {
        return { is_closed: path.is_closed, start: transformPoint(path.start, trans), segs };
    }
}
export function flipPath(path) {
    const segs = path.segs.map((seg, i) => {
        const target = getStartPoint(path, i);
        if (seg.type === PathSegType.Arc) {
            return {
                type: seg.type,
                target,
                circle: flipCircle(seg.circle),
                len: seg.len,
                source: seg.source,
            };
        }
        else {
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
    }
    else {
        return {
            is_closed: path.is_closed,
            start: path.segs[path.segs.length - 1].target,
            segs,
        };
    }
}
export function scalePath(path, scale) {
    const segs = path.segs.map(seg => {
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
        }
        else {
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
    }
    else {
        return { is_closed: path.is_closed, start: mul(path.start, scale), segs };
    }
}
// inside: negative distance
export function calculateNearestPoint(path, point) {
    const distances = [];
    for (const i of indices(path.segs.length)) {
        const seg = path.segs[i];
        if (seg.type === PathSegType.Arc) {
            const pos = seg.circle.radius > 0 ?
                angleBetween(seg.circle.center, getStartPoint(path, i), point)
                : angleBetween(seg.circle.center, point, getStartPoint(path, i));
            if (!(pos > 0 && pos < seg.len))
                continue;
            const dis = norm(sub(point, seg.circle.center)) * Math.sign(seg.circle.radius) - seg.circle.radius;
            const point_ = transformPoint(getStartPoint(path, i), rotateAround(pos * Math.sign(seg.circle.radius), seg.circle.center));
            distances.push({ dis, point: point_ });
        }
        else {
            const pos = dot(seg.line.direction, sub(point, getStartPoint(path, i)));
            if (!(pos > 0 && pos < seg.len))
                continue;
            const dis = -distanceToLine(seg.line, point);
            const point_ = add(getStartPoint(path, i), mul(seg.line.direction, pos));
            distances.push({ dis, point: point_ });
        }
    }
    if (path.is_closed) {
        for (const i of indices(path.segs.length)) {
            const point_ = getStartPoint(path, i);
            const next_seg = path.segs[i];
            const next_dir = next_seg.type === PathSegType.Line ? next_seg.line.direction
                : mul(normalize(rot90(sub(point_, next_seg.circle.center))), Math.sign(next_seg.circle.radius));
            const prev_seg = path.segs[mod(i - 1, path.segs.length)];
            const prev_dir = prev_seg.type === PathSegType.Line ? mul(prev_seg.line.direction, -1)
                : mul(normalize(rot90(sub(point_, prev_seg.circle.center))), -Math.sign(prev_seg.circle.radius));
            const vec = sub(point, point_);
            const is_in_range = as_0_2pi(angleBetween([0, 0], next_dir, vec)) < as_0_2pi(angleBetween([0, 0], next_dir, prev_dir));
            const dis = norm(vec) * (is_in_range ? -1 : 1);
            distances.push({ dis, point: point_ });
        }
    }
    else {
        {
            const point_ = getStartPoint(path, 0);
            const next_seg = path.segs[0];
            const next_dir = next_seg.type === PathSegType.Line ? next_seg.line.direction
                : mul(normalize(rot90(sub(point_, next_seg.circle.center))), Math.sign(next_seg.circle.radius));
            const vec = sub(point, point_);
            const is_in_range = angleBetween([0, 0], next_dir, vec) > 0;
            const dis = norm(vec) * (is_in_range ? -1 : 1);
            distances.push({ dis, point: point_ });
        }
        for (const i of indices(path.segs.length).slice(1)) {
            const point_ = getStartPoint(path, i);
            const next_seg = path.segs[i];
            const next_dir = next_seg.type === PathSegType.Line ? next_seg.line.direction
                : mul(normalize(rot90(sub(point_, next_seg.circle.center))), Math.sign(next_seg.circle.radius));
            const prev_seg = path.segs[mod(i - 1, path.segs.length)];
            const prev_dir = prev_seg.type === PathSegType.Line ? mul(prev_seg.line.direction, -1)
                : mul(normalize(rot90(sub(point_, prev_seg.circle.center))), -Math.sign(prev_seg.circle.radius));
            const vec = sub(point, point_);
            const is_in_range = as_0_2pi(angleBetween([0, 0], next_dir, vec)) < as_0_2pi(angleBetween([0, 0], next_dir, prev_dir));
            const dis = norm(vec) * (is_in_range ? -1 : 1);
            distances.push({ dis, point: point_ });
        }
        {
            const point_ = path.segs[path.segs.length - 1].target;
            const prev_seg = path.segs[mod(-1, path.segs.length)];
            const prev_dir = prev_seg.type === PathSegType.Line ? mul(prev_seg.line.direction, -1)
                : mul(normalize(rot90(sub(point_, prev_seg.circle.center))), -Math.sign(prev_seg.circle.radius));
            const vec = sub(point, point_);
            const is_in_range = angleBetween([0, 0], prev_dir, vec) < 0;
            const dis = norm(vec) * (is_in_range ? -1 : 1);
            distances.push({ dis, point: point_ });
        }
    }
    return distances.reduce((a, b) => Math.abs(a.dis) < Math.abs(b.dis) ? a : b);
}
export function intersectCircles(circle1, circle2) {
    const ab_vec = sub(circle2.center, circle1.center);
    const c = norm(ab_vec);
    const a = Math.abs(circle1.radius);
    const b = Math.abs(circle2.radius);
    const A = Math.acos((c * c + b * b - a * a) / (2 * b * c));
    const B = Math.acos((c * c + a * a - b * b) / (2 * a * c));
    if (Number.isNaN(A) || Number.isNaN(B))
        return undefined;
    const v = mul(normalize(ab_vec), a);
    const point1 = add(circle1.center, transform(v, rotate(-B)));
    const point2 = add(circle1.center, transform(v, rotate(+B)));
    const points = (circle1.radius > 0) === (circle1.radius > 0) ? [point1, point2] : [point2, point1];
    const angles = [
        (circle1.radius > 0 ? A * 2 : 2 * Math.PI - A * 2),
        (circle1.radius > 0 ? B * 2 : 2 * Math.PI - B * 2),
    ];
    return {
        points,
        angles,
    };
}
export function intersectLines(line1, line2) {
    const s = cross(line1.direction, line2.direction);
    const x = -distanceToLine(line1, line2.center) / s;
    if (Number.isNaN(x))
        return undefined;
    const point = getPointOnLine(line2, x);
    return { point, ccw: s > 0 };
}
export function intersectLineAndCircle(line1, circle2) {
    const d = -distanceToLine(line1, circle2.center);
    let angle = 2 * Math.acos(d / Math.abs(circle2.radius));
    let len = 2 * Math.sqrt(circle2.radius * circle2.radius - d * d);
    if (Number.isNaN(angle) || Number.isNaN(len))
        return undefined;
    if (circle2.radius < 0)
        angle = 2 * Math.PI - angle;
    if (circle2.radius < 0)
        len = -len;
    const x = projectToLine(line1, circle2.center);
    const point1 = getPointOnLine(line1, x - len / 2);
    const point2 = getPointOnLine(line1, x + len / 2);
    return {
        points: [point1, point2],
        angle,
        len,
    };
}
export var CutSourceType;
(function (CutSourceType) {
    CutSourceType["Seg"] = "Seg";
    CutSourceType["LeftCut"] = "LeftCut";
    CutSourceType["RightCut"] = "RightCut";
})(CutSourceType || (CutSourceType = {}));
function flipPathSeg(seg) {
    if (seg.type === PathSegType.Line) {
        return {
            type: seg.type,
            target: sub(seg.target, mul(seg.line.direction, seg.len)),
            line: flipLine(seg.line),
            len: seg.len,
            source: seg.source,
        };
    }
    else {
        return {
            type: seg.type,
            target: add(seg.circle.center, transform(sub(seg.target, seg.circle.center), rotate(-Math.sign(seg.circle.radius) * seg.len))),
            circle: flipCircle(seg.circle),
            len: seg.len,
            source: seg.source,
        };
    }
}
function cutPathSeg(source) {
    var _a, _b;
    if (source.type === CutSourceType.RightCut) {
        let res = cutPathSeg({
            type: CutSourceType.LeftCut,
            ref: source.ref,
            from: source.to,
            to: source.from,
        });
        res = flipPathSeg(res);
        res.source = source;
        return res;
    }
    const seg = source.ref;
    const from = (_a = source.from) !== null && _a !== void 0 ? _a : 0;
    const to = (_b = source.to) !== null && _b !== void 0 ? _b : seg.len;
    if (seg.type === PathSegType.Line) {
        return {
            type: seg.type,
            target: sub(seg.target, mul(seg.line.direction, seg.len - to)),
            line: seg.line,
            len: to - from,
            source,
        };
    }
    else {
        return {
            type: seg.type,
            target: add(seg.circle.center, transform(sub(seg.target, seg.circle.center), rotate(-Math.sign(seg.circle.radius) * (seg.len - to)))),
            circle: seg.circle,
            len: to - from,
            source,
        };
    }
}
export function cutPath(path, from, to, type) {
    const is_forward = type !== CutSourceType.RightCut;
    const sources = [];
    const is_single_section = is_forward ? from[0] === to[0] && from[1] < to[1] : from[0] === to[0] && from[1] > to[1];
    if (is_single_section) {
        sources.push({
            type,
            ref: path.segs[from[0]],
            from: from[1],
            to: to[1],
        });
    }
    else {
        // first
        let i = from[0];
        sources.push({
            type,
            ref: path.segs[from[0]],
            from: from[1],
            to: undefined,
        });
        while (true) {
            i = is_forward ? (i + 1) % path.segs.length : (i + path.segs.length - 1) % path.segs.length;
            sources.push({
                type,
                ref: path.segs[i],
                from: undefined,
                to: i === to[0] ? to[1] : undefined,
            });
            if (i === to[0])
                break;
        }
    }
    return sources.map(source => cutPathSeg(source));
}
function getSegCoordinate(start, seg, point) {
    if (seg.type === PathSegType.Line) {
        return dot(seg.line.direction, sub(point, start));
    }
    else {
        return as_0_2pi(angleBetween(seg.circle.center, start, point) * Math.sign(seg.circle.radius));
    }
}
export function intersectPaths(path1, path2, cond) {
    let intersections = [];
    for (const i of indices(path1.segs.length)) {
        const start1 = getStartPoint(path1, i);
        const seg1 = path1.segs[i];
        for (const j of indices(path2.segs.length)) {
            const start2 = getStartPoint(path2, j);
            const seg2 = path2.segs[j];
            if (seg1.type === PathSegType.Line && seg2.type === PathSegType.Line) {
                const res = intersectLines(seg1.line, seg2.line);
                if (res === undefined)
                    continue;
                const t1 = getSegCoordinate(start1, seg1, res.point);
                const t2 = getSegCoordinate(start2, seg2, res.point);
                intersections.push({
                    point: res.point,
                    ccw: res.ccw,
                    pos1: [i, t1],
                    pos2: [j, t2],
                });
            }
            else if (seg1.type === PathSegType.Arc && seg2.type === PathSegType.Arc) {
                const res = intersectCircles(seg1.circle, seg2.circle);
                if (res === undefined)
                    continue;
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
            }
            else if (seg1.type === PathSegType.Line && seg2.type === PathSegType.Arc) {
                const res = intersectLineAndCircle(seg1.line, seg2.circle);
                if (res === undefined)
                    continue;
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
            }
            else if (seg1.type === PathSegType.Arc && seg2.type === PathSegType.Line) {
                const res = intersectLineAndCircle(seg2.line, seg1.circle);
                if (res === undefined)
                    continue;
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
        assert(path1.is_closed);
        assert(!path2.is_closed);
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
            .flatMap(({ ccw, point, pos1, pos2 }) => {
            if (pos1[0] === index1
                && Math.abs(pos1[1] - t1) < EPS
                && pos2[0] === index2
                && Math.abs(pos2[1] - t2) < EPS) {
                is_path_incident1 = true;
                pos1 = [index1, t1];
                pos2 = [index2, t2];
                if (!include)
                    return [];
            }
            if (pos1[0] === index1_
                && Math.abs(pos1[1] - t1_) < EPS
                && pos2[0] === index2
                && Math.abs(pos2[1] - t2) < EPS) {
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
        .filter(({ pos1, pos2 }) => (pos1[1] >= 0 && pos1[1] <= path1.segs[pos1[0]].len)
        && (pos2[1] >= 0 && pos2[1] <= path2.segs[pos2[0]].len));
    return intersections;
}
export function cutNothing(path) {
    if (path.is_closed) {
        return {
            is_closed: path.is_closed,
            segs: path.segs.map(seg => seg.type === PathSegType.Arc ?
                ({ ...seg, source: { type: CutSourceType.Seg, ref: seg, from: undefined, to: undefined } })
                : ({ ...seg, source: { type: CutSourceType.Seg, ref: seg, from: undefined, to: undefined } })),
        };
    }
    else {
        return {
            is_closed: path.is_closed,
            start: path.start,
            segs: path.segs.map(seg => seg.type === PathSegType.Arc ?
                ({ ...seg, source: { type: CutSourceType.Seg, ref: seg, from: undefined, to: undefined } })
                : ({ ...seg, source: { type: CutSourceType.Seg, ref: seg, from: undefined, to: undefined } })),
        };
    }
}
export function cutRegion(path, cut, cond) {
    if (!path.is_closed)
        return undefined;
    if (cut.is_closed)
        return undefined;
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
        }));
        return [{ is_closed: true, segs }];
    }
    const order1 = indices(intersections.length)
        .sort((a, b) => (intersections[a].pos1[0] - intersections[b].pos1[0])
        || (intersections[a].pos1[1] - intersections[b].pos1[1])
        || ((intersections[a].ccw ? -1 : 0) - (intersections[b].ccw ? -1 : 0)));
    const order2 = indices(intersections.length)
        .sort((a, b) => (intersections[a].pos2[0] - intersections[b].pos2[0])
        || (intersections[a].pos2[1] - intersections[b].pos2[1])
        || ((intersections[a].ccw ? 1 : 0) - (intersections[b].ccw ? 1 : 0)));
    const res = [];
    const order1_indices = new Set(indices(order1.length));
    for (const _ of indices(intersections.length)) {
        if (order1_indices.size === 0)
            break;
        const segs = [];
        const [first_order1_index,] = order1_indices;
        let order1_index = first_order1_index;
        for (const _ of indices(intersections.length)) {
            const order1_index_from = order1_index;
            const order1_index_to = order1_index_from + 1;
            assert(order1_indices.has(order1_index_from));
            order1_indices.delete(order1_index_from);
            const intersection_from = intersections[order1[order1_index_from]];
            const intersection_to = intersections[order1[mod(order1_index_to, order1.length)]];
            segs.push(...cutPath(path, intersection_from.pos1, intersection_to.pos1, CutSourceType.Seg));
            const order2_index_from = order2.indexOf(order1[mod(order1_index_to, order1.length)]);
            assert(order2_index_from !== -1);
            const order2_index_to = intersection_to.ccw ? order2_index_from + 1 : order2_index_from - 1;
            const intersection_from_ = intersections[order2[order2_index_from]];
            const intersection_to_ = intersections[order2[clamp(order2_index_to, 0, order2.length - 1)]];
            if (order2_index_to >= 0 && order2_index_to < order2.length) {
                if (intersection_from_.ccw === intersection_to_.ccw)
                    return undefined;
                segs.push(...cutPath(cut, intersection_from_.pos2, intersection_to_.pos2, intersection_from_.ccw ? CutSourceType.LeftCut : CutSourceType.RightCut));
            }
            else if (order2_index_to < 0) {
                const start = [0, 0];
                segs.push(...cutPath(cut, intersection_from_.pos2, start, CutSourceType.RightCut));
                segs.push(...cutPath(cut, start, intersection_from_.pos2, CutSourceType.LeftCut));
            }
            else if (order2_index_to >= order2.length) {
                const end = [cut.segs.length - 1, cut.segs[cut.segs.length - 1].len];
                segs.push(...cutPath(cut, intersection_from_.pos2, end, CutSourceType.LeftCut));
                segs.push(...cutPath(cut, end, intersection_from_.pos2, CutSourceType.RightCut));
            }
            else {
                assert(false);
            }
            order1_index = order1.indexOf(order2[clamp(order2_index_to, 0, order2.length - 1)]);
            assert(order1_index !== -1);
            if (order1_index === first_order1_index)
                break;
        }
        assert(order1_index === first_order1_index);
        res.push({ is_closed: true, segs });
    }
    assert(order1_indices.size === 0);
    return res;
}
export function flattenCut(path) {
    const segs = path.segs.map(seg => {
        let source;
        if (seg.source.type !== CutSourceType.Seg) {
            source = seg.source;
        }
        else if (seg.source.ref.source.type === CutSourceType.RightCut) {
            const from = seg.source.from === undefined ?
                seg.source.ref.source.from
                : seg.source.ref.source.from === undefined ?
                    seg.source.ref.source.ref.len - seg.source.from
                    : seg.source.ref.source.from - seg.source.from;
            const to = seg.source.to === undefined ?
                seg.source.ref.source.to
                : seg.source.ref.source.from === undefined ?
                    seg.source.ref.source.ref.len - seg.source.to
                    : seg.source.ref.source.from - seg.source.to;
            source = { ...seg.source.ref.source, from, to };
        }
        else {
            const from = seg.source.from === undefined ?
                seg.source.ref.source.from
                : seg.source.ref.source.from === undefined ?
                    seg.source.from
                    : seg.source.ref.source.from + seg.source.from;
            const to = seg.source.to === undefined ?
                seg.source.ref.source.to
                : seg.source.ref.source.from === undefined ?
                    seg.source.to
                    : seg.source.ref.source.from + seg.source.to;
            source = { ...seg.source.ref.source, from, to };
        }
        return { ...seg, source };
    });
    return { ...path, segs };
}
export function hasIncompleteCut(path, cut) {
    assert(path.is_closed);
    const seg0 = cut.segs[0];
    const start_index = path.segs
        .map(seg => seg.source)
        .findIndex(source => source.ref === seg0 && source.to === 0 && source.type === CutSourceType.RightCut);
    const incomplete_start_cut = start_index !== -1
        && start_index + 1 < path.segs.length
        && path.segs[start_index + 1].source.type === CutSourceType.LeftCut
        && path.segs[start_index + 1].source.ref === seg0
        && path.segs[start_index + 1].source.from === 0;
    const seg1 = cut.segs[cut.segs.length - 1];
    const end_index = path.segs
        .map(seg => seg.source)
        .findIndex(source => source.ref === seg1 && source.to === seg1.len && source.type === CutSourceType.LeftCut);
    const incomplete_end_cut = end_index !== -1
        && end_index + 1 < path.segs.length
        && path.segs[end_index + 1].source.type === CutSourceType.RightCut
        && path.segs[end_index + 1].source.ref === seg1
        && path.segs[end_index + 1].source.to === seg1.len;
    return incomplete_start_cut || incomplete_end_cut;
}
//# sourceMappingURL=Geometry2D.js.map
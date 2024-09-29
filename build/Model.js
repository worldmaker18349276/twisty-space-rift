import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";
import { assert, indices, mod, zip, rotate, unrollUntilLoopback, append, applyCyclicPerm, cmpOn, cmp, reverseCyclicPerm, isDAG, isReachable, allReachable, Result, asCyclicPerm, applyCyclicPerm_, } from "./Utils.js";
export var Edge;
(function (Edge) {
    function next(edge) {
        assert(!edge.auxiliary);
        let next = edge.next_;
        while (next.auxiliary) {
            next = next.adj.next_;
        }
        return next;
    }
    Edge.next = next;
    function prev(edge) {
        assert(!edge.auxiliary);
        let prev = edge.prev_;
        while (prev.auxiliary) {
            prev = prev.adj.prev_;
        }
        return prev;
    }
    Edge.prev = prev;
    function walk(edge, steps) {
        assert(!edge.auxiliary);
        for (const step of steps) {
            if (step > 0) {
                for (const _ of indices(Math.abs(step))) {
                    edge = Edge.next(edge);
                }
            }
            else {
                for (const _ of indices(Math.abs(step))) {
                    edge = Edge.prev(edge);
                }
            }
            edge = edge.adj;
        }
        return edge;
    }
    Edge.walk = walk;
})(Edge || (Edge = {}));
export var PieceType;
(function (PieceType) {
    PieceType[PieceType["CornerPiece"] = 0] = "CornerPiece";
    PieceType[PieceType["EdgePiece"] = 1] = "EdgePiece";
    PieceType[PieceType["CenterPiece"] = 2] = "CenterPiece";
    PieceType[PieceType["BoundaryPiece"] = 3] = "BoundaryPiece";
    PieceType[PieceType["InfPiece"] = 4] = "InfPiece";
})(PieceType || (PieceType = {}));
export var StateType;
(function (StateType) {
    StateType[StateType["Aligned"] = 0] = "Aligned";
    StateType[StateType["LeftShifted"] = 1] = "LeftShifted";
    StateType[StateType["RightShifted"] = 2] = "RightShifted";
})(StateType || (StateType = {}));
export var AbstractPuzzle;
(function (AbstractPuzzle) {
    function makeEdge(piece) {
        const edge = {
            aff: piece,
            next_: undefined,
            prev_: undefined,
            adj: undefined,
            auxiliary: false,
        };
        edge.next_ = edge;
        edge.prev_ = edge;
        edge.adj = edge;
        return edge;
    }
    function linkEdges(edge1, edge2) {
        edge1.next_ = edge2;
        edge2.prev_ = edge1;
    }
    function adjEdges(edge1, edge2) {
        edge1.adj = edge2;
        edge2.adj = edge1;
    }
    // edges[i] <-> edges[i+1].adj
    function swapAdj(...edges) {
        const adj_edges = rotate(edges, 1).map(edge => edge.adj);
        for (const [edge, adj_edge] of zip(edges, adj_edges))
            adjEdges(edge, adj_edge);
    }
    AbstractPuzzle.swapAdj = swapAdj;
    function makeEdges(piece, n) {
        piece.edges = indices(n).map(_ => makeEdge(piece));
        for (const i of indices(n)) {
            linkEdges(piece.edges[i], piece.edges[mod(i + 1, piece.edges.length)]);
        }
        return piece;
    }
    function makeCornerPiece(name) {
        return makeEdges({ type: PieceType.CornerPiece, edges: [], name }, 3);
    }
    function makeEdgePiece(name) {
        return makeEdges({ type: PieceType.EdgePiece, edges: [], name }, 4);
    }
    function makeBoundaryPiece(name) {
        // edges[0]: edge started with below intersection point
        const pieceBL = makeEdges({ type: PieceType.BoundaryPiece, edges: [], name: name + "L" }, 12);
        // edges[0]: edge started with above intersection point
        const pieceBR = makeEdges({ type: PieceType.BoundaryPiece, edges: [], name: name + "R" }, 12);
        const pieceINF = makeEdges({ type: PieceType.InfPiece, edges: [], name: name + "INF" }, 2);
        pieceBL.edges[9].auxiliary = true;
        pieceBL.edges[10].auxiliary = true;
        pieceBL.edges[11].auxiliary = true;
        pieceBR.edges[9].auxiliary = true;
        pieceBR.edges[10].auxiliary = true;
        pieceBR.edges[11].auxiliary = true;
        pieceINF.edges[0].auxiliary = true;
        pieceINF.edges[1].auxiliary = true;
        adjEdges(pieceBL.edges[9], pieceBR.edges[11]);
        adjEdges(pieceBL.edges[11], pieceBR.edges[9]);
        adjEdges(pieceBR.edges[10], pieceINF.edges[0]);
        adjEdges(pieceBL.edges[10], pieceINF.edges[1]);
        return [pieceBL, pieceBR, pieceINF];
    }
    function makeCenterPiece(name) {
        return makeEdges({ type: PieceType.CenterPiece, edges: [], name }, 6);
    }
    function ramifyPiece(name, pieces, n) {
        const edges = rotate(pieces.flatMap(piece => rotate(piece.edges, n)), -n);
        const type = pieces[0].type;
        const piece = { type, edges, name };
        for (const i of indices(edges.length)) {
            linkEdges(edges[i], edges[mod(i + 1, edges.length)]);
            edges[i].aff = piece;
        }
        return piece;
    }
    AbstractPuzzle.ramifyPiece = ramifyPiece;
    function chunkPiece(name, piece, step) {
        assert(piece.edges.length % step == 0);
        const subpieces = [];
        for (const n of indices(piece.edges.length / step)) {
            const type = piece.type;
            const subpiece = { type, edges: [], name: `${name}${n}` };
            const edges = piece.edges.slice(n * step, (n + 1) * step);
            edges.unshift(makeEdge(subpiece));
            edges.push(makeEdge(subpiece));
            for (const i of indices(edges.length)) {
                linkEdges(edges[i], edges[mod(i + 1, edges.length)]);
                edges[i].aff = subpiece;
            }
            subpiece.edges = edges;
            subpieces.push(subpiece);
        }
        for (const n of indices(subpieces.length)) {
            const prev_subpiece = subpieces[n];
            const next_subpiece = subpieces[mod(n + 1, subpieces.length)];
            const prev_edge = prev_subpiece.edges[prev_subpiece.edges.length - 1];
            const next_edge = next_subpiece.edges[0];
            adjEdges(prev_edge, next_edge);
            prev_edge.auxiliary = true;
            next_edge.auxiliary = true;
        }
        return subpieces;
    }
    AbstractPuzzle.chunkPiece = chunkPiece;
    function edgeAt(puzzle, sheet, steps) {
        return Edge.walk(puzzle.stands[sheet], steps);
    }
    AbstractPuzzle.edgeAt = edgeAt;
    function makePieces(suffix = "") {
        // edges[0]: edge started with center piece
        // piece0L: piece touched above intersection point
        const piece0L = makeCornerPiece("0L" + suffix);
        const piece1L = makeCornerPiece("1L" + suffix);
        const piece2L = makeCornerPiece("2L" + suffix);
        const piece3L = makeCornerPiece("3L" + suffix);
        const piece4L = makeCornerPiece("4L" + suffix);
        // piece0R: piece touched below intersection point
        const piece0R = makeCornerPiece("0R" + suffix);
        const piece1R = makeCornerPiece("1R" + suffix);
        const piece2R = makeCornerPiece("2R" + suffix);
        const piece3R = makeCornerPiece("3R" + suffix);
        const piece4R = makeCornerPiece("4R" + suffix);
        // edges[0]: edge adj to center piece
        // piece01L: piece between piece0l and piece1l
        const piece01L = makeEdgePiece("01L" + suffix);
        const piece12L = makeEdgePiece("12L" + suffix);
        const piece23L = makeEdgePiece("23L" + suffix);
        const piece34L = makeEdgePiece("34L" + suffix);
        const piece45L = makeEdgePiece("45L" + suffix);
        const piece01R = makeEdgePiece("01R" + suffix);
        const piece12R = makeEdgePiece("12R" + suffix);
        const piece23R = makeEdgePiece("23R" + suffix);
        const piece34R = makeEdgePiece("34R" + suffix);
        const piece45R = makeEdgePiece("45R" + suffix);
        // pieceBL.edges[0]: edge started with below intersection point
        // pieceBR.edges[0]: edge started with above intersection point
        const [pieceBL, pieceBR, pieceINF] = makeBoundaryPiece("B" + suffix);
        // edges[0]: edge adjacent to center edge piece
        const pieceCL = makeCenterPiece("CL" + suffix);
        const pieceCR = makeCenterPiece("CR" + suffix);
        // edges[0]: adj to left center
        const piece50L = makeEdgePiece("50L" + suffix);
        // adj boundary
        adjEdges(piece01L.edges[2], pieceBL.edges[9 - 1 - 0]);
        adjEdges(piece12L.edges[2], pieceBL.edges[9 - 1 - 2]);
        adjEdges(piece23L.edges[2], pieceBL.edges[9 - 1 - 4]);
        adjEdges(piece34L.edges[2], pieceBL.edges[9 - 1 - 6]);
        adjEdges(piece45L.edges[2], pieceBL.edges[9 - 1 - 8]);
        adjEdges(piece1L.edges[1], pieceBL.edges[9 - 1 - 1]);
        adjEdges(piece2L.edges[1], pieceBL.edges[9 - 1 - 3]);
        adjEdges(piece3L.edges[1], pieceBL.edges[9 - 1 - 5]);
        adjEdges(piece4L.edges[1], pieceBL.edges[9 - 1 - 7]);
        adjEdges(piece01R.edges[2], pieceBR.edges[9 - 1 - 0]);
        adjEdges(piece12R.edges[2], pieceBR.edges[9 - 1 - 2]);
        adjEdges(piece23R.edges[2], pieceBR.edges[9 - 1 - 4]);
        adjEdges(piece34R.edges[2], pieceBR.edges[9 - 1 - 6]);
        adjEdges(piece45R.edges[2], pieceBR.edges[9 - 1 - 8]);
        adjEdges(piece1R.edges[1], pieceBR.edges[9 - 1 - 1]);
        adjEdges(piece2R.edges[1], pieceBR.edges[9 - 1 - 3]);
        adjEdges(piece3R.edges[1], pieceBR.edges[9 - 1 - 5]);
        adjEdges(piece4R.edges[1], pieceBR.edges[9 - 1 - 7]);
        // adj center
        adjEdges(piece50L.edges[0], pieceCL.edges[0]);
        adjEdges(piece01L.edges[0], pieceCL.edges[1]);
        adjEdges(piece12L.edges[0], pieceCL.edges[2]);
        adjEdges(piece23L.edges[0], pieceCL.edges[3]);
        adjEdges(piece34L.edges[0], pieceCL.edges[4]);
        adjEdges(piece45L.edges[0], pieceCL.edges[5]);
        adjEdges(piece50L.edges[2], pieceCR.edges[0]);
        adjEdges(piece01R.edges[0], pieceCR.edges[1]);
        adjEdges(piece12R.edges[0], pieceCR.edges[2]);
        adjEdges(piece23R.edges[0], pieceCR.edges[3]);
        adjEdges(piece34R.edges[0], pieceCR.edges[4]);
        adjEdges(piece45R.edges[0], pieceCR.edges[5]);
        // adj corner, edge
        adjEdges(piece0L.edges[2], piece01L.edges[1]);
        adjEdges(piece1L.edges[2], piece12L.edges[1]);
        adjEdges(piece2L.edges[2], piece23L.edges[1]);
        adjEdges(piece3L.edges[2], piece34L.edges[1]);
        adjEdges(piece4L.edges[2], piece45L.edges[1]);
        adjEdges(piece0L.edges[0], piece50L.edges[3]);
        adjEdges(piece1L.edges[0], piece01L.edges[3]);
        adjEdges(piece2L.edges[0], piece12L.edges[3]);
        adjEdges(piece3L.edges[0], piece23L.edges[3]);
        adjEdges(piece4L.edges[0], piece34L.edges[3]);
        adjEdges(piece0R.edges[1], piece45L.edges[3]);
        adjEdges(piece0R.edges[2], piece01R.edges[1]);
        adjEdges(piece1R.edges[2], piece12R.edges[1]);
        adjEdges(piece2R.edges[2], piece23R.edges[1]);
        adjEdges(piece3R.edges[2], piece34R.edges[1]);
        adjEdges(piece4R.edges[2], piece45R.edges[1]);
        adjEdges(piece0R.edges[0], piece50L.edges[1]);
        adjEdges(piece1R.edges[0], piece01R.edges[3]);
        adjEdges(piece2R.edges[0], piece12R.edges[3]);
        adjEdges(piece3R.edges[0], piece23R.edges[3]);
        adjEdges(piece4R.edges[0], piece34R.edges[3]);
        adjEdges(piece0L.edges[1], piece45R.edges[3]);
        return {
            pieces: [
                piece0L,
                piece1L,
                piece2L,
                piece3L,
                piece4L,
                piece0R,
                piece1R,
                piece2R,
                piece3R,
                piece4R,
                piece01L,
                piece12L,
                piece23L,
                piece34L,
                piece45L,
                piece01R,
                piece12R,
                piece23R,
                piece34R,
                piece45R,
                pieceBL,
                pieceBR,
                pieceINF,
                pieceCL,
                pieceCR,
                piece50L,
            ],
            stand: pieceBR.edges[0],
        };
    }
    AbstractPuzzle.makePieces = makePieces;
    function makePuzzle(factory) {
        const { pieces, stands, ramified } = factory.make_pieces();
        return {
            pieces,
            stands,
            ramified,
            states: indices(stands.length).map(_ => ({ type: StateType.Aligned })),
        };
    }
    AbstractPuzzle.makePuzzle = makePuzzle;
    // side = true: left
    function getTwistEdges(puzzle, side, sheet) {
        const edge0 = side ? edgeAt(puzzle, sheet, [-1, -1, -2, -1, 0])
            : edgeAt(puzzle, sheet, [0, 1, 2, 1, 0]);
        return unrollUntilLoopback(edge0, edge => Edge.walk(edge, [1, 1, 0]));
    }
    AbstractPuzzle.getTwistEdges = getTwistEdges;
    // side = true: left
    function getTwistPieces(puzzle, side, sheet) {
        const boundaries = indices(puzzle.stands.length).map(sheet => getTwistEdges(puzzle, side, sheet));
        const sheets = new Set();
        const pieces = new Set();
        for (const edge of boundaries[sheet])
            pieces.add(edge.aff);
        for (const piece of pieces)
            for (const edge of piece.edges) {
                let is_bd = false;
                for (const sheet of indices(boundaries.length)) {
                    if (boundaries[sheet].includes(edge)) {
                        sheets.add(sheet);
                        is_bd = true;
                    }
                }
                if (!is_bd) {
                    pieces.add(edge.adj.aff);
                }
            }
        if (Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.Aligned)
            || Array.from(sheets).every(sheet => side && puzzle.states[sheet].type === StateType.LeftShifted)
            || Array.from(sheets).every(sheet => !side && puzzle.states[sheet].type === StateType.RightShifted))
            return { pieces, sheets };
        return undefined;
    }
    AbstractPuzzle.getTwistPieces = getTwistPieces;
    // side = true: left
    function twistSnapped(puzzle, side, sheet, forward) {
        const { sheets } = getTwistPieces(puzzle, side, sheet);
        const edgess = Array.from(sheets).map(sheet => getTwistEdges(puzzle, side, sheet));
        const edgess_adj_rotated = edgess
            .map(edges => edges.map(edge => edge.adj))
            .map(edges_adj => forward ? rotate(edges_adj, 2) : rotate(edges_adj, -2));
        for (const [edges, edges_adj_rotated] of zip(edgess, edgess_adj_rotated)) {
            for (const [edge, edge_adj_rotated] of zip(edges, edges_adj_rotated)) {
                adjEdges(edge, edge_adj_rotated);
            }
        }
    }
    // side = true: left
    // sheets: Puzzle.getTwistPieces(puzzle, side, sheet).sheets
    function setShift(puzzle, side, sheets, angle) {
        if (side && Array.from(sheets).every(sheet => puzzle.states[sheet].type !== StateType.RightShifted)) {
            assert(Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.LeftShifted)
                || Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.Aligned));
            puzzle.states = puzzle.states.map((state, sheet) => sheets.has(sheet) ? ({ type: StateType.LeftShifted, angle: angle }) : state);
        }
        else if (!side && Array.from(sheets).every(sheet => puzzle.states[sheet].type !== StateType.LeftShifted)) {
            assert(Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.RightShifted)
                || Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.Aligned));
            puzzle.states = puzzle.states.map((state, sheet) => sheets.has(sheet) ? ({ type: StateType.RightShifted, angle: angle }) : state);
        }
        else {
            assert(false);
        }
    }
    AbstractPuzzle.setShift = setShift;
    function snap(puzzle) {
        const ANGLE_EPS = 1e-8;
        const actions = [];
        for (const sheet of indices(puzzle.states.length)) {
            const state = puzzle.states[sheet];
            if (state.type === StateType.Aligned)
                continue;
            const turn = Math.round(state.angle / (Math.PI / 3));
            const err = Math.abs(state.angle - Math.round(state.angle / (Math.PI / 3)) * (Math.PI / 3));
            if (err > ANGLE_EPS)
                continue;
            const side = state.type === StateType.LeftShifted;
            const { sheets } = getTwistPieces(puzzle, side, sheet);
            for (const sheet of sheets)
                puzzle.states[sheet] = { type: StateType.Aligned };
            for (const _ of indices(Math.abs(turn)))
                twistSnapped(puzzle, side, sheet, turn > 0);
            actions.push({ side, sheets, turn });
        }
        return actions;
    }
    AbstractPuzzle.snap = snap;
    function isAligned(puzzle) {
        return puzzle.states.every(state => state.type === StateType.Aligned);
    }
    AbstractPuzzle.isAligned = isAligned;
})(AbstractPuzzle || (AbstractPuzzle = {}));
export var Puzzle;
(function (Puzzle) {
    function ckeckPuzzleShape(shape) {
        assert(shape.center_x > 0);
        assert(shape.radius > 0);
        assert(shape.center_x < shape.radius);
        assert(shape.center_x * 2 > shape.radius);
        assert(shape.R > shape.center_x + shape.radius);
    }
    function makePuzzle(factory, shape) {
        ckeckPuzzleShape(shape);
        const puzzle = AbstractPuzzle.makePuzzle(factory);
        return {
            ...puzzle,
            ...shape,
        };
    }
    Puzzle.makePuzzle = makePuzzle;
    function getTwistCircles(puzzle) {
        return [
            { center: [-puzzle.center_x, 0], radius: puzzle.radius },
            { center: [+puzzle.center_x, 0], radius: puzzle.radius },
        ];
    }
    Puzzle.getTwistCircles = getTwistCircles;
    function getTwistTransformation(puzzle, side, forward) {
        const [left_circle, right_circle] = getTwistCircles(puzzle);
        if (side && forward)
            return Geo.rotateAround(Math.PI / 3, left_circle.center);
        else if (side && !forward)
            return Geo.rotateAround(-Math.PI / 3, left_circle.center);
        else if (!side && forward)
            return Geo.rotateAround(Math.PI / 3, right_circle.center);
        else if (!side && !forward)
            return Geo.rotateAround(-Math.PI / 3, right_circle.center);
        else
            assert(false);
    }
    Puzzle.getTwistTransformation = getTwistTransformation;
    function getShiftTransformations(puzzle) {
        const [left_circle, right_circle] = getTwistCircles(puzzle);
        const res = [];
        const visited_sheets = [];
        for (const sheet of indices(puzzle.states.length)) {
            const state = puzzle.states[sheet];
            if (visited_sheets.includes(sheet))
                continue;
            if (state.type === StateType.Aligned)
                continue;
            const side = state.type === StateType.LeftShifted;
            const { sheets } = AbstractPuzzle.getTwistPieces(puzzle, side, sheet);
            const trans = side ? Geo.rotateAround(state.angle, left_circle.center)
                : Geo.rotateAround(state.angle, right_circle.center);
            res.push({ trans, side, sheets });
            visited_sheets.push(...sheets);
        }
        return res;
    }
    Puzzle.getShiftTransformations = getShiftTransformations;
    function transformArc(arc, trans) {
        return {
            start: Geo.transformPoint(arc.start, trans),
            end: Geo.transformPoint(arc.end, trans),
            auxiliary_point: Geo.transformPoint(arc.auxiliary_point, trans),
            circle: Geo.transformCircle(arc.circle, trans),
        };
    }
    function flipArc(arc) {
        return {
            start: arc.end,
            end: arc.start,
            auxiliary_point: arc.auxiliary_point,
            circle: Geo.flipCircle(arc.circle),
        };
    }
    function calculateArcs(puzzle) {
        const left_trans = getTwistTransformation(puzzle, true, true);
        const right_trans = getTwistTransformation(puzzle, false, true);
        const [left_circle, right_circle] = getTwistCircles(puzzle);
        const intersections = Geo.intersectCircles(left_circle, right_circle);
        assert(intersections !== undefined);
        const p0 = intersections.points[1];
        const p1 = Geo.transformPoint(p0, right_trans);
        const p2 = Geo.transformPoint(p1, left_trans);
        const auxiliary_point = [0, puzzle.center_x / Math.sqrt(3)];
        const short_edge_angle = Geo.angleBetween(right_circle.center, p2, p1);
        const arcs = new Map();
        arcs.set(AbstractPuzzle.edgeAt(puzzle, 0, [0, 1, 1, 0]), { start: p0, end: p2, auxiliary_point, circle: right_circle });
        arcs.set(AbstractPuzzle.edgeAt(puzzle, 0, [0, 1, -1, 1, 0]), { start: p2, end: p1, auxiliary_point, circle: right_circle });
        for (const [edge, arc] of arcs) {
            if (!arcs.has(edge.adj)) {
                arcs.set(edge.adj, flipArc(arc));
            }
            if (!arcs.has(Edge.next(edge))) {
                if (edge.aff.type === PieceType.CornerPiece) {
                    arcs.set(Edge.next(edge), transformArc(arc, Geo.rotateAround(Math.PI * 2 / 3, arc.auxiliary_point)));
                }
                else if (edge.aff.type === PieceType.EdgePiece && edge.adj.aff.type === PieceType.CornerPiece) {
                    const circle = Geo.transformCircle(Geo.flipCircle(arc.circle), Geo.rotateAround(-Math.PI * 2 / 3, arc.auxiliary_point));
                    const end = Geo.transformPoint(arc.end, Geo.rotateAround(short_edge_angle, circle.center));
                    arcs.set(Edge.next(edge), { start: arc.end, end, auxiliary_point: arc.auxiliary_point, circle });
                }
                else if (edge.aff.type === PieceType.EdgePiece && edge.adj.aff.type !== PieceType.CornerPiece) {
                    const auxiliary_point = Geo.transformPoint(arc.auxiliary_point, Geo.rotateAround(Math.PI / 3, arc.circle.center));
                    const circle = Geo.transformCircle(Geo.flipCircle(arc.circle), Geo.rotateAround(-Math.PI * 2 / 3, auxiliary_point));
                    const end = Geo.transformPoint(arc.end, Geo.rotateAround(-Math.PI * 2 / 3, auxiliary_point));
                    arcs.set(Edge.next(edge), { start: arc.end, end, auxiliary_point, circle });
                }
            }
        }
        for (const shift_trans of getShiftTransformations(puzzle)) {
            const [sheet] = shift_trans.sheets;
            const { pieces } = AbstractPuzzle.getTwistPieces(puzzle, shift_trans.side, sheet);
            for (const piece of pieces) {
                for (const edge of piece.edges) {
                    const arc = arcs.get(edge);
                    if (arc !== undefined) {
                        arcs.set(edge, transformArc(arc, shift_trans.trans));
                    }
                }
            }
        }
        return arcs;
    }
    function calculateBoundaryShapes(puzzle, arcs, sheet) {
        const pieceBR = AbstractPuzzle.edgeAt(puzzle, sheet, []).aff;
        const pieceBL = AbstractPuzzle.edgeAt(puzzle, sheet, [-1, 0]).aff;
        const circle = { center: [0, 0], radius: puzzle.R };
        const top = [0, puzzle.R];
        const bot = [0, -puzzle.R];
        return new Map([pieceBL, pieceBR].map(piece => {
            const path = { is_closed: true, segs: [] };
            for (const edge of piece.edges.slice(0, 9)) {
                const arc = arcs.get(edge);
                path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
            }
            const p1 = arcs.get(piece.edges[8]).end;
            const p2 = p1[1] > 0 ? top : bot;
            const p3 = p1[1] > 0 ? bot : top;
            const p4 = arcs.get(piece.edges[0]).start;
            path.segs.push(Geo.makePathSegLine(p1, p2, piece.edges[9]));
            path.segs.push(Geo.makePathSegArc(p2, p3, circle, piece.edges[10]));
            path.segs.push(Geo.makePathSegLine(p3, p4, piece.edges[11]));
            return [piece, path];
        }));
    }
    function calculateShapes(puzzle) {
        const arcs = calculateArcs(puzzle);
        const branch_points = puzzle.ramified.map(({ pieces }) => {
            const points = pieces
                .flatMap(piece => piece.edges.slice(1, piece.edges.length - 1))
                .map(edge => arcs.get(edge))
                .map(arc => arc.start);
            return Geo.mul(points.reduce(Geo.add), 1 / points.length);
        });
        const result = new Map();
        for (const piece of puzzle.pieces) {
            if (piece.type === PieceType.BoundaryPiece)
                continue;
            if (piece.type === PieceType.InfPiece)
                continue;
            const ramified = puzzle.ramified.find(({ pieces }) => pieces.includes(piece));
            if (ramified !== undefined) {
                const branch_point = branch_points[puzzle.ramified.indexOf(ramified)];
                const path = { is_closed: true, segs: [] };
                {
                    const arc_ = arcs.get(piece.edges[1]);
                    path.segs.push(Geo.makePathSegLine(branch_point, arc_.start, piece.edges[0]));
                }
                for (const edge of piece.edges.slice(1, piece.edges.length - 1)) {
                    const arc = arcs.get(edge);
                    path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
                }
                {
                    const arc_ = arcs.get(piece.edges[piece.edges.length - 2]);
                    path.segs.push(Geo.makePathSegLine(arc_.end, branch_point, piece.edges[piece.edges.length - 1]));
                }
                result.set(piece, path);
            }
            else {
                const path = { is_closed: true, segs: [] };
                for (const edge of piece.edges) {
                    const arc = arcs.get(edge);
                    path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
                }
                result.set(piece, path);
            }
        }
        for (const sheet of indices(puzzle.stands.length))
            for (const [piece, shape] of calculateBoundaryShapes(puzzle, arcs, sheet))
                result.set(piece, shape);
        return result;
    }
    Puzzle.calculateShapes = calculateShapes;
    function getEdgeAngles(puzzle) {
        const left_trans = getTwistTransformation(puzzle, true, true);
        const right_trans = getTwistTransformation(puzzle, false, true);
        const [left_circle, right_circle] = getTwistCircles(puzzle);
        const intersections = Geo.intersectCircles(left_circle, right_circle);
        assert(intersections !== undefined);
        const p0 = intersections.points[1];
        const p1 = Geo.transformPoint(p0, right_trans);
        const p2 = Geo.transformPoint(p1, left_trans);
        const ang = Geo.angleBetween(right_circle.center, p2, p1);
        return [ang, Math.PI / 3 - ang];
    }
    function getEdgeAngleType(edge) {
        assert(!edge.auxiliary);
        return edge.aff.type === PieceType.EdgePiece
            && edge.adj.aff.type !== PieceType.CornerPiece
            || edge.aff.type === PieceType.BoundaryPiece
                && edge.adj.aff.type === PieceType.EdgePiece
            || edge.aff.type === PieceType.CenterPiece
                && edge.adj.aff.type === PieceType.EdgePiece;
    }
    function getAdjacentEdges(puzzle, edge) {
        assert(!edge.auxiliary);
        const [short_angle, long_angle] = getEdgeAngles(puzzle);
        const angle = getEdgeAngleType(edge) ? short_angle : long_angle;
        const cycles = getShiftTransformations(puzzle)
            .flatMap(shifted_trans => Array.from(shifted_trans.sheets).map(sheet => [
            AbstractPuzzle.getTwistEdges(puzzle, shifted_trans.side, sheet),
            sheet,
        ]))
            .flatMap(([cycle, sheet]) => [
            [cycle, sheet],
            [cycle.map(edge => edge.adj).reverse(), sheet],
        ]);
        const cycle_sheet = cycles.find(([cycle, sheet]) => cycle.includes(edge));
        if (cycle_sheet === undefined) {
            return [{
                    edge: edge.adj,
                    offset: angle,
                    from: 0,
                    to: angle,
                }];
        }
        const [cycle, sheet] = cycle_sheet;
        const cycle_rotated = rotate(cycle, cycle.indexOf(edge));
        assert(puzzle.states[sheet].type !== StateType.Aligned);
        const shifted_angle = puzzle.states[sheet].angle;
        const res = [];
        if (shifted_angle >= 0) {
            let offset = -shifted_angle;
            for (let n = 0;; n = mod(n + 1, cycle_rotated.length)) {
                const adj_edge = cycle_rotated[n].adj;
                const adj_angle = getEdgeAngleType(adj_edge) ? short_angle : long_angle;
                const from = Math.max(offset, 0);
                offset += adj_angle;
                const to = Math.min(offset, angle);
                if (to > from)
                    res.push({ edge: adj_edge, offset, from, to });
                if (offset > angle)
                    break;
            }
        }
        else {
            let offset;
            {
                const n = 0;
                const adj_edge = cycle_rotated[n].adj;
                const adj_angle = getEdgeAngleType(adj_edge) ? short_angle : long_angle;
                offset = -shifted_angle + adj_angle;
            }
            for (let n = 0;; n = mod(n - 1, cycle_rotated.length)) {
                const adj_edge = cycle_rotated[n].adj;
                const adj_angle = getEdgeAngleType(adj_edge) ? short_angle : long_angle;
                const to = Math.min(offset, angle);
                offset -= adj_angle;
                const from = Math.max(offset, 0);
                if (to > from)
                    res.push({ edge: adj_edge, offset: offset + adj_angle, from, to });
                if (offset < 0)
                    break;
            }
            res.reverse();
        }
        return res;
    }
    Puzzle.getAdjacentEdges = getAdjacentEdges;
})(Puzzle || (Puzzle = {}));
export var HyperbolicPolarCoordinate;
(function (HyperbolicPolarCoordinate) {
    // `offset` is the offset of the hyperbola curve
    // `angle` is the angle of vector from the focus to the point on the hyperbola curve
    // when offset < 0: `angle` is the angle `(f1, f2, point)`
    // when offset > 0: `angle` is the angle `(f2, point, f1)`
    // `is_solid` means if `point` is on the main focus side
    function getHyperbolaPoint(f1, f2, coord) {
        // hyperbola with origin at focus: r = (c^2 - a^2) / (a + c cos(theta))
        // c: half distance between focus
        // a: smallest distance between hyperbola curve and the center of hyperbola
        // theta: angle from focus to a point on hyperbola curve
        assert(-1 < coord.offset && coord.offset < 1);
        const c = Geo.norm(Geo.sub(f1, f2)) / 2;
        const a = c * Math.abs(coord.offset);
        const r = (c * c - a * a) / (a + c * Math.cos(coord.angle));
        if (coord.offset < 0) {
            const d = Geo.normalize(Geo.sub(f2, f1));
            const d_ = Geo.transform(d, Geo.rotate(coord.angle));
            return [Geo.add(f1, Geo.mul(d_, r)), r > 0];
        }
        else {
            const d = Geo.normalize(Geo.sub(f1, f2));
            const d_ = Geo.transform(d, Geo.rotate(-coord.angle));
            return [Geo.add(f2, Geo.mul(d_, r)), r > 0];
        }
    }
    HyperbolicPolarCoordinate.getHyperbolaPoint = getHyperbolaPoint;
    function getCoordinateFromPoint(f1, f2, point) {
        const a = (Geo.norm(Geo.sub(f1, point)) - Geo.norm(Geo.sub(f2, point))) / 2;
        const offset = a / (Geo.norm(Geo.sub(f1, f2)) / 2);
        const angle = offset < 0 ? Geo.angleBetween(f1, f2, point) : Geo.angleBetween(f2, point, f1);
        return { offset, angle };
    }
    HyperbolicPolarCoordinate.getCoordinateFromPoint = getCoordinateFromPoint;
    function makeSameTurn(angle, ref_angle) {
        const angle_to_0 = Math.abs(Geo.as_npi_pi(ref_angle));
        if (angle_to_0 < Math.PI / 2) {
            const n = Math.floor((ref_angle + Math.PI) / (Math.PI * 2));
            return Geo.as_npi_pi(angle) + n * Math.PI * 2;
        }
        else {
            const n = Math.floor(ref_angle / (Math.PI * 2));
            return Geo.as_0_2pi(angle) + n * Math.PI * 2;
        }
    }
    function computeLeftAngle(offset, right_angle) {
        const s = Math.sin(right_angle);
        const c = Math.cos(right_angle);
        const left_angle = Math.atan2(s, offset + c) - Math.atan2(offset * s, offset * c + 1);
        return makeSameTurn(left_angle, right_angle);
    }
    function getFocusAngles(coord) {
        if (coord.offset < 0) {
            return [coord.angle, computeLeftAngle(-coord.offset, coord.angle)];
        }
        else {
            return [computeLeftAngle(coord.offset, coord.angle), coord.angle];
        }
    }
    HyperbolicPolarCoordinate.getFocusAngles = getFocusAngles;
    function getCoordinateFromAngles(left_angle, right_angle) {
        const offset = (Math.sin(right_angle) - Math.sin(left_angle)) / Math.sin(left_angle + right_angle);
        const angle = offset > 0 ? right_angle : left_angle;
        return { offset, angle };
    }
    HyperbolicPolarCoordinate.getCoordinateFromAngles = getCoordinateFromAngles;
    function offsetTo(coord, offset) {
        const [left_angle, right_angle] = getFocusAngles(coord);
        if (coord.offset > offset) {
            if (offset < 0) {
                return { offset, angle: computeLeftAngle(offset, right_angle) };
            }
            else {
                return { offset, angle: right_angle };
            }
        }
        else {
            if (offset < 0) {
                return { offset, angle: left_angle };
            }
            else {
                return { offset, angle: computeLeftAngle(-offset, left_angle) };
            }
        }
    }
    HyperbolicPolarCoordinate.offsetTo = offsetTo;
})(HyperbolicPolarCoordinate || (HyperbolicPolarCoordinate = {}));
export var PrincipalPuzzle;
(function (PrincipalPuzzle) {
    const MAX_RIFT_OFFSET = 0.8;
    function makePuzzle(factory, shape) {
        const puzzle = Puzzle.makePuzzle(factory, shape);
        const rifts = factory.make_rifts(shape);
        const branch_points = rifts.branch_points.map((branch_point, index) => {
            const rel_angles = rifts.rifts.map(rift => {
                if (index === rift.left || index === rift.right) {
                    return 0;
                }
                else {
                    let coord = HyperbolicPolarCoordinate.getCoordinateFromPoint(rifts.branch_points[rift.left].point, rifts.branch_points[rift.right].point, branch_point.point);
                    coord = HyperbolicPolarCoordinate.offsetTo(coord, rift.coord.offset);
                    return Geo.as_0_2pi(coord.angle - rift.coord.angle);
                }
            });
            return { ...branch_point, perm: asCyclicPerm(branch_point.order), rel_angles };
        });
        return {
            ...puzzle,
            branch_points,
            rifts: rifts.rifts,
            rift_hierarchy: rifts.rift_hierarchy,
        };
    }
    PrincipalPuzzle.makePuzzle = makePuzzle;
    function computeRiftRelAngles(branch_points, new_rifts) {
        const rel_angless_ = branch_points.map((branch_point, pindex) => new_rifts.map(rift => {
            if (pindex === rift.left || pindex === rift.right) {
                return 0;
            }
            else {
                let coord = HyperbolicPolarCoordinate.getCoordinateFromPoint(branch_points[rift.left].point, branch_points[rift.right].point, branch_point.point);
                coord = HyperbolicPolarCoordinate.offsetTo(coord, rift.coord.offset);
                return coord.angle - rift.coord.angle;
            }
        })
            .map((rel_angle, rift_index) => {
            const prev_rel_angle = branch_point.rel_angles[rift_index];
            return Geo.as_npi_pi(rel_angle - prev_rel_angle) + prev_rel_angle;
        }));
        // validate rifts crossing branch points
        const crosses = rel_angless_.map(rel_angles => rel_angles.map(rel_angle => Math.floor(rel_angle / (Math.PI * 2))));
        if (crosses.some(cross => cross.some(i => Math.abs(i) > 1))) {
            return Result.err("crossing a rift too many times");
        }
        if (crosses.some(cross => cross.filter(i => i !== 0).length > 1)) {
            return Result.err("crossing multiple rifts at the same time");
        }
        if (new_rifts.some(({ left, right }) => crosses[left].some(j => j !== 0) && crosses[right].some(j => j !== 0))) {
            return Result.err("two endpoints of a rift crossing at the same time");
        }
        const rel_angless = zip(crosses, rel_angless_)
            .map(([cross, rel_angles]) => zip(cross, rel_angles)
            .map(([turn, rel_angle]) => rel_angle - turn * Math.PI * 2));
        const cross_relations = crosses.flatMap((cross, i) => cross.flatMap((turn, j) => (turn === 0 ? [] : [[i, j]])));
        return Result.ok({
            rel_angless,
            cross_relations,
        });
    }
    function getInfRadius(puzzle, rift) {
        return puzzle.R * 1.5 + Math.max(rift.left, rift.right) * puzzle.radius / 10;
    }
    function calculateRiftShape(left_point, right_point, coord, inf_radius) {
        const [middle, is_solid] = HyperbolicPolarCoordinate.getHyperbolaPoint(left_point, right_point, coord);
        if (is_solid && Geo.norm(middle) < inf_radius) {
            return {
                is_closed: false,
                start: left_point,
                segs: [
                    Geo.makePathSegLine(left_point, middle, undefined),
                    Geo.makePathSegLine(middle, right_point, undefined),
                ],
            };
        }
        function calculateInfPoint(from, to, flip, radius) {
            let dir = Geo.normalize(Geo.sub(to, from));
            if (flip)
                dir = Geo.mul(dir, -1);
            const s = Geo.cross(dir, from);
            const dis = Math.sqrt(radius * radius - s * s) - Geo.dot(dir, from);
            return Geo.add(from, Geo.mul(dir, dis));
        }
        const left_inf = calculateInfPoint(left_point, middle, !is_solid, inf_radius);
        const right_inf = calculateInfPoint(right_point, middle, !is_solid, inf_radius);
        const inf_circle = { center: [0, 0], radius: inf_radius };
        return {
            is_closed: false,
            start: left_point,
            segs: [
                Geo.makePathSegLine(left_point, left_inf, undefined),
                Geo.makePathSegArc(left_inf, right_inf, inf_circle, undefined),
                Geo.makePathSegLine(right_inf, right_point, undefined),
            ],
        };
    }
    function cutRiftShapes(puzzle, rifts, rift_shapes, cross_relations) {
        const crossing_state = indices(puzzle.branch_points.length).map(index => cross_relations.some(([i, j]) => i === index));
        // calculate transferred rift hierarchy
        const transferred_rift_hierarchy = [...puzzle.rift_hierarchy];
        for (const [branch_point_index, rift_index] of cross_relations) {
            const rift_index_ = rifts.findIndex(rift => rift.left === branch_point_index || rift.right === branch_point_index);
            assert(rift_index_ !== -1);
            if (isReachable(transferred_rift_hierarchy, rift_index, rift_index_)) {
                return Result.err("try to cross the rift above from below");
            }
            transferred_rift_hierarchy.push([rift_index_, rift_index]);
        }
        function assignHierarchy(index1, index2) {
            if (isReachable(transferred_rift_hierarchy, index1, index2)) {
                return true;
            }
            if (isReachable(transferred_rift_hierarchy, index2, index1)) {
                return false;
            }
            // TODO: determine based on context
            transferred_rift_hierarchy.push([index1, index2]);
            return true;
        }
        const rift_intersections = indices(rift_shapes.length)
            .flatMap(j => indices(j).map(i => [i, j]))
            .flatMap(([index1, index2]) => Geo.intersectPaths(rift_shapes[index1], rift_shapes[index2])
            .map(info => ({
            pos1: [index1, ...info.pos1],
            pos2: [index2, ...info.pos2],
            ccw: info.ccw,
        }))
            .map(info => assignHierarchy(index1, index2) ?
            { below_pos: info.pos1, above_pos: info.pos2, ccw: info.ccw }
            : { below_pos: info.pos2, above_pos: info.pos1, ccw: !info.ccw }));
        assert(isDAG(transferred_rift_hierarchy));
        // determine permutations around intersection points
        const branch_point_perms = [];
        const intersection_above_perms = new Map();
        const intersection_below_perms = new Map();
        const sorted_rift_indices = indices(rifts.length)
            .sort(cmpOn(rift_index => [allReachable(transferred_rift_hierarchy, rift_index).size]));
        for (const rift_index of sorted_rift_indices) {
            // find permutations for each crossing
            const sorted_intersections = rift_intersections
                .filter(info => info.below_pos[0] === rift_index || info.above_pos[0] === rift_index)
                .sort(cmpOn(info => info.below_pos[0] === rift_index ? info.below_pos : info.above_pos));
            const cross_perms = sorted_intersections
                .map(info => {
                if (info.above_pos[0] === rift_index)
                    return [];
                const above_perm = intersection_above_perms.get(info);
                assert(above_perm !== undefined);
                return info.ccw ? reverseCyclicPerm(above_perm) : above_perm;
            });
            // determine permutations around intersections of this rift
            const left_crossing = crossing_state[rifts[rift_index].left];
            const right_crossing = crossing_state[rifts[rift_index].right];
            assert(!left_crossing || !right_crossing);
            if (!left_crossing) {
                // from left
                const left_perm = puzzle.branch_points[rifts[rift_index].left].perm;
                let perm = left_perm;
                for (const [info, cross_perm] of zip(sorted_intersections, cross_perms)) {
                    if (info.above_pos[0] === rift_index) {
                        assert(!intersection_above_perms.has(info));
                        intersection_above_perms.set(info, perm);
                    }
                    else {
                        const prev = perm;
                        perm = applyCyclicPerm_(cross_perm, perm);
                        const post = perm;
                        assert(!intersection_below_perms.has(info));
                        intersection_below_perms.set(info, { prev, post });
                    }
                }
                branch_point_perms[rifts[rift_index].left] = left_perm;
                branch_point_perms[rifts[rift_index].right] = reverseCyclicPerm(perm);
            }
            else {
                // from right
                const right_perm = reverseCyclicPerm(puzzle.branch_points[rifts[rift_index].right].perm);
                let perm = right_perm;
                for (const [info, cross_perm] of zip(sorted_intersections, cross_perms).reverse()) {
                    if (info.above_pos[0] === rift_index) {
                        assert(!intersection_above_perms.has(info));
                        intersection_above_perms.set(info, perm);
                    }
                    else {
                        const post = perm;
                        perm = applyCyclicPerm_(reverseCyclicPerm(cross_perm), perm);
                        const prev = perm;
                        assert(!intersection_below_perms.has(info));
                        intersection_below_perms.set(info, { prev, post });
                    }
                }
                branch_point_perms[rifts[rift_index].left] = perm;
                branch_point_perms[rifts[rift_index].right] = reverseCyclicPerm(right_perm);
            }
            // check permutations at branch points
            if (!left_crossing) {
                const index = rifts[rift_index].left;
                if (cmp(branch_point_perms[index], puzzle.branch_points[index].perm) !== 0) {
                    return Result.err("branch point's permutation changes without crossing");
                }
            }
            if (!right_crossing) {
                const index = rifts[rift_index].right;
                if (cmp(branch_point_perms[index], puzzle.branch_points[index].perm) !== 0) {
                    return Result.err("branch point's permutation changes without crossing");
                }
            }
        }
        // cut rifts and determine permutations of each segments
        const cutted_rift_shapes = [];
        const rift_perms = new Map();
        for (const rift_index of indices(rifts.length)) {
            const sorted_below_intersections = rift_intersections
                .filter(info => info.below_pos[0] === rift_index)
                .filter(info => {
                const { prev, post } = intersection_below_perms.get(info);
                return cmp(prev, post) !== 0;
            })
                .sort(cmpOn(info => info.below_pos));
            const seg_perms = sorted_below_intersections
                .map(info => intersection_below_perms.get(info).post);
            seg_perms.unshift(branch_point_perms[rifts[rift_index].left]);
            const rift_shape = rift_shapes[rift_index];
            assert(!rift_shape.is_closed);
            const start_pos = [0, 0];
            const end_pos = [rift_shape.segs.length - 1, rift_shape.segs[rift_shape.segs.length - 1].len];
            const poss = sorted_below_intersections
                .map(info => [info.below_pos[1], info.below_pos[2]]);
            const segss = zip([start_pos, ...poss], [...poss, end_pos])
                .map(([pos1, pos2]) => Geo.cutPath(rift_shape, pos1, pos2, Geo.CutSourceType.Seg));
            assert(seg_perms.length === segss.length);
            for (const [segs, perm] of zip(segss, seg_perms)) {
                for (const seg of segs) {
                    rift_perms.set(seg, perm);
                }
            }
            cutted_rift_shapes[rift_index] = {
                is_closed: false,
                start: rift_shape.start,
                segs: segss.flatMap(segs => segs),
            };
        }
        // compute new rift hierarchy
        const rift_hierarchy = [];
        for (const info of rift_intersections) {
            const { prev, post } = intersection_below_perms.get(info);
            if (cmp(prev, post) === 0)
                continue;
            const below = info.below_pos[0];
            const above = info.above_pos[0];
            if (isReachable(rift_hierarchy, above, below)) {
                return Result.err("invalid hierarchy");
            }
            rift_hierarchy.push([below, above]);
        }
        assert(isDAG(rift_hierarchy));
        const crossing_branch_point_perms = branch_point_perms
            .map((perm, i) => crossing_state[i] ? perm : undefined);
        return Result.ok({
            crossing_branch_point_perms,
            cutted_rift_shapes,
            rift_perms,
            rift_hierarchy,
        });
    }
    function calculateCuttedRiftShapes(puzzle, rifts) {
        const res1 = computeRiftRelAngles(puzzle.branch_points, rifts);
        if (!res1.ok)
            return res1;
        const rift_shapes = rifts.map(rift => {
            const left_point = puzzle.branch_points[rift.left].point;
            const right_point = puzzle.branch_points[rift.right].point;
            return calculateRiftShape(left_point, right_point, rift.coord, getInfRadius(puzzle, rift));
        });
        const res2 = cutRiftShapes(puzzle, rifts, rift_shapes, res1.result.cross_relations);
        if (!res2.ok)
            return res2;
        return Result.ok({
            ...res2.result,
            rel_angless: res1.result.rel_angless,
            rift_shapes,
        });
    }
    function calculateClippedShapesAndUpdateOrders(puzzle) {
        const RETRY = 5;
        const PERTURBATION = 1e-4;
        const shapes = Puzzle.calculateShapes(puzzle);
        function go(rifts, n) {
            const res1 = calculateCuttedRiftShapes(puzzle, rifts);
            if (!res1.ok)
                return res1;
            const res2 = cutShapes(puzzle, shapes, res1.result.rift_shapes);
            if (!res2.ok)
                return res2;
            const res3 = determineLayers(puzzle, shapes, res1.result.rift_shapes, res2.result.cutted_shapes, res1.result.cutted_rift_shapes, res1.result.rift_perms, res2.result.cutted_ramified_shapes);
            if (!res3.ok)
                return res3;
            const branch_points = zip(res1.result.crossing_branch_point_perms, res3.result.orders)
                .map(([perm, order], i) => ({
                perm: perm !== null && perm !== void 0 ? perm : puzzle.branch_points[i].perm,
                order,
            }));
            return Result.ok({ layers: res3.result.layers, rifts: res1.result.rift_shapes, branch_points });
        }
        let res = go(puzzle.rifts, 0);
        for (const n of indices(RETRY)) {
            if (res.ok)
                break;
            console.warn(`fail to clip path (${n}): ${res.error}`);
            const perturbation = {
                angle: (Math.random() - 0.5) * PERTURBATION,
                offset: (Math.random() - 0.5) * PERTURBATION,
            };
            const perturb_rifts = puzzle.rifts
                .map(({ left, right, coord }) => ({
                left,
                right,
                coord: {
                    angle: coord.angle + perturbation.angle,
                    offset: coord.offset + perturbation.offset,
                },
            }));
            res = go(perturb_rifts, n + 1);
        }
        if (!res.ok) {
            console.warn(`fail to clip path (${RETRY}): ${res.error}`);
            return undefined;
        }
        for (const [branch_point, { order, perm }] of zip(puzzle.branch_points, res.result.branch_points)) {
            branch_point.order = order;
            branch_point.perm = perm;
        }
        return {
            layers: res.result.layers,
            rifts: res.result.rifts,
        };
    }
    PrincipalPuzzle.calculateClippedShapesAndUpdateOrders = calculateClippedShapesAndUpdateOrders;
    function calculateRiftAngle(puzzle, shapes, rift_shapes, index) {
        const rift_index = puzzle.rifts.findIndex(({ left, right }) => left === index || right === index);
        assert(rift_index !== -1);
        const rift_side = puzzle.rifts[rift_index].left === index;
        const ref_seg = shapes.get(puzzle.ramified[index].pieces[0]).segs[0];
        assert(ref_seg.type === Geo.PathSegType.Line);
        const ref_dir = ref_seg.line.direction;
        const rift_shape = rift_shapes[rift_index];
        const rift_seg = rift_side ? rift_shape.segs[0] : rift_shape.segs[rift_shape.segs.length - 1];
        assert(rift_seg.type === Geo.PathSegType.Line);
        const rift_dir = rift_side ? rift_seg.line.direction : Geo.mul(rift_seg.line.direction, -1);
        return Geo.angleBetween([0, 0], ref_dir, rift_dir);
    }
    const SMALLEST_ADJ_LEN = 0.01;
    function getAdjacentSegs(puzzle, seg, shapes, cutted_shapes) {
        var _a, _b, _c, _d;
        const res = [];
        const edge = seg.source.ref.source;
        const len = shapes.get(edge.aff).segs[edge.aff.edges.indexOf(edge)].len;
        const adjs = edge.auxiliary ? [{ edge: edge.adj, offset: len, from: 0, to: len }]
            : Puzzle.getAdjacentEdges(puzzle, edge);
        for (const adj of adjs) {
            if (adj.edge.aff.type === PieceType.InfPiece)
                continue;
            const from = Math.max((_a = seg.source.from) !== null && _a !== void 0 ? _a : 0, adj.from);
            const to = Math.min((_b = seg.source.to) !== null && _b !== void 0 ? _b : seg.source.ref.len, adj.to);
            const adj_edge = adj.edge;
            const adj_from = adj.offset - to;
            const adj_to = adj.offset - from;
            for (const adj_path of cutted_shapes.get(adj_edge.aff)) {
                for (const adj_seg of adj_path.segs) {
                    if (!(adj_seg.source.type === Geo.CutSourceType.Seg && adj_seg.source.ref.source === adj_edge))
                        continue;
                    const adj_from_ = Math.max((_c = adj_seg.source.from) !== null && _c !== void 0 ? _c : 0, adj_from);
                    const adj_to_ = Math.min((_d = adj_seg.source.to) !== null && _d !== void 0 ? _d : seg.source.ref.len, adj_to);
                    if (adj_to_ - adj_from_ < SMALLEST_ADJ_LEN)
                        continue;
                    res.push(adj_path);
                    break;
                }
            }
        }
        return res;
    }
    function getAdjacentRiftSegs(seg, rift_shapes, cutted_rift_shapes, rift_perms, cutted_shapes) {
        var _a, _b;
        const res = [];
        const rift_seg = seg.source.ref;
        const rift_index = rift_shapes.findIndex(path => path.segs.includes(rift_seg));
        assert(rift_index !== -1);
        const rift_seg_index = rift_shapes[rift_index].segs.indexOf(rift_seg);
        assert(rift_seg_index !== -1);
        let piece = undefined;
        for (const [piece_, shapes] of cutted_shapes) {
            if (shapes.some(path => path.segs.includes(seg))) {
                piece = piece_;
                break;
            }
        }
        assert(piece !== undefined);
        const ranges_perms = [];
        {
            const [src_from, src_to] = seg.source.type === Geo.CutSourceType.LeftCut ?
                [seg.source.from, seg.source.to]
                : [seg.source.to, seg.source.from];
            const from = src_from !== null && src_from !== void 0 ? src_from : 0;
            const to = src_to !== null && src_to !== void 0 ? src_to : rift_seg.len;
            for (const cutted_rift_seg of cutted_rift_shapes[rift_index].segs) {
                if (cutted_rift_seg.source.ref !== rift_seg)
                    continue;
                const cutted_from = (_a = cutted_rift_seg.source.from) !== null && _a !== void 0 ? _a : 0;
                const cutted_to = (_b = cutted_rift_seg.source.to) !== null && _b !== void 0 ? _b : rift_seg.len;
                const from_ = Math.max(from, cutted_from);
                const to_ = Math.min(to, cutted_to);
                const perm = seg.source.type === Geo.CutSourceType.RightCut ?
                    [...rift_perms.get(cutted_rift_seg)]
                    : reverseCyclicPerm(rift_perms.get(cutted_rift_seg));
                ranges_perms.push({ range: [from_, to_], perm });
            }
        }
        const adj_type = seg.source.type === Geo.CutSourceType.LeftCut ?
            Geo.CutSourceType.RightCut : Geo.CutSourceType.LeftCut;
        for (const adj_shape of cutted_shapes.get(piece)) {
            for (const adj_seg of adj_shape.segs) {
                if (!(adj_seg.source.type === adj_type && adj_seg.source.ref === rift_seg))
                    continue;
                const [adj_src_from, adj_src_to] = adj_seg.source.type === Geo.CutSourceType.LeftCut ?
                    [adj_seg.source.from, adj_seg.source.to]
                    : [adj_seg.source.to, adj_seg.source.from];
                for (const { range, perm } of ranges_perms) {
                    const adj_from = Math.max(adj_src_from !== null && adj_src_from !== void 0 ? adj_src_from : 0, range[0]);
                    const adj_to = Math.min(adj_src_to !== null && adj_src_to !== void 0 ? adj_src_to : rift_seg.len, range[1]);
                    if (adj_to - adj_from < SMALLEST_ADJ_LEN)
                        continue;
                    res.push([adj_shape, perm]);
                    break;
                }
            }
        }
        return res;
    }
    function cutShapes(puzzle, shapes, rift_shapes) {
        const ANG_EPS = 1e-3;
        const POS_EPS = 1e-3;
        const cutted_shapes = new Map();
        function cut(shapes, rift_shapes, name) {
            const INSIDE_DIS = -1e-3;
            for (const rift_shape of rift_shapes) {
                const shapes_ = [];
                for (const shape of shapes) {
                    const res = Geo.cutRegion(shape, rift_shape);
                    if (res === undefined) {
                        return Result.err(`fail to cut piece ${name}`);
                    }
                    const dis1 = Geo.calculateNearestPoint(shape, Geo.getStartPoint(rift_shape)).dis;
                    const dis2 = Geo.calculateNearestPoint(shape, Geo.getEndPoint(rift_shape)).dis;
                    if (dis1 < INSIDE_DIS || dis2 < INSIDE_DIS) {
                        shapes_.push(...res.map(path => Geo.flattenCut(Geo.glueIncompleteCut(path, rift_shape))));
                    }
                    else if (res.some(path => Geo.hasIncompleteCut(path, rift_shape))) {
                        return Result.err(`fail to cut piece ${name}`);
                    }
                    else {
                        shapes_.push(...res.map(path => Geo.flattenCut(path)));
                    }
                }
                shapes = shapes_;
            }
            return Result.ok(shapes);
        }
        // cut normal pieces
        for (const [piece, shape] of shapes) {
            if (piece.type === PieceType.InfPiece)
                continue;
            if (puzzle.ramified.some(ramified => ramified.pieces.includes(piece)))
                continue;
            const res = cut([Geo.cutNothing(shape)], rift_shapes, piece.name);
            if (!res.ok)
                return res;
            append(cutted_shapes, piece, res.result);
        }
        // cut ramified pieces
        const cutted_ramified_shapes = [];
        for (const i of indices(puzzle.ramified.length)) {
            const ramified = puzzle.ramified[i];
            const branch_point = puzzle.branch_points[i];
            const rift_index = puzzle.rifts.findIndex(({ left, right }) => left === i || right === i);
            const rift_side = puzzle.rifts[rift_index].left === i;
            const rift_shape = rift_shapes[rift_index];
            const point = rift_side ? Geo.getStartPoint(rift_shape) : Geo.getEndPoint(rift_shape);
            // recalculate cut_angle based on shapes and check that errors are small enough
            let cut_angle = branch_point.cut_angle;
            {
                const ramified_angle_ = calculateRiftAngle(puzzle, shapes, rift_shapes, i);
                const angle_err = Math.abs(Geo.as_npi_pi(ramified_angle_ - cut_angle));
                if (angle_err >= ANG_EPS)
                    console.warn(`ramified angle error: ${angle_err}`);
                const pos_err = Geo.norm(Geo.sub(point, branch_point.point));
                if (pos_err >= POS_EPS)
                    console.warn(`ramified position error: ${pos_err}`);
                cut_angle = Geo.as_npi_pi(ramified_angle_ - cut_angle) + cut_angle;
            }
            // determine subpieces being cutted by the rift on this piece for each turn
            let ramified_piece_indices;
            {
                const outpoints = ramified.pieces.map(piece => shapes.get(piece).segs[0].target);
                const angle_upperbounds = zip(outpoints, rotate(outpoints, 1))
                    .map(([start, end]) => Geo.angleBetween(point, start, end))
                    .map((_, i, angles) => angles.slice(0, i + 1).reduce((a, b) => a + b));
                ramified_piece_indices = indices(ramified.turn)
                    .map(n => mod(cut_angle + Math.PI * 2 * n, Math.PI * 2 * ramified.turn))
                    .map(ramified_angle => angle_upperbounds.findIndex(upperbound => ramified_angle < upperbound));
                if (ramified_piece_indices.includes(-1)) {
                    return Result.err(`fail to cut ramified pieces`);
                }
            }
            // cut subpieces
            cutted_ramified_shapes[i] = [];
            for (const index of indices(ramified.pieces.length)) {
                const piece = ramified.pieces[index];
                const shape = shapes.get(piece);
                // cut by the rift on this piece
                const res0 = Geo.cutRegion(shape, rift_shape, {
                    index_of_path: 0,
                    incident_with_cut_start_or_end: rift_side,
                    considered_as_incident: ramified_piece_indices.includes(index),
                });
                if (res0 === undefined) {
                    return Result.err(`fail to cut ramified piece: ${piece.name}`);
                }
                if (res0.some(path => Geo.hasIncompleteCut(path, rift_shape))) {
                    return Result.err(`fail to cut ramified piece: ${piece.name}`);
                }
                // cut by other rifts
                const res = cut(res0, rift_shapes.filter((_, i) => i !== rift_index), piece.name);
                if (!res.ok)
                    return res;
                append(cutted_shapes, piece, res.result);
                // assign cutted subpiece
                const turn = ramified_piece_indices.indexOf(index);
                if (turn !== -1) {
                    const cutted_shape = rift_side ?
                        res.result.find(path => path.segs.some(seg => seg.source.type === Geo.CutSourceType.LeftCut
                            && seg.source.ref === rift_shape.segs[0]
                            && seg.source.from === 0))
                        :
                            res.result.find(path => path.segs.some(seg => seg.source.type === Geo.CutSourceType.RightCut
                                && seg.source.ref === rift_shape.segs[rift_shape.segs.length - 1]
                                && seg.source.from === seg.source.ref.len));
                    if (cutted_shape === undefined) {
                        return Result.err(`cannot find cutted ramified piece: ${piece.name}`);
                    }
                    cutted_ramified_shapes[i][turn] = cutted_shape;
                }
            }
        }
        return Result.ok({ cutted_shapes, cutted_ramified_shapes });
    }
    function determineLayers(puzzle, shapes, rift_shapes, cutted_shapes, cutted_rift_shapes, rift_perms, cutted_ramified_shapes) {
        const cutted_shapes_layer = new Map();
        for (const [branch_point, cutted_shapes] of zip(puzzle.branch_points, cutted_ramified_shapes)) {
            if (branch_point.order !== undefined) {
                for (const [cutted_shape, layer_index] of zip(cutted_shapes, branch_point.order)) {
                    cutted_shapes_layer.set(cutted_shape, layer_index);
                }
            }
        }
        const orders = puzzle.branch_points.map(branch_point => branch_point.order);
        for (const [path, layer_index] of cutted_shapes_layer) {
            const ramified_index = cutted_ramified_shapes.findIndex(shapes => shapes.includes(path));
            if (ramified_index !== -1) {
                const turn = cutted_ramified_shapes[ramified_index].indexOf(path);
                let order;
                if (puzzle.branch_points[ramified_index].order === undefined) {
                    const perm = puzzle.branch_points[ramified_index].perm;
                    const turn_ = perm.indexOf(layer_index);
                    if (turn_ === -1) {
                        return Result.err(`conflict layer: layer ${layer_index} is not in perm=[${perm}] of ${ramified_index}-th branch point`);
                    }
                    order = rotate(perm, turn_ - turn);
                }
                else {
                    order = puzzle.branch_points[ramified_index].order;
                    const turn_ = order.indexOf(layer_index);
                    if (turn_ === -1) {
                        return Result.err(`conflict layer: layer ${layer_index} is not in order=[${order}] of ${ramified_index}-th branch point`);
                    }
                    if (turn_ !== turn) {
                        return Result.err(`conflict layer: layer ${layer_index} is not ${turn}-th element of order=[${order}] of ${ramified_index}-th branch point`);
                    }
                }
                for (const [cutted_shape, turn_layer_index] of zip(cutted_ramified_shapes[ramified_index], order)) {
                    if (cutted_shapes_layer.has(cutted_shape)) {
                        if (cutted_shapes_layer.get(cutted_shape) !== turn_layer_index) {
                            return Result.err(`conflict layer: (determined by turn) ${turn_layer_index} != ${cutted_shapes_layer.get(cutted_shape)} in ${ramified_index}-th branch point`);
                        }
                    }
                    else {
                        cutted_shapes_layer.set(cutted_shape, turn_layer_index);
                    }
                }
                if (orders[ramified_index] === undefined) {
                    orders[ramified_index] = order;
                }
            }
            for (const seg of path.segs) {
                let adj_paths;
                if (seg.source.type === Geo.CutSourceType.Seg) {
                    // find adjacent edges
                    adj_paths = getAdjacentSegs(puzzle, seg, shapes, cutted_shapes)
                        .map(adj_path => [adj_path, undefined]);
                }
                else {
                    // find adjacent edges
                    adj_paths = getAdjacentRiftSegs(seg, rift_shapes, cutted_rift_shapes, rift_perms, cutted_shapes);
                }
                for (const [adj_path, perm] of adj_paths) {
                    const adj_layer_index = applyCyclicPerm(perm !== null && perm !== void 0 ? perm : [], 1, layer_index);
                    if (cutted_shapes_layer.has(adj_path)) {
                        if (cutted_shapes_layer.get(adj_path) !== adj_layer_index) {
                            if (perm === undefined) {
                                return Result.err(`conflict layer: (determined by edge adjacency) ${layer_index} != ${cutted_shapes_layer.get(adj_path)}`);
                            }
                            else {
                                return Result.err(`conflict layer: (determined by cut adjacency) [${perm}] * ${layer_index} != ${cutted_shapes_layer.get(adj_path)}`);
                            }
                        }
                    }
                    else {
                        cutted_shapes_layer.set(adj_path, adj_layer_index);
                    }
                }
            }
        }
        const unclassified = new Set();
        const layers = indices(puzzle.stands.length)
            .map(_ => new Map());
        for (const [piece, paths] of cutted_shapes) {
            for (const path of paths) {
                if (cutted_shapes_layer.has(path)) {
                    const layer_index = cutted_shapes_layer.get(path);
                    append(layers[layer_index], piece, [path]);
                }
                else {
                    if (!path.segs.every(seg => seg.len < SMALLEST_ADJ_LEN * 2))
                        unclassified.add(path);
                }
            }
        }
        if (unclassified.size > 0) {
            console.warn(`${unclassified.size} shapes are not classified into any layer`);
        }
        if (orders.some(order => order === undefined)) {
            console.warn(`some orders on branch points cannot be determined`);
        }
        return Result.ok({
            layers,
            orders,
        });
    }
    function updateRiftRelAngles(puzzle) {
        const RETRY = 5;
        const PERTURBATION = 1e-4;
        let res = calculateCuttedRiftShapes(puzzle, puzzle.rifts);
        for (const n of indices(RETRY)) {
            if (res.ok)
                break;
            console.warn(`fail to cut rifts (${n}): ${res.error}`);
            const perturbation = {
                angle: (Math.random() - 0.5) * PERTURBATION,
                offset: (Math.random() - 0.5) * PERTURBATION,
            };
            const perturb_rifts = puzzle.rifts
                .map(({ left, right, coord }) => ({
                left,
                right,
                coord: {
                    angle: coord.angle + perturbation.angle,
                    offset: coord.offset + perturbation.offset,
                },
            }));
            res = calculateCuttedRiftShapes(puzzle, perturb_rifts);
        }
        if (!res.ok) {
            console.warn(`fail to cut rifts (${RETRY}): ${res.error}`);
            console.error("fail to update rift rel angles");
            return false;
        }
        for (const [branch_point, rel_angles] of zip(puzzle.branch_points, res.result.rel_angless)) {
            branch_point.rel_angles = rel_angles;
        }
        for (const [branch_point, perm] of zip(puzzle.branch_points, res.result.crossing_branch_point_perms)) {
            if (perm !== undefined) {
                branch_point.order = undefined;
                branch_point.perm = perm;
            }
        }
        puzzle.rift_hierarchy = res.result.rift_hierarchy;
        return true;
    }
    function setShift(puzzle, side, sheet, angle) {
        const ANGLE_MAX_STEP = Math.PI / 30;
        const twist_pieces = AbstractPuzzle.getTwistPieces(puzzle, side, sheet);
        if (twist_pieces === undefined)
            return false;
        const { pieces, sheets } = twist_pieces;
        // recalculate branch_cuts
        const current_shift_angle = puzzle.states[sheet].type === StateType.Aligned ? 0 : puzzle.states[sheet].angle;
        const [left_circle, right_circle] = Puzzle.getTwistCircles(puzzle);
        const center = side ? left_circle.center : right_circle.center;
        const twist_angle_diff = angle - current_shift_angle;
        const shift_trans = Geo.rotateAround(twist_angle_diff, center);
        if (Math.abs(twist_angle_diff) > ANGLE_MAX_STEP)
            console.warn(`twist angle changes too much: ${twist_angle_diff}`);
        const is_moved = puzzle.ramified
            .map(ramified => ramified.pieces.some(piece => pieces.has(piece)));
        const moved_points = puzzle.branch_points
            .map(({ point }, index) => is_moved[index] ? Geo.transformPoint(point, shift_trans) : point);
        const lean_angle_diffs = puzzle.rifts
            .map(rift => Geo.angleBetween([0, 0], Geo.sub(puzzle.branch_points[rift.right].point, puzzle.branch_points[rift.left].point), Geo.sub(moved_points[rift.right], moved_points[rift.left])));
        const cut_angle_diffs = indices(puzzle.branch_points.length)
            .map(i => puzzle.rifts.findIndex(({ left, right }) => left === i || right === i))
            .map(rift_index => rift_index === -1 ? 0 : lean_angle_diffs[rift_index])
            .map((lean_angle_diff, i) => lean_angle_diff - (is_moved[i] ? twist_angle_diff : 0));
        for (const i of indices(puzzle.branch_points.length)) {
            puzzle.branch_points[i].cut_angle += cut_angle_diffs[i];
            puzzle.branch_points[i].point = moved_points[i];
        }
        AbstractPuzzle.setShift(puzzle, side, sheets, angle);
        updateRiftRelAngles(puzzle);
        return true;
    }
    PrincipalPuzzle.setShift = setShift;
    function snap(puzzle) {
        return AbstractPuzzle.snap(puzzle);
    }
    PrincipalPuzzle.snap = snap;
    function setRift(puzzle, index, coord) {
        const ANGLE_MAX_STEP = Math.PI / 3;
        const { offset, angle } = coord;
        const offset_ = Math.min(Math.max(offset, -MAX_RIFT_OFFSET), MAX_RIFT_OFFSET);
        const coord0 = puzzle.rifts[index].coord;
        if (Math.abs(coord.angle - coord0.angle) > ANGLE_MAX_STEP)
            console.warn(`rift angle changes too much: ${coord.angle - coord0.angle}`);
        const [left_angle0, right_angle0] = HyperbolicPolarCoordinate.getFocusAngles(coord0);
        const [left_angle, right_angle] = HyperbolicPolarCoordinate.getFocusAngles({ offset: offset_, angle });
        const left_angle_diff = left_angle - left_angle0;
        const right_angle_diff = right_angle0 - right_angle;
        puzzle.rifts[index].coord = { offset: offset_, angle };
        puzzle.branch_points[puzzle.rifts[index].left].cut_angle += left_angle_diff;
        puzzle.branch_points[puzzle.rifts[index].right].cut_angle += right_angle_diff;
        const succ = updateRiftRelAngles(puzzle);
        return true;
    }
    PrincipalPuzzle.setRift = setRift;
})(PrincipalPuzzle || (PrincipalPuzzle = {}));
export var PrincipalPuzzleWithTexture;
(function (PrincipalPuzzleWithTexture) {
    function makePuzzle(factory, shape, draw_image) {
        const puzzle = PrincipalPuzzle.makePuzzle(factory, shape);
        const textures = factory.make_texture_functions(puzzle).map(draw_image);
        const unshifted_positions = new Map(puzzle.pieces.map(piece => [piece, Geo.id_trans()]));
        const texture_indices = factory.determine_texture_indices(puzzle);
        return {
            ...puzzle,
            unshifted_positions,
            texture_indices,
            textures,
        };
    }
    PrincipalPuzzleWithTexture.makePuzzle = makePuzzle;
    function getPositions(puzzle) {
        const positions = new Map(puzzle.unshifted_positions);
        for (const trans of Puzzle.getShiftTransformations(puzzle)) {
            const [sheet] = trans.sheets;
            for (const piece of AbstractPuzzle.getTwistPieces(puzzle, trans.side, sheet).pieces)
                positions.set(piece, Geo.compose(positions.get(piece), trans.trans));
        }
        return positions;
    }
    PrincipalPuzzleWithTexture.getPositions = getPositions;
    function calculateImages(puzzle) {
        const positions = getPositions(puzzle);
        const shapes = Puzzle.calculateShapes(puzzle);
        return new Set(Array.from(shapes).map(([piece, shape]) => ({
            image: puzzle.textures[puzzle.texture_indices.get(piece)],
            region: Geo.cutNothing(shape),
            transformation: positions.get(piece),
        })));
    }
    PrincipalPuzzleWithTexture.calculateImages = calculateImages;
    function calculateClippedImages(puzzle) {
        const positions = getPositions(puzzle);
        const clipped_shapes = PrincipalPuzzle.calculateClippedShapesAndUpdateOrders(puzzle);
        if (clipped_shapes === undefined)
            return undefined;
        const images = clipped_shapes.layers.map(layer => new Set(Array.from(layer)
            .flatMap(([piece, shapes]) => shapes
            .map(shape => ({
            image: puzzle.textures[puzzle.texture_indices.get(piece)],
            region: shape,
            transformation: positions.get(piece),
        })))));
        return { images, rifts: clipped_shapes.rifts };
    }
    PrincipalPuzzleWithTexture.calculateClippedImages = calculateClippedImages;
    function setShift(puzzle, side, sheet, angle) {
        return PrincipalPuzzle.setShift(puzzle, side, sheet, angle);
    }
    PrincipalPuzzleWithTexture.setShift = setShift;
    function snap(puzzle) {
        const trans = PrincipalPuzzle.snap(puzzle);
        if (trans.length === 0)
            return false;
        for (const { side, sheets, turn } of trans) {
            const twist_trans1 = Puzzle.getTwistTransformation(puzzle, side, turn > 0);
            let twist_trans = Geo.id_trans();
            for (const n of indices(Math.abs(turn)))
                twist_trans = Geo.compose(twist_trans, twist_trans1);
            const [sheet] = sheets;
            for (const piece of AbstractPuzzle.getTwistPieces(puzzle, side, sheet).pieces) {
                let trans = puzzle.unshifted_positions.get(piece);
                trans = Geo.compose(trans, twist_trans);
                puzzle.unshifted_positions.set(piece, trans);
            }
        }
        return true;
    }
    PrincipalPuzzleWithTexture.snap = snap;
    function setRift(puzzle, index, coord) {
        return PrincipalPuzzle.setRift(puzzle, index, coord);
    }
    PrincipalPuzzleWithTexture.setRift = setRift;
})(PrincipalPuzzleWithTexture || (PrincipalPuzzleWithTexture = {}));
export var Textures;
(function (Textures) {
    function getDHTextureFunction(puzzle, turn, colorscale) {
        const d = puzzle.center_x;
        const fns = [];
        for (const i of indices(turn)) {
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.add(z, Complex.c(-d, 0)), (turn - 1) / turn), Complex.omega(i / turn), Complex.c(colorscale, 0)));
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.add(z, Complex.c(-d, 0)), Complex.c(-1, 0)), (turn - 1) / turn), Complex.omega((turn + 1 + 2 * i) / turn / 2), Complex.c(colorscale, 0)));
        }
        return fns;
    }
    Textures.getDHTextureFunction = getDHTextureFunction;
    function getDVTextureFunction(puzzle, turn, colorscale) {
        const d = puzzle.center_x / Math.sqrt(3);
        const fns = [];
        for (const i of indices(turn)) {
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d, 0)), (turn - 1) / turn), Complex.omega(i / turn), Complex.c(colorscale, 0)));
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.c(-1, 0), Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d, 0))), (turn - 1) / turn), Complex.omega((turn + 1 + 2 * i) / turn / 2), Complex.c(colorscale, 0)));
        }
        return fns;
    }
    Textures.getDVTextureFunction = getDVTextureFunction;
    function getQTextureFunction(puzzle, turn, colorscale) {
        const d1 = puzzle.center_x;
        const d2 = puzzle.center_x / Math.sqrt(3);
        const fns = [];
        for (const i of indices(turn)) {
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / turn), Complex.pow(Complex.add(z, Complex.c(-d1, 0)), (turn - 1) / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d2, 0)), (turn - 1) / turn), Complex.omega(i / turn), Complex.c(colorscale, 0)));
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.add(z, Complex.c(-1, 0)), Complex.c(-d1, 0)), (turn - 1) / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.c(-1, 0), Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d2, 0))), (turn - 1) / turn), Complex.omega((i + 1) / turn), Complex.c(colorscale, 0)));
        }
        return fns;
    }
    Textures.getQTextureFunction = getQTextureFunction;
    function getDDTextureFunction(puzzle, colorscale) {
        const d1 = puzzle.center_x;
        const d2 = puzzle.center_x / Math.sqrt(3);
        const f1 = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / 2), Complex.pow(Complex.add(z, Complex.c(-d1, 0)), 1 / 2), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / 2), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, -1)), Complex.c(+d2, 0)), 1 / 2), Complex.c(colorscale, 0));
        const f2 = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / 2), Complex.pow(Complex.add(z, Complex.c(-d1, 0)), 1 / 2), Complex.abs(Complex.add(z, Complex.c(0, (z[1] >= 0 ? +1 : -1) * d2))), Complex.c(-1, 0), Complex.c(colorscale, 0));
        const f3 = (z) => Complex.mul(Complex.abs(Complex.add(z, Complex.c((z[0] >= 0 ? +1 : -1) * d1, 0))), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / 2), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, -1)), Complex.c(+d2, 0)), 1 / 2), Complex.normalize(z), Complex.c(-1, 0), Complex.c(colorscale, 0));
        const f12 = (z) => (z[1] < 0) ? f1(z) : f2(z);
        const f12_ = (z) => !(z[1] < 0) ? f1(z) : f2(z);
        const f13 = (z) => (z[1] > 0 ? z[0] < 0 : z[0] <= 0) ? f1(z) : f3(z);
        const f13_ = (z) => !(z[1] > 0 ? z[0] < 0 : z[0] <= 0) ? f1(z) : f3(z);
        return [f3, f12_, f12, f13, f13_, f2];
    }
    Textures.getDDTextureFunction = getDDTextureFunction;
})(Textures || (Textures = {}));
export var Builder;
(function (Builder) {
    function DH(turn, colorscale) {
        return {
            make_pieces: () => {
                const layers = indices(turn).map(i => AbstractPuzzle.makePieces(`_${i}`));
                const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
                const pieceCLs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1]).aff);
                const pieceCRs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, -1]).aff);
                // ramify center pieces
                // ramified_pieceCLs[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_pieceCLs = AbstractPuzzle.chunkPiece("CL", AbstractPuzzle.ramifyPiece("", pieceCLs, 0), 2);
                // ramified_pieceCRs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_pieceCRs = AbstractPuzzle.chunkPiece("CR", AbstractPuzzle.ramifyPiece("", rotate(pieceCRs, 1).reverse(), 0), 2);
                // piece50Ls[0].edges[0]: the edge from the second sheet to the top sheet
                AbstractPuzzle.swapAdj(...piece50Ls.map(piece => piece.edges[0]));
                AbstractPuzzle.swapAdj(...piece50Ls.map(piece => piece.edges[3]));
                const pieces = layers.flatMap(layer => layer.pieces)
                    .filter(p => !pieceCLs.includes(p) && !pieceCRs.includes(p))
                    .concat(ramified_pieceCLs)
                    .concat(ramified_pieceCRs);
                return {
                    pieces,
                    stands: layers.map(layer => layer.stand),
                    ramified: [{ pieces: ramified_pieceCLs, turn }, { pieces: ramified_pieceCRs, turn }],
                };
            },
            make_rifts: (shape) => {
                return {
                    branch_points: [
                        { point: [-shape.center_x, 0], cut_angle: Math.PI / 6, order: indices(turn) },
                        { point: [shape.center_x, 0], cut_angle: Math.PI / 6, order: rotate(indices(turn), 1).reverse() },
                    ],
                    rifts: [
                        { left: 0, right: 1, coord: { offset: 0.0, angle: 0.0 } }
                    ],
                    rift_hierarchy: [],
                };
            },
            make_texture_functions: puzzle => Textures.getDHTextureFunction(puzzle, turn, colorscale),
            determine_texture_indices: (puzzle) => {
                const texture_indices = new Map();
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = mod(2 * sheet - 1, 2 * puzzle.stands.length);
                    const edgeCL = AbstractPuzzle.edgeAt(puzzle, sheet, [0, 1, -1, 1]);
                    texture_indices.set(edgeCL.aff, texture_index);
                    texture_indices.set(Edge.walk(edgeCL, [0]).aff, texture_index);
                    texture_indices.set(Edge.walk(edgeCL, [0, 2]).aff, texture_index);
                }
                for (const sheet of indices(puzzle.stands.length)) {
                    const layer = new Set();
                    layer.add(AbstractPuzzle.edgeAt(puzzle, sheet, []).aff);
                    for (const piece of layer) {
                        for (const edge of piece.edges) {
                            const adj_piece = edge.adj.aff;
                            if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
                                layer.add(adj_piece);
                            }
                        }
                    }
                    for (const piece of layer) {
                        texture_indices.set(piece, 2 * sheet);
                    }
                }
                return texture_indices;
            },
        };
    }
    Builder.DH = DH;
    function DV(turn, colorscale) {
        return {
            make_pieces: () => {
                const layers = indices(turn).map(i => AbstractPuzzle.makePieces(`_${i}`));
                const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
                const piece0Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1]).aff);
                const piece0Rs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 2]).aff);
                // ramify corner pieces
                // ramified_piece0Ls[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_piece0Ls = AbstractPuzzle.chunkPiece("0L", AbstractPuzzle.ramifyPiece("", piece0Ls, 0), 1);
                // ramified_piece0Rs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_piece0Rs = AbstractPuzzle.chunkPiece("0R", AbstractPuzzle.ramifyPiece("", rotate(piece0Rs, 1).reverse(), 0), 1);
                // piece50Ls[0].edges[3]: the edge from the second sheet to the top sheet
                AbstractPuzzle.swapAdj(...piece50Ls.map(piece => piece.edges[3]));
                AbstractPuzzle.swapAdj(...piece50Ls.map(piece => piece.edges[2]));
                const pieces = layers.flatMap(layer => layer.pieces)
                    .filter(p => !piece0Ls.includes(p) && !piece0Rs.includes(p))
                    .concat(ramified_piece0Ls)
                    .concat(ramified_piece0Rs);
                return {
                    pieces,
                    stands: layers.map(layer => layer.stand),
                    ramified: [{ pieces: ramified_piece0Ls, turn }, { pieces: ramified_piece0Rs, turn }],
                };
            },
            make_rifts: (shape) => {
                return {
                    branch_points: [
                        { point: [0, shape.center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: indices(turn) },
                        { point: [0, -shape.center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: rotate(indices(turn), 1).reverse() },
                    ],
                    rifts: [
                        { left: 0, right: 1, coord: { offset: 0.0, angle: 0.0 } }
                    ],
                    rift_hierarchy: [],
                };
            },
            make_texture_functions: puzzle => Textures.getDVTextureFunction(puzzle, turn, colorscale),
            determine_texture_indices: (puzzle) => {
                const texture_indices = new Map();
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = mod(2 * sheet - 1, 2 * puzzle.stands.length);
                    const edge0L = AbstractPuzzle.edgeAt(puzzle, sheet, [0, 1, -1, 0]);
                    texture_indices.set(edge0L.aff, texture_index);
                    texture_indices.set(Edge.walk(edge0L, [0]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge0L, [0, 2]).aff, texture_index);
                }
                for (const sheet of indices(puzzle.stands.length)) {
                    const layer = new Set();
                    layer.add(AbstractPuzzle.edgeAt(puzzle, sheet, []).aff);
                    for (const piece of layer) {
                        for (const edge of piece.edges) {
                            const adj_piece = edge.adj.aff;
                            if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
                                layer.add(adj_piece);
                            }
                        }
                    }
                    for (const piece of layer) {
                        texture_indices.set(piece, 2 * sheet);
                    }
                }
                return texture_indices;
            },
        };
    }
    Builder.DV = DV;
    function Q(turn, colorscale) {
        return {
            make_pieces: () => {
                const layers = indices(turn).map(i => AbstractPuzzle.makePieces(`_${i}`));
                const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
                const pieceCLs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1]).aff);
                const pieceCRs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, -1]).aff);
                const piece0Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1]).aff);
                const piece0Rs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 2]).aff);
                // ramify center pieces
                // ramified_pieceCLs[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_pieceCLs = AbstractPuzzle.chunkPiece("CL", AbstractPuzzle.ramifyPiece("", pieceCLs, 0), 2);
                // ramified_pieceCRs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_pieceCRs = AbstractPuzzle.chunkPiece("CR", AbstractPuzzle.ramifyPiece("", rotate(pieceCRs, 1).reverse(), 0), 2);
                // ramify corner pieces
                // ramified_piece0Ls[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_piece0Ls = AbstractPuzzle.chunkPiece("0L", AbstractPuzzle.ramifyPiece("", piece0Ls, 0), 1);
                // ramified_piece0Rs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_piece0Rs = AbstractPuzzle.chunkPiece("0R", AbstractPuzzle.ramifyPiece("", rotate(piece0Rs, 1).reverse(), 0), 1);
                // piece50Ls[0].edges[0]: the edge from the top sheet to the bottom sheet
                // piece50Ls[0].edges[1]: the edge from the bottom sheet to the top sheet
                // piece50Ls[0].edges[2]: the edge from the top sheet to the second sheet
                // piece50Ls[0].edges[3]: the edge from the second sheet to the top sheet
                AbstractPuzzle.swapAdj(...piece50Ls.map(piece => piece.edges[1]).reverse());
                AbstractPuzzle.swapAdj(...piece50Ls.map(piece => piece.edges[3]));
                const pieces = layers.flatMap(layer => layer.pieces)
                    .filter(p => !pieceCLs.includes(p) && !pieceCRs.includes(p) && !piece0Ls.includes(p) && !piece0Rs.includes(p))
                    .concat(ramified_pieceCLs)
                    .concat(ramified_pieceCRs)
                    .concat(ramified_piece0Ls)
                    .concat(ramified_piece0Rs);
                return {
                    pieces,
                    stands: layers.map(layer => layer.stand),
                    ramified: [
                        { pieces: ramified_pieceCLs, turn },
                        { pieces: ramified_pieceCRs, turn },
                        { pieces: ramified_piece0Ls, turn },
                        { pieces: ramified_piece0Rs, turn },
                    ],
                };
            },
            make_rifts: (shape) => {
                return {
                    branch_points: [
                        { point: [-shape.center_x, 0], cut_angle: Math.PI / 6, order: indices(turn) },
                        { point: [shape.center_x, 0], cut_angle: Math.PI / 6, order: rotate(indices(turn), 1).reverse() },
                        { point: [0, shape.center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: indices(turn) },
                        { point: [0, -shape.center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: rotate(indices(turn), 1).reverse() },
                    ],
                    rifts: [
                        { left: 0, right: 1, coord: { offset: 0.0, angle: 0.0 } },
                        { left: 2, right: 3, coord: { offset: 0.0, angle: 0.0 } },
                    ],
                    rift_hierarchy: [],
                };
            },
            make_texture_functions: puzzle => Textures.getQTextureFunction(puzzle, turn, colorscale),
            determine_texture_indices: (puzzle) => {
                const texture_indices = new Map();
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = mod(2 * sheet - 3, 2 * puzzle.stands.length);
                    const edge = AbstractPuzzle.edgeAt(puzzle, sheet, [0, 1, -1]);
                    texture_indices.set(edge.aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [0]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [1]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [2]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [3]).aff, texture_index);
                }
                for (const sheet of indices(puzzle.stands.length)) {
                    const layer = new Set();
                    layer.add(AbstractPuzzle.edgeAt(puzzle, sheet, []).aff);
                    for (const piece of layer) {
                        for (const edge of piece.edges) {
                            const adj_piece = edge.adj.aff;
                            if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
                                layer.add(adj_piece);
                            }
                        }
                    }
                    for (const piece of layer) {
                        texture_indices.set(piece, 2 * sheet);
                    }
                }
                return texture_indices;
            },
        };
    }
    Builder.Q = Q;
    function DD(colorscale) {
        return {
            make_pieces: () => {
                const layers = indices(3).map(i => AbstractPuzzle.makePieces(`_${i}`));
                const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
                const pieceCLs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1]).aff);
                const pieceCRs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, -1]).aff);
                const piece0Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1]).aff);
                const piece0Rs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 2]).aff);
                // ramify center pieces
                // ramified_pieceCLs[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_pieceCLs = AbstractPuzzle.chunkPiece("CL", AbstractPuzzle.ramifyPiece("", [pieceCLs[0], pieceCLs[2]], 0), 2);
                // ramified_pieceCRs[0].edges[1]: the edge from the bottom sheet to the second sheet
                const ramified_pieceCRs = AbstractPuzzle.chunkPiece("CR", AbstractPuzzle.ramifyPiece("", [pieceCRs[1], pieceCRs[2]], 0), 2);
                // ramify corner pieces
                // ramified_piece0Ls[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_piece0Ls = AbstractPuzzle.chunkPiece("0L", AbstractPuzzle.ramifyPiece("", [piece0Ls[0], piece0Ls[1]], 0), 1);
                // ramified_piece0Rs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_piece0Rs = AbstractPuzzle.chunkPiece("0R", AbstractPuzzle.ramifyPiece("", [piece0Rs[0], piece0Rs[1]], 0), 1);
                AbstractPuzzle.swapAdj(piece50Ls[0].edges[0], piece50Ls[1].edges[0]);
                AbstractPuzzle.swapAdj(piece50Ls[0].edges[1], piece50Ls[1].edges[1], piece50Ls[2].edges[1]);
                AbstractPuzzle.swapAdj(piece50Ls[1].edges[2], piece50Ls[2].edges[2]);
                const pieces = layers.flatMap(layer => layer.pieces)
                    .filter(p => ![pieceCLs[0], pieceCLs[2], pieceCRs[1], pieceCRs[2], piece0Ls[0], piece0Ls[1], piece0Rs[0], piece0Rs[1]].includes(p))
                    .concat(ramified_pieceCLs)
                    .concat(ramified_pieceCRs)
                    .concat(ramified_piece0Ls)
                    .concat(ramified_piece0Rs);
                return {
                    pieces,
                    stands: layers.map(layer => layer.stand),
                    ramified: [
                        { pieces: ramified_pieceCLs, turn: 2 },
                        { pieces: ramified_pieceCRs, turn: 2 },
                        { pieces: ramified_piece0Ls, turn: 2 },
                        { pieces: ramified_piece0Rs, turn: 2 },
                    ],
                };
            },
            make_rifts: (shape) => {
                return {
                    branch_points: [
                        { point: [-shape.center_x, 0], cut_angle: Math.PI / 6, order: [0, 2] },
                        { point: [shape.center_x, 0], cut_angle: Math.PI / 6, order: [1, 2] },
                        { point: [0, shape.center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: [0, 1] },
                        { point: [0, -shape.center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: [0, 1] },
                    ],
                    rifts: [
                        { left: 0, right: 1, coord: { offset: 0.0, angle: 0.0 } },
                        { left: 2, right: 3, coord: { offset: 0.0, angle: 0.0 } },
                    ],
                    rift_hierarchy: [[0, 1]],
                };
            },
            make_texture_functions: puzzle => Textures.getDDTextureFunction(puzzle, colorscale),
            determine_texture_indices: (puzzle) => {
                const texture_indices = new Map();
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = sheet;
                    const edge = AbstractPuzzle.edgeAt(puzzle, sheet, [0, 1, -1]);
                    texture_indices.set(edge.aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [0]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [1]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [2]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [3]).aff, texture_index);
                }
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = sheet + 3;
                    const layer = new Set();
                    layer.add(AbstractPuzzle.edgeAt(puzzle, sheet, []).aff);
                    for (const piece of layer) {
                        for (const edge of piece.edges) {
                            const adj_piece = edge.adj.aff;
                            if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
                                layer.add(adj_piece);
                            }
                        }
                    }
                    for (const piece of layer) {
                        texture_indices.set(piece, texture_index);
                    }
                }
                return texture_indices;
            },
        };
    }
    Builder.DD = DD;
})(Builder || (Builder = {}));
//# sourceMappingURL=Model.js.map
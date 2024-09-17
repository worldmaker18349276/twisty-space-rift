import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";
import { assert, indices, mod, zip, rotate, unrollUntilLoopback, append } from "./Utils.js";
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
export var Puzzle;
(function (Puzzle) {
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
    Puzzle.swapAdj = swapAdj;
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
    Puzzle.ramifyPiece = ramifyPiece;
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
    Puzzle.chunkPiece = chunkPiece;
    function edgeAt(puzzle, sheet, steps) {
        return Edge.walk(puzzle.stands[sheet], steps);
    }
    Puzzle.edgeAt = edgeAt;
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
    Puzzle.makePieces = makePieces;
    function ckeckPuzzleShape(radius, center_x, R) {
        assert(center_x > 0);
        assert(radius > 0);
        assert(center_x < radius);
        assert(center_x * 2 > radius);
        assert(R > center_x + radius);
    }
    function makePuzzle(factory, radius, center_x, R) {
        ckeckPuzzleShape(radius, center_x, R);
        const { pieces, stands, ramified } = factory.make_pieces();
        return {
            pieces,
            stands,
            ramified,
            states: indices(stands.length).map(_ => ({ type: StateType.Aligned })),
            radius,
            center_x,
            R,
        };
    }
    Puzzle.makePuzzle = makePuzzle;
    // side = true: left
    function getTwistEdges(puzzle, side, sheet) {
        const edge0 = side ? edgeAt(puzzle, sheet, [-1, -1, -2, -1, 0])
            : edgeAt(puzzle, sheet, [0, 1, 2, 1, 0]);
        return unrollUntilLoopback(edge0, edge => Edge.walk(edge, [1, 1, 0]));
    }
    Puzzle.getTwistEdges = getTwistEdges;
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
    Puzzle.getTwistPieces = getTwistPieces;
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
    Puzzle.setShift = setShift;
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
    Puzzle.snap = snap;
    function isAligned(puzzle) {
        return puzzle.states.every(state => state.type === StateType.Aligned);
    }
    Puzzle.isAligned = isAligned;
})(Puzzle || (Puzzle = {}));
(function (Puzzle) {
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
            const { sheets } = Puzzle.getTwistPieces(puzzle, side, sheet);
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
        arcs.set(Puzzle.edgeAt(puzzle, 0, [0, 1, 1, 0]), { start: p0, end: p2, auxiliary_point, circle: right_circle });
        arcs.set(Puzzle.edgeAt(puzzle, 0, [0, 1, -1, 1, 0]), { start: p2, end: p1, auxiliary_point, circle: right_circle });
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
            const { pieces } = Puzzle.getTwistPieces(puzzle, shift_trans.side, sheet);
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
        const pieceBR = Puzzle.edgeAt(puzzle, sheet, []).aff;
        const pieceBL = Puzzle.edgeAt(puzzle, sheet, [-1, 0]).aff;
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
            Puzzle.getTwistEdges(puzzle, shifted_trans.side, sheet),
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
    function makePuzzle(factory, radius, center_x, R) {
        const puzzle = Puzzle.makePuzzle(factory, radius, center_x, R);
        const rifts = factory.make_rifts(radius, center_x, R);
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
            return { ...branch_point, rel_angles };
        });
        return {
            ...puzzle,
            branch_points,
            rifts: rifts.rifts,
        };
    }
    PrincipalPuzzle.makePuzzle = makePuzzle;
    function calculateRiftShape(puzzle, shapes, rift) {
        const left_point = Geo.getStartPoint(shapes.get(puzzle.ramified[rift.left].pieces[0]));
        const right_point = Geo.getStartPoint(shapes.get(puzzle.ramified[rift.right].pieces[0]));
        const [middle, is_solid] = HyperbolicPolarCoordinate.getHyperbolaPoint(left_point, right_point, rift.coord);
        if (is_solid && Geo.norm(middle) < puzzle.R * 2) {
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
        const inf_radius = puzzle.R * 1.5 + Math.max(rift.left, rift.right) * puzzle.radius / 10;
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
    function calculateClippedShapes(puzzle) {
        const shapes = Puzzle.calculateShapes(puzzle);
        const rift_shapes = puzzle.rifts.map(rift => calculateRiftShape(puzzle, shapes, rift));
        let layers = calculateClippedShapes_(puzzle, shapes, rift_shapes, 0);
        const RETRY = 5;
        const PERTURBATION = 1e-4;
        for (const n of indices(RETRY)) {
            if (layers !== undefined)
                break;
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
            // console.warn(`fail to calculate clipped shapes, try again with perturbation (${n})`, perturbation);
            const rift_shapes = perturb_rifts.map(rift => calculateRiftShape(puzzle, shapes, rift));
            layers = calculateClippedShapes_(puzzle, shapes, rift_shapes, n + 1);
        }
        if (layers === undefined)
            return undefined;
        return { layers, rifts: rift_shapes };
    }
    PrincipalPuzzle.calculateClippedShapes = calculateClippedShapes;
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
    function getAdjacentSegs(puzzle, seg, shapes, rift_shapes, cutted_shapes) {
        var _a, _b, _c, _d;
        const res = [];
        if (seg.source.type === Geo.CutSourceType.Seg) {
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
                        // break;
                    }
                }
            }
        }
        else {
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
            const [src_from, src_to] = seg.source.type === Geo.CutSourceType.LeftCut ?
                [seg.source.from, seg.source.to]
                : [seg.source.to, seg.source.from];
            const from = src_from !== null && src_from !== void 0 ? src_from : 0;
            const to = src_to !== null && src_to !== void 0 ? src_to : rift_seg.len;
            const adj_type = seg.source.type === Geo.CutSourceType.LeftCut ?
                Geo.CutSourceType.RightCut : Geo.CutSourceType.LeftCut;
            for (const [adj_piece, shapes] of cutted_shapes) {
                if (adj_piece !== piece)
                    continue;
                for (const adj_path of shapes) {
                    for (const adj_seg of adj_path.segs) {
                        if (!(adj_seg.source.type === adj_type && adj_seg.source.ref === rift_seg))
                            continue;
                        const [adj_src_from, adj_src_to] = adj_seg.source.type === Geo.CutSourceType.LeftCut ?
                            [adj_seg.source.from, adj_seg.source.to]
                            : [adj_seg.source.to, adj_seg.source.from];
                        const adj_from = Math.max(adj_src_from !== null && adj_src_from !== void 0 ? adj_src_from : 0, from);
                        const adj_to = Math.min(adj_src_to !== null && adj_src_to !== void 0 ? adj_src_to : rift_seg.len, to);
                        if (adj_to - adj_from < SMALLEST_ADJ_LEN)
                            continue;
                        res.push(adj_path);
                        // break;
                    }
                }
            }
        }
        return res;
    }
    function calculateClippedShapes_(puzzle, shapes, rift_shapes, n) {
        const ANG_EPS = 1e-3;
        const POS_EPS = 1e-3;
        const cutted_shapes = new Map();
        // cut normal pieces
        function cut(shape, rift_shape, name) {
            const res = Geo.cutRegion(shape, rift_shape);
            if (res === undefined) {
                console.warn(`fail to clip path (${n}): fail to cut piece ${name}`);
                return undefined;
            }
            // TODO: incomplete cut
            if (res.some(path => Geo.hasIncompleteCut(path, rift_shape))) {
                console.warn(`fail to clip path (${n}): fail to cut piece ${name}`);
                return undefined;
            }
            return res;
        }
        for (const [piece, shape] of shapes) {
            if (piece.type === PieceType.InfPiece)
                continue;
            if (puzzle.ramified.some(ramified => ramified.pieces.includes(piece)))
                continue;
            let res;
            for (const i of indices(rift_shapes.length)) {
                const rift_shape = rift_shapes[i];
                if (i === 0) {
                    const res_ = cut(shape, rift_shape, piece.name);
                    if (res_ === undefined) {
                        return undefined;
                    }
                    res = res_;
                }
                else {
                    const ress = res.map(subshape => cut(subshape, rift_shape, piece.name));
                    if (ress.some(subshapes => subshapes === undefined)) {
                        return undefined;
                    }
                    res = ress.flatMap(subshapes => subshapes).map(subshape => Geo.flattenCut(subshape));
                }
            }
            append(cutted_shapes, piece, res);
        }
        // cut ramified pieces
        const seeds = indices(puzzle.stands.length).map(_ => []);
        for (const i of indices(puzzle.ramified.length)) {
            const ramified = puzzle.ramified[i];
            const branch_cut = puzzle.branch_points[i];
            const rift_index = puzzle.rifts.findIndex(({ left, right }) => left === i || right === i);
            const rift_side = puzzle.rifts[rift_index].left === i;
            const rift_shape = rift_shapes[rift_index];
            const branch_point = rift_side ? Geo.getStartPoint(rift_shape) : Geo.getEndPoint(rift_shape);
            let cut_angle = branch_cut.cut_angle;
            {
                const ramified_angle_ = calculateRiftAngle(puzzle, shapes, rift_shapes, i);
                const angle_err = Math.abs(Geo.as_npi_pi(ramified_angle_ - cut_angle));
                if (angle_err >= ANG_EPS)
                    console.warn(`ramified angle error: ${angle_err}`);
                const pos_err = Geo.norm(Geo.sub(rift_side ? Geo.getStartPoint(rift_shapes[rift_index]) : Geo.getEndPoint(rift_shapes[rift_index]), branch_cut.point));
                cut_angle = Geo.as_npi_pi(ramified_angle_ - cut_angle) + cut_angle;
                if (pos_err >= POS_EPS)
                    console.warn(`ramified position error: ${pos_err}`);
            }
            const ramified_piece_indices = [];
            {
                const points = ramified.pieces.map(piece => shapes.get(piece).segs[0].target);
                const angle_upperbounds = zip(points, rotate(points, 1))
                    .map(([start, end]) => Geo.angleBetween(branch_point, start, end))
                    .map((_, i, angles) => angles.slice(0, i + 1).reduce((a, b) => a + b));
                const ramified_piece_indices_ = indices(ramified.turn)
                    .map(n => mod(cut_angle + Math.PI * 2 * n, Math.PI * 2 * ramified.turn))
                    .map(ramified_angle => angle_upperbounds.findIndex(upperbound => ramified_angle < upperbound));
                if (ramified_piece_indices_.includes(-1)) {
                    console.warn(`fail to clip path (${n}): fail to cut ramified pieces`);
                    return undefined;
                }
                ramified_piece_indices.push(...ramified_piece_indices_);
            }
            for (const index of indices(ramified.pieces.length)) {
                const piece = ramified.pieces[index];
                const shape = shapes.get(piece);
                const res0 = Geo.cutRegion(shape, rift_shape, {
                    index_of_path: 0,
                    incident_with_cut_start_or_end: rift_side,
                    considered_as_incident: ramified_piece_indices.includes(index),
                });
                if (res0 === undefined) {
                    console.warn(`fail to clip path (${n}): fail to cut ramified piece: ${piece.name}`);
                    return undefined;
                }
                if (res0.some(path => Geo.hasIncompleteCut(path, rift_shape))) {
                    console.warn(`fail to clip path (${n}): fail to cut ramified piece ${piece.name}`);
                    return undefined;
                }
                let res = res0;
                for (const i of indices(rift_shapes.length)) {
                    if (i === rift_index)
                        continue;
                    const rift_shape = rift_shapes[i];
                    const ress = res.map(subshape => cut(subshape, rift_shape, piece.name));
                    if (ress.some(subshapes => subshapes === undefined)) {
                        return undefined;
                    }
                    res = ress.flatMap(subshapes => subshapes).map(subshape => Geo.flattenCut(subshape));
                }
                append(cutted_shapes, piece, res);
                for (const [ramified_piece_index, layer_index] of zip(ramified_piece_indices, branch_cut.order)) {
                    if (index === ramified_piece_index) {
                        const seed_shape0 = rift_side ?
                            res.find(path => path.segs.some(seg => seg.source.type === Geo.CutSourceType.LeftCut
                                && seg.source.ref === rift_shape.segs[0]
                                && seg.source.from === 0))
                            :
                                res.find(path => path.segs.some(seg => seg.source.type === Geo.CutSourceType.RightCut
                                    && seg.source.ref === rift_shape.segs[rift_shape.segs.length - 1]
                                    && seg.source.to === seg.source.ref.len));
                        if (seed_shape0 !== undefined)
                            seeds[layer_index].push(seed_shape0);
                    }
                }
            }
        }
        // TODO: determine layers cross cut
        const cutted_shapes_layer = new Map(seeds.flatMap((seeds, layer_index) => seeds.map(shape => [shape, layer_index])));
        for (const [path, layer_index] of cutted_shapes_layer) {
            for (const seg of path.segs) {
                let adj_layer_index;
                if (seg.source.type === Geo.CutSourceType.Seg) {
                    adj_layer_index = layer_index;
                }
                else {
                    const rift_seg = seg.source.ref;
                    const rift_index = rift_shapes.findIndex(path => path.segs.includes(rift_seg));
                    assert(rift_index !== -1);
                    const is_foward = seg.source.type === Geo.CutSourceType.RightCut;
                    // assume: they commute each others
                    const perm = [...puzzle.branch_points[puzzle.rifts[rift_index].left].order];
                    adj_layer_index = applyPerm(perm, is_foward ? +1 : -1, layer_index);
                }
                // find adjacent edges
                for (const adj_path of getAdjacentSegs(puzzle, seg, shapes, rift_shapes, cutted_shapes)) {
                    if (cutted_shapes_layer.has(adj_path)) {
                        if (cutted_shapes_layer.get(adj_path) !== adj_layer_index) {
                            console.warn(`fail to clip path (${n}): conflict layer`);
                            return undefined;
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
            console.warn(`fail to clip path (${n}): ${unclassified.size} shapes are not classified into any layer`);
        }
        return layers;
    }
    function setShift(puzzle, side, sheet, angle) {
        const ANGLE_MAX_STEP = Math.PI / 30;
        const twist_pieces = Puzzle.getTwistPieces(puzzle, side, sheet);
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
        Puzzle.setShift(puzzle, side, sheets, angle);
        updateRiftRelAngles(puzzle);
        return true;
    }
    PrincipalPuzzle.setShift = setShift;
    function snap(puzzle) {
        return Puzzle.snap(puzzle);
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
    function applyPerm(cyclic, n, value) {
        const i = cyclic.indexOf(value);
        if (i === -1)
            return value;
        return cyclic[mod(i + n, cyclic.length)];
    }
    function updateRiftRelAngles(puzzle) {
        const rel_angless = puzzle.branch_points.map((branch_point, pindex) => zip(branch_point.rel_angles, puzzle.rifts).map(([rel_angle, rift]) => {
            if (pindex === rift.left || pindex === rift.right) {
                return 0;
            }
            else {
                let coord = HyperbolicPolarCoordinate.getCoordinateFromPoint(puzzle.branch_points[rift.left].point, puzzle.branch_points[rift.right].point, branch_point.point);
                coord = HyperbolicPolarCoordinate.offsetTo(coord, rift.coord.offset);
                let rel_angle_ = coord.angle - rift.coord.angle;
                rel_angle_ = Geo.as_npi_pi(rel_angle_ - rel_angle) + rel_angle;
                return rel_angle_;
            }
        }));
        // TODO: fail for invalid rift crossing
        const crosses = rel_angless.map(rel_angles => rel_angles.map(rel_angle => Math.floor(rel_angle / (Math.PI * 2))));
        // assume: they commute each others
        const perms = puzzle.rifts.map(({ left }) => [...puzzle.branch_points[left].order]);
        for (const [rel_angles, branch_point] of zip(rel_angless, puzzle.branch_points)) {
            branch_point.rel_angles = rel_angles;
        }
        for (const [cross, branch_point] of zip(crosses, puzzle.branch_points)) {
            branch_point.rel_angles = zip(cross, branch_point.rel_angles)
                .map(([turn, rel_angle]) => rel_angle - turn * Math.PI * 2);
            branch_point.order = zip(perms, cross)
                .reduce((order, [perm, turn]) => order.map(i => applyPerm(perm, turn, i)), branch_point.order);
        }
        return true;
    }
})(PrincipalPuzzle || (PrincipalPuzzle = {}));
export var PrincipalPuzzleWithTexture;
(function (PrincipalPuzzleWithTexture) {
    function makePuzzle(factory, radius, center_x, R, draw_image) {
        const puzzle = PrincipalPuzzle.makePuzzle(factory, radius, center_x, R);
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
            for (const piece of Puzzle.getTwistPieces(puzzle, trans.side, sheet).pieces)
                positions.set(piece, Geo.compose(positions.get(piece), trans.trans));
        }
        return positions;
    }
    PrincipalPuzzleWithTexture.getPositions = getPositions;
    function calculateClippedImages(puzzle) {
        const positions = getPositions(puzzle);
        const clipped_shapes = PrincipalPuzzle.calculateClippedShapes(puzzle);
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
            for (const piece of Puzzle.getTwistPieces(puzzle, side, sheet).pieces) {
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
    function getDHTextureFunction(puzzle, turn, scale) {
        const d = puzzle.center_x;
        const fns = [];
        for (const i of indices(turn)) {
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.add(z, Complex.c(-d, 0)), (turn - 1) / turn), Complex.omega(i / turn), Complex.c(scale, 0)));
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.add(z, Complex.c(-d, 0)), Complex.c(-1, 0)), (turn - 1) / turn), Complex.omega((turn + 1 + 2 * i) / turn / 2), Complex.c(scale, 0)));
        }
        return fns;
    }
    Textures.getDHTextureFunction = getDHTextureFunction;
    function getDVTextureFunction(puzzle, turn, scale) {
        const d = puzzle.center_x / Math.sqrt(3);
        const fns = [];
        for (const i of indices(turn)) {
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d, 0)), (turn - 1) / turn), Complex.omega(i / turn), Complex.c(scale, 0)));
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.c(-1, 0), Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d, 0))), (turn - 1) / turn), Complex.omega((turn + 1 + 2 * i) / turn / 2), Complex.c(scale, 0)));
        }
        return fns;
    }
    Textures.getDVTextureFunction = getDVTextureFunction;
    function getQTextureFunction(puzzle, turn, scale) {
        const d1 = puzzle.center_x;
        const d2 = puzzle.center_x / Math.sqrt(3);
        const fns = [];
        for (const i of indices(turn)) {
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / turn), Complex.pow(Complex.add(z, Complex.c(-d1, 0)), (turn - 1) / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d2, 0)), (turn - 1) / turn), Complex.omega(i / turn), Complex.c(scale, 0)));
            fns.push((z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.add(z, Complex.c(-1, 0)), Complex.c(-d1, 0)), (turn - 1) / turn), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / turn), Complex.pow(Complex.mul(Complex.c(-1, 0), Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d2, 0))), (turn - 1) / turn), Complex.omega((i + 1) / turn), Complex.c(scale, 0)));
        }
        return fns;
    }
    Textures.getQTextureFunction = getQTextureFunction;
    function getDDTextureFunction(puzzle, scale) {
        const d1 = puzzle.center_x;
        const d2 = puzzle.center_x / Math.sqrt(3);
        const f1 = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / 2), Complex.pow(Complex.add(z, Complex.c(-d1, 0)), 1 / 2), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / 2), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, -1)), Complex.c(+d2, 0)), 1 / 2), Complex.c(scale, 0));
        const f2 = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1 / 2), Complex.pow(Complex.add(z, Complex.c(-d1, 0)), 1 / 2), Complex.abs(Complex.add(z, Complex.c(0, (z[1] >= 0 ? +1 : -1) * d2))), Complex.c(-1, 0), Complex.c(scale, 0));
        const f3 = (z) => Complex.mul(Complex.abs(Complex.add(z, Complex.c((z[0] >= 0 ? +1 : -1) * d1, 0))), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1 / 2), Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, -1)), Complex.c(+d2, 0)), 1 / 2), Complex.normalize(z), Complex.c(-1, 0), Complex.c(scale, 0));
        const f12 = (z) => (z[1] < 0) ? f1(z) : f2(z);
        const f12_ = (z) => !(z[1] < 0) ? f1(z) : f2(z);
        const f13 = (z) => (z[1] > 0 ? z[0] < 0 : z[0] <= 0) ? f1(z) : f3(z);
        const f13_ = (z) => !(z[1] > 0 ? z[0] < 0 : z[0] <= 0) ? f1(z) : f3(z);
        return [f1, f2, f3, f12, f12_, f13, f13_];
    }
    Textures.getDDTextureFunction = getDDTextureFunction;
})(Textures || (Textures = {}));
export var Factory;
(function (Factory) {
    function DH(turn, scale) {
        return {
            make_pieces: () => {
                const layers = indices(turn).map(i => Puzzle.makePieces(`_${i}`));
                const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
                const pieceCLs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1]).aff);
                const pieceCRs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, -1]).aff);
                // ramify center pieces
                // ramified_pieceCLs[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_pieceCLs = Puzzle.chunkPiece("CL", Puzzle.ramifyPiece("", pieceCLs, 0), 2);
                // ramified_pieceCRs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_pieceCRs = Puzzle.chunkPiece("CR", Puzzle.ramifyPiece("", rotate(pieceCRs, 1).reverse(), 0), 2);
                // piece50Ls[0].edges[0]: the edge from the second sheet to the top sheet
                Puzzle.swapAdj(...piece50Ls.map(piece => piece.edges[0]));
                Puzzle.swapAdj(...piece50Ls.map(piece => piece.edges[3]));
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
            make_rifts: (radius, center_x, R) => {
                return {
                    branch_points: [
                        { point: [-center_x, 0], cut_angle: Math.PI / 6, order: indices(turn) },
                        { point: [center_x, 0], cut_angle: Math.PI / 6, order: rotate(indices(turn), 1).reverse() },
                    ],
                    rifts: [
                        { left: 0, right: 1, coord: { offset: 0.0, angle: 0.0 } }
                    ],
                };
            },
            make_texture_functions: puzzle => Textures.getDHTextureFunction(puzzle, turn, scale),
            determine_texture_indices: (puzzle) => {
                const texture_indices = new Map();
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = mod(2 * sheet - 1, 2 * puzzle.stands.length);
                    const edgeCL = Puzzle.edgeAt(puzzle, sheet, [0, 1, -1, 1]);
                    texture_indices.set(edgeCL.aff, texture_index);
                    texture_indices.set(Edge.walk(edgeCL, [0]).aff, texture_index);
                    texture_indices.set(Edge.walk(edgeCL, [0, 2]).aff, texture_index);
                }
                for (const sheet of indices(puzzle.stands.length)) {
                    const layer = new Set();
                    layer.add(Puzzle.edgeAt(puzzle, sheet, []).aff);
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
    Factory.DH = DH;
    function DV(turn, scale) {
        return {
            make_pieces: () => {
                const layers = indices(turn).map(i => Puzzle.makePieces(`_${i}`));
                const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
                const piece0Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1]).aff);
                const piece0Rs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 2]).aff);
                // ramify corner pieces
                // ramified_piece0Ls[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_piece0Ls = Puzzle.chunkPiece("0L", Puzzle.ramifyPiece("", piece0Ls, 0), 1);
                // ramified_piece0Rs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_piece0Rs = Puzzle.chunkPiece("0R", Puzzle.ramifyPiece("", rotate(piece0Rs, 1).reverse(), 0), 1);
                // piece50Ls[0].edges[3]: the edge from the second sheet to the top sheet
                Puzzle.swapAdj(...piece50Ls.map(piece => piece.edges[3]));
                Puzzle.swapAdj(...piece50Ls.map(piece => piece.edges[2]));
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
            make_rifts: (radius, center_x, R) => {
                return {
                    branch_points: [
                        { point: [0, center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: indices(turn) },
                        { point: [0, -center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: rotate(indices(turn), 1).reverse() },
                    ],
                    rifts: [
                        { left: 0, right: 1, coord: { offset: 0.0, angle: 0.0 } }
                    ],
                };
            },
            make_texture_functions: puzzle => Textures.getDVTextureFunction(puzzle, turn, scale),
            determine_texture_indices: (puzzle) => {
                const texture_indices = new Map();
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = mod(2 * sheet - 1, 2 * puzzle.stands.length);
                    const edge0L = Puzzle.edgeAt(puzzle, sheet, [0, 1, -1, 0]);
                    texture_indices.set(edge0L.aff, texture_index);
                    texture_indices.set(Edge.walk(edge0L, [0]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge0L, [0, 2]).aff, texture_index);
                }
                for (const sheet of indices(puzzle.stands.length)) {
                    const layer = new Set();
                    layer.add(Puzzle.edgeAt(puzzle, sheet, []).aff);
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
    Factory.DV = DV;
    function Q(turn, scale) {
        return {
            make_pieces: () => {
                const layers = indices(turn).map(i => Puzzle.makePieces(`_${i}`));
                const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
                const pieceCLs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1]).aff);
                const pieceCRs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, -1]).aff);
                const piece0Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1]).aff);
                const piece0Rs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 2]).aff);
                // ramify center pieces
                // ramified_pieceCLs[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_pieceCLs = Puzzle.chunkPiece("CL", Puzzle.ramifyPiece("", pieceCLs, 0), 2);
                // ramified_pieceCRs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_pieceCRs = Puzzle.chunkPiece("CR", Puzzle.ramifyPiece("", rotate(pieceCRs, 1).reverse(), 0), 2);
                // ramify corner pieces
                // ramified_piece0Ls[0].edges[1]: the edge from the bottom sheet to the top sheet
                const ramified_piece0Ls = Puzzle.chunkPiece("0L", Puzzle.ramifyPiece("", piece0Ls, 0), 1);
                // ramified_piece0Rs[0].edges[1]: the edge from the second sheet to the top sheet
                const ramified_piece0Rs = Puzzle.chunkPiece("0R", Puzzle.ramifyPiece("", rotate(piece0Rs, 1).reverse(), 0), 1);
                // piece50Ls[0].edges[0]: the edge from the top sheet to the bottom sheet
                // piece50Ls[0].edges[1]: the edge from the bottom sheet to the top sheet
                // piece50Ls[0].edges[2]: the edge from the top sheet to the second sheet
                // piece50Ls[0].edges[3]: the edge from the second sheet to the top sheet
                Puzzle.swapAdj(...piece50Ls.map(piece => piece.edges[1]).reverse());
                Puzzle.swapAdj(...piece50Ls.map(piece => piece.edges[3]));
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
            make_rifts: (radius, center_x, R) => {
                return {
                    branch_points: [
                        { point: [-center_x, 0], cut_angle: Math.PI / 6, order: indices(turn) },
                        { point: [center_x, 0], cut_angle: Math.PI / 6, order: rotate(indices(turn), 1).reverse() },
                        { point: [0, center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: indices(turn) },
                        { point: [0, -center_x / Math.sqrt(3)], cut_angle: Math.PI / 3, order: rotate(indices(turn), 1).reverse() },
                    ],
                    rifts: [
                        { left: 0, right: 1, coord: { offset: 0.0, angle: 0.0 } },
                        { left: 2, right: 3, coord: { offset: 0.0, angle: 0.0 } },
                    ],
                };
            },
            make_texture_functions: puzzle => Textures.getQTextureFunction(puzzle, turn, scale),
            determine_texture_indices: (puzzle) => {
                const texture_indices = new Map();
                for (const sheet of indices(puzzle.stands.length)) {
                    const texture_index = mod(2 * sheet - 3, 2 * puzzle.stands.length);
                    const edge = Puzzle.edgeAt(puzzle, sheet, [0, 1, -1]);
                    texture_indices.set(edge.aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [0]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [1]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [2]).aff, texture_index);
                    texture_indices.set(Edge.walk(edge, [3]).aff, texture_index);
                }
                for (const sheet of indices(puzzle.stands.length)) {
                    const layer = new Set();
                    layer.add(Puzzle.edgeAt(puzzle, sheet, []).aff);
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
    Factory.Q = Q;
})(Factory || (Factory = {}));
//# sourceMappingURL=Model.js.map
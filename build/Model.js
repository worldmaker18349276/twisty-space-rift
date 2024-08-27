import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";
function indices(n) {
    const res = [];
    for (let i = 0; i < n; i++)
        res.push(i);
    return res;
}
function unrollUntilLoopback(a, next) {
    const res = [a];
    while (true) {
        a = next(a);
        if (a === res[0])
            break;
        res.push(a);
    }
    return res;
}
function append(map, key, values) {
    const slots = map.get(key);
    if (slots === undefined) {
        map.set(key, Array.from(values));
    }
    else {
        slots.push(...values);
    }
}
export var Edge;
(function (Edge) {
    function next(edge) {
        console.assert(!edge.auxiliary);
        let next = edge.next_;
        while (next.auxiliary) {
            next = next.adj.next_;
        }
        return next;
    }
    Edge.next = next;
    function prev(edge) {
        console.assert(!edge.auxiliary);
        let prev = edge.prev_;
        while (prev.auxiliary) {
            prev = prev.adj.prev_;
        }
        return prev;
    }
    Edge.prev = prev;
    function walk(edge, steps) {
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
export var Puzzle;
(function (Puzzle) {
    function makeEdge(piece) {
        const edge = {
            aff: piece,
            next: undefined,
            prev: undefined,
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
    function swapAdj(edge1, edge2) {
        const adj_edge1 = edge1.adj;
        const adj_edge2 = edge2.adj;
        adjEdges(edge1, adj_edge2);
        adjEdges(edge2, adj_edge1);
    }
    function makeEdges(piece, n) {
        piece.edges = indices(n).map(_ => makeEdge(piece));
        for (const i of indices(n)) {
            linkEdges(piece.edges[i], piece.edges[(i + 1) % piece.edges.length]);
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
        const edges = pieces.flatMap(piece => [...piece.edges.slice(n), ...piece.edges.slice(0, n)]);
        const type = pieces[0].type;
        const piece = { type, edges, name };
        for (const i of indices(edges.length)) {
            linkEdges(edges[i], edges[(i + 1) % edges.length]);
            edges[i].aff = piece;
        }
        return piece;
    }
    function chunkPiece(name, piece, step) {
        console.assert(piece.edges.length % step == 0);
        const subpieces = [];
        for (const n of indices(piece.edges.length / step)) {
            const type = piece.type;
            const subpiece = { type, edges: [], name: `${name}${n}` };
            const edges = piece.edges.slice(n * step, (n + 1) * step);
            edges.unshift(makeEdge(subpiece));
            edges.push(makeEdge(subpiece));
            for (const i of indices(edges.length)) {
                linkEdges(edges[i], edges[(i + 1) % edges.length]);
                edges[i].aff = subpiece;
            }
            subpiece.edges = edges;
            subpieces.push(subpiece);
        }
        for (const n of indices(subpieces.length)) {
            const prev_subpiece = subpieces[n];
            const next_subpiece = subpieces[(n + 1) % subpieces.length];
            const prev_edge = prev_subpiece.edges[prev_subpiece.edges.length - 1];
            const next_edge = next_subpiece.edges[0];
            adjEdges(prev_edge, next_edge);
            prev_edge.auxiliary = true;
            next_edge.auxiliary = true;
        }
        return subpieces;
    }
    function make(suffix = "") {
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
            stands: [pieceBR.edges[0]],
        };
    }
    Puzzle.make = make;
    function edgeAt(puzzle, sheet, steps) {
        return Edge.walk(puzzle.stands[sheet], steps);
    }
    Puzzle.edgeAt = edgeAt;
    function makeRamifiedV1() {
        // top pieces
        const top = make("_top");
        const bot = make("_bot");
        const top_piece50L = edgeAt(top, 0, [0, 1, -1, 1, 0]).aff;
        const bot_piece50L = edgeAt(bot, 0, [0, 1, -1, 1, 0]).aff;
        const top_pieceCL = edgeAt(top, 0, [0, 1, -1, 1]).aff;
        const top_pieceCR = edgeAt(top, 0, [0, 1, -1, -1]).aff;
        const bot_pieceCL = edgeAt(bot, 0, [0, 1, -1, 1]).aff;
        const bot_pieceCR = edgeAt(bot, 0, [0, 1, -1, -1]).aff;
        // ramify center pieces
        // pieceCLs[0].edges[1]: edge outgoing the branch cut
        const pieceCLs = chunkPiece("CL", ramifyPiece("", [top_pieceCL, bot_pieceCL], 0), 2);
        // pieceCRs[0].edges[1]: edge outgoing the branch cut
        const pieceCRs = chunkPiece("CR", ramifyPiece("", [top_pieceCR, bot_pieceCR], 0), 2);
        // top_piece50L.edges[0]: adj to left center, edge outgoing the branch cut
        // bot_piece50L.edges[2]: adj to right center, edge incoming the branch cut
        swapAdj(top_piece50L.edges[3], bot_piece50L.edges[3]);
        swapAdj(top_piece50L.edges[0], bot_piece50L.edges[0]);
        const pieces = [
            ...top.pieces,
            ...bot.pieces,
            ...pieceCLs,
            ...pieceCRs,
        ].filter(p => ![
            top_pieceCL,
            top_pieceCR,
            bot_pieceCL,
            bot_pieceCR,
        ].includes(p));
        return { pieces, stands: [top.stands[0], bot.stands[0]] };
    }
    Puzzle.makeRamifiedV1 = makeRamifiedV1;
    // side = true: left
    function getCircleEdges(puzzle, side, sheet) {
        const edge0 = side ? edgeAt(puzzle, sheet, [0, 1, -1, -1, 0])
            : edgeAt(puzzle, sheet, [0, 1, -1, 1, 0]);
        return unrollUntilLoopback(edge0, edge => Edge.walk(edge, [1, 1, 0]));
    }
    Puzzle.getCircleEdges = getCircleEdges;
    // side = true: left
    function getCenterEdges(puzzle, side, sheet) {
        const edge0 = side ? edgeAt(puzzle, sheet, [0, 1, -1, 1, 0])
            : edgeAt(puzzle, sheet, [0, 1, -1, -1, 0]);
        return unrollUntilLoopback(edge0, edge => Edge.walk(edge, [1, 1, 1, 0]));
    }
    Puzzle.getCenterEdges = getCenterEdges;
    // side = true: left
    function getTwistPiece(puzzle, side, sheet) {
        const edges = getCircleEdges(puzzle, side, sheet);
        const pieces = new Set();
        for (const edge of edges)
            pieces.add(edge.aff);
        for (const piece of pieces)
            for (const edge of piece.edges)
                if (!edges.includes(edge))
                    pieces.add(edge.adj.aff);
        return pieces;
    }
    Puzzle.getTwistPiece = getTwistPiece;
    // side = true: left
    function twist(puzzle, side, sheet, forward) {
        const edges = getCircleEdges(puzzle, side, sheet);
        const edges_adj = edges.map(edge => edge.adj);
        const edges_adj_rotated = forward ? [...edges_adj.slice(2), ...edges_adj.slice(0, 2)]
            : [...edges_adj.slice(-2), ...edges_adj.slice(0, -2)];
        for (const i of indices(edges.length)) {
            adjEdges(edges[i], edges_adj_rotated[i]);
        }
    }
    Puzzle.twist = twist;
})(Puzzle || (Puzzle = {}));
export var StateType;
(function (StateType) {
    StateType[StateType["Aligned"] = 0] = "Aligned";
    StateType[StateType["LeftShifted"] = 1] = "LeftShifted";
    StateType[StateType["RightShifted"] = 2] = "RightShifted";
})(StateType || (StateType = {}));
export var PrincipalPuzzle;
(function (PrincipalPuzzle) {
    const MAX_RIFT_OFFSET = 0.8;
    function make(radius, center_x, R) {
        console.assert(center_x > 0);
        console.assert(radius > 0);
        console.assert(center_x < radius);
        console.assert(center_x * 2 > radius);
        console.assert(R > center_x + radius);
        const space = Puzzle.makeRamifiedV1();
        const left_center_piece = Puzzle.edgeAt(space, 0, [0, 1, -1, 1]).aff;
        const right_center_piece = Puzzle.edgeAt(space, 1, [0, 1, -1, -1]).aff;
        return {
            radius,
            center_x,
            R,
            space,
            state: { type: StateType.Aligned },
            rift_offset: 0,
            rift_angle: 0,
            ramified_angles: {
                left: [left_center_piece, 0],
                right: [right_center_piece, 0],
            },
        };
    }
    PrincipalPuzzle.make = make;
    function getTwistCircles(puzzle) {
        return [
            { center: [-puzzle.center_x, 0], radius: puzzle.radius },
            { center: [+puzzle.center_x, 0], radius: puzzle.radius },
        ];
    }
    PrincipalPuzzle.getTwistCircles = getTwistCircles;
    function getShiftTransformation(puzzle) {
        if (puzzle.state.type === StateType.LeftShifted) {
            return Geo.compose(Geo.translate([puzzle.center_x, 0]), Geo.rotate(puzzle.state.angle), Geo.translate([-puzzle.center_x, 0]));
        }
        if (puzzle.state.type === StateType.RightShifted) {
            return Geo.compose(Geo.translate([-puzzle.center_x, 0]), Geo.rotate(puzzle.state.angle), Geo.translate([puzzle.center_x, 0]));
        }
        return Geo.id_trans();
    }
    PrincipalPuzzle.getShiftTransformation = getShiftTransformation;
    function getTwistTransformation(puzzle, side, forward) {
        if (side && forward)
            return Geo.compose(Geo.translate([puzzle.center_x, 0]), Geo.rotate(Math.PI / 3), Geo.translate([-puzzle.center_x, 0]));
        if (side && !forward)
            return Geo.compose(Geo.translate([puzzle.center_x, 0]), Geo.rotate(-Math.PI / 3), Geo.translate([-puzzle.center_x, 0]));
        if (!side && forward)
            return Geo.compose(Geo.translate([-puzzle.center_x, 0]), Geo.rotate(Math.PI / 3), Geo.translate([puzzle.center_x, 0]));
        if (!side && !forward)
            return Geo.compose(Geo.translate([-puzzle.center_x, 0]), Geo.rotate(-Math.PI / 3), Geo.translate([puzzle.center_x, 0]));
        return Geo.id_trans();
    }
    PrincipalPuzzle.getTwistTransformation = getTwistTransformation;
    // `offset` is the offset of the hyperbola curve
    // `angle` is the angle of vector from the focus to the point on the hyperbola curve
    // when offset < 0: `angle` is the angle `(f1, f2, point)`
    // when offset > 0: `angle` is the angle `(f2, point, f1)`
    // `is_solid` means if `point` is on the main focus side
    function getHyperbolaPoint(f1, f2, offset, angle) {
        // hyperbola with origin at focus: r = (c^2 - a^2) / (a + c cos(theta))
        // c: half distance between focus
        // a: smallest distance between hyperbola curve and the center of hyperbola
        // theta: angle from focus to a point on hyperbola curve
        console.assert(-1 < offset && offset < 1);
        const c = Geo.norm(Geo.sub(f1, f2)) / 2;
        const a = c * Math.abs(offset);
        const r = (c * c - a * a) / (a + c * Math.cos(angle));
        if (offset < 0) {
            const d = Geo.normalize(Geo.sub(f2, f1));
            const d_ = Geo.transform(d, Geo.rotate(angle));
            return [Geo.add(f1, Geo.mul(d_, r)), r > 0];
        }
        else {
            const d = Geo.normalize(Geo.sub(f1, f2));
            const d_ = Geo.transform(d, Geo.rotate(-angle));
            return [Geo.add(f2, Geo.mul(d_, r)), r > 0];
        }
    }
    function getHyperbolaFromPoint(f1, f2, point) {
        const a = (Geo.norm(Geo.sub(f1, point)) - Geo.norm(Geo.sub(f2, point))) / 2;
        const offset = a / (Geo.norm(Geo.sub(f1, f2)) / 2);
        const angle = offset < 0 ? Geo.angleBetween(f1, f2, point) : Geo.angleBetween(f2, point, f1);
        return { offset, angle };
    }
    function getRiftAngles(f1, f2, offset, angle) {
        const [middle, is_solid] = getHyperbolaPoint(f1, f2, offset, angle);
        function makeSameTurn(angle, ref_angle) {
            const angle_to_0 = Math.abs(Geo.mod(ref_angle + Math.PI, Math.PI * 2) - Math.PI);
            if (angle_to_0 < Math.PI / 2) {
                const n = Math.floor((ref_angle + Math.PI) / (Math.PI * 2));
                return Geo.mod(angle + Math.PI, Math.PI * 2) - Math.PI + n * Math.PI * 2;
            }
            else {
                const n = Math.floor(ref_angle / (Math.PI * 2));
                return Geo.mod(angle, Math.PI * 2) + n * Math.PI * 2;
            }
        }
        if (offset < 0) {
            const right_angle = -(Geo.angleBetween(f2, f1, middle) + (is_solid ? 0 : Math.PI));
            return [angle, makeSameTurn(right_angle, angle)];
        }
        else {
            const left_angle = Geo.angleBetween(f1, f2, middle) + (is_solid ? 0 : Math.PI);
            return [makeSameTurn(left_angle, angle), angle];
        }
    }
    // left[1]: angle of rift relative to left[0].edges[0], ccw as positive
    // right[1]: angle of rift relative to right[0].edges[0], cw as positive
    function getRamifiedAngles(puzzle) {
        const left_center = [-puzzle.center_x, 0];
        const right_center = [+puzzle.center_x, 0];
        const [left_angle, right_angle] = getRiftAngles(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);
        const [left_piece1, left_piece1_n] = puzzle.ramified_angles.left;
        const left_piece1_angle = -Math.PI / 6 + left_piece1_n * Math.PI / 3
            + (puzzle.state.type === StateType.LeftShifted ? puzzle.state.angle : 0);
        const [right_piece1, right_piece1_n] = puzzle.ramified_angles.right;
        const right_piece1_angle = Math.PI / 6 - right_piece1_n * Math.PI / 3
            - (puzzle.state.type === StateType.RightShifted ? puzzle.state.angle : 0);
        return {
            left: [left_piece1, left_angle - left_piece1_angle],
            right: [right_piece1, right_angle - right_piece1_angle],
        };
    }
    function twistTo(puzzle, angle, side) {
        if (side && puzzle.state.type !== StateType.RightShifted) {
            puzzle.state = {
                type: StateType.LeftShifted,
                angle: angle,
            };
            return true;
        }
        else if (!side && puzzle.state.type !== StateType.LeftShifted) {
            puzzle.state = {
                type: StateType.RightShifted,
                angle: angle,
            };
            return true;
        }
        else {
            return false;
        }
    }
    PrincipalPuzzle.twistTo = twistTo;
    function snap(puzzle) {
        if (puzzle.state.type === StateType.Aligned)
            return [true, 0];
        let dn;
        let side;
        if (puzzle.state.type === StateType.LeftShifted) {
            dn = Math.round(puzzle.state.angle / (Math.PI / 3));
            puzzle.state = { type: StateType.Aligned };
            let n = puzzle.ramified_angles.left[1] + dn;
            n = (n % 12 + 12) % 12;
            puzzle.ramified_angles.left[1] = n;
            side = true;
        }
        else {
            dn = Math.round(puzzle.state.angle / (Math.PI / 3));
            puzzle.state = { type: StateType.Aligned };
            let n = puzzle.ramified_angles.right[1] + dn;
            n = (n % 12 + 12) % 12;
            puzzle.ramified_angles.right[1] = n;
            side = false;
        }
        for (const _ of indices(Math.abs(dn)))
            Puzzle.twist(puzzle.space, side, 0, dn > 0);
        return [side, dn];
    }
    PrincipalPuzzle.snap = snap;
    function setRift(puzzle, angle, offset) {
        angle = Geo.mod(angle, Math.PI * 4);
        puzzle.rift_angle = angle;
        offset = Math.max(Math.min(offset, MAX_RIFT_OFFSET), -MAX_RIFT_OFFSET);
        puzzle.rift_offset = offset;
    }
    PrincipalPuzzle.setRift = setRift;
    function calculateRiftTurningPoint(puzzle) {
        const left_center = [-puzzle.center_x, 0];
        const right_center = [+puzzle.center_x, 0];
        const [point, is_solid] = getHyperbolaPoint(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);
        if (!is_solid)
            return undefined;
        return point;
    }
    PrincipalPuzzle.calculateRiftTurningPoint = calculateRiftTurningPoint;
    function calculateRiftAngleOffsetFromPoint(puzzle, point) {
        const left_center = [-puzzle.center_x, 0];
        const right_center = [+puzzle.center_x, 0];
        const { offset, angle } = getHyperbolaFromPoint(left_center, right_center, point);
        const rift_angle = Geo.as0to2pi(angle - puzzle.rift_angle + Math.PI) - Math.PI + puzzle.rift_angle;
        const rift_offset = Math.max(Math.min(offset, MAX_RIFT_OFFSET), -MAX_RIFT_OFFSET);
        return [rift_angle, rift_offset];
    }
    PrincipalPuzzle.calculateRiftAngleOffsetFromPoint = calculateRiftAngleOffsetFromPoint;
    function calculateRift(puzzle) {
        const left_center = [-puzzle.center_x, 0];
        const right_center = [+puzzle.center_x, 0];
        const [middle, is_solid] = getHyperbolaPoint(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);
        if (is_solid && Geo.norm(middle) < puzzle.R * 2) {
            return {
                is_closed: false,
                start: left_center,
                segs: [
                    Geo.makePathSegLine(left_center, middle, undefined),
                    Geo.makePathSegLine(middle, right_center, undefined),
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
        const left_inf = calculateInfPoint(left_center, middle, !is_solid, puzzle.R * 1.5);
        const right_inf = calculateInfPoint(right_center, middle, !is_solid, puzzle.R * 1.5);
        const inf_circle = { center: [0, 0], radius: puzzle.R * 1.5 };
        return {
            is_closed: false,
            start: left_center,
            segs: [
                Geo.makePathSegLine(left_center, left_inf, undefined),
                Geo.makePathSegArc(left_inf, right_inf, inf_circle, undefined),
                Geo.makePathSegLine(right_inf, right_center, undefined),
            ],
        };
    }
    PrincipalPuzzle.calculateRift = calculateRift;
    function calculateShapes(puzzle) {
        const left_trans = getTwistTransformation(puzzle, true, true);
        const left_trans_rev = getTwistTransformation(puzzle, true, false);
        const right_trans = getTwistTransformation(puzzle, false, true);
        const right_trans_rev = getTwistTransformation(puzzle, false, false);
        const [left_circle, right_circle] = getTwistCircles(puzzle);
        const top_circle = Geo.transformCircle(right_circle, left_trans);
        const intersections = Geo.intersectCircles(left_circle, right_circle);
        console.assert(intersections !== undefined);
        const upper_point = intersections.points[1];
        const lower_point = intersections.points[0];
        const p0 = upper_point;
        const p1 = Geo.transformPoint(lower_point, right_trans_rev);
        const p2 = Geo.transformPoint(lower_point, left_trans);
        const p3 = Geo.transformPoint(upper_point, right_trans);
        const p4 = Geo.transformPoint(upper_point, left_trans_rev);
        function transformArc(arc, trans) {
            return {
                start: Geo.transformPoint(arc.start, trans),
                end: Geo.transformPoint(arc.end, trans),
                circle: Geo.transformCircle(arc.circle, trans),
            };
        }
        function flipArc(arc) {
            return {
                start: arc.end,
                end: arc.start,
                circle: Geo.flipCircle(arc.circle),
            };
        }
        const arcs = new Map();
        {
            const corner_arcs0 = [
                { start: p2, end: p0, circle: left_circle },
                { start: p0, end: p1, circle: right_circle },
                { start: p1, end: p2, circle: top_circle },
            ];
            const edge_arcs0 = [
                { start: p1, end: p3, circle: right_circle },
                { start: p4, end: p2, circle: left_circle },
            ];
            let left_corner_arcs = corner_arcs0;
            const left_circle_edge0 = Puzzle.edgeAt(puzzle.space, 0, [0, 1]);
            for (const edge of unrollUntilLoopback(left_circle_edge0, edge => Edge.walk(edge, [1, 2, 1, 0]))) {
                if (!arcs.has(edge)) {
                    arcs.set(edge, left_corner_arcs[0]);
                    arcs.set(Edge.walk(edge, [1, 0]), left_corner_arcs[1]);
                    arcs.set(Edge.walk(edge, [2, 0]), left_corner_arcs[2]);
                }
                left_corner_arcs = left_corner_arcs.map(arc => transformArc(arc, left_trans));
            }
            let right_corner_arcs = corner_arcs0;
            const right_circle_edge0 = Puzzle.edgeAt(puzzle.space, 0, [0, 1, 1, 0]);
            for (const edge of unrollUntilLoopback(right_circle_edge0, edge => Edge.walk(edge, [1, 2, 1, 0]))) {
                if (!arcs.has(edge)) {
                    arcs.set(edge, right_corner_arcs[1]);
                    arcs.set(Edge.walk(edge, [1, 0]), right_corner_arcs[2]);
                    arcs.set(Edge.walk(edge, [2, 0]), right_corner_arcs[0]);
                }
                right_corner_arcs = right_corner_arcs.map(arc => transformArc(arc, right_trans));
            }
            let left_edge_arcs = edge_arcs0;
            const left_circle_seg0 = Puzzle.edgeAt(puzzle.space, 0, [0, 1, -1, -1, 0]);
            for (const edge of unrollUntilLoopback(left_circle_seg0, edge => Edge.walk(edge, [1, 2, 1, 0]))) {
                if (!arcs.has(edge)) {
                    arcs.set(edge, left_edge_arcs[1]);
                    arcs.set(Edge.walk(edge, [2, 0]), left_edge_arcs[0]);
                }
                left_edge_arcs = left_edge_arcs.map(arc => transformArc(arc, left_trans));
            }
            let right_edge_arcs = edge_arcs0;
            const right_circle_seg0 = Puzzle.edgeAt(puzzle.space, 0, [0, 1, -1, 1, 0]);
            for (const edge of unrollUntilLoopback(right_circle_seg0, edge => Edge.walk(edge, [1, 2, 1, 0]))) {
                if (!arcs.has(edge)) {
                    arcs.set(edge, right_edge_arcs[0]);
                    arcs.set(Edge.walk(edge, [2, 0]), right_edge_arcs[1]);
                }
                right_edge_arcs = right_edge_arcs.map(arc => transformArc(arc, right_trans));
            }
        }
        for (const [edge, arc] of arcs)
            if (!arcs.has(edge.adj))
                arcs.set(edge.adj, flipArc(arc));
        if (puzzle.state.type === StateType.LeftShifted) {
            const left_shift_trans = getShiftTransformation(puzzle);
            for (const piece of Puzzle.getTwistPiece(puzzle.space, true, 0))
                for (const edge of piece.edges)
                    if (arcs.has(edge))
                        arcs.set(edge, transformArc(arcs.get(edge), left_shift_trans));
        }
        if (puzzle.state.type === StateType.RightShifted) {
            const right_shift_trans = getShiftTransformation(puzzle);
            for (const piece of Puzzle.getTwistPiece(puzzle.space, false, 1))
                for (const edge of piece.edges)
                    if (arcs.has(edge))
                        arcs.set(edge, transformArc(arcs.get(edge), right_shift_trans));
        }
        const result = new Map();
        const left_center_pieces = new Set(Puzzle.getCenterEdges(puzzle.space, true, 0).map(edge => edge.adj.aff));
        for (const piece of puzzle.space.pieces) {
            const path = { is_closed: true, segs: [] };
            if (piece.type === PieceType.CenterPiece) {
                const center_point = left_center_pieces.has(piece) ? left_circle.center : right_circle.center;
                path.segs.push(Geo.makePathSegLine(center_point, arcs.get(piece.edges[1]).start, piece.edges[0]));
                for (const edge of piece.edges.slice(1, 3)) {
                    const arc = arcs.get(edge);
                    path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
                }
                path.segs.push(Geo.makePathSegLine(arcs.get(piece.edges[2]).end, center_point, piece.edges[3]));
            }
            else if (piece.type === PieceType.CornerPiece || piece.type === PieceType.EdgePiece) {
                for (const edge of piece.edges) {
                    const arc = arcs.get(edge);
                    path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
                }
            }
            result.set(piece, path);
        }
        {
            const pieceBR = Puzzle.edgeAt(puzzle.space, 0, []).aff;
            const pieceBL = Puzzle.edgeAt(puzzle.space, 0, [-1, 0]).aff;
            const pieceBR_ = Puzzle.edgeAt(puzzle.space, 1, []).aff;
            const pieceBL_ = Puzzle.edgeAt(puzzle.space, 1, [-1, 0]).aff;
            const circle = { center: [0, 0], radius: puzzle.R };
            const circle_ = { center: [0, 0], radius: -puzzle.R };
            for (const piece of [pieceBR, pieceBR_, pieceBL, pieceBL_]) {
                const path = { is_closed: true, segs: [] };
                for (const edge of piece.edges.slice(0, 9)) {
                    const arc = arcs.get(edge);
                    path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
                }
                const p1 = arcs.get(piece.edges[8]).end;
                const p2 = [0, p1[1] > 0 ? puzzle.R : -puzzle.R];
                const p3 = [0, p1[1] > 0 ? -puzzle.R : puzzle.R];
                const p4 = arcs.get(piece.edges[0]).start;
                path.segs.push(Geo.makePathSegLine(p1, p2, piece.edges[9]));
                path.segs.push(Geo.makePathSegArc(p2, p3, circle, piece.edges[10]));
                path.segs.push(Geo.makePathSegLine(p3, p4, piece.edges[11]));
                result.set(piece, path);
            }
        }
        return result;
    }
    PrincipalPuzzle.calculateShapes = calculateShapes;
    function calculateClippedShapes(puzzle) {
        const shapes = calculateShapes(puzzle);
        const rift = calculateRift(puzzle);
        let res = calculateClippedShapes_(shapes, rift, puzzle);
        const RETRY = 5;
        const PERTURBATION = 1e-4;
        for (let n = 0; res === undefined && n < RETRY; n++) {
            const rift_angle = puzzle.rift_angle;
            const rift_offset = puzzle.rift_offset;
            puzzle.rift_angle += (Math.random() - 0.5) * PERTURBATION;
            puzzle.rift_offset += (Math.random() - 0.5) * PERTURBATION;
            const rift = calculateRift(puzzle);
            res = calculateClippedShapes_(shapes, rift, puzzle);
            puzzle.rift_angle = rift_angle;
            puzzle.rift_offset = rift_offset;
        }
        return res;
    }
    PrincipalPuzzle.calculateClippedShapes = calculateClippedShapes;
    function calculateClippedShapes_(shapes, rift, puzzle) {
        var _a, _b, _c, _d;
        const cutted_shapes = new Map();
        // cut corners, edges, boundaries
        for (const [piece, shape] of shapes) {
            if (piece.type === PieceType.CenterPiece) {
                continue;
            }
            if (piece.type === PieceType.InfPiece) {
                continue;
            }
            const res = Geo.cutRegion(shape, rift);
            if (res === undefined) {
                console.warn("fail to clip path: fail to cut regions of normal pieces");
                return undefined;
            }
            append(cutted_shapes, piece, res);
        }
        // cut centers
        let prin_shape0 = undefined;
        {
            const ramified_angles = getRamifiedAngles(puzzle);
            const [left_piece1, left_piece1_ramified_angle] = ramified_angles.left;
            const [right_piece1, right_piece1_ramified_angle] = ramified_angles.right;
            const left_center_pieces = unrollUntilLoopback(left_piece1, piece => piece.edges[3].adj.aff);
            const right_center_pieces = unrollUntilLoopback(right_piece1, piece => piece.edges[3].adj.aff);
            const left_ramified_piece_index = Geo.mod(Math.floor(left_piece1_ramified_angle / (Math.PI * 2 / 3)), 6);
            const left_ramified_piece_index_ = Geo.mod(left_ramified_piece_index + 3, 6);
            const right_ramified_piece_index = 6 - 1 - Geo.mod(Math.floor(right_piece1_ramified_angle / (Math.PI * 2 / 3)), 6);
            const right_ramified_piece_index_ = Geo.mod(right_ramified_piece_index + 3, 6);
            for (const piece of left_center_pieces) {
                const shape = shapes.get(piece);
                const is_ramified = piece === left_center_pieces[left_ramified_piece_index]
                    || piece === left_center_pieces[left_ramified_piece_index_];
                const res = Geo.cutRegion(shape, rift, {
                    index_of_path: 0,
                    incident_with_cut_start_or_end: true,
                    considered_as_incident: is_ramified,
                });
                if (res === undefined) {
                    console.warn("fail to clip path: fail to cut regions of left ramified pieces");
                    return undefined;
                }
                append(cutted_shapes, piece, res);
                if (piece === left_center_pieces[left_ramified_piece_index]) {
                    prin_shape0 = res.find(path => path.segs.some(seg => seg.source.type === Geo.CutSourceType.LeftCut
                        && seg.source.ref === rift.segs[0]
                        && seg.source.from === 0));
                    console.assert(prin_shape0 !== undefined);
                }
            }
            for (const piece of right_center_pieces) {
                const shape = shapes.get(piece);
                const is_ramified = piece === right_center_pieces[right_ramified_piece_index]
                    || piece === right_center_pieces[right_ramified_piece_index_];
                const res = Geo.cutRegion(shape, rift, {
                    index_of_path: 0,
                    incident_with_cut_start_or_end: false,
                    considered_as_incident: is_ramified,
                });
                if (res === undefined) {
                    console.warn("fail to clip path: fail to cut regions of right ramified pieces");
                    return undefined;
                }
                append(cutted_shapes, piece, res);
            }
        }
        if (prin_shape0 === undefined) {
            console.warn("fail to clip path: cannot find principal part");
            return undefined;
        }
        // grow principal part
        const prin_cutted_shapes = new Set();
        prin_cutted_shapes.add(prin_shape0);
        const SMALLEST_ANGLE = 0.01;
        for (const path of prin_cutted_shapes) {
            for (const seg of path.segs) {
                if (seg.source.type !== Geo.CutSourceType.Seg)
                    continue;
                // find adjacent edg
                const edge = seg.source.ref.source;
                for (const adj of getAdjacentEdges(puzzle, edge, shapes)) {
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
                            if (adj_to_ - adj_from_ < SMALLEST_ANGLE)
                                continue;
                            prin_cutted_shapes.add(adj_path);
                            break;
                        }
                    }
                }
            }
        }
        const principal = new Map();
        const complementary = new Map();
        for (const [piece, paths] of cutted_shapes) {
            for (const path of paths) {
                if (prin_cutted_shapes.has(path)) {
                    append(principal, piece, [path]);
                }
                else {
                    append(complementary, piece, [path]);
                }
            }
        }
        return { principal, complementary };
    }
    function getAdjacentEdges(puzzle, edge, shapes) {
        const seg = shapes.get(edge.aff).segs[edge.aff.edges.indexOf(edge)];
        const left_cycle = Puzzle.getCircleEdges(puzzle.space, true, 0);
        const right_cycle = Puzzle.getCircleEdges(puzzle.space, false, 1);
        const left_cycle_adj = left_cycle.map(edge => edge.adj).reverse();
        const right_cycle_adj = right_cycle.map(edge => edge.adj).reverse();
        if (puzzle.state.type === StateType.Aligned
            || puzzle.state.type === StateType.LeftShifted && !left_cycle.includes(edge) && !left_cycle_adj.includes(edge)
            || puzzle.state.type === StateType.RightShifted && !right_cycle.includes(edge) && !right_cycle_adj.includes(edge)) {
            return [{ edge: edge.adj, offset: seg.len, from: 0, to: seg.len }];
        }
        const cycle = [left_cycle, right_cycle, left_cycle_adj, right_cycle_adj].find(cycle => cycle.includes(edge));
        cycle.push(...cycle.splice(0, cycle.indexOf(edge)));
        const res = [];
        if (puzzle.state.angle >= 0) {
            let offset = -puzzle.state.angle;
            for (let n = 0;; n = (n + 1) % cycle.length) {
                const adj_edge = cycle[n].adj;
                const adj_seg = shapes.get(adj_edge.aff).segs[adj_edge.aff.edges.indexOf(adj_edge)];
                const from = Math.max(offset, 0);
                offset += adj_seg.len;
                const to = Math.min(offset, seg.len);
                if (to > from)
                    res.push({ edge: adj_edge, offset, from, to });
                if (offset > seg.len)
                    break;
            }
        }
        else {
            let offset;
            {
                const n = 0;
                const adj_edge = cycle[n].adj;
                const adj_seg = shapes.get(adj_edge.aff).segs[adj_edge.aff.edges.indexOf(adj_edge)];
                offset = -puzzle.state.angle + adj_seg.len;
            }
            for (let n = 0;; n = (n + cycle.length - 1) % cycle.length) {
                const adj_edge = cycle[n].adj;
                const adj_seg = shapes.get(adj_edge.aff).segs[adj_edge.aff.edges.indexOf(adj_edge)];
                const to = Math.min(offset, seg.len);
                offset -= adj_seg.len;
                const from = Math.max(offset, 0);
                if (to > from)
                    res.push({ edge: adj_edge, offset: offset + adj_seg.len, from, to });
                if (offset < 0)
                    break;
            }
            res.reverse();
        }
        return res;
    }
})(PrincipalPuzzle || (PrincipalPuzzle = {}));
function getTextureFunction(puzzle, scale) {
    const d = puzzle.center_x;
    const f1 = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5), Complex.pow(Complex.add(z, Complex.c(-d, 0)), 0.5), Complex.c(scale, 0));
    const f1_ = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5), Complex.pow(Complex.add(z, Complex.c(-d, 0)), 0.5), Complex.c(-scale, 0));
    const f2 = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5), Complex.pow(Complex.mul(Complex.add(z, Complex.c(-d, 0)), Complex.c(-1, 0)), 0.5), Complex.c(0, -scale));
    const f2_ = (z) => Complex.mul(Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5), Complex.pow(Complex.mul(Complex.add(z, Complex.c(-d, 0)), Complex.c(-1, 0)), 0.5), Complex.c(0, scale));
    return [f1, f1_, f2, f2_];
}
export var PrincipalPuzzleWithTexture;
(function (PrincipalPuzzleWithTexture) {
    function _make(puzzle, f, draw_image) {
        const unshifted_positions = new Map(puzzle.space.pieces.map(piece => [piece, Geo.id_trans()]));
        const texture_indices = new Map();
        {
            const edgeL = Puzzle.edgeAt(puzzle.space, 0, [0, 1, -1, 1, 0]);
            const edgeR = Puzzle.edgeAt(puzzle.space, 1, [0, 1, -1, -1, 0]);
            texture_indices.set(edgeL.aff, 3);
            texture_indices.set(Edge.walk(edgeL, [0]).aff, 3);
            texture_indices.set(Edge.walk(edgeL, [2]).aff, 3);
            texture_indices.set(edgeR.aff, 2);
            texture_indices.set(Edge.walk(edgeR, [0]).aff, 2);
            texture_indices.set(Edge.walk(edgeR, [2]).aff, 2);
            const prin = new Set();
            prin.add(Puzzle.edgeAt(puzzle.space, 0, []).aff);
            for (const piece of prin) {
                for (const edge of piece.edges) {
                    const adj_piece = edge.adj.aff;
                    if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
                        prin.add(adj_piece);
                    }
                }
            }
            const comp = new Set();
            comp.add(Puzzle.edgeAt(puzzle.space, 1, []).aff);
            for (const piece of comp) {
                for (const edge of piece.edges) {
                    const adj_piece = edge.adj.aff;
                    if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
                        comp.add(adj_piece);
                    }
                }
            }
            for (const piece of prin)
                texture_indices.set(piece, 0);
            for (const piece of comp)
                texture_indices.set(piece, 1);
        }
        return {
            puzzle,
            unshifted_positions,
            texture_indices,
            textures: [draw_image(f[0]), draw_image(f[1]), draw_image(f[2]), draw_image(f[3])],
        };
    }
    function make(radius, center_x, R, draw_image, scale = 1) {
        const puzzle = PrincipalPuzzle.make(radius, center_x, R);
        return _make(puzzle, getTextureFunction(puzzle, scale), draw_image);
    }
    PrincipalPuzzleWithTexture.make = make;
    function getPositions(puzzle) {
        const positions = new Map(puzzle.unshifted_positions);
        if (puzzle.puzzle.state.type === StateType.LeftShifted) {
            const left_shift_trans = Geo.compose(Geo.translate([puzzle.puzzle.center_x, 0]), Geo.rotate(puzzle.puzzle.state.angle), Geo.translate([-puzzle.puzzle.center_x, 0]));
            for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, true, 0))
                positions.set(piece, Geo.compose(positions.get(piece), left_shift_trans));
        }
        if (puzzle.puzzle.state.type === StateType.RightShifted) {
            const right_shift_trans = Geo.compose(Geo.translate([-puzzle.puzzle.center_x, 0]), Geo.rotate(puzzle.puzzle.state.angle), Geo.translate([puzzle.puzzle.center_x, 0]));
            for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, false, 1))
                positions.set(piece, Geo.compose(positions.get(piece), right_shift_trans));
        }
        return positions;
    }
    PrincipalPuzzleWithTexture.getPositions = getPositions;
    function getClippedImages(puzzle) {
        const positions = getPositions(puzzle);
        const clipped_shapes = PrincipalPuzzle.calculateClippedShapes(puzzle.puzzle);
        if (clipped_shapes === undefined)
            return undefined;
        const res = new Set();
        for (const [piece, shapes] of clipped_shapes.principal) {
            for (const shape of shapes) {
                res.add({
                    image: puzzle.textures[puzzle.texture_indices.get(piece)],
                    region: shape,
                    transformation: positions.get(piece),
                });
            }
        }
        return res;
    }
    PrincipalPuzzleWithTexture.getClippedImages = getClippedImages;
    function twistTo(puzzle, angle, side) {
        PrincipalPuzzle.twistTo(puzzle.puzzle, angle, side);
    }
    PrincipalPuzzleWithTexture.twistTo = twistTo;
    function snap(puzzle) {
        const [side, turn] = PrincipalPuzzle.snap(puzzle.puzzle);
        if (turn === 0)
            return false;
        const twist_trans1 = PrincipalPuzzle.getTwistTransformation(puzzle.puzzle, side, turn > 0);
        let twist_trans = Geo.id_trans();
        for (let n = 0; n < Math.abs(turn); n++)
            twist_trans = Geo.compose(twist_trans, twist_trans1);
        for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, side, 0)) {
            let trans = puzzle.unshifted_positions.get(piece);
            trans = Geo.compose(trans, twist_trans);
            puzzle.unshifted_positions.set(piece, trans);
        }
        return true;
    }
    PrincipalPuzzleWithTexture.snap = snap;
    function setRift(puzzle, angle, offset) {
        PrincipalPuzzle.setRift(puzzle.puzzle, angle, offset);
    }
    PrincipalPuzzleWithTexture.setRift = setRift;
})(PrincipalPuzzleWithTexture || (PrincipalPuzzleWithTexture = {}));
;
//# sourceMappingURL=Model.js.map
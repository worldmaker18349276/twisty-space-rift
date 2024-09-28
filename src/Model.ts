import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";
import {assert, indices, mod, zip, rotate, unrollUntilLoopback, append, applyPerm, cmpOn, cmp, cyclicSort, reversePerm} from "./Utils.js";

export type Edge = {
  aff: Piece;
  next_: Edge;
  prev_: Edge;
  adj: Edge;
  auxiliary: boolean;
};

export namespace Edge {
  export function next(edge: Edge): Edge {
    assert(!edge.auxiliary);
    let next = edge.next_;
    while (next.auxiliary) {
      next = next.adj.next_;
    }
    return next;
  }
  export function prev(edge: Edge): Edge {
    assert(!edge.auxiliary);
    let prev = edge.prev_;
    while (prev.auxiliary) {
      prev = prev.adj.prev_;
    }
    return prev;
  }
  export function walk(edge: Edge, steps: number[]): Edge {
    assert(!edge.auxiliary);
    for (const step of steps) {
      if (step > 0) {
        for (const _ of indices(Math.abs(step))) {
          edge = Edge.next(edge);
        }
      } else {
        for (const _ of indices(Math.abs(step))) {
          edge = Edge.prev(edge);
        }
      }
      edge = edge.adj;
    }
    return edge;
  }
}

export enum PieceType { CornerPiece, EdgePiece, CenterPiece, BoundaryPiece, InfPiece }

export type Piece = {
  type: PieceType;
  edges: Edge[];
  name: string;
};

export enum StateType { Aligned, LeftShifted, RightShifted }

export type State =
  | { type: StateType.Aligned }
  | { type: StateType.LeftShifted, angle: Geo.Angle }
  | { type: StateType.RightShifted, angle: Geo.Angle };

export type Puzzle = {
  pieces: Piece[];
  stands: Edge[]; // boundary piece's edges at the top intersection point
  ramified: {pieces:Piece[], turn:number}[];
  states: State[];

  radius: Geo.Distance;
  center_x: Geo.Distance;
  R: Geo.Distance;
};

export type PuzzleFactory = {
  make_pieces: () => {pieces:Piece[], stands:Edge[], ramified:{pieces:Piece[], turn:number}[]},
};

export namespace Puzzle {
  function makeEdge(piece: Piece): Edge {
    const edge = {
      aff: piece,
      next_: undefined,
      prev_: undefined,
      adj: undefined,
      auxiliary: false,
    } as unknown as Edge;
    edge.next_ = edge;
    edge.prev_ = edge;
    edge.adj = edge;
    return edge;
  }

  function linkEdges(edge1: Edge, edge2: Edge): void {
    edge1.next_ = edge2;
    edge2.prev_ = edge1;
  }

  function adjEdges(edge1: Edge, edge2: Edge): void {
    edge1.adj = edge2;
    edge2.adj = edge1;
  }

  // edges[i] <-> edges[i+1].adj
  export function swapAdj(...edges: Edge[]): void {
    const adj_edges = rotate(edges, 1).map(edge => edge.adj);
    for (const [edge, adj_edge] of zip(edges, adj_edges))
      adjEdges(edge, adj_edge);
  }

  function makeEdges(piece: Piece, n: number): Piece {
    piece.edges = indices(n).map(_ => makeEdge(piece));
    for (const i of indices(n)) {
      linkEdges(piece.edges[i], piece.edges[mod(i + 1, piece.edges.length)]);
    }
    return piece;
  }

  function makeCornerPiece(name: string): Piece {
    return makeEdges({type: PieceType.CornerPiece, edges: [], name}, 3);
  }

  function makeEdgePiece(name: string): Piece {
    return makeEdges({type: PieceType.EdgePiece, edges: [], name}, 4);
  }

  function makeBoundaryPiece(name: string): [Piece, Piece, Piece] {
    // edges[0]: edge started with below intersection point
    const pieceBL = makeEdges({type: PieceType.BoundaryPiece, edges: [], name: name + "L"}, 12);
    // edges[0]: edge started with above intersection point
    const pieceBR = makeEdges({type: PieceType.BoundaryPiece, edges: [], name: name + "R"}, 12);

    const pieceINF = makeEdges({type: PieceType.InfPiece, edges: [], name: name + "INF"}, 2);

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

  function makeCenterPiece(name: string): Piece {
    return makeEdges({type: PieceType.CenterPiece, edges: [], name}, 6);
  }

  export function ramifyPiece(name: string, pieces: Piece[], n: number): Piece {
    const edges = rotate(pieces.flatMap(piece => rotate(piece.edges, n)), -n);
    const type = pieces[0].type;
    const piece: Piece = {type, edges, name};
    for (const i of indices(edges.length)) {
      linkEdges(edges[i], edges[mod(i + 1, edges.length)]);
      edges[i].aff = piece;
    }
    return piece;
  }

  export function chunkPiece(name: string, piece: Piece, step: number): Piece[] {
    assert(piece.edges.length % step == 0);
    
    const subpieces: Piece[] = [];
    for (const n of indices(piece.edges.length / step)) {
      const type = piece.type;
      const subpiece: Piece = {type, edges: [], name: `${name}${n}`};
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

  export function edgeAt(puzzle: Puzzle, sheet: number, steps: number[]): Edge {
    return Edge.walk(puzzle.stands[sheet], steps);
  }

  export function makePieces(suffix: string = ""): {pieces:Piece[], stand:Edge} {
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

  function ckeckPuzzleShape(radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): void {
    assert(center_x > 0);
    assert(radius > 0);
    assert(center_x < radius);
    assert(center_x * 2 > radius);
    assert(R > center_x + radius);
  }
  export function makePuzzle(factory: PuzzleFactory, radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): Puzzle {
    ckeckPuzzleShape(radius, center_x, R);
    const {pieces, stands, ramified} = factory.make_pieces();
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

  // side = true: left
  export function getTwistEdges(puzzle: Puzzle, side: boolean, sheet: number): Edge[] {
    const edge0 =
      side ? edgeAt(puzzle, sheet, [-1, -1, -2, -1, 0])
      : edgeAt(puzzle, sheet, [0, 1, 2, 1, 0]);
    return unrollUntilLoopback(edge0, edge => Edge.walk(edge, [1, 1, 0]));
  }
  // side = true: left
  export function getTwistPieces(
    puzzle: Puzzle,
    side: boolean,
    sheet: number,
  ): {pieces:Set<Piece>, sheets:Set<number>} | undefined {
    const boundaries = indices(puzzle.stands.length).map(sheet => getTwistEdges(puzzle, side, sheet));
    const sheets = new Set<number>();
    const pieces = new Set<Piece>();
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

    if (
      Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.Aligned)
      || Array.from(sheets).every(sheet => side && puzzle.states[sheet].type === StateType.LeftShifted)
      || Array.from(sheets).every(sheet => !side && puzzle.states[sheet].type === StateType.RightShifted)
    )
      return {pieces, sheets};

    return undefined;
  }

  // side = true: left
  function twistSnapped(puzzle: Puzzle, side: boolean, sheet: number, forward: boolean): void {
    const {sheets} = getTwistPieces(puzzle, side, sheet)!;
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
  export function setShift(puzzle: Puzzle, side: boolean, sheets: Set<number>, angle: Geo.Angle): void {
    if (side && Array.from(sheets).every(sheet => puzzle.states[sheet].type !== StateType.RightShifted)) {
      assert(
        Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.LeftShifted)
        || Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.Aligned)
      );
      puzzle.states = puzzle.states.map((state, sheet) =>
        sheets.has(sheet) ? ({ type: StateType.LeftShifted, angle: angle }) : state
      );

    } else if (!side && Array.from(sheets).every(sheet => puzzle.states[sheet].type !== StateType.LeftShifted)) {
      assert(
        Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.RightShifted)
        || Array.from(sheets).every(sheet => puzzle.states[sheet].type === StateType.Aligned)
      );
      puzzle.states = puzzle.states.map((state, sheet) =>
        sheets.has(sheet) ? ({ type: StateType.RightShifted, angle: angle }) : state
      );

    } else {
      assert(false);
    }
  }
  export function snap(puzzle: Puzzle): {side: boolean, sheets: Set<number>, turn: number}[] {
    const ANGLE_EPS = 1e-8;

    const actions: {side: boolean, sheets: Set<number>, turn: number}[] = [];

    for (const sheet of indices(puzzle.states.length)) {
      const state = puzzle.states[sheet];
      if (state.type === StateType.Aligned) continue;
      const turn = Math.round(state.angle / (Math.PI/3));
      const err = Math.abs(state.angle - Math.round(state.angle / (Math.PI/3)) * (Math.PI/3));
      if (err > ANGLE_EPS) continue;
      const side = state.type === StateType.LeftShifted;
      const {sheets} = getTwistPieces(puzzle, side, sheet)!;
      for (const sheet of sheets)
        puzzle.states[sheet] = { type: StateType.Aligned };
      for (const _ of indices(Math.abs(turn)))
        twistSnapped(puzzle, side, sheet, turn > 0);
      actions.push({side, sheets, turn});
    }
    return actions;
  }
  export function isAligned(puzzle: Puzzle): boolean {
    return puzzle.states.every(state => state.type === StateType.Aligned);
  }
}

export namespace Puzzle {
  export function getTwistCircles(puzzle: Puzzle): [left:Geo.DirectionalCircle, right:Geo.DirectionalCircle] {
    return [
      { center: [-puzzle.center_x, 0], radius: puzzle.radius },
      { center: [+puzzle.center_x, 0], radius: puzzle.radius },
    ];
  }
  export function getTwistTransformation(puzzle: Puzzle, side: boolean, forward: boolean): Geo.RigidTransformation {
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
  export function getShiftTransformations(puzzle: Puzzle): {trans:Geo.RigidTransformation, side:boolean, sheets:Set<number>}[] {
    const [left_circle, right_circle] = getTwistCircles(puzzle);
    const res: {trans:Geo.RigidTransformation, side:boolean, sheets: Set<number>}[] = [];
    const visited_sheets: number[] = [];
    for (const sheet of indices(puzzle.states.length)) {
      const state = puzzle.states[sheet];
      if (visited_sheets.includes(sheet)) continue;
      if (state.type === StateType.Aligned) continue;
      const side = state.type === StateType.LeftShifted;
      const {sheets} = getTwistPieces(puzzle, side, sheet)!;
      const trans =
        side ? Geo.rotateAround(state.angle, left_circle.center)
        : Geo.rotateAround(state.angle, right_circle.center);
      res.push({trans, side, sheets});
      visited_sheets.push(...sheets);
    }
    return res;
  }

  type Arc = {
    start: Geo.Point,
    end: Geo.Point,
    auxiliary_point: Geo.Point,
    circle: Geo.DirectionalCircle,
  };
  function transformArc(arc: Arc, trans: Geo.RigidTransformation): Arc {
    return {
      start: Geo.transformPoint(arc.start, trans),
      end: Geo.transformPoint(arc.end, trans),
      auxiliary_point: Geo.transformPoint(arc.auxiliary_point, trans),
      circle: Geo.transformCircle(arc.circle, trans),
    };
  }
  function flipArc(arc: Arc): Arc {
    return {
      start: arc.end,
      end: arc.start,
      auxiliary_point: arc.auxiliary_point,
      circle: Geo.flipCircle(arc.circle),
    };
  }

  function calculateArcs(puzzle: Puzzle): Map<Edge, Arc> {
    const left_trans = getTwistTransformation(puzzle, true, true);
    const right_trans = getTwistTransformation(puzzle, false, true);
    const [left_circle, right_circle] = getTwistCircles(puzzle);
    
    const intersections = Geo.intersectCircles(left_circle, right_circle);
    assert(intersections !== undefined);
    const p0 = intersections!.points[1];
    const p1 = Geo.transformPoint(p0, right_trans);
    const p2 = Geo.transformPoint(p1, left_trans);
    const auxiliary_point: Geo.Point = [0, puzzle.center_x / Math.sqrt(3)];
    const short_edge_angle = Geo.angleBetween(right_circle.center, p2, p1);

    const arcs = new Map<Edge, Arc>();
    arcs.set(
      Puzzle.edgeAt(puzzle, 0, [0, 1, 1, 0]),
      { start: p0, end: p2, auxiliary_point, circle: right_circle },
    );
    arcs.set(
      Puzzle.edgeAt(puzzle, 0, [0, 1, -1, 1, 0]),
      { start: p2, end: p1, auxiliary_point, circle: right_circle },
    );

    for (const [edge, arc] of arcs) {
      if (!arcs.has(edge.adj)) {
        arcs.set(edge.adj, flipArc(arc));
      }
      if (!arcs.has(Edge.next(edge))) {
        if (edge.aff.type === PieceType.CornerPiece) {
          arcs.set(
            Edge.next(edge),
            transformArc(arc, Geo.rotateAround(Math.PI*2/3, arc.auxiliary_point)),
          );

        } else if (edge.aff.type === PieceType.EdgePiece && edge.adj.aff.type === PieceType.CornerPiece) {
          const circle = Geo.transformCircle(
            Geo.flipCircle(arc.circle),
            Geo.rotateAround(-Math.PI*2/3, arc.auxiliary_point),
          );
          const end = Geo.transformPoint(arc.end, Geo.rotateAround(short_edge_angle, circle.center));
          arcs.set(
            Edge.next(edge),
            { start: arc.end, end, auxiliary_point: arc.auxiliary_point, circle },
          );

        } else if (edge.aff.type === PieceType.EdgePiece && edge.adj.aff.type !== PieceType.CornerPiece) {
          const auxiliary_point = Geo.transformPoint(
            arc.auxiliary_point,
            Geo.rotateAround(Math.PI/3, arc.circle.center)
          );
          const circle = Geo.transformCircle(
            Geo.flipCircle(arc.circle),
            Geo.rotateAround(-Math.PI*2/3, auxiliary_point),
          );
          const end = Geo.transformPoint(
            arc.end,
            Geo.rotateAround(-Math.PI*2/3, auxiliary_point),
          );
          arcs.set(
            Edge.next(edge),
            { start: arc.end, end, auxiliary_point, circle },
          );
        }
      }
    }

    for (const shift_trans of getShiftTransformations(puzzle)) {
      const [sheet] = shift_trans.sheets;
      const {pieces} = getTwistPieces(puzzle, shift_trans.side, sheet)!;
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
  function calculateBoundaryShapes(puzzle: Puzzle, arcs: Map<Edge, Arc>, sheet: number): Map<Piece, Geo.Path<Edge>> {
    const pieceBR = Puzzle.edgeAt(puzzle, sheet, []).aff;
    const pieceBL = Puzzle.edgeAt(puzzle, sheet, [-1, 0]).aff;

    const circle: Geo.DirectionalCircle = { center: [0, 0], radius: puzzle.R };
    const top: Geo.Point = [0, puzzle.R];
    const bot: Geo.Point = [0, -puzzle.R];

    return new Map([pieceBL, pieceBR].map(piece => {
      const path: Geo.Path<Edge> = { is_closed: true, segs: [] };
      for (const edge of piece.edges.slice(0, 9)) {
        const arc = arcs.get(edge)!;
        path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
      }
      const p1 = arcs.get(piece.edges[8])!.end;
      const p2 = p1[1] > 0 ? top : bot;
      const p3 = p1[1] > 0 ? bot : top;
      const p4 = arcs.get(piece.edges[0])!.start;
      path.segs.push(Geo.makePathSegLine(p1, p2, piece.edges[9]));
      path.segs.push(Geo.makePathSegArc(p2, p3, circle, piece.edges[10]));
      path.segs.push(Geo.makePathSegLine(p3, p4, piece.edges[11]));
      return [piece, path];
    }));
  }
  export function calculateShapes(puzzle: Puzzle): Map<Piece, Geo.Path<Edge>> {
    const arcs = calculateArcs(puzzle);

    const branch_points = puzzle.ramified.map(({pieces}) => {
      const points = pieces
        .flatMap(piece => piece.edges.slice(1, piece.edges.length - 1))
        .map(edge => arcs.get(edge)!)
        .map(arc => arc.start);
      return Geo.mul(points.reduce(Geo.add), 1/points.length);
    });

    const result = new Map<Piece, Geo.Path<Edge>>();

    for (const piece of puzzle.pieces) {
      if (piece.type === PieceType.BoundaryPiece)
        continue;
      if (piece.type === PieceType.InfPiece)
        continue;

      const ramified = puzzle.ramified.find(({pieces}) => pieces.includes(piece));
      if (ramified !== undefined) {
        const branch_point = branch_points[puzzle.ramified.indexOf(ramified)];
        const path: Geo.Path<Edge> = { is_closed: true, segs: [] };
        {
          const arc_ = arcs.get(piece.edges[1])!;
          path.segs.push(Geo.makePathSegLine(branch_point, arc_.start, piece.edges[0]));
        }
        for (const edge of piece.edges.slice(1, piece.edges.length - 1)) {
          const arc = arcs.get(edge)!;
          path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
        }
        {
          const arc_ = arcs.get(piece.edges[piece.edges.length - 2])!;
          path.segs.push(Geo.makePathSegLine(arc_.end, branch_point, piece.edges[piece.edges.length - 1]));
        }
        result.set(piece, path);
 
      } else {
        const path: Geo.Path<Edge> = { is_closed: true, segs: [] };
        for (const edge of piece.edges) {
          const arc = arcs.get(edge)!;
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

  function getEdgeAngles(puzzle: Puzzle): [angle1:Geo.Angle, angle2:Geo.Angle] {
    const left_trans = getTwistTransformation(puzzle, true, true);
    const right_trans = getTwistTransformation(puzzle, false, true);
    const [left_circle, right_circle] = getTwistCircles(puzzle);
    
    const intersections = Geo.intersectCircles(left_circle, right_circle);
    assert(intersections !== undefined);
    const p0 = intersections.points[1];
    const p1 = Geo.transformPoint(p0, right_trans);
    const p2 = Geo.transformPoint(p1, left_trans);
    const ang = Geo.angleBetween(right_circle.center, p2, p1);
    return [ang, Math.PI/3 - ang];
  }
  function getEdgeAngleType(edge: Edge): boolean {
    assert(!edge.auxiliary);
    return edge.aff.type === PieceType.EdgePiece
      && edge.adj.aff.type !== PieceType.CornerPiece
      || edge.aff.type === PieceType.BoundaryPiece
      && edge.adj.aff.type === PieceType.EdgePiece
      || edge.aff.type === PieceType.CenterPiece
      && edge.adj.aff.type === PieceType.EdgePiece;
  }
  export function getAdjacentEdges(
    puzzle: Puzzle, edge: Edge
  ): {edge:Edge, offset:Geo.Angle, from:Geo.Angle, to:Geo.Angle}[] {
    assert(!edge.auxiliary);
    
    const [short_angle, long_angle] = getEdgeAngles(puzzle);
    const angle = getEdgeAngleType(edge) ? short_angle : long_angle;

    const cycles = getShiftTransformations(puzzle)
      .flatMap(shifted_trans => Array.from(shifted_trans.sheets).map(sheet =>
        [
          getTwistEdges(puzzle, shifted_trans.side, sheet),
          sheet,
        ] as const
      ))
      .flatMap(([cycle, sheet]) => [
        [cycle, sheet] as const,
        [cycle.map(edge => edge.adj).reverse(), sheet] as const,
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

    const res: {edge:Edge, offset:Geo.Angle, from:Geo.Angle, to:Geo.Angle}[] = [];
    if (shifted_angle >= 0) {
      let offset = -shifted_angle;
      for (let n = 0;; n = mod(n + 1, cycle_rotated.length)) {
        const adj_edge = cycle_rotated[n].adj;
        const adj_angle = getEdgeAngleType(adj_edge) ? short_angle : long_angle;
        const from = Math.max(offset, 0);
        offset += adj_angle;
        const to = Math.min(offset, angle);
        if (to > from)
          res.push({edge:adj_edge, offset, from, to});
        if (offset > angle)
          break;
      }
    } else {
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
          res.push({edge:adj_edge, offset:offset + adj_angle, from, to});
        if (offset < 0)
          break;
      }
      res.reverse();
    }

    return res;
  }
}

export type HyperbolicPolarCoordinate = {offset: number, angle: Geo.Angle};

export namespace HyperbolicPolarCoordinate {
  // `offset` is the offset of the hyperbola curve
  // `angle` is the angle of vector from the focus to the point on the hyperbola curve
  // when offset < 0: `angle` is the angle `(f1, f2, point)`
  // when offset > 0: `angle` is the angle `(f2, point, f1)`
  // `is_solid` means if `point` is on the main focus side
  export function getHyperbolaPoint(f1: Geo.Point, f2: Geo.Point, coord: HyperbolicPolarCoordinate): [point:Geo.Point, is_solid:boolean] {
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
    } else {
      const d = Geo.normalize(Geo.sub(f1, f2));
      const d_ = Geo.transform(d, Geo.rotate(-coord.angle));
      return [Geo.add(f2, Geo.mul(d_, r)), r > 0];
    }
  }
  export function getCoordinateFromPoint(f1: Geo.Point, f2: Geo.Point, point: Geo.Point): HyperbolicPolarCoordinate {
    const a = (Geo.norm(Geo.sub(f1, point)) - Geo.norm(Geo.sub(f2, point))) / 2;
    const offset = a / (Geo.norm(Geo.sub(f1, f2)) / 2);
    const angle = offset < 0 ? Geo.angleBetween(f1, f2, point) : Geo.angleBetween(f2, point, f1);
    return {offset, angle};
  }
  function makeSameTurn(angle: number, ref_angle: number): number {
    const angle_to_0 = Math.abs(Geo.as_npi_pi(ref_angle));
    if (angle_to_0 < Math.PI/2) {
      const n = Math.floor((ref_angle + Math.PI) / (Math.PI*2));
      return Geo.as_npi_pi(angle) + n * Math.PI*2;
    } else {
      const n = Math.floor(ref_angle / (Math.PI*2));
      return Geo.as_0_2pi(angle) + n * Math.PI*2;
    }
  }
  function computeLeftAngle(offset: number, right_angle: Geo.Angle): Geo.Angle {
    const s = Math.sin(right_angle);
    const c = Math.cos(right_angle);
    const left_angle = Math.atan2(s, offset + c) - Math.atan2(offset*s, offset*c + 1);
    return makeSameTurn(left_angle, right_angle);
  }
  export function getFocusAngles(coord: HyperbolicPolarCoordinate): [left_angle:Geo.Angle, right_angle:Geo.Angle] {
    if (coord.offset < 0) {
      return [coord.angle, computeLeftAngle(-coord.offset, coord.angle)];
    } else {
      return [computeLeftAngle(coord.offset, coord.angle), coord.angle];
    }
  }
  export function getCoordinateFromAngles(left_angle: Geo.Angle, right_angle: Geo.Angle): HyperbolicPolarCoordinate {
    const offset = (Math.sin(right_angle) - Math.sin(left_angle)) / Math.sin(left_angle + right_angle);
    const angle = offset > 0 ? right_angle : left_angle;
    return {offset, angle};
  }
  export function offsetTo(coord: HyperbolicPolarCoordinate, offset: number): HyperbolicPolarCoordinate {
    const [left_angle, right_angle] = getFocusAngles(coord);
    if (coord.offset > offset) {
      if (offset < 0) {
        return {offset, angle:computeLeftAngle(offset, right_angle)};
      } else {
        return {offset, angle:right_angle};
      }

    } else {
      if (offset < 0) {
        return {offset, angle:left_angle};
      } else {
        return {offset, angle:computeLeftAngle(-offset, left_angle)};
      }
    }
  }
}

export type PrincipalPuzzle = Puzzle & {
  // correspond to ramified
  branch_points: {point:Geo.Point, cut_angle:Geo.Angle, order:number[], rel_angles:Geo.Angle[]}[];
  rifts: {left:number, right:number, coord:HyperbolicPolarCoordinate}[];
  rift_hierarchy: [below:number, above:number][];
};

export type PrincipalPuzzleFactory = PuzzleFactory & {
  make_rifts: (radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance) => {
    branch_points: {point:Geo.Point, cut_angle:Geo.Angle, order:number[]}[];
    rifts: {left:number, right:number, coord:HyperbolicPolarCoordinate}[];
    rift_hierarchy: [below:number, above:number][];
  },
};

export namespace PrincipalPuzzle {
  const MAX_RIFT_OFFSET = 0.8;

  export function makePuzzle(factory: PrincipalPuzzleFactory, radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): PrincipalPuzzle {
    const puzzle = Puzzle.makePuzzle(factory, radius, center_x, R);
    const rifts = factory.make_rifts(radius, center_x, R);
    const branch_points = rifts.branch_points.map((branch_point, index) => {
      const rel_angles = rifts.rifts.map(rift => {
        if (index === rift.left || index === rift.right) {
          return 0;
        } else {
          let coord = HyperbolicPolarCoordinate.getCoordinateFromPoint(
            rifts.branch_points[rift.left].point,
            rifts.branch_points[rift.right].point,
            branch_point.point,
          );
          coord = HyperbolicPolarCoordinate.offsetTo(coord, rift.coord.offset);
          return Geo.as_0_2pi(coord.angle - rift.coord.angle);
        }
      });
      return {...branch_point, rel_angles};
    });

    return {
      ...puzzle,
      branch_points,
      rifts: rifts.rifts,
      rift_hierarchy: rifts.rift_hierarchy,
    };
  }

  function computeRiftRelAngles(
    branch_points: {point:Geo.Point, cut_angle:Geo.Angle, order:number[], rel_angles:Geo.Angle[]}[],
    new_rifts: {left:number, right:number, coord:HyperbolicPolarCoordinate}[],
  ): {
    rel_angless: Geo.Angle[][],
    cross_hierarchy: [below:number, above:number][],
  } | undefined {
    const rel_angless_ = branch_points.map((branch_point, pindex) =>
      new_rifts.map(rift => {
        if (pindex === rift.left || pindex === rift.right) {
          return 0;
        } else {
          let coord = HyperbolicPolarCoordinate.getCoordinateFromPoint(
            branch_points[rift.left].point,
            branch_points[rift.right].point,
            branch_point.point,
          );
          coord = HyperbolicPolarCoordinate.offsetTo(coord, rift.coord.offset);
          return coord.angle - rift.coord.angle;
        }
      })
      .map((rel_angle, rift_index) => {
        const prev_rel_angle = branch_point.rel_angles[rift_index];
        return Geo.as_npi_pi(rel_angle - prev_rel_angle) + prev_rel_angle;
      })
    );

    // validate rifts crossing branch points
    const crosses = rel_angless_.map(rel_angles => rel_angles.map(rel_angle => Math.floor(rel_angle / (Math.PI*2))));
    if (crosses.some(cross => cross.some(i => Math.abs(i) > 1))) {
      console.warn("crossing a rift too many times");
      return undefined;
    }
    if (crosses.some(cross => cross.filter(i => i !== 0).length > 1)) {
      console.warn("crossing multiple rifts at the same time");
      return undefined;
    }
    if (new_rifts.some(({left, right}) => crosses[left].some(j => j !== 0) && crosses[right].some(j => j !== 0))) {
      console.warn("two endpoints of a rift crossing at the same time");
      return undefined;
    }

    const rel_angless = zip(crosses, rel_angless_)
      .map(([cross, rel_angles]) => zip(cross, rel_angles)
        .map(([turn, rel_angle]) => rel_angle - turn * Math.PI * 2)
      );
    const cross_hierarchy = crosses.flatMap((cross, i) =>
      cross.flatMap((turn, j) => (turn === 0 ? [] : [[i, j]]) as [number, number][]));
    return {
      rel_angless,
      cross_hierarchy,
    };
  }
  function getInfRadius(puzzle: PrincipalPuzzle, rift: {left:number, right:number}): number {
    return puzzle.R * 1.5 + Math.max(rift.left, rift.right) * puzzle.radius / 10;
  }
  function calculateRiftShape(
    left_point: Geo.Point,
    right_point: Geo.Point,
    coord: HyperbolicPolarCoordinate,
    inf_radius: number,
  ): Geo.Path<undefined> {
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
    
    function calculateInfPoint(from: Geo.Point, to: Geo.Point, flip: boolean, radius: number): Geo.Point {
      let dir = Geo.normalize(Geo.sub(to, from));
      if (flip) dir = Geo.mul(dir, -1);
      const s = Geo.cross(dir, from);
      const dis = Math.sqrt(radius * radius - s * s) - Geo.dot(dir, from);
      return Geo.add(from, Geo.mul(dir, dis));
    }
    const left_inf = calculateInfPoint(left_point, middle, !is_solid, inf_radius);
    const right_inf = calculateInfPoint(right_point, middle, !is_solid, inf_radius);
    const inf_circle: Geo.DirectionalCircle = { center: [0,0], radius: inf_radius };
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
  function cutRiftShapes(
    puzzle: PrincipalPuzzle,
    rifts: {left:number, right:number, coord:HyperbolicPolarCoordinate}[],
    rift_shapes: Geo.Path<undefined>[],
    cross_hierarchy: [below:number, above:number][],
  ): {
    orders: number[][],
    cutted_rift_shapes: Geo.Path<Geo.CutSourceSeg<undefined>>[],
    rift_perms: Map<Geo.PathSeg<Geo.CutSourceSeg<undefined>>, number[]>,
    rift_hierarchy: [below:number, above:number][],
  } | undefined {
    function isAbove(dag: [below:number, above:number][], below: number, above: number): boolean {
      return dag.some(([i, j]) => i === below && j === above)
          || dag.some(([i, j]) => i === below && isAbove(dag, j, above));
    }
    function allAbove(dag: [below:number, above:number][], below: number): Set<number> {
      const res = new Set<number>([below]);
      for (const curr of res)
        for (const [i, j] of dag)
          if (i === curr)
            res.add(j);
      res.delete(below);
      return res;
    }

    const crossing_branch_point_indices = new Set(cross_hierarchy.map(([i, j]) => i));

    // calculate transferred rift hierarchy
    const transferred_rift_hierarchy = [...puzzle.rift_hierarchy];
    for (const [below, above] of cross_hierarchy) {
      if (isAbove(transferred_rift_hierarchy, above, below)) {
        console.warn("try to cross the rift above from below");
        return undefined;
      }
      transferred_rift_hierarchy.push([below, above]);
    }

    // calculate rift intersections
    type RiftIntersectionInfo = {
      below_pos: readonly [rift_index: number, seg_index: number, t: number];
      above_pos: readonly [rift_index: number, seg_index: number, t: number];
      ccw: boolean,
    };
    function assignHierarchy(index1: number, index2: number) {
      if (isAbove(transferred_rift_hierarchy, index1, index2)) {
        return true;
      }
      if (isAbove(transferred_rift_hierarchy, index2, index1)) {
        return false;
      }
      // TODO: determine based on context
      transferred_rift_hierarchy.push([index1, index2]);
      return true;
    }
    const rift_intersections: RiftIntersectionInfo[] = indices(rift_shapes.length)
      .flatMap(j => indices(j).map(i => [i, j] as const))
      .flatMap(([index1, index2]) =>
        Geo.intersectPaths(rift_shapes[index1], rift_shapes[index2])!
          .map(info => ({
            pos1: [index1, ...info.pos1] as const,
            pos2: [index2, ...info.pos2] as const,
            ccw: info.ccw,
          }))
          .map(info => assignHierarchy(index1, index2) ?
            {below_pos: info.pos1, above_pos: info.pos2, ccw: info.ccw}
          : {below_pos: info.pos2, above_pos: info.pos1, ccw: !info.ccw}
          )
      );

    // determine permutations around intersection points
    const intersection_above_perms = new Map<RiftIntersectionInfo, number[]>();
    const intersection_below_perms = new Map<RiftIntersectionInfo, {prev:number[], post:number[]}>();
    const sorted_rift_indices = indices(rifts.length)
      .sort(cmpOn(rift_index => [allAbove(transferred_rift_hierarchy, rift_index).size]));
    for (const rift_index of sorted_rift_indices) {
      // find permutations for each crossing
      const sorted_intersections = rift_intersections
        .filter(info => info.below_pos[0] === rift_index || info.above_pos[0] === rift_index)
        .sort(cmpOn(info => info.below_pos[0] === rift_index ? info.below_pos : info.above_pos));
      const cross_perms = sorted_intersections
        .map(info => {
          if (info.above_pos[0] === rift_index) return [];
          const above_perm = intersection_above_perms.get(info);
          assert(above_perm !== undefined);
          return info.ccw ? [...above_perm].reverse() : above_perm;
        });

      // determine permutations around intersections of this rift
      const left_crossing = crossing_branch_point_indices.has(rifts[rift_index].left);
      const right_crossing = crossing_branch_point_indices.has(rifts[rift_index].right);
      assert(!left_crossing || !right_crossing);
      if (!left_crossing) {
        // from left
        let perm = cyclicSort(puzzle.branch_points[rifts[rift_index].left].order);
        for (const [info, cross_perm] of zip(sorted_intersections, cross_perms)) {
          if (info.above_pos[0] === rift_index) {
            assert(!intersection_above_perms.has(info));
            intersection_above_perms.set(info, perm);
          } else {
            const prev = perm;
            perm = cyclicSort(perm.map(v => applyPerm(cross_perm, 1, v)));
            const post = perm;
            assert(!intersection_below_perms.has(info));
            intersection_below_perms.set(info, {prev, post});
          }
        }
      } else {
        // from right
        let perm = reversePerm(cyclicSort(puzzle.branch_points[rifts[rift_index].right].order));
        for (const [info, cross_perm] of zip(sorted_intersections, cross_perms).reverse()) {
          if (info.above_pos[0] === rift_index) {
            assert(!intersection_above_perms.has(info));
            intersection_above_perms.set(info, perm);
          } else {
            const post = perm;
            perm = cyclicSort(perm.map(v => applyPerm(cross_perm, -1, v)));
            const prev = perm;
            assert(!intersection_below_perms.has(info));
            intersection_below_perms.set(info, {prev, post});
          }
        }
      }
    }

    // determine and check orders of branch points
    const orders: number[][] = [];
    for (const rift_index of indices(rifts.length)) {
      const sorted_intersections = rift_intersections
        .filter(info => info.below_pos[0] === rift_index || info.above_pos[0] === rift_index)
        .sort(cmpOn(info => info.below_pos[0] === rift_index ? info.below_pos : info.above_pos));

      const left_crossing = crossing_branch_point_indices.has(rifts[rift_index].left);
      const right_crossing = crossing_branch_point_indices.has(rifts[rift_index].right);
      const left_order = puzzle.branch_points[rifts[rift_index].left].order;
      const right_order = reversePerm(puzzle.branch_points[rifts[rift_index].right].order);
      assert(!left_crossing || !right_crossing);
      if (!left_crossing) {
        // from left
        let order = left_order;
        for (const info of sorted_intersections) {
          if (info.above_pos[0] === rift_index) {
            const {prev, post} = intersection_below_perms.get(info)!;
            const perm = info.ccw ? prev : reversePerm(post);
            order = order.map(v => applyPerm(perm, 1, v));
          } else {
            const perm_ = intersection_above_perms.get(info)!;
            const perm = info.ccw ? reversePerm(perm_) : perm_;
            order = order.map(v => applyPerm(perm, 1, v));
          }
        }
        orders[rifts[rift_index].left] = left_order;
        orders[rifts[rift_index].right] = reversePerm(order);
      } else {
        // from right
        let order = right_order;
        for (const info of [...sorted_intersections].reverse()) {
          if (info.above_pos[0] === rift_index) {
            const {prev, post} = intersection_below_perms.get(info)!;
            const perm = info.ccw ? prev : reversePerm(post);
            order = order.map(v => applyPerm(perm, -1, v));
          } else {
            const perm_ = intersection_above_perms.get(info)!;
            const perm = info.ccw ? reversePerm(perm_) : perm_;
            order = order.map(v => applyPerm(perm, -1, v));
          }
        }
        orders[rifts[rift_index].left] = order;
        orders[rifts[rift_index].right] = reversePerm(right_order);
      }

      if (!left_crossing) {
        const index = rifts[rift_index].left;
        if (cmp(orders[index], puzzle.branch_points[index].order) !== 0) {
          console.warn("branch point's order changes without crossing");
          return undefined;
        }
      }
      if (!right_crossing) {
        const index = rifts[rift_index].right;
        if (cmp(orders[index], puzzle.branch_points[index].order) !== 0) {
          console.warn("branch point's order changes without crossing");
          return undefined;
        }
      }
    }

    // cut rifts and determine permutations of each segments
    const cutted_rift_shapes: Geo.Path<Geo.CutSourceSeg<undefined>>[] = [];
    const rift_perms = new Map<Geo.PathSeg<Geo.CutSourceSeg<undefined>>, number[]>();
    for (const rift_index of indices(rifts.length)) {
      const sorted_below_intersections = rift_intersections
        .filter(info => info.below_pos[0] === rift_index)
        .filter(info => {
          const {prev, post} = intersection_below_perms.get(info)!;
          return cmp(prev, post) !== 0;
        })
        .sort(cmpOn(info => info.below_pos));

      const seg_perms = sorted_below_intersections
        .map(info => intersection_below_perms.get(info)!.post);
      seg_perms.unshift(cyclicSort(orders[rifts[rift_index].left]));

      const rift_shape = rift_shapes[rift_index];
      assert(!rift_shape.is_closed);
      const start_pos: [number, number] = [0, 0];
      const end_pos: [number, number] = [rift_shape.segs.length-1, rift_shape.segs[rift_shape.segs.length-1].len];
      const poss = sorted_below_intersections
        .map(info => [info.below_pos[1], info.below_pos[2]] as [number, number]);
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
    const rift_hierarchy: [below:number, above:number][] = [];
    for (const info of rift_intersections) {
      const {prev, post} = intersection_below_perms.get(info)!;
      if (cmp(prev, post) === 0) continue;
      const below = info.below_pos[0];
      const above = info.above_pos[0];
      if (isAbove(rift_hierarchy, above, below)) {
        console.warn("invalid hierarchy");
        return undefined;
      }
      rift_hierarchy.push([below, above]);
    }

    return {
      orders,
      cutted_rift_shapes,
      rift_perms,
      rift_hierarchy,
    };
  }
  function calculateCuttedRiftShapes(
    puzzle: PrincipalPuzzle,
    rifts: {left:number, right:number, coord:HyperbolicPolarCoordinate}[],
  ): {
    orders: number[][],
    rel_angless: Geo.Angle[][],
    rift_shapes: Geo.Path<undefined>[],
    cutted_rift_shapes: Geo.Path<Geo.CutSourceSeg<undefined>>[],
    rift_perms: Map<Geo.PathSeg<Geo.CutSourceSeg<undefined>>, number[]>,
    rift_hierarchy: [below:number, above:number][],
  } | undefined {
    const res1 = computeRiftRelAngles(puzzle.branch_points, rifts);
    if (res1 === undefined) return undefined;
    const rift_shapes = rifts.map(rift => {
      const left_point = puzzle.branch_points[rift.left].point;
      const right_point = puzzle.branch_points[rift.right].point;
      return calculateRiftShape(
        left_point,
        right_point,
        rift.coord,
        getInfRadius(puzzle, rift),
      );
    });
    const res2 = cutRiftShapes(puzzle, rifts, rift_shapes, res1.cross_hierarchy);
    if (res2 === undefined) return undefined;
    return {
      ...res2,
      rel_angless: res1.rel_angless,
      rift_shapes,
    };
  }

  export function calculateClippedShapes(
    puzzle: PrincipalPuzzle,
  ): {
    layers: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>[],
    rifts: Geo.Path<undefined>[],
  } | undefined {
    const RETRY = 5;
    const PERTURBATION = 1e-4;

    const shapes = Puzzle.calculateShapes(puzzle);

    function go(
      rifts: {left:number, right:number, coord:HyperbolicPolarCoordinate}[],
      n: number,
    ): {
      layers: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>[],
      rifts: Geo.Path<undefined>[],
    } | undefined {
      const res1 = calculateCuttedRiftShapes(puzzle, rifts);
      if (res1 === undefined) return undefined;
      const res2 = cutShapes(puzzle, shapes, res1.rift_shapes, n);
      if (res2 === undefined) return undefined;
      const layers = determineLayers(
        puzzle,
        shapes,
        res1.rift_shapes,
        res2.cutted_shapes,
        res1.cutted_rift_shapes,
        res1.rift_perms,
        res2.seeds,
        n,
      );
      if (layers === undefined) return undefined;
      return {layers, rifts: res1.rift_shapes};
    }

    let res = go(puzzle.rifts, 0);
    for (const n of indices(RETRY)) {
      if (res !== undefined) break;
      const perturbation = {
        angle: (Math.random() - 0.5) * PERTURBATION,
        offset: (Math.random() - 0.5) * PERTURBATION,
      };
      const perturb_rifts = puzzle.rifts
        .map(({left, right, coord}) => ({
        left,
        right,
        coord: {
          angle: coord.angle + perturbation.angle,
          offset: coord.offset + perturbation.offset,
        },
      }));
      // console.warn(`fail to calculate clipped shapes, try again with perturbation (${n})`, perturbation);
      res = go(perturb_rifts, n + 1);
    }
    return res;
  }
  function calculateRiftAngle(
    puzzle: PrincipalPuzzle,
    shapes: Map<Piece, Geo.Path<Edge>>,
    rift_shapes: Geo.Path<undefined>[],
    index: number,
  ): Geo.Angle {
    const rift_index = puzzle.rifts.findIndex(({left, right}) => left === index || right === index);
    assert(rift_index !== -1);
    const rift_side = puzzle.rifts[rift_index].left === index;

    const ref_seg = shapes.get(puzzle.ramified[index].pieces[0])!.segs[0];
    assert(ref_seg.type === Geo.PathSegType.Line);
    const ref_dir = ref_seg.line.direction;

    const rift_shape = rift_shapes[rift_index];
    const rift_seg = rift_side ? rift_shape.segs[0] : rift_shape.segs[rift_shape.segs.length - 1];
    assert(rift_seg.type === Geo.PathSegType.Line);
    const rift_dir = rift_side ? rift_seg.line.direction : Geo.mul(rift_seg.line.direction, -1);

    return Geo.angleBetween([0, 0], ref_dir, rift_dir);
  }
  const SMALLEST_ADJ_LEN = 0.01;
  function getAdjacentSegs(
    puzzle: PrincipalPuzzle,
    seg: Geo.PathSeg<Geo.CutSourceSeg<Edge>>,
    shapes: Map<Piece, Geo.Path<Edge>>,
    cutted_shapes: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
  ): Geo.Path<Geo.CutSource<Edge, undefined>>[] {
    const res: Geo.Path<Geo.CutSource<Edge, undefined>>[] = [];

    const edge = seg.source.ref.source;
    const len = shapes.get(edge.aff)!.segs[edge.aff.edges.indexOf(edge)].len;
    const adjs =
      edge.auxiliary ? [{ edge: edge.adj, offset: len, from: 0, to: len }]
      : Puzzle.getAdjacentEdges(puzzle, edge);
    for (const adj of adjs) {
      if (adj.edge.aff.type === PieceType.InfPiece) continue;

      const from = Math.max(seg.source.from ?? 0, adj.from);
      const to = Math.min(seg.source.to ?? seg.source.ref.len, adj.to);

      const adj_edge = adj.edge;
      const adj_from = adj.offset - to;
      const adj_to = adj.offset - from;

      for (const adj_path of cutted_shapes.get(adj_edge.aff)!) {
        for (const adj_seg of adj_path.segs) {
          if (!(adj_seg.source.type === Geo.CutSourceType.Seg && adj_seg.source.ref.source === adj_edge)) continue;
          const adj_from_ = Math.max(adj_seg.source.from ?? 0, adj_from);
          const adj_to_ = Math.min(adj_seg.source.to ?? seg.source.ref.len, adj_to);

          if (adj_to_ - adj_from_ < SMALLEST_ADJ_LEN) continue;

          res.push(adj_path);
          break;
        }
      }
    }

    return res;
  }
  function getAdjacentRiftSegs(
    seg: Geo.PathSeg<Geo.CutSourceKnife<undefined>>,
    rift_shapes: Geo.Path<undefined>[],
    cutted_rift_shapes: Geo.Path<Geo.CutSourceSeg<undefined>>[],
    rift_perms: Map<Geo.PathSeg<Geo.CutSourceSeg<undefined>>, number[]>,
    cutted_shapes: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
  ): [Geo.Path<Geo.CutSource<Edge, undefined>>, number[]][] {
    const res: [Geo.Path<Geo.CutSource<Edge, undefined>>, number[]][] = [];

    const rift_seg = seg.source.ref;
    const rift_index = rift_shapes.findIndex(path => path.segs.includes(rift_seg));
    assert(rift_index !== -1);
    const rift_seg_index = rift_shapes[rift_index].segs.indexOf(rift_seg);
    assert(rift_seg_index !== -1);

    let piece: Piece | undefined = undefined;
    for (const [piece_, shapes] of cutted_shapes) {
      if (shapes.some(path => path.segs.includes(seg))) {
        piece = piece_;
        break;
      }
    }
    assert(piece !== undefined);

    const ranges_perms: {range:[from:number, to:number], perm:number[]}[] = [];
    {
      const [src_from, src_to] =
        seg.source.type === Geo.CutSourceType.LeftCut ?
          [seg.source.from, seg.source.to]
        : [seg.source.to, seg.source.from];
      const from = src_from ?? 0;
      const to = src_to ?? rift_seg.len;

      for (const cutted_rift_seg of cutted_rift_shapes[rift_index].segs) {
        if (cutted_rift_seg.source.ref !== rift_seg) continue;
        const cutted_from = cutted_rift_seg.source.from ?? 0;
        const cutted_to = cutted_rift_seg.source.to ?? rift_seg.len;
        
        const from_ = Math.max(from, cutted_from);
        const to_ = Math.min(to, cutted_to);

        const perm =
          seg.source.type === Geo.CutSourceType.RightCut ?
            [...rift_perms.get(cutted_rift_seg)!]
          : cyclicSort([...rift_perms.get(cutted_rift_seg)!].reverse());
        
        ranges_perms.push({range:[from_, to_], perm});
      }
    }

    const adj_type =
      seg.source.type === Geo.CutSourceType.LeftCut ?
        Geo.CutSourceType.RightCut : Geo.CutSourceType.LeftCut;

    for (const adj_shape of cutted_shapes.get(piece)!) {
      for (const adj_seg of adj_shape.segs) {
        if (!(adj_seg.source.type === adj_type && adj_seg.source.ref === rift_seg)) continue;
        const [adj_src_from, adj_src_to] =
          adj_seg.source.type === Geo.CutSourceType.LeftCut ?
            [adj_seg.source.from, adj_seg.source.to]
          : [adj_seg.source.to, adj_seg.source.from];

        for (const {range, perm} of ranges_perms) {
          const adj_from = Math.max(adj_src_from ?? 0, range[0]);
          const adj_to = Math.min(adj_src_to ?? rift_seg.len, range[1]);

          if (adj_to - adj_from < SMALLEST_ADJ_LEN) continue;

          res.push([adj_shape, perm]);
          break;
        }
      }
    }

    return res;
  }
  function cutShapes(
    puzzle: PrincipalPuzzle,
    shapes: Map<Piece, Geo.Path<Edge>>,
    rift_shapes: Geo.Path<undefined>[],
    n: number = 0,
  ): {
    cutted_shapes: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
    seeds: Geo.Path<Geo.CutSource<Edge, undefined>>[][],
  } | undefined {
    const ANG_EPS = 1e-3;
    const POS_EPS = 1e-3;

    const cutted_shapes = new Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>();

    function cut(
      shapes: Geo.Path<Geo.CutSource<Edge, undefined>>[],
      rift_shapes: Geo.Path<undefined>[],
      name: string,
    ): Geo.Path<Geo.CutSource<Edge, undefined>>[] | undefined {
      const INSIDE_DIS = -1e-3;

      for (const rift_shape of rift_shapes) {
        const shapes_: Geo.Path<Geo.CutSource<Edge, undefined>>[] = [];
        for (const shape of shapes) {
          const res = Geo.cutRegion(shape, rift_shape);
          if (res === undefined) {
            console.warn(`fail to clip path (${n}): fail to cut piece ${name}`);
            return undefined;
          }
          const dis1 = Geo.calculateNearestPoint(shape, Geo.getStartPoint(rift_shape)).dis;
          const dis2 = Geo.calculateNearestPoint(shape, Geo.getEndPoint(rift_shape)).dis;
          if (dis1 < INSIDE_DIS || dis2 < INSIDE_DIS) {
            shapes_.push(...res.map(path => Geo.flattenCut(Geo.glueIncompleteCut(path, rift_shape))));
            
          } else if (res.some(path => Geo.hasIncompleteCut(path, rift_shape))) {
            console.warn(`fail to clip path (${n}): fail to cut piece ${name}`);
            return undefined;
          } else {
            shapes_.push(...res.map(path => Geo.flattenCut(path)));
          }
        }
        shapes = shapes_;
      }
      return shapes;
    }

    // cut normal pieces
    for (const [piece, shape] of shapes) {
      if (piece.type === PieceType.InfPiece) continue;
      if (puzzle.ramified.some(ramified => ramified.pieces.includes(piece))) continue;

      const res = cut([Geo.cutNothing(shape)], rift_shapes, piece.name);
      if (res === undefined) return undefined;
      append(cutted_shapes, piece, res);
    }

    // cut ramified pieces
    const seeds: Geo.Path<Geo.CutSource<Edge, undefined>>[][] = indices(puzzle.stands.length).map(_ => []);
    for (const i of indices(puzzle.ramified.length)) {
      const ramified = puzzle.ramified[i];
      const branch_point = puzzle.branch_points[i];
      const rift_index = puzzle.rifts.findIndex(({left, right}) => left === i || right === i);
      const rift_side = puzzle.rifts[rift_index].left === i;
      const rift_shape = rift_shapes[rift_index];
      const point = rift_side ? Geo.getStartPoint(rift_shape) : Geo.getEndPoint(rift_shape);
      
      // recalculate cut_angle based on shapes and check that errors are small enough
      let cut_angle = branch_point.cut_angle;
      {
        const ramified_angle_ = calculateRiftAngle(puzzle, shapes, rift_shapes, i);
        const angle_err = Math.abs(Geo.as_npi_pi(ramified_angle_ - cut_angle));
        if (angle_err >= ANG_EPS) console.warn(`ramified angle error: ${angle_err}`);
        const pos_err = Geo.norm(Geo.sub(point, branch_point.point));
        if (pos_err >= POS_EPS) console.warn(`ramified position error: ${pos_err}`);
        cut_angle = Geo.as_npi_pi(ramified_angle_ - cut_angle) + cut_angle;
      }

      // determine subpieces being cutted by the rift on this piece for each turn
      let ramified_piece_indices: number[];
      {
        const outpoints = ramified.pieces.map(piece => shapes.get(piece)!.segs[0].target);
        const angle_upperbounds = zip(outpoints, rotate(outpoints, 1))
          .map(([start, end]) => Geo.angleBetween(point, start, end))
          .map((_, i, angles) => angles.slice(0, i + 1).reduce((a, b) => a + b));
        ramified_piece_indices = indices(ramified.turn)
          .map(n => mod(cut_angle + Math.PI*2 * n, Math.PI*2 * ramified.turn))
          .map(ramified_angle => angle_upperbounds.findIndex(upperbound => ramified_angle < upperbound));
        if (ramified_piece_indices.includes(-1)) {
          console.warn(`fail to clip path (${n}): fail to cut ramified pieces`);
          return undefined;
        }
      }

      // cut subpieces
      for (const index of indices(ramified.pieces.length)) {
        const piece = ramified.pieces[index];
        const shape = shapes.get(piece)!;

        // cut by the rift on this piece
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
          console.warn(`fail to clip path (${n}): fail to cut ramified piece: ${piece.name}`);
          return undefined;
        }

        // cut by other rifts
        const res = cut(res0, rift_shapes.filter((_, i) => i !== rift_index), piece.name);
        if (res === undefined) return undefined;
        append(cutted_shapes, piece, res);

        // assign each cutted subpiece to seeds
        for (const [ramified_piece_index, layer_index] of zip(ramified_piece_indices, branch_point.order)) {
          if (index === ramified_piece_index) {
            const seed_shape0 =
              rift_side ?
                res.find(path =>
                  path.segs.some(seg =>
                    seg.source.type === Geo.CutSourceType.LeftCut
                    && seg.source.ref === rift_shape.segs[0]
                    && seg.source.from === 0
                  )
                )
              :
                res.find(path =>
                  path.segs.some(seg =>
                    seg.source.type === Geo.CutSourceType.RightCut
                    && seg.source.ref === rift_shape.segs[rift_shape.segs.length - 1]
                    && seg.source.from === seg.source.ref.len
                  )
                );
            if (seed_shape0 === undefined)
              console.warn(`cannot find ${layer_index}-layer seed of ramified piece: ${piece.name}`);
            else
              seeds[layer_index].push(seed_shape0);
          }
        }
      }
    }
    return { cutted_shapes, seeds };
  }
  function determineLayers(
    puzzle: PrincipalPuzzle,
    shapes: Map<Piece, Geo.Path<Edge>>,
    rift_shapes: Geo.Path<undefined>[],
    cutted_shapes: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
    cutted_rift_shapes: Geo.Path<Geo.CutSourceSeg<undefined>>[],
    rift_perms: Map<Geo.PathSeg<Geo.CutSourceSeg<undefined>>, number[]>,
    seeds: Geo.Path<Geo.CutSource<Edge, undefined>>[][],
    n: number = 0,
  ): Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>[] | undefined {
    const cutted_shapes_layer = new Map<Geo.Path<Geo.CutSource<Edge, undefined>>, number>(
      seeds.flatMap((seeds, layer_index) => seeds.map(shape => [shape, layer_index]))
    );

    for (const [path, layer_index] of cutted_shapes_layer) {
      for (const seg of path.segs) {
        let adj_paths: [Geo.Path<Geo.CutSource<Edge, undefined>>, number[]][];
        if (seg.source.type === Geo.CutSourceType.Seg) {
          // find adjacent edges
          adj_paths = getAdjacentSegs(
            puzzle,
            seg as Geo.PathSeg<Geo.CutSourceSeg<Edge>>,
            shapes,
            cutted_shapes,
          )
          .map(adj_path => [adj_path, []]);
        } else {
          // find adjacent edges
          adj_paths = getAdjacentRiftSegs(
            seg as Geo.PathSeg<Geo.CutSourceKnife<undefined>>,
            rift_shapes,
            cutted_rift_shapes,
            rift_perms,
            cutted_shapes,
          );
        }

        for (const [adj_path, perm] of adj_paths) {
          const adj_layer_index = applyPerm(perm, 1, layer_index);
          if (cutted_shapes_layer.has(adj_path)) {
            if (cutted_shapes_layer.get(adj_path) !== adj_layer_index) {
              console.warn(`fail to clip path (${n}): conflict layer`);
              return undefined;
            }
          } else {
            cutted_shapes_layer.set(adj_path, adj_layer_index);
          }
        }
      }
    }
    
    const unclassified = new Set<Geo.Path<Geo.CutSource<Edge, undefined>>>();
    const layers = indices(puzzle.stands.length)
      .map(_ => new Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>());
    for (const [piece, paths] of cutted_shapes) {
      for (const path of paths) {
        if (cutted_shapes_layer.has(path)) {
          const layer_index = cutted_shapes_layer.get(path)!;
          append(layers[layer_index], piece, [path]);
        } else {
          if (!path.segs.every(seg => seg.len < SMALLEST_ADJ_LEN*2))
            unclassified.add(path);
        }
      }
    }
    if (unclassified.size > 0) {
      console.warn(`fail to clip path (${n}): ${unclassified.size} shapes are not classified into any layer`);
    }
    return layers;
  }
  
  function updateRiftRelAngles(puzzle: PrincipalPuzzle): boolean {
    const RETRY = 5;
    const PERTURBATION = 1e-4;

    const shapes = Puzzle.calculateShapes(puzzle);

    let res = calculateCuttedRiftShapes(puzzle, puzzle.rifts);
    for (const n of indices(RETRY)) {
      if (res !== undefined) break;
      const perturbation = {
        angle: (Math.random() - 0.5) * PERTURBATION,
        offset: (Math.random() - 0.5) * PERTURBATION,
      };
      const perturb_rifts = puzzle.rifts
        .map(({left, right, coord}) => ({
        left,
        right,
        coord: {
          angle: coord.angle + perturbation.angle,
          offset: coord.offset + perturbation.offset,
        },
      }));
      res = calculateCuttedRiftShapes(puzzle, perturb_rifts);
    }
    if (res === undefined) {
      console.error("fail to update rift rel angles");
      return false;
    }

    for (const [[branch_point, rel_angles], order] of zip(zip(puzzle.branch_points, res.rel_angless), res.orders)) {
      branch_point.rel_angles = rel_angles;
      branch_point.order = order;
    }
    puzzle.rift_hierarchy = res.rift_hierarchy;
    
    return true;
  }
  export function setShift(puzzle: PrincipalPuzzle, side: boolean, sheet: number, angle: Geo.Angle): boolean {
    const ANGLE_MAX_STEP: Geo.Angle = Math.PI/30;

    const twist_pieces = Puzzle.getTwistPieces(puzzle, side, sheet);
    if (twist_pieces === undefined) return false;
    const {pieces, sheets} = twist_pieces;

    // recalculate branch_cuts
    const current_shift_angle =
      puzzle.states[sheet].type === StateType.Aligned ? 0 : puzzle.states[sheet].angle;
    const [left_circle, right_circle] = Puzzle.getTwistCircles(puzzle);
    const center = side ? left_circle.center : right_circle.center;
    const twist_angle_diff = angle - current_shift_angle;
    const shift_trans = Geo.rotateAround(twist_angle_diff, center);
    if (Math.abs(twist_angle_diff) > ANGLE_MAX_STEP)
      console.warn(`twist angle changes too much: ${twist_angle_diff}`);

    const is_moved = puzzle.ramified
      .map(ramified => ramified.pieces.some(piece => pieces.has(piece)));
    const moved_points = puzzle.branch_points
      .map(({point}, index) => is_moved[index] ? Geo.transformPoint(point, shift_trans) : point);
    const lean_angle_diffs = puzzle.rifts
      .map(rift => Geo.angleBetween(
        [0, 0],
        Geo.sub(puzzle.branch_points[rift.right].point, puzzle.branch_points[rift.left].point),
        Geo.sub(moved_points[rift.right], moved_points[rift.left]),
      ));
    const cut_angle_diffs = indices(puzzle.branch_points.length)
      .map(i => puzzle.rifts.findIndex(({left, right}) => left === i || right === i))
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
  export function snap(puzzle: PrincipalPuzzle): {side:boolean, sheets:Set<number>, turn:number}[] {
    return Puzzle.snap(puzzle);
  }
  export function setRift(puzzle: PrincipalPuzzle, index: number, coord: HyperbolicPolarCoordinate): boolean {
    const ANGLE_MAX_STEP: Geo.Angle = Math.PI/3;
    
    const {offset, angle} = coord;
    const offset_ = Math.min(Math.max(offset, -MAX_RIFT_OFFSET), MAX_RIFT_OFFSET);
    const coord0 = puzzle.rifts[index].coord;
    if (Math.abs(coord.angle - coord0.angle) > ANGLE_MAX_STEP)
      console.warn(`rift angle changes too much: ${coord.angle - coord0.angle}`);

    const [left_angle0, right_angle0] = HyperbolicPolarCoordinate.getFocusAngles(coord0);
    const [left_angle, right_angle] = HyperbolicPolarCoordinate.getFocusAngles({offset:offset_, angle});
    const left_angle_diff = left_angle - left_angle0;
    const right_angle_diff = right_angle0 - right_angle;

    puzzle.rifts[index].coord = {offset:offset_, angle};
    puzzle.branch_points[puzzle.rifts[index].left].cut_angle += left_angle_diff;
    puzzle.branch_points[puzzle.rifts[index].right].cut_angle += right_angle_diff;

    const succ = updateRiftRelAngles(puzzle);
    
    return true;
  }
}

export type ClippedImage<Image> = {
  image: Image;
  transformation: Geo.RigidTransformation;
  region: Geo.Path<Geo.CutSource<Edge, undefined>>;
};

export type PrincipalPuzzleWithTexture<Image> = PrincipalPuzzle & {
  unshifted_positions: Map<Piece, Geo.RigidTransformation>;
  texture_indices: Map<Piece, number>;
  textures: Image[];
};

export type PrincipalPuzzleWithTextureFactory = PrincipalPuzzleFactory & {
  make_texture_functions: (puzzle: PrincipalPuzzle) => Complex.ComplexFunction[],
  determine_texture_indices: (puzzle: PrincipalPuzzle) => Map<Piece, number>;
};

export namespace PrincipalPuzzleWithTexture {
  export function makePuzzle<Image>(
    factory: PrincipalPuzzleWithTextureFactory,
    radius: Geo.Distance,
    center_x: Geo.Distance,
    R: Geo.Distance,
    draw_image: (f: Complex.ComplexFunction) => Image,
  ): PrincipalPuzzleWithTexture<Image> {
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

  export function getPositions<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): Map<Piece, Geo.RigidTransformation> {
    const positions = new Map(puzzle.unshifted_positions);
    for (const trans of Puzzle.getShiftTransformations(puzzle)) {
      const [sheet] = trans.sheets;
      for (const piece of Puzzle.getTwistPieces(puzzle, trans.side, sheet)!.pieces)
        positions.set(piece, Geo.compose(positions.get(piece)!, trans.trans));
    }
    return positions;
  }

  export function calculateImages<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): Set<ClippedImage<Image>> {
    const positions = getPositions(puzzle);
    const shapes = Puzzle.calculateShapes(puzzle);
    return new Set<ClippedImage<Image>>(
      Array.from(shapes).map(([piece, shape]) => ({
        image: puzzle.textures[puzzle.texture_indices.get(piece)!],
        region: Geo.cutNothing(shape),
        transformation: positions.get(piece)!,
      }))
    );
  }

  export function calculateClippedImages<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): {images:Set<ClippedImage<Image>>[], rifts:Geo.Path<undefined>[]} | undefined {
    const positions = getPositions(puzzle);
    const clipped_shapes = PrincipalPuzzle.calculateClippedShapes(puzzle);
    if (clipped_shapes === undefined) return undefined;
    const images = clipped_shapes.layers.map(layer =>
      new Set<ClippedImage<Image>>(
        Array.from(layer)
          .flatMap(([piece, shapes]) => shapes
            .map(shape => ({
              image: puzzle.textures[puzzle.texture_indices.get(piece)!],
              region: shape,
              transformation: positions.get(piece)!,
            }))
          )
      )
    );
    return {images, rifts:clipped_shapes.rifts};
  }

  export function setShift<Image>(puzzle: PrincipalPuzzleWithTexture<Image>, side: boolean, sheet: number, angle: Geo.Angle): boolean {
    return PrincipalPuzzle.setShift(puzzle, side, sheet, angle);
  }
  export function snap<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): boolean {
    const trans = PrincipalPuzzle.snap(puzzle);
    if (trans.length === 0) return false;

    for (const {side, sheets, turn} of trans) {
      const twist_trans1 = Puzzle.getTwistTransformation(puzzle, side, turn > 0);
      let twist_trans = Geo.id_trans();
      for (const n of indices(Math.abs(turn)))
        twist_trans = Geo.compose(twist_trans, twist_trans1);

      const [sheet] = sheets;
      for (const piece of Puzzle.getTwistPieces(puzzle, side, sheet)!.pieces) {
        let trans = puzzle.unshifted_positions.get(piece)!;
        trans = Geo.compose(trans, twist_trans);
        puzzle.unshifted_positions.set(piece, trans);
      }
    }
    return true;
  }
  export function setRift<Image>(puzzle: PrincipalPuzzleWithTexture<Image>, index: number, coord: HyperbolicPolarCoordinate): boolean {
    return PrincipalPuzzle.setRift(puzzle, index, coord);
  }
}

export namespace Textures {
  export function getDHTextureFunction(
    puzzle: PrincipalPuzzle,
    turn: number,
    scale: number,
  ): Complex.ComplexFunction[] {
    const d = puzzle.center_x;
    
    const fns: Complex.ComplexFunction[] = [];
    for (const i of indices(turn)) {
      fns.push((z: Complex.ComplexNumber) => Complex.mul(
        Complex.pow(Complex.add(z, Complex.c(+d, 0)), 1/turn),
        Complex.pow(Complex.add(z, Complex.c(-d, 0)), (turn-1)/turn),
        Complex.omega(i/turn),
        Complex.c(scale, 0),
      ));
      fns.push((z: Complex.ComplexNumber) => Complex.mul(
        Complex.pow(Complex.add(z, Complex.c(+d, 0)), 1/turn),
        Complex.pow(Complex.mul(Complex.add(z, Complex.c(-d, 0)), Complex.c(-1, 0)), (turn-1)/turn),
        Complex.omega((turn+1+2*i)/turn/2),
        Complex.c(scale, 0),
      ));
    }
    
    return fns;
  }

  export function getDVTextureFunction(
    puzzle: PrincipalPuzzle,
    turn: number,
    scale: number,
  ): Complex.ComplexFunction[] {
    const d = puzzle.center_x / Math.sqrt(3);
    
    const fns: Complex.ComplexFunction[] = [];
    for (const i of indices(turn)) {
      fns.push((z: Complex.ComplexNumber) => Complex.mul(
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d, 0)), 1/turn),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d, 0)), (turn-1)/turn),
        Complex.omega(i/turn),
        Complex.c(scale, 0),
      ));
      fns.push((z: Complex.ComplexNumber) => Complex.mul(
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d, 0)), 1/turn),
        Complex.pow(Complex.mul(Complex.c(-1, 0), Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d, 0))), (turn-1)/turn),
        Complex.omega((turn+1+2*i)/turn/2),
        Complex.c(scale, 0),
      ));
    }
    
    return fns;
  }

  export function getQTextureFunction(
    puzzle: PrincipalPuzzle,
    turn: number,
    scale: number,
  ): Complex.ComplexFunction[] {
    const d1 = puzzle.center_x;
    const d2 = puzzle.center_x / Math.sqrt(3);

    const fns: Complex.ComplexFunction[] = [];
    for (const i of indices(turn)) {
      fns.push((z: Complex.ComplexNumber) => Complex.mul(
        Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1/turn),
        Complex.pow(Complex.add(z, Complex.c(-d1, 0)), (turn-1)/turn),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1/turn),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d2, 0)), (turn-1)/turn),
        Complex.omega(i/turn),
        Complex.c(scale, 0),
      ));
      fns.push((z: Complex.ComplexNumber) => Complex.mul(
        Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1/turn),
        Complex.pow(Complex.mul(Complex.add(z, Complex.c(-1, 0)), Complex.c(-d1, 0)), (turn-1)/turn),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1/turn),
        Complex.pow(Complex.mul(Complex.c(-1, 0), Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(-d2, 0))), (turn-1)/turn),
        Complex.omega((i+1)/turn),
        Complex.c(scale, 0),
      ));
    }
    
    return fns;
  }

  export function getDDTextureFunction(
    puzzle: PrincipalPuzzle,
    scale: number,
  ): Complex.ComplexFunction[] {
    const d1 = puzzle.center_x;
    const d2 = puzzle.center_x/Math.sqrt(3);

    const f1 = (z: Complex.ComplexNumber) =>
      Complex.mul(
        Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1/2),
        Complex.pow(Complex.add(z, Complex.c(-d1, 0)), 1/2),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1/2),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, -1)), Complex.c(+d2, 0)), 1/2),
        Complex.c(scale, 0),
      );

    const f2 = (z: Complex.ComplexNumber) =>
      Complex.mul(
        Complex.pow(Complex.add(z, Complex.c(+d1, 0)), 1/2),
        Complex.pow(Complex.add(z, Complex.c(-d1, 0)), 1/2),
        Complex.abs(Complex.add(z, Complex.c(0, (z[1] >= 0 ? +1 : -1)*d2))),
        Complex.c(-1, 0),
        Complex.c(scale, 0),
      );

    const f3 = (z: Complex.ComplexNumber) =>
      Complex.mul(
        Complex.abs(Complex.add(z, Complex.c((z[0] >= 0 ? +1 : -1)*d1, 0))),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, +1)), Complex.c(+d2, 0)), 1/2),
        Complex.pow(Complex.add(Complex.mul(z, Complex.c(0, -1)), Complex.c(+d2, 0)), 1/2),
        Complex.normalize(z),
        Complex.c(-1, 0),
        Complex.c(scale, 0),
      );

    const f12 = (z: Complex.ComplexNumber) => (z[1] < 0) ? f1(z) : f2(z);
    const f12_ = (z: Complex.ComplexNumber) => !(z[1] < 0) ? f1(z) : f2(z);
    const f13 = (z: Complex.ComplexNumber) => (z[1] > 0 ? z[0] < 0 : z[0] <= 0) ? f1(z) : f3(z);
    const f13_ = (z: Complex.ComplexNumber) => !(z[1] > 0 ? z[0] < 0 : z[0] <= 0) ? f1(z) : f3(z);

    return [f3, f12_, f12, f13, f13_, f2];
  }
}

export namespace Factory {
  export function DH(turn: number, scale: number): PrincipalPuzzleWithTextureFactory {
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
          ramified: [{pieces:ramified_pieceCLs, turn}, {pieces:ramified_pieceCRs, turn}],
        };
      },
      make_rifts: (radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance) => {
        return {
          branch_points: [
            {point: [-center_x, 0], cut_angle: Math.PI/6, order: indices(turn)},
            {point: [center_x, 0], cut_angle: Math.PI/6, order: rotate(indices(turn), 1).reverse()},
          ],
          rifts: [
            {left:0, right:1, coord:{offset:0.0, angle:0.0}}
          ],
          rift_hierarchy: [],
        };
      },
      make_texture_functions: puzzle => Textures.getDHTextureFunction(puzzle, turn, scale),
      determine_texture_indices: (puzzle: PrincipalPuzzle) => {
        const texture_indices = new Map<Piece, number>();
        for (const sheet of indices(puzzle.stands.length)) {
          const texture_index = mod(2*sheet-1, 2*puzzle.stands.length);
          const edgeCL = Puzzle.edgeAt(puzzle, sheet, [0, 1, -1, 1]);
          texture_indices.set(edgeCL.aff, texture_index);
          texture_indices.set(Edge.walk(edgeCL, [0]).aff, texture_index);
          texture_indices.set(Edge.walk(edgeCL, [0, 2]).aff, texture_index);
        }
        for (const sheet of indices(puzzle.stands.length)) {
          const layer = new Set<Piece>();
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
            texture_indices.set(piece, 2*sheet);
          }
        }
        return texture_indices;
      },
    };
  }

  export function DV(turn: number, scale: number): PrincipalPuzzleWithTextureFactory {
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
          ramified: [{pieces:ramified_piece0Ls, turn}, {pieces:ramified_piece0Rs, turn}],
        };
      },
      make_rifts: (radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance) => {
        return {
          branch_points: [
            {point: [0, center_x/Math.sqrt(3)], cut_angle: Math.PI/3, order: indices(turn)},
            {point: [0, -center_x/Math.sqrt(3)], cut_angle: Math.PI/3, order: rotate(indices(turn), 1).reverse()},
          ],
          rifts: [
            {left:0, right:1, coord:{offset:0.0, angle:0.0}}
          ],
          rift_hierarchy: [],
        };
      },
      make_texture_functions: puzzle => Textures.getDVTextureFunction(puzzle, turn, scale),
      determine_texture_indices: (puzzle: PrincipalPuzzle) => {
        const texture_indices = new Map<Piece, number>();
        for (const sheet of indices(puzzle.stands.length)) {
          const texture_index = mod(2*sheet-1, 2*puzzle.stands.length);
          const edge0L = Puzzle.edgeAt(puzzle, sheet, [0, 1, -1, 0]);
          texture_indices.set(edge0L.aff, texture_index);
          texture_indices.set(Edge.walk(edge0L, [0]).aff, texture_index);
          texture_indices.set(Edge.walk(edge0L, [0, 2]).aff, texture_index);
        }
        for (const sheet of indices(puzzle.stands.length)) {
          const layer = new Set<Piece>();
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
            texture_indices.set(piece, 2*sheet);
          }
        }
        return texture_indices;
      },
    };
  }

  export function Q(turn: number, scale: number): PrincipalPuzzleWithTextureFactory {
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
            {pieces:ramified_pieceCLs, turn},
            {pieces:ramified_pieceCRs, turn},
            {pieces:ramified_piece0Ls, turn},
            {pieces:ramified_piece0Rs, turn},
          ],
        };
      },
      make_rifts: (radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance) => {
        return {
          branch_points: [
            {point: [-center_x, 0], cut_angle: Math.PI/6, order: indices(turn)},
            {point: [center_x, 0], cut_angle: mod(Math.PI/6 - 2*Math.PI, 2*Math.PI*turn), order: rotate(indices(turn), 2).reverse()},
            {point: [0, center_x/Math.sqrt(3)], cut_angle: Math.PI/3, order: indices(turn)},
            {point: [0, -center_x/Math.sqrt(3)], cut_angle: mod(Math.PI/3 + 2*Math.PI, 2*Math.PI*turn), order: indices(turn).reverse()},
          ],
          rifts: [
            {left:0, right:1, coord:{offset:0.0, angle:0.0}},
            {left:2, right:3, coord:{offset:0.0, angle:0.0}},
          ],
          rift_hierarchy: [],
        };
      },
      make_texture_functions: puzzle => Textures.getQTextureFunction(puzzle, turn, scale),
      determine_texture_indices: (puzzle: PrincipalPuzzle) => {
        const texture_indices = new Map<Piece, number>();
        for (const sheet of indices(puzzle.stands.length)) {
          const texture_index = mod(2*sheet-3, 2*puzzle.stands.length);
          const edge = Puzzle.edgeAt(puzzle, sheet, [0, 1, -1]);
          texture_indices.set(edge.aff, texture_index);
          texture_indices.set(Edge.walk(edge, [0]).aff, texture_index);
          texture_indices.set(Edge.walk(edge, [1]).aff, texture_index);
          texture_indices.set(Edge.walk(edge, [2]).aff, texture_index);
          texture_indices.set(Edge.walk(edge, [3]).aff, texture_index);
        }
        for (const sheet of indices(puzzle.stands.length)) {
          const layer = new Set<Piece>();
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
            texture_indices.set(piece, 2*sheet);
          }
        }
        return texture_indices;
      },
    };
  }

  export function DD(scale: number): PrincipalPuzzleWithTextureFactory {
    return {
      make_pieces: () => {
        const layers = indices(3).map(i => Puzzle.makePieces(`_${i}`));
        
        const piece50Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1, 0]).aff);
        const pieceCLs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 1]).aff);
        const pieceCRs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, -1]).aff);
        const piece0Ls = layers.map(layer => Edge.walk(layer.stand, [0, 1]).aff);
        const piece0Rs = layers.map(layer => Edge.walk(layer.stand, [0, 1, -1, 2]).aff);

        // ramify center pieces

        // ramified_pieceCLs[0].edges[1]: the edge from the bottom sheet to the top sheet
        const ramified_pieceCLs = Puzzle.chunkPiece("CL", Puzzle.ramifyPiece("", [pieceCLs[0], pieceCLs[2]], 0), 2);

        // ramified_pieceCRs[0].edges[1]: the edge from the bottom sheet to the second sheet
        const ramified_pieceCRs = Puzzle.chunkPiece("CR", Puzzle.ramifyPiece("", [pieceCRs[1], pieceCRs[2]], 0), 2);

        // ramify corner pieces

        // ramified_piece0Ls[0].edges[1]: the edge from the second sheet to the top sheet
        const ramified_piece0Ls = Puzzle.chunkPiece("0L", Puzzle.ramifyPiece("", [piece0Ls[0], piece0Ls[1]], 0), 1);

        // ramified_piece0Rs[0].edges[1]: the edge from the second sheet to the top sheet
        const ramified_piece0Rs = Puzzle.chunkPiece("0R", Puzzle.ramifyPiece("", [piece0Rs[0], piece0Rs[1]], 0), 1);

        Puzzle.swapAdj(piece50Ls[0].edges[0], piece50Ls[1].edges[0]);
        Puzzle.swapAdj(piece50Ls[0].edges[1], piece50Ls[1].edges[1], piece50Ls[2].edges[1]);
        Puzzle.swapAdj(piece50Ls[1].edges[2], piece50Ls[2].edges[2]);
        
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
            {pieces:ramified_pieceCLs, turn:2},
            {pieces:ramified_pieceCRs, turn:2},
            {pieces:ramified_piece0Ls, turn:2},
            {pieces:ramified_piece0Rs, turn:2},
          ],
        };
      },
      make_rifts: (radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance) => {
        return {
          branch_points: [
            {point: [-center_x, 0], cut_angle: Math.PI/6, order: [0, 2]},
            {point: [center_x, 0], cut_angle: Math.PI/6, order: [1, 2]},
            {point: [0, center_x/Math.sqrt(3)], cut_angle: Math.PI/3, order: [0, 1]},
            {point: [0, -center_x/Math.sqrt(3)], cut_angle: Math.PI/3, order: [0, 1]},
          ],
          rifts: [
            {left:0, right:1, coord:{offset:0.0, angle:0.0}},
            {left:2, right:3, coord:{offset:0.0, angle:0.0}},
          ],
          rift_hierarchy: [[0, 1]],
        };
      },
      make_texture_functions: puzzle => Textures.getDDTextureFunction(puzzle, scale),
      determine_texture_indices: (puzzle: PrincipalPuzzle) => {
        const texture_indices = new Map<Piece, number>();
        for (const sheet of indices(puzzle.stands.length)) {
          const texture_index = sheet;
          const edge = Puzzle.edgeAt(puzzle, sheet, [0, 1, -1]);
          texture_indices.set(edge.aff, texture_index);
          texture_indices.set(Edge.walk(edge, [0]).aff, texture_index);
          texture_indices.set(Edge.walk(edge, [1]).aff, texture_index);
          texture_indices.set(Edge.walk(edge, [2]).aff, texture_index);
          texture_indices.set(Edge.walk(edge, [3]).aff, texture_index);
        }
        for (const sheet of indices(puzzle.stands.length)) {
          const texture_index = sheet + 3;
          const layer = new Set<Piece>();
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
            texture_indices.set(piece, texture_index);
          }
        }
        return texture_indices;
      },
    };
  }

}

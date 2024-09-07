import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";
import {assert, indices, mod, zip, rotate, unrollUntilLoopback, append} from "./Utils.js";

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

export enum PuzzleType { Normal, Ramified2S }

export type Puzzle = {
  type: PuzzleType;
  pieces: Piece[];
  stands: Edge[]; // boundary piece's edges at the top intersection point
  ramified: {pieces:Piece[], turn:number}[];
  states: State[];

  radius: Geo.Distance;
  center_x: Geo.Distance;
  R: Geo.Distance;
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

  function swapAdj(edge1: Edge, edge2: Edge): void {
    const adj_edge1 = edge1.adj;
    const adj_edge2 = edge2.adj;
    adjEdges(edge1, adj_edge2);
    adjEdges(edge2, adj_edge1);
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

  function ramifyPiece(name: string, pieces: Piece[], n: number): Piece {
    const edges = rotate(pieces.flatMap(piece => rotate(piece.edges, n)), -n);
    const type = pieces[0].type;
    const piece: Piece = {type, edges, name};
    for (const i of indices(edges.length)) {
      linkEdges(edges[i], edges[mod(i + 1, edges.length)]);
      edges[i].aff = piece;
    }
    return piece;
  }

  function chunkPiece(name: string, piece: Piece, step: number): Piece[] {
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

  function makePieces(suffix: string = ""): {pieces:Piece[], stands:Edge[]} {
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

  function makeRamifiedV1Pieces(): {pieces:Piece[], stands:Edge[], ramified:{pieces:Piece[], turn:number}[]} {
    // top pieces
    
    const top = makePieces("_top");
    const bot = makePieces("_bot");
    
    const top_piece50L = Edge.walk(top.stands[0], [0, 1, -1, 1, 0]).aff;
    const bot_piece50L = Edge.walk(bot.stands[0], [0, 1, -1, 1, 0]).aff;

    const top_pieceCL = Edge.walk(top.stands[0], [0, 1, -1, 1]).aff;
    const top_pieceCR = Edge.walk(top.stands[0], [0, 1, -1, -1]).aff;
    const bot_pieceCL = Edge.walk(bot.stands[0], [0, 1, -1, 1]).aff;
    const bot_pieceCR = Edge.walk(bot.stands[0], [0, 1, -1, -1]).aff;

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
    ].filter(p =>
      ![
        top_pieceCL,
        top_pieceCR,
        bot_pieceCL,
        bot_pieceCR,
      ].includes(p)
    );
    
    return {
      pieces,
      stands: [top.stands[0], bot.stands[0]],
      ramified: [{pieces:pieceCLs, turn:2}, {pieces:pieceCRs, turn:2}],
    };
  }

  function ckeckPuzzleShape(radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): void {
    assert(center_x > 0);
    assert(radius > 0);
    assert(center_x < radius);
    assert(center_x * 2 > radius);
    assert(R > center_x + radius);
  }
  export function makeNormalPuzzle(radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): Puzzle {
    ckeckPuzzleShape(radius, center_x, R);
    const {pieces, stands} = makePieces();
    return {
      type: PuzzleType.Normal,
      pieces,
      stands,
      ramified: [],
      states: indices(stands.length).map(_ => ({ type: StateType.Aligned })),
      radius,
      center_x,
      R,
    };
  }
  export function makeRamified2SPuzzle(radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): Puzzle {
    ckeckPuzzleShape(radius, center_x, R);
    const {pieces, stands, ramified} = makeRamifiedV1Pieces();
    return {
      type: PuzzleType.Ramified2S,
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
  export function getCircleEdges(puzzle: Puzzle, side: boolean, sheet: number): Edge[] {
    const edge0 =
      side ? edgeAt(puzzle, sheet, [0, 1, -1, -1, 0])
      : edgeAt(puzzle, sheet, [0, 1, -1, 1, 0]);
    return unrollUntilLoopback(edge0, edge => Edge.walk(edge, [1, 1, 0]));
  }

  // side = true: left
  export function getCenterEdges(puzzle: Puzzle, side: boolean, sheet: number): Edge[] {
    const edge0 =
      side ? edgeAt(puzzle, sheet, [0, 1, -1, 1, 0])
      : edgeAt(puzzle, sheet, [0, 1, -1, -1, 0]);
    return unrollUntilLoopback(edge0, edge => Edge.walk(edge, [1, 1, 1, 0]));
  }

  // side = true: left
  export function getTwistPieces(
    puzzle: Puzzle,
    side: boolean,
    sheet: number,
  ): {pieces:Set<Piece>, sheets:Set<number>} | undefined {
    const boundaries = indices(puzzle.stands.length).map(sheet => getCircleEdges(puzzle, side, sheet));
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
    const edgess = Array.from(sheets).map(sheet => getCircleEdges(puzzle, side, sheet));
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
  export function twistTo(puzzle: Puzzle, side: boolean, sheets: Set<number>, angle: Geo.Angle): void {
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
    const actions: {side: boolean, sheets: Set<number>, turn: number}[] = [];

    for (const sheet of indices(puzzle.states.length)) {
      const state = puzzle.states[sheet];
      if (state.type === StateType.Aligned) continue;
      const turn = Math.round(state.angle / (Math.PI/3));
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
}

export namespace Puzzle {
  export function getTwistCircles(puzzle: Puzzle): [left:Geo.DirectionalCircle, right:Geo.DirectionalCircle] {
    return [
      { center: [-puzzle.center_x, 0], radius: puzzle.radius },
      { center: [+puzzle.center_x, 0], radius: puzzle.radius },
    ];
  }
  export function getShiftTransformation(puzzle: Puzzle): {trans:Geo.RigidTransformation, side:boolean, sheets: Set<number>}[] {
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

    for (const shift_trans of getShiftTransformation(puzzle)) {
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

    const cycles = getShiftTransformation(puzzle)
      .map(shifted_trans => {
        const [sheet] = shifted_trans.sheets;
        return [
          getCircleEdges(puzzle, shifted_trans.side, sheet),
          sheet,
        ] as const
      })
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
  export function getFocusAngles(coord: HyperbolicPolarCoordinate): [left_angle:Geo.Angle, right_angle:Geo.Angle] {
    const f1: Geo.Point = [-1, 0];
    const f2: Geo.Point = [+1, 0];
    const [middle, is_solid] = getHyperbolaPoint(f1, f2, coord);

    if (coord.offset < 0) {
      const right_angle = -(Geo.angleBetween(f2, f1, middle) + (is_solid ? 0 : Math.PI));
      return [coord.angle, makeSameTurn(right_angle, coord.angle)];
    } else {
      const left_angle = Geo.angleBetween(f1, f2, middle) + (is_solid ? 0 : Math.PI);
      return [makeSameTurn(left_angle, coord.angle), coord.angle];
    }
  }
  export function getCoordinateFromAngles(left_angle: Geo.Angle, right_angle: Geo.Angle): HyperbolicPolarCoordinate {
    const offset = (Math.sin(right_angle) - Math.sin(left_angle)) / Math.sin(left_angle + right_angle);
    const angle = offset > 0 ? right_angle : left_angle;
    return {offset, angle};
  }
}

export type PrincipalPuzzle = Puzzle & {
  // correspond to space.ramified
  branch_cuts: {point: Geo.Point, cut_angle:Geo.Angle, principal:number|undefined}[];
  rifts: {left:number, right:number, coord:HyperbolicPolarCoordinate}[];
};

export namespace PrincipalPuzzle {
  const MAX_RIFT_OFFSET = 0.8;

  export function makeRamified2SPuzzle(radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): PrincipalPuzzle {
    const puzzle = Puzzle.makeRamified2SPuzzle(radius, center_x, R);

    return {
      ...puzzle,
      branch_cuts: [
        {point: [-center_x, 0], cut_angle: Math.PI/6, principal:0},
        {point: [center_x, 0], cut_angle: Math.PI/6, principal:0},
      ],
      rifts: [
        {left:0, right:1, coord:{offset:0.0, angle:0.0}}
      ],
    };
  }

  function calculateRiftShape(
    puzzle: PrincipalPuzzle,
    shapes: Map<Piece, Geo.Path<Edge>>,
    rift: {left:number, right:number, coord:HyperbolicPolarCoordinate},
  ): Geo.Path<undefined> {
    const left_point = Geo.getStartPoint(shapes.get(puzzle.ramified[rift.left].pieces[0])!);
    const right_point = Geo.getStartPoint(shapes.get(puzzle.ramified[rift.right].pieces[0])!);

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
    
    function calculateInfPoint(from: Geo.Point, to: Geo.Point, flip: boolean, radius: number): Geo.Point {
      let dir = Geo.normalize(Geo.sub(to, from));
      if (flip) dir = Geo.mul(dir, -1);
      const s = Geo.cross(dir, from);
      const dis = Math.sqrt(radius * radius - s * s) - Geo.dot(dir, from);
      return Geo.add(from, Geo.mul(dir, dis));
    }
    const left_inf = calculateInfPoint(left_point, middle, !is_solid, puzzle.R * 1.5);
    const right_inf = calculateInfPoint(right_point, middle, !is_solid, puzzle.R * 1.5);
    const inf_circle: Geo.DirectionalCircle = { center: [0,0], radius: puzzle.R * 1.5 };
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
  export function calculateClippedShapes(
    puzzle: PrincipalPuzzle,
  ): {
    principal: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
    complementary: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
    rifts: Geo.Path<undefined>[],
  } | undefined {
    const shapes = Puzzle.calculateShapes(puzzle);
    const rift_shapes = puzzle.rifts.map(rift => calculateRiftShape(puzzle, shapes, rift));
    let res = calculateClippedShapes_(puzzle, shapes, rift_shapes);
    const RETRY = 5;
    const PERTURBATION = 1e-4;
    for (const _ of indices(RETRY)) {
      if (res !== undefined) break;
      const perturb_rifts = puzzle.rifts.map(({left, right, coord}) => ({
        left,
        right,
        coord: {
          angle: coord.angle + (Math.random() - 0.5) * PERTURBATION,
          offset: coord.offset + (Math.random() - 0.5) * PERTURBATION,
        },
      }));
      const rift_shapes = perturb_rifts.map(rift => calculateRiftShape(puzzle, shapes, rift));
      res = calculateClippedShapes_(puzzle, shapes, rift_shapes);
    }
    if (res === undefined) return undefined;

    return {...res, rifts:rift_shapes};
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
  function calculateClippedShapes_(
    puzzle: PrincipalPuzzle,
    shapes: Map<Piece, Geo.Path<Edge>>,
    rift_shapes: Geo.Path<undefined>[],
  ): {
    principal: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
    complementary: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
  } | undefined {
    const EPS = 1e-4;

    const cutted_shapes = new Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>();

    // cut normal pieces
    for (const [piece, shape] of shapes) {
      if (piece.type === PieceType.InfPiece) continue;
      if (puzzle.ramified.some(ramified => ramified.pieces.includes(piece))) continue;

      // TODO: multiple rifts
      const rift_shape = rift_shapes[0];
      const res = Geo.cutRegion(shape, rift_shape, undefined);
      if (res === undefined) {
        console.warn("fail to clip path: fail to cut regions of normal pieces");
        return undefined;
      }
      if (res.some(path => Geo.hasIncompleteCut(path, rift_shape))) {
        console.warn("fail to clip path: fail to cut regions of normal pieces");
        return undefined;
      }
      append(cutted_shapes, piece, res);
    }

    // cut ramified pieces
    const prin_shapes: Geo.Path<Geo.CutSource<Edge, undefined>>[] = [];
    for (const i of indices(puzzle.ramified.length)) {
      const ramified = puzzle.ramified[i];
      const branch_cut = puzzle.branch_cuts[i];
      const rift_index = puzzle.rifts.findIndex(({left, right}) => left === i || right === i);
      const rift_side = puzzle.rifts[rift_index].left === i;
      const rift_shape = rift_shapes[rift_index];
      const branch_point = rift_side ? Geo.getStartPoint(rift_shape) : Geo.getEndPoint(rift_shape);
      
      {
        const ramified_angle_ = calculateRiftAngle(puzzle, shapes, rift_shapes, i);
        const angle_err = Math.abs(Geo.as_npi_pi(ramified_angle_ - branch_cut.cut_angle));
        if (angle_err >= EPS)
          console.warn(`invalid ramified angle: ${angle_err}`);
      }

      const ramified_piece_indices: number[] = [];
      {
        const points = ramified.pieces.map(piece => shapes.get(piece)!.segs[0].target);
        const angle_upperbounds = zip(points, rotate(points, 1))
          .map(([start, end]) => Geo.angleBetween(branch_point, start, end))
          .map((_, i, angles) => angles.slice(0, i + 1).reduce((a, b) => a + b));
        const ramified_piece_indices_ = indices(ramified.turn)
          .map(n => mod(branch_cut.cut_angle + Math.PI*2 * n, Math.PI*2 * ramified.turn))
          .map(ramified_angle => angle_upperbounds.findIndex(upperbound => ramified_angle < upperbound));
        assert(!ramified_piece_indices_.includes(-1));
        ramified_piece_indices.push(...ramified_piece_indices_);
      }

      for (const index of indices(ramified.pieces.length)) {
        const piece = ramified.pieces[index];
        const shape = shapes.get(piece)!;
        const res = Geo.cutRegion(shape, rift_shape, {
          index_of_path: 0,
          incident_with_cut_start_or_end: rift_side,
          considered_as_incident: ramified_piece_indices.includes(index),
        });
        if (res === undefined) {
          console.warn("fail to clip path: fail to cut regions of ramified pieces");
          return undefined;
        }
        append(cutted_shapes, piece, res);

        if (branch_cut.principal !== undefined && index === ramified_piece_indices[branch_cut.principal]) {
          const prin_shape0 =
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
                  && seg.source.to === seg.source.ref.len
                )
              );
          if (prin_shape0 !== undefined)
            prin_shapes.push(prin_shape0);
        }
      }
    }
    if (prin_shapes.length === 0) {
      console.warn("fail to clip path: cannot find principal part");
      return undefined;
    }

    // grow principal part
    const prin_cutted_shapes = new Set<Geo.Path<Geo.CutSource<Edge, undefined>>>();
    // TODO: check consistency for prin_shapes
    prin_cutted_shapes.add(prin_shapes[0]);
    
    const SMALLEST_ANGLE = 0.01;
    for (const path of prin_cutted_shapes) {
      for (const seg of path.segs) {
        if (seg.source.type !== Geo.CutSourceType.Seg) continue;

        // find adjacent edg
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

              if (adj_to_ - adj_from_ < SMALLEST_ANGLE) continue;
              
              prin_cutted_shapes.add(adj_path);
              break;
            }
          }
        }
      }
    }
    
    const principal = new Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>();
    const complementary = new Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>();
    for (const [piece, paths] of cutted_shapes) {
      for (const path of paths) {
        if (prin_cutted_shapes.has(path)) {
          append(principal, piece, [path]);
        } else {
          append(complementary, piece, [path]);
        }
      }
    }
    return { principal, complementary };
  }

  export function twistTo(puzzle: PrincipalPuzzle, side: boolean, sheet: number, angle: Geo.Angle): boolean {
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
    const moved_points = puzzle.branch_cuts
      .map(({point}, index) => is_moved[index] ? Geo.transformPoint(point, shift_trans) : point);
    const lean_angle_diffs = puzzle.rifts
      .map(rift => Geo.angleBetween(
        [0, 0],
        Geo.sub(puzzle.branch_cuts[rift.right].point, puzzle.branch_cuts[rift.left].point),
        Geo.sub(moved_points[rift.right], moved_points[rift.left]),
      ));
    const cut_angle_diffs = indices(puzzle.branch_cuts.length)
      .map(i => puzzle.rifts.findIndex(({left, right}) => left === i || right === i))
      .map(rift_index => rift_index === -1 ? 0 : lean_angle_diffs[rift_index])
      .map((lean_angle_diff, i) => lean_angle_diff - (is_moved[i] ? twist_angle_diff : 0));
 
    // TODO: fail for invalid rift crossing
    for (const i of indices(puzzle.branch_cuts.length)) {
      puzzle.branch_cuts[i].cut_angle += cut_angle_diffs[i];
      puzzle.branch_cuts[i].point = moved_points[i];
    }

    Puzzle.twistTo(puzzle, side, sheets, angle);

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
    
    // TODO: fail for invalid rift crossing
    puzzle.rifts[index].coord = {offset:offset_, angle};
    puzzle.branch_cuts[puzzle.rifts[index].left].cut_angle += left_angle_diff;
    puzzle.branch_cuts[puzzle.rifts[index].right].cut_angle += right_angle_diff;
    return true;
  }
}

export type ClippedImage<Image> = {
  image: Image;
  transformation: Geo.RigidTransformation;
  region: Geo.Path<Geo.CutSource<Edge, undefined>>;
};

function get2STextureFunction(
  puzzle: PrincipalPuzzle,
  scale: number,
): [Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction] {
  const d = puzzle.center_x;
  
  const f1 = (z: Complex.ComplexNumber) => Complex.mul(
    Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5),
    Complex.pow(Complex.add(z, Complex.c(-d, 0)), 0.5),
    Complex.c(scale, 0),
  );
  const f1_ = (z: Complex.ComplexNumber) => Complex.mul(
    Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5),
    Complex.pow(Complex.add(z, Complex.c(-d, 0)), 0.5),
    Complex.c(-scale, 0),
  );
  const f2 = (z: Complex.ComplexNumber) => Complex.mul(
    Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5),
    Complex.pow(Complex.mul(Complex.add(z, Complex.c(-d, 0)), Complex.c(-1, 0)), 0.5),
    Complex.c(0, -scale),
  );
  const f2_ = (z: Complex.ComplexNumber) => Complex.mul(
    Complex.pow(Complex.add(z, Complex.c(+d, 0)), 0.5),
    Complex.pow(Complex.mul(Complex.add(z, Complex.c(-d, 0)), Complex.c(-1, 0)), 0.5),
    Complex.c(0, scale),
  );
  
  return [f1, f1_, f2, f2_];
}

export type PrincipalPuzzleWithTexture<Image> = PrincipalPuzzle & {
  unshifted_positions: Map<Piece, Geo.RigidTransformation>;
  texture_indices: Map<Piece, number>;
  textures: Image[];
};

export namespace PrincipalPuzzleWithTexture {
  function _makeRamified2SPuzzle<Image>(
    puzzle: PrincipalPuzzle,
    textures: Image[],
  ): PrincipalPuzzleWithTexture<Image> {
    const unshifted_positions = new Map(puzzle.pieces.map(piece => [piece, Geo.id_trans()]));

    const texture_indices = new Map<Piece, number>();
    {
      const edgeL = Puzzle.edgeAt(puzzle, 0, [0, 1, -1, 1, 0]);
      const edgeR = Puzzle.edgeAt(puzzle, 1, [0, 1, -1, -1, 0]);
      texture_indices.set(edgeL.aff, 3);
      texture_indices.set(Edge.walk(edgeL, [0]).aff, 3);
      texture_indices.set(Edge.walk(edgeL, [2]).aff, 3);
      texture_indices.set(edgeR.aff, 2);
      texture_indices.set(Edge.walk(edgeR, [0]).aff, 2);
      texture_indices.set(Edge.walk(edgeR, [2]).aff, 2);
      
      const prin = new Set<Piece>();
      prin.add(Puzzle.edgeAt(puzzle, 0, []).aff);
      for (const piece of prin) {
        for (const edge of piece.edges) {
          const adj_piece = edge.adj.aff;
          if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
            prin.add(adj_piece);
          }
        }
      }
      
      const comp = new Set<Piece>();
      comp.add(Puzzle.edgeAt(puzzle, 1, []).aff);
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
      ...puzzle,
      unshifted_positions,
      texture_indices,
      textures,
    };
  }

  export function makeRamified2SPuzzle<Image>(
    radius: Geo.Distance,
    center_x: Geo.Distance,
    R: Geo.Distance,
    draw_image: (f: Complex.ComplexFunction) => Image,
    scale: number = 1,
  ): PrincipalPuzzleWithTexture<Image> {
    const puzzle = PrincipalPuzzle.makeRamified2SPuzzle(radius, center_x, R);
    return _makeRamified2SPuzzle(puzzle, get2STextureFunction(puzzle, scale).map(draw_image));
  }

  export function getPositions<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): Map<Piece, Geo.RigidTransformation> {
    const positions = new Map(puzzle.unshifted_positions);
    for (const trans of Puzzle.getShiftTransformation(puzzle)) {
      const [sheet] = trans.sheets;
      for (const piece of Puzzle.getTwistPieces(puzzle, trans.side, sheet)!.pieces)
        positions.set(piece, Geo.compose(positions.get(piece)!, trans.trans));
    }
    return positions;
  }

  export function calculateClippedImages<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): {images:Set<ClippedImage<Image>>, rifts:Geo.Path<undefined>[]} | undefined {
    const positions = getPositions(puzzle);
    const clipped_shapes = PrincipalPuzzle.calculateClippedShapes(puzzle);
    if (clipped_shapes === undefined) return undefined;
    const images = new Set<ClippedImage<Image>>();
    for (const [piece, shapes] of clipped_shapes.principal) {
      for (const shape of shapes) {
        images.add({
          image: puzzle.textures[puzzle.texture_indices.get(piece)!],
          region: shape,
          transformation: positions.get(piece)!,
        });
      }
    }
    return {images, rifts:clipped_shapes.rifts};
  }

  export function twistTo<Image>(puzzle: PrincipalPuzzleWithTexture<Image>, side: boolean, sheet: number, angle: Geo.Angle): boolean {
    return PrincipalPuzzle.twistTo(puzzle, side, sheet, angle);
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

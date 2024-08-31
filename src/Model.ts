
import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";

function indices(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; i++)
    res.push(i);
  return res;
}

function zip<A, B>(a: A[], b: B[]): [A, B][] {
  return indices(Math.min(a.length, b.length)).map(i => [a[i], b[i]]);
}

function unrollUntilLoopback<A>(a: A, next: (a: A) => A): A[] {
  const res = [a];
  while (true) {
    a = next(a);
    if (a === res[0]) break;
    res.push(a);
  }
  return res;
}

function append<K, V>(map: Map<K, V[]>, key: K, values: V[]) {
  const slots = map.get(key);
  if (slots === undefined) {
    map.set(key, Array.from(values));
  } else {
    slots.push(...values);
  }
}

export type Edge = {
  aff: Piece;
  next_: Edge;
  prev_: Edge;
  adj: Edge;
  auxiliary: boolean;
};

export namespace Edge {
  export function next(edge: Edge): Edge {
    console.assert(!edge.auxiliary);
    let next = edge.next_;
    while (next.auxiliary) {
      next = next.adj.next_;
    }
    return next;
  }
  export function prev(edge: Edge): Edge {
    console.assert(!edge.auxiliary);
    let prev = edge.prev_;
    while (prev.auxiliary) {
      prev = prev.adj.prev_;
    }
    return prev;
  }
  export function walk(edge: Edge, steps: number[]): Edge {
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
  states: State[];
  radius: Geo.Distance;
  center_x: Geo.Distance;
  R: Geo.Distance;
};

type Arc = {
  start: Geo.Point,
  end: Geo.Point,
  center: Geo.Point,
  circle: Geo.DirectionalCircle,
};
function transformArc(arc: Arc, trans: Geo.RigidTransformation): Arc {
  return {
    start: Geo.transformPoint(arc.start, trans),
    end: Geo.transformPoint(arc.end, trans),
    center: Geo.transformPoint(arc.center, trans),
    circle: Geo.transformCircle(arc.circle, trans),
  };
}
function flipArc(arc: Arc): Arc {
  return {
    start: arc.end,
    end: arc.start,
    center: arc.center,
    circle: Geo.flipCircle(arc.circle),
  };
}

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
      linkEdges(piece.edges[i], piece.edges[(i + 1) % piece.edges.length]);
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
    let edges = pieces.flatMap(piece => [...piece.edges.slice(n), ...piece.edges.slice(0, n)]);
    edges = [...edges.slice(-n), ...edges.slice(0, -n)];
    const type = pieces[0].type;
    const piece: Piece = {type, edges, name};
    for (const i of indices(edges.length)) {
      linkEdges(edges[i], edges[(i + 1) % edges.length]);
      edges[i].aff = piece;
    }
    return piece;
  }

  function chunkPiece(name: string, piece: Piece, step: number): Piece[] {
    console.assert(piece.edges.length % step == 0);
    
    const subpieces: Piece[] = [];
    for (const n of indices(piece.edges.length / step)) {
      const type = piece.type;
      const subpiece: Piece = {type, edges: [], name: `${name}${n}`};
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

  export function edgeAt(puzzle: Puzzle, sheet: number, steps: number[]): Edge {
    return Edge.walk(puzzle.stands[sheet], steps);
  }

  function makePieces(suffix: string = ""): { pieces: Piece[], stands: Edge[] } {
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

  function makeRamifiedV1Pieces(): { pieces: Piece[], stands: Edge[] } {
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
    
    return { pieces, stands: [top.stands[0], bot.stands[0]] };
  }

  export function makeRamifiedV1Puzzle(radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): Puzzle {
    const {pieces, stands} = makeRamifiedV1Pieces();
    return {
      pieces,
      stands,
      states: [{ type: StateType.Aligned }, { type: StateType.Aligned }],
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
  export function getTwistPiece(puzzle: Puzzle, side: boolean, sheet: number): {pieces:Set<Piece>, sheets:Set<number>} {
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
    return {pieces, sheets};
  }

  // side = true: left
  function twist(puzzle: Puzzle, side: boolean, sheet: number, forward: boolean): void {
    const {sheets} = getTwistPiece(puzzle, side, sheet);
    const edgess = Array.from(sheets).map(sheet => getCircleEdges(puzzle, side, sheet));
    const edgess_adj_rotated = edgess
      .map(edges => edges.map(edge => edge.adj))
      .map(edges_adj =>
        forward ? [...edges_adj.slice(2), ...edges_adj.slice(0, 2)]
        : [...edges_adj.slice(-2), ...edges_adj.slice(0, -2)]
      );
    for (const [edges, edges_adj_rotated] of zip(edgess, edgess_adj_rotated)) {
      for (const [edge, edge_adj_rotated] of zip(edges, edges_adj_rotated)) {
        adjEdges(edge, edge_adj_rotated);
      }
    }
  }
  // side = true: left
  export function twistTo(puzzle: Puzzle, side: boolean, sheet: number, angle: Geo.Angle): boolean {
    const {sheets} = getTwistPiece(puzzle, side, sheet);
    if (side && Array.from(sheets).every(sheet => puzzle.states[sheet].type !== StateType.RightShifted)) {
      puzzle.states = puzzle.states.map((state, sheet) =>
        sheets.has(sheet) ? ({ type: StateType.LeftShifted, angle: angle }) : state
      );
      return true;
    } else if (!side && Array.from(sheets).every(sheet => puzzle.states[sheet].type !== StateType.LeftShifted)) {
      puzzle.states = puzzle.states.map((state, sheet) =>
        sheets.has(sheet) ? ({ type: StateType.RightShifted, angle: angle }) : state
      );
      return true;
    } else {
      return false;
    }
  }
  export function snap(puzzle: Puzzle): {side: boolean, sheets: Set<number>, turn: number}[] {
    const actions: {side: boolean, sheets: Set<number>, turn: number}[] = [];

    for (const sheet of indices(puzzle.states.length)) {
      const state = puzzle.states[sheet];
      if (state.type === StateType.Aligned) continue;
      const turn = Math.round(state.angle / (Math.PI/3));
      const side = state.type === StateType.LeftShifted;
      const {sheets} = getTwistPiece(puzzle, side, sheet);
      for (const sheet of sheets)
        puzzle.states[sheet] = { type: StateType.Aligned };
      for (const _ of indices(Math.abs(turn)))
        twist(puzzle, side, sheet, turn > 0);
      actions.push({side, sheets, turn});
    }
    return actions;
  }

  export function getTwistCircles(puzzle: Puzzle): [left:Geo.DirectionalCircle, right:Geo.DirectionalCircle] {
    return [
      { center: [-puzzle.center_x, 0], radius: puzzle.radius },
      { center: [+puzzle.center_x, 0], radius: puzzle.radius },
    ];
  }
  export function getShiftTransformation(puzzle: Puzzle): {trans:Geo.RigidTransformation, side:boolean, sheets: Set<number>}[] {
    const res: {trans:Geo.RigidTransformation, side:boolean, sheets: Set<number>}[] = [];
    const visited_sheets: number[] = [];
    for (const sheet of indices(puzzle.states.length)) {
      const state = puzzle.states[sheet];
      if (visited_sheets.includes(sheet)) continue;
      if (state.type === StateType.Aligned) continue;
      const side = state.type === StateType.LeftShifted;
      const {sheets} = getTwistPiece(puzzle, side, sheet);
      const trans =
        side ?
          Geo.compose(
            Geo.translate([puzzle.center_x, 0]),
            Geo.rotate(state.angle),
            Geo.translate([-puzzle.center_x, 0]),
          )
        :
          Geo.compose(
            Geo.translate([-puzzle.center_x, 0]),
            Geo.rotate(state.angle),
            Geo.translate([puzzle.center_x, 0]),
          );
      res.push({trans, side, sheets});
      visited_sheets.push(...sheets);
    }
    return res;
  }
  export function getTwistTransformation(puzzle: Puzzle, side: boolean, forward: boolean): Geo.RigidTransformation {
    if (side && forward)
      return Geo.compose(
        Geo.translate([puzzle.center_x, 0]),
        Geo.rotate(Math.PI / 3),
        Geo.translate([-puzzle.center_x, 0]),
      );
    if (side && !forward)
      return Geo.compose(
        Geo.translate([puzzle.center_x, 0]),
        Geo.rotate(-Math.PI / 3),
        Geo.translate([-puzzle.center_x, 0]),
      );
    if (!side && forward)
      return Geo.compose(
        Geo.translate([-puzzle.center_x, 0]),
        Geo.rotate(Math.PI / 3),
        Geo.translate([puzzle.center_x, 0]),
      );
    if (!side && !forward)
      return Geo.compose(
        Geo.translate([-puzzle.center_x, 0]),
        Geo.rotate(-Math.PI / 3),
        Geo.translate([puzzle.center_x, 0]),
      );
    return Geo.id_trans();
  }

  export function calculateArcs(puzzle: Puzzle): Map<Edge, Arc> {
    const left_trans = getTwistTransformation(puzzle, true, true);
    const right_trans = getTwistTransformation(puzzle, false, true);
    const [left_circle, right_circle] = getTwistCircles(puzzle);
    
    const intersections = Geo.intersectCircles(left_circle, right_circle);
    console.assert(intersections !== undefined);
    const p0 = intersections!.points[1];
    const p1 = Geo.transformPoint(p0, right_trans);
    const p2 = Geo.transformPoint(p1, left_trans);
    const c: Geo.Point = [0, puzzle.center_x / Math.sqrt(3)];
    const ang = Geo.angleBetween(right_circle.center, p2, p1);

    const arcs = new Map<Edge, Arc>();
    arcs.set(
      Puzzle.edgeAt(puzzle, 0, [0, 1, 1, 0]),
      { start: p0, end: p2, center: c, circle: right_circle },
    );
    arcs.set(
      Puzzle.edgeAt(puzzle, 0, [0, 1, -1, 1, 0]),
      { start: p2, end: p1, center: c, circle: right_circle },
    );

    for (const [edge, arc] of arcs) {
      if (!arcs.has(edge.adj)) {
        arcs.set(edge.adj, flipArc(arc));
      }
      if (!arcs.has(Edge.next(edge))) {
        if (edge.aff.type === PieceType.CornerPiece) {
          arcs.set(
            Edge.next(edge),
            transformArc(arc, Geo.rotateAround(Math.PI*2/3, arc.center)),
          );

        } else if (edge.aff.type === PieceType.EdgePiece && edge.adj.aff.type === PieceType.CornerPiece) {
          const circle = Geo.flipCircle(Geo.transformCircle(
            arc.circle,
            Geo.rotateAround(-Math.PI*2/3, arc.center),
          ));
          const end = Geo.transformPoint(arc.end, Geo.rotateAround(ang, circle.center));
          arcs.set(
            Edge.next(edge),
            { start: arc.end, end, center: arc.center, circle },
          );

        } else if (edge.aff.type === PieceType.EdgePiece && edge.adj.aff.type !== PieceType.CornerPiece) {
          const center = Geo.transformPoint(
            arc.center,
            Geo.rotateAround(Math.PI/3, arc.circle.center)
          );
          const circle = Geo.flipCircle(Geo.transformCircle(
            arc.circle,
            Geo.rotateAround(-Math.PI*2/3, center),
          ));
          const end = Geo.transformPoint(
            arc.end,
            Geo.rotateAround(-Math.PI*2/3, center),
          );
          arcs.set(
            Edge.next(edge),
            { start: arc.end, end, center, circle },
          );
        }
      }
    }

    for (const shift_trans of getShiftTransformation(puzzle)) {
      const [sheet] = shift_trans.sheets;
      const {pieces} = getTwistPiece(puzzle, shift_trans.side, sheet);
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

  function angles(puzzle: Puzzle): [angle1:Geo.Angle, angle2:Geo.Angle] {
    const left_trans = getTwistTransformation(puzzle, true, true);
    const right_trans = getTwistTransformation(puzzle, false, true);
    const [left_circle, right_circle] = getTwistCircles(puzzle);
    
    const intersections = Geo.intersectCircles(left_circle, right_circle);
    console.assert(intersections !== undefined);
    const p0 = intersections!.points[1];
    const p1 = Geo.transformPoint(p0, right_trans);
    const p2 = Geo.transformPoint(p1, left_trans);
    const ang = Geo.angleBetween(right_circle.center, p2, p1);
    return [ang, Math.PI/3 - ang];
  }

  function isShortEdge(edge: Edge): boolean {
    return edge.aff.type === PieceType.EdgePiece
      && edge.adj.aff.type !== PieceType.CornerPiece
      || edge.aff.type === PieceType.BoundaryPiece
      && edge.adj.aff.type === PieceType.EdgePiece
      || edge.aff.type === PieceType.CenterPiece
      && edge.adj.aff.type === PieceType.EdgePiece;
  }

  export function getAdjacentEdges(
    puzzle: Puzzle, edge: Edge
  ): {edge:Edge, offset:Geo.Angle, from:Geo.Angle, to:Geo.Angle}[] | undefined {
    if (edge.auxiliary) return undefined;
    
    const [short_angle, long_angle] = angles(puzzle);
    const angle = isShortEdge(edge) ? short_angle : long_angle;

    const cycles = getShiftTransformation(puzzle)
      .map(shifted_trans => {
        const [sheet] = shifted_trans.sheets;
        return [
          getCircleEdges(puzzle, shifted_trans.side, sheet),
          sheet,
        ] as const
      }
      )
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
    cycle.push(...cycle.splice(0, cycle.indexOf(edge)));
    if (puzzle.states[sheet].type === StateType.Aligned)
      throw new Error("unreachable");
    const shifted_angle = puzzle.states[sheet].angle;

    const res: {edge:Edge, offset:Geo.Angle, from:Geo.Angle, to:Geo.Angle}[] = [];
    if (shifted_angle >= 0) {
      let offset = -shifted_angle;
      for (let n = 0;; n = (n + 1) % cycle.length) {
        const adj_edge = cycle[n].adj;
        const adj_angle = isShortEdge(adj_edge) ? short_angle : long_angle;
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
        const adj_edge = cycle[n].adj;
        const adj_angle = isShortEdge(adj_edge) ? short_angle : long_angle;
        offset = -shifted_angle + adj_angle;
      }
      for (let n = 0;; n = (n + cycle.length - 1) % cycle.length) {
        const adj_edge = cycle[n].adj;
        const adj_angle = isShortEdge(adj_edge) ? short_angle : long_angle;
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

export type PrincipalPuzzle = {
  space: Puzzle;
  rift_offset: number; // -1 ~ +1
  rift_angle: Geo.Angle; // 0 ~ 4 pi
  ramified_angles: {
    left: [piece:Piece, n:number]; // n: 0 ~ 12
    right: [piece:Piece, n:number]; // n: 0 ~ 12
  };
};

export namespace PrincipalPuzzle {
  const MAX_RIFT_OFFSET = 0.8;

  export function make(radius: Geo.Distance, center_x: Geo.Distance, R: Geo.Distance): PrincipalPuzzle {
    console.assert(center_x > 0);
    console.assert(radius > 0);
    console.assert(center_x < radius);
    console.assert(center_x * 2 > radius);
    console.assert(R > center_x + radius);

    const space = Puzzle.makeRamifiedV1Puzzle(radius, center_x, R);
    const left_center_piece = Puzzle.edgeAt(space, 0, [0, 1, -1, 1]).aff;
    const right_center_piece = Puzzle.edgeAt(space, 1, [0, 1, -1, -1]).aff;

    return {
      space,
      rift_offset: 0,
      rift_angle: 0,
      ramified_angles: {
        left: [left_center_piece, 0],
        right: [right_center_piece, 0],
      },
    };
  }

  // `offset` is the offset of the hyperbola curve
  // `angle` is the angle of vector from the focus to the point on the hyperbola curve
  // when offset < 0: `angle` is the angle `(f1, f2, point)`
  // when offset > 0: `angle` is the angle `(f2, point, f1)`
  // `is_solid` means if `point` is on the main focus side
  function getHyperbolaPoint(f1: Geo.Point, f2: Geo.Point, offset: number, angle: Geo.Angle): [point:Geo.Point, is_solid:boolean] {
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
    } else {
      const d = Geo.normalize(Geo.sub(f1, f2));
      const d_ = Geo.transform(d, Geo.rotate(-angle));
      return [Geo.add(f2, Geo.mul(d_, r)), r > 0];
    }
  }

  function getHyperbolaFromPoint(f1: Geo.Point, f2: Geo.Point, point: Geo.Point): {offset:number, angle:Geo.Angle} {
    const a = (Geo.norm(Geo.sub(f1, point)) - Geo.norm(Geo.sub(f2, point))) / 2;
    const offset = a / (Geo.norm(Geo.sub(f1, f2)) / 2);
    const angle = offset < 0 ? Geo.angleBetween(f1, f2, point) : Geo.angleBetween(f2, point, f1);
    return {offset, angle};
  }

  function getRiftAngles(f1: Geo.Point, f2: Geo.Point, offset: number, angle: Geo.Angle): [left_angle:Geo.Angle, right_angle:Geo.Angle] {
    const [middle, is_solid] = getHyperbolaPoint(f1, f2, offset, angle);

    function makeSameTurn(angle: number, ref_angle: number): number {
      const angle_to_0 = Math.abs(Geo.mod(ref_angle + Math.PI, Math.PI*2) - Math.PI);
      if (angle_to_0 < Math.PI/2) {
        const n = Math.floor((ref_angle + Math.PI) / (Math.PI*2));
        return Geo.mod(angle + Math.PI, Math.PI*2) - Math.PI + n * Math.PI*2;
      } else {
        const n = Math.floor(ref_angle / (Math.PI*2));
        return Geo.mod(angle, Math.PI*2) + n * Math.PI*2;
      }
    }

    if (offset < 0) {
      const right_angle = -(Geo.angleBetween(f2, f1, middle) + (is_solid ? 0 : Math.PI));
      return [angle, makeSameTurn(right_angle, angle)];
    } else {
      const left_angle = Geo.angleBetween(f1, f2, middle) + (is_solid ? 0 : Math.PI);
      return [makeSameTurn(left_angle, angle), angle];
    }
  }

  // left[1]: angle of rift relative to left[0].edges[0], ccw as positive
  // right[1]: angle of rift relative to right[0].edges[0], cw as positive
  function getRamifiedAngles(puzzle: PrincipalPuzzle): {left:[piece:Piece, angle:Geo.Angle], right:[piece:Piece, angle:Geo.Angle]} {
    const left_center: Geo.Vector2 = [-puzzle.space.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.space.center_x, 0];
    const [left_angle, right_angle] = getRiftAngles(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);

    const [left_piece1, left_piece1_n] = puzzle.ramified_angles.left;
    const left_piece1_angle =
      -Math.PI/6 + left_piece1_n * Math.PI/3
      + (puzzle.space.states[0].type === StateType.LeftShifted ? puzzle.space.states[0].angle : 0);

    const [right_piece1, right_piece1_n] = puzzle.ramified_angles.right;
    const right_piece1_angle =
      Math.PI/6 - right_piece1_n * Math.PI/3
      - (puzzle.space.states[0].type === StateType.RightShifted ? puzzle.space.states[0].angle : 0);

    return {
      left: [left_piece1, left_angle - left_piece1_angle],
      right: [right_piece1, right_angle - right_piece1_angle],
    };
  }

  export function twistTo(puzzle: PrincipalPuzzle, angle: Geo.Angle, side: boolean): boolean {
    return Puzzle.twistTo(puzzle.space, side, 0, angle);
  }
  export function snap(puzzle: PrincipalPuzzle): {side: boolean, sheets:Set<number>, turn: number}[] {
    const trans = Puzzle.snap(puzzle.space);
    for (const {side, sheets, turn} of trans) {
      if (side) {
        let n = puzzle.ramified_angles.left[1] + turn;
        n = (n % 12 + 12) % 12;
        puzzle.ramified_angles.left[1] = n;
      } else {
        let n = puzzle.ramified_angles.right[1] + turn;
        n = (n % 12 + 12) % 12;
        puzzle.ramified_angles.right[1] = n;
      }
    }
    return trans;
  }
  export function setRift(puzzle: PrincipalPuzzle, angle: Geo.Angle, offset: number): void {
    angle = Geo.mod(angle, Math.PI*4);
    puzzle.rift_angle = angle;

    offset = Math.max(Math.min(offset, MAX_RIFT_OFFSET), -MAX_RIFT_OFFSET);
    puzzle.rift_offset = offset;
  }
  export function calculateRiftTurningPoint(puzzle: PrincipalPuzzle): Geo.Point | undefined {
    const left_center: Geo.Vector2 = [-puzzle.space.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.space.center_x, 0];
    const [point, is_solid] = getHyperbolaPoint(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);
    if (!is_solid) return undefined;
    return point;
  }
  export function calculateRiftAngleOffsetFromPoint(puzzle: PrincipalPuzzle, point: Geo.Point): [angle:Geo.Angle, offset:number] {
    const left_center: Geo.Vector2 = [-puzzle.space.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.space.center_x, 0];
    const {offset, angle} = getHyperbolaFromPoint(left_center, right_center, point);
    const rift_angle = Geo.as0to2pi(angle - puzzle.rift_angle + Math.PI) - Math.PI + puzzle.rift_angle;
    const rift_offset = Math.max(Math.min(offset, MAX_RIFT_OFFSET), -MAX_RIFT_OFFSET);
    return [rift_angle, rift_offset];
  }

  export function calculateRift(puzzle: PrincipalPuzzle): Geo.Path<undefined> {
    const left_center: Geo.Vector2 = [-puzzle.space.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.space.center_x, 0];
    
    const [middle, is_solid] = getHyperbolaPoint(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);

    if (is_solid && Geo.norm(middle) < puzzle.space.R * 2) {
      return {
        is_closed: false,
        start: left_center,
        segs: [
          Geo.makePathSegLine(left_center, middle, undefined),
          Geo.makePathSegLine(middle, right_center, undefined),
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
    const left_inf = calculateInfPoint(left_center, middle, !is_solid, puzzle.space.R * 1.5);
    const right_inf = calculateInfPoint(right_center, middle, !is_solid, puzzle.space.R * 1.5);
    const inf_circle: Geo.DirectionalCircle = { center: [0,0], radius: puzzle.space.R * 1.5 };
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

  function makeBoundaryShapes(
    puzzle: Puzzle,
    arcs: Map<Edge, Arc>,
    sheet: number
  ): Map<Piece, Geo.Path<Edge>> {
    const pieceBR = Puzzle.edgeAt(puzzle, sheet, []).aff;
    const pieceBL = Puzzle.edgeAt(puzzle, sheet, [-1, 0]).aff;

    const circle: Geo.DirectionalCircle = { center: [0, 0], radius: puzzle.R };

    return new Map([pieceBL, pieceBR].map(piece => {
      const path: Geo.Path<Edge> = { is_closed: true, segs: [] };
      for (const edge of piece.edges.slice(0, 9)) {
        const arc = arcs.get(edge)!;
        path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
      }
      const p1 = arcs.get(piece.edges[8])!.end;
      const p2: Geo.Vector2 = [0, p1[1] > 0 ? puzzle.R : -puzzle.R];
      const p3: Geo.Vector2 = [0, p1[1] > 0 ? -puzzle.R : puzzle.R];
      const p4 = arcs.get(piece.edges[0])!.start;
      path.segs.push(Geo.makePathSegLine(p1, p2, piece.edges[9]));
      path.segs.push(Geo.makePathSegArc(p2, p3, circle, piece.edges[10]));
      path.segs.push(Geo.makePathSegLine(p3, p4, piece.edges[11]));
      return [piece, path];
    }));
  }

  export function calculateShapes(puzzle: PrincipalPuzzle): Map<Piece, Geo.Path<Edge>> {
    const [left_circle, right_circle] = Puzzle.getTwistCircles(puzzle.space);

    const arcs = Puzzle.calculateArcs(puzzle.space);

    const result = new Map<Piece, Geo.Path<Edge>>();

    const left_center_pieces = new Set(Puzzle.getCenterEdges(puzzle.space, true, 0).map(edge => edge.adj.aff));
    for (const piece of puzzle.space.pieces) {
      const path: Geo.Path<Edge> = { is_closed: true, segs: [] };
      if (piece.type === PieceType.CenterPiece) {
        const center_point = left_center_pieces.has(piece) ? left_circle.center : right_circle.center;
        path.segs.push(Geo.makePathSegLine(center_point, arcs.get(piece.edges[1])!.start, piece.edges[0]));
        for (const edge of piece.edges.slice(1, 3)) {
          const arc = arcs.get(edge)!;
          path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
        }
        path.segs.push(Geo.makePathSegLine(arcs.get(piece.edges[2])!.end, center_point, piece.edges[3]));

      } else if (piece.type === PieceType.CornerPiece || piece.type === PieceType.EdgePiece) {
        for (const edge of piece.edges) {
          const arc = arcs.get(edge)!;
          path.segs.push(Geo.makePathSegArc(arc.start, arc.end, arc.circle, edge));
        }
      }
      result.set(piece, path);
    }

    for (const sheet of [0, 1]) {
      for (const [piece, shape] of makeBoundaryShapes(puzzle.space, arcs, sheet)) {
        result.set(piece, shape);
      }
    }

    return result;
  }

  export function calculateClippedShapes(
    puzzle: PrincipalPuzzle,
  ): {
    principal: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
    complementary: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
  } | undefined {
    const shapes = calculateShapes(puzzle);
    const rift = calculateRift(puzzle);
    let res = calculateClippedShapes_(shapes, rift, puzzle);
    const RETRY = 5;
    const PERTURBATION = 1e-4;
    for (const _ of indices(RETRY)) {
      if (res !== undefined) break;
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

  function calculateClippedShapes_(
    shapes: Map<Piece, Geo.Path<Edge>>,
    rift: Geo.Path<undefined>,
    puzzle: PrincipalPuzzle,
  ): {
    principal: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
    complementary: Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>,
  } | undefined {
    const cutted_shapes = new Map<Piece, Geo.Path<Geo.CutSource<Edge, undefined>>[]>();

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
    let prin_shape0: Geo.Path<Geo.CutSource<Edge, undefined>> | undefined = undefined;
    {
      const ramified_angles = getRamifiedAngles(puzzle);
      const [left_piece1, left_piece1_ramified_angle] = ramified_angles.left;
      const [right_piece1, right_piece1_ramified_angle] = ramified_angles.right;

      const left_center_pieces = unrollUntilLoopback(left_piece1, piece => piece.edges[3].adj.aff);
      const right_center_pieces = unrollUntilLoopback(right_piece1, piece => piece.edges[3].adj.aff);

      const left_ramified_piece_index =
        Geo.mod(Math.floor(left_piece1_ramified_angle / (Math.PI*2/3)), 6);
      const left_ramified_piece_index_ = Geo.mod(left_ramified_piece_index + 3, 6);
      const right_ramified_piece_index =
        6 - 1 - Geo.mod(Math.floor(right_piece1_ramified_angle / (Math.PI*2/3)), 6);
      const right_ramified_piece_index_ = Geo.mod(right_ramified_piece_index + 3, 6);

      for (const piece of left_center_pieces) {
        const shape = shapes.get(piece)!;
        const is_ramified =
          piece === left_center_pieces[left_ramified_piece_index]
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
          prin_shape0 = res.find(path =>
            path.segs.some(seg =>
              seg.source.type === Geo.CutSourceType.LeftCut
              && seg.source.ref === rift.segs[0]
              && seg.source.from === 0
            )
          );
          console.assert(prin_shape0 !== undefined);
        }
      }

      for (const piece of right_center_pieces) {
        const shape = shapes.get(piece)!;
        const is_ramified =
          piece === right_center_pieces[right_ramified_piece_index]
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
    const prin_cutted_shapes = new Set<Geo.Path<Geo.CutSource<Edge, undefined>>>();
    prin_cutted_shapes.add(prin_shape0);
    
    const SMALLEST_ANGLE = 0.01;
    for (const path of prin_cutted_shapes) {
      for (const seg of path.segs) {
        if (seg.source.type !== Geo.CutSourceType.Seg) continue;

        // find adjacent edg
        const edge = seg.source.ref.source;
        const len = shapes.get(edge.aff)!.segs[edge.aff.edges.indexOf(edge)].len;
        const adjs =
          edge.auxiliary ? [{ edge: edge.adj, offset: len, from: 0, to: len }]
          : Puzzle.getAdjacentEdges(puzzle.space, edge)!;
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
}

export type ClippedImage<Image> = {
  image: Image;
  transformation: Geo.RigidTransformation;
  region: Geo.Path<Geo.CutSource<Edge, undefined>>;
};

function getTextureFunction(
  puzzle: PrincipalPuzzle,
  scale: number,
): [Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction] {
  const d = puzzle.space.center_x;
  
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

export type PrincipalPuzzleWithTexture<Image> = {
  puzzle: PrincipalPuzzle;
  unshifted_positions: Map<Piece, Geo.RigidTransformation>;
  texture_indices: Map<Piece, number>;
  textures: [Image, Image, Image, Image];
};

export namespace PrincipalPuzzleWithTexture {
  function _make<Image>(
    puzzle: PrincipalPuzzle,
    f: [Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction],
    draw_image: (f: Complex.ComplexFunction) => Image,
  ): PrincipalPuzzleWithTexture<Image> {
    const unshifted_positions = new Map(puzzle.space.pieces.map(piece => [piece, Geo.id_trans()]));

    const texture_indices = new Map<Piece, number>();
    {
      const edgeL = Puzzle.edgeAt(puzzle.space, 0, [0, 1, -1, 1, 0]);
      const edgeR = Puzzle.edgeAt(puzzle.space, 1, [0, 1, -1, -1, 0]);
      texture_indices.set(edgeL.aff, 3);
      texture_indices.set(Edge.walk(edgeL, [0]).aff, 3);
      texture_indices.set(Edge.walk(edgeL, [2]).aff, 3);
      texture_indices.set(edgeR.aff, 2);
      texture_indices.set(Edge.walk(edgeR, [0]).aff, 2);
      texture_indices.set(Edge.walk(edgeR, [2]).aff, 2);
      
      const prin = new Set<Piece>();
      prin.add(Puzzle.edgeAt(puzzle.space, 0, []).aff);
      for (const piece of prin) {
        for (const edge of piece.edges) {
          const adj_piece = edge.adj.aff;
          if (adj_piece.type !== PieceType.InfPiece && !texture_indices.has(adj_piece)) {
            prin.add(adj_piece);
          }
        }
      }
      
      const comp = new Set<Piece>();
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

  export function make<Image>(
    radius: Geo.Distance,
    center_x: Geo.Distance,
    R: Geo.Distance,
    draw_image: (f: Complex.ComplexFunction) => Image,
    scale: number = 1,
  ): PrincipalPuzzleWithTexture<Image> {
    const puzzle = PrincipalPuzzle.make(radius, center_x, R);
    return _make(puzzle, getTextureFunction(puzzle, scale), draw_image);
  }

  export function getPositions<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): Map<Piece, Geo.RigidTransformation> {
    const positions = new Map(puzzle.unshifted_positions);
    for (const trans of Puzzle.getShiftTransformation(puzzle.puzzle.space)) {
      const [sheet] = trans.sheets;
      for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, trans.side, sheet).pieces)
        positions.set(piece, Geo.compose(positions.get(piece)!, trans.trans));
    }
    return positions;
  }

  export function calculateClippedImages<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): Set<ClippedImage<Image>> | undefined {
    const positions = getPositions(puzzle);
    const clipped_shapes = PrincipalPuzzle.calculateClippedShapes(puzzle.puzzle);
    if (clipped_shapes === undefined) return undefined;
    const res = new Set<ClippedImage<Image>>();
    for (const [piece, shapes] of clipped_shapes.principal) {
      for (const shape of shapes) {
        res.add({
          image: puzzle.textures[puzzle.texture_indices.get(piece)!],
          region: shape,
          transformation: positions.get(piece)!,
        });
      }
    }
    return res;
  }

  export function twistTo<Image>(puzzle: PrincipalPuzzleWithTexture<Image>, angle: Geo.Angle, side: boolean): void {
    PrincipalPuzzle.twistTo(puzzle.puzzle, angle, side);
  }
  export function snap<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): boolean {
    const trans = PrincipalPuzzle.snap(puzzle.puzzle);
    if (trans.length === 0) return false;

    for (const {side, sheets, turn} of trans) {
      const twist_trans1 = Puzzle.getTwistTransformation(puzzle.puzzle.space, side, turn > 0);
      let twist_trans = Geo.id_trans();
      for (const n of indices(Math.abs(turn)))
        twist_trans = Geo.compose(twist_trans, twist_trans1);

      const [sheet] = sheets;
      for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, side, sheet).pieces) {
        let trans = puzzle.unshifted_positions.get(piece)!;
        trans = Geo.compose(trans, twist_trans);
        puzzle.unshifted_positions.set(piece, trans);
      }
    }
    return true;
  }
  export function setRift<Image>(puzzle: PrincipalPuzzleWithTexture<Image>, angle: Geo.Angle, offset: number): void {
    PrincipalPuzzle.setRift(puzzle.puzzle, angle, offset);
  }
}

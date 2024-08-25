
import * as Geo from "./Geometry2D.js";
import * as Complex from "./Complex.js";

function indices(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; i++)
    res.push(i);
  return res;
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

// angle between edges should not be larger than PI
// arc should not be closed to 2PI
// edges of a piece should not intersect with itself
// it should form a loop counterclockwise loop except for InfPiece
export type Edge = {
  aff: Piece;
  next: Edge;
  prev: Edge;
  adj: Edge;
};

export enum PieceType { CornerPiece, EdgePiece, CenterPiece, BoundaryPiece, InfPiece }

export type Piece = {
  type: PieceType;
  edges: Edge[];
  name: string;
};

function makeEdge(piece: Piece): Edge {
  const edge = {
    aff: piece,
    next: undefined,
    prev: undefined,
    adj: undefined,
  } as unknown as Edge;
  edge.next = edge;
  edge.prev = edge;
  edge.adj = edge;
  return edge;
}

function linkEdges(edge1: Edge, edge2: Edge): void {
  edge1.next = edge2;
  edge2.prev = edge1;
}

function adjEdges(edge1: Edge, edge2: Edge): void {
  edge1.adj = edge2;
  edge2.adj = edge1;
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

function makeBoundaryPiece(name: string): Piece {
  return makeEdges({type: PieceType.BoundaryPiece, edges: [], name}, 12);
}

function makeInfPiece(name: string): Piece {
  return makeEdges({type: PieceType.InfPiece, edges: [], name}, 2);
}

function makeCenterPiece(name: string): Piece {
  return makeEdges({type: PieceType.CenterPiece, edges: [], name}, 4);
}

export type Puzzle = {
  pieces: Piece[];
  stands: Edge[]; // boundary piece's edges at the top intersection point
};

export namespace Puzzle {
  export function make(): Puzzle {
    // top pieces

    // edges[0]: edge started with center piece

    // piece0L: piece touched above intersection point
    const piece0L = makeCornerPiece("0L");
    const piece1L = makeCornerPiece("1L");
    const piece2L = makeCornerPiece("2L");
    const piece3L = makeCornerPiece("3L");
    const piece4L = makeCornerPiece("4L");

    // piece0R: piece touched below intersection point
    const piece0R = makeCornerPiece("0R");
    const piece1R = makeCornerPiece("1R");
    const piece2R = makeCornerPiece("2R");
    const piece3R = makeCornerPiece("3R");
    const piece4R = makeCornerPiece("4R");

    // edges[0]: edge adj to center piece

    // piece01L: piece between piece0l and piece1l
    const piece01L = makeEdgePiece("01L");
    const piece12L = makeEdgePiece("12L");
    const piece23L = makeEdgePiece("23L");
    const piece34L = makeEdgePiece("34L");
    const piece45L = makeEdgePiece("45L");

    const piece01R = makeEdgePiece("01R");
    const piece12R = makeEdgePiece("12R");
    const piece23R = makeEdgePiece("23R");
    const piece34R = makeEdgePiece("34R");
    const piece45R = makeEdgePiece("45R");

    // edges[0]: edge started with below intersection point
    const pieceBL = makeBoundaryPiece("BL");
    // edges[0]: edge started with above intersection point
    const pieceBR = makeBoundaryPiece("BR");

    const pieceINF = makeInfPiece("INF");

    // bottom pieces

    const piece0L_ = makeCornerPiece("0L_");
    const piece1L_ = makeCornerPiece("1L_");
    const piece2L_ = makeCornerPiece("2L_");
    const piece3L_ = makeCornerPiece("3L_");
    const piece4L_ = makeCornerPiece("4L_");

    const piece0R_ = makeCornerPiece("0R_");
    const piece1R_ = makeCornerPiece("1R_");
    const piece2R_ = makeCornerPiece("2R_");
    const piece3R_ = makeCornerPiece("3R_");
    const piece4R_ = makeCornerPiece("4R_");

    const piece01L_ = makeEdgePiece("01L_");
    const piece12L_ = makeEdgePiece("12L_");
    const piece23L_ = makeEdgePiece("23L_");
    const piece34L_ = makeEdgePiece("34L_");
    const piece45L_ = makeEdgePiece("45L_");

    const piece01R_ = makeEdgePiece("01R_");
    const piece12R_ = makeEdgePiece("12R_");
    const piece23R_ = makeEdgePiece("23R_");
    const piece34R_ = makeEdgePiece("34R_");
    const piece45R_ = makeEdgePiece("45R_");

    const pieceBL_ = makeBoundaryPiece("BL_");
    const pieceBR_ = makeBoundaryPiece("BR_");
    const pieceINF_ = makeInfPiece("INF_");

    // ramified pieces and middle pieces

    // edges[0]: edge outgoing the center

    // pieceCL1.edges[1]: edge outgoing the branch cut
    const pieceCL1 = makeCenterPiece("CL1");
    const pieceCL2 = makeCenterPiece("CL2");
    const pieceCL3 = makeCenterPiece("CL3");
    const pieceCL1_ = makeCenterPiece("CL1_");
    const pieceCL2_ = makeCenterPiece("CL2_");
    const pieceCL3_ = makeCenterPiece("CL3_");

    // pieceCR1.edges[1]: edge outgoing the branch cut
    const pieceCR1 = makeCenterPiece("CR1");
    const pieceCR2 = makeCenterPiece("CR2");
    const pieceCR3 = makeCenterPiece("CR3");
    const pieceCR1_ = makeCenterPiece("CR1_");
    const pieceCR2_ = makeCenterPiece("CR2_");
    const pieceCR3_ = makeCenterPiece("CR3_");

    // edges[0]: edge outgoing the branch cut

    // edges[0]: adj to left center
    const piece50L = makeEdgePiece("50L");
    // edges[0]: adj to right center
    const piece50R = makeEdgePiece("50R");

    // adj boundary
    adjEdges(pieceBL.edges[9], pieceBR.edges[11]);
    adjEdges(pieceBL.edges[11], pieceBR.edges[9]);

    adjEdges(pieceBR.edges[10], pieceINF.edges[0]);
    adjEdges(pieceBL.edges[10], pieceINF.edges[1]);
    
    adjEdges(pieceBL_.edges[9], pieceBR_.edges[11]);
    adjEdges(pieceBL_.edges[11], pieceBR_.edges[9]);

    adjEdges(pieceBR_.edges[10], pieceINF_.edges[0]);
    adjEdges(pieceBL_.edges[10], pieceINF_.edges[1]);
    
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

    adjEdges(piece01L_.edges[2], pieceBL_.edges[9 - 1 - 0]);
    adjEdges(piece12L_.edges[2], pieceBL_.edges[9 - 1 - 2]);
    adjEdges(piece23L_.edges[2], pieceBL_.edges[9 - 1 - 4]);
    adjEdges(piece34L_.edges[2], pieceBL_.edges[9 - 1 - 6]);
    adjEdges(piece45L_.edges[2], pieceBL_.edges[9 - 1 - 8]);

    adjEdges(piece1L_.edges[1], pieceBL_.edges[9 - 1 - 1]);
    adjEdges(piece2L_.edges[1], pieceBL_.edges[9 - 1 - 3]);
    adjEdges(piece3L_.edges[1], pieceBL_.edges[9 - 1 - 5]);
    adjEdges(piece4L_.edges[1], pieceBL_.edges[9 - 1 - 7]);

    adjEdges(piece01R_.edges[2], pieceBR_.edges[9 - 1 - 0]);
    adjEdges(piece12R_.edges[2], pieceBR_.edges[9 - 1 - 2]);
    adjEdges(piece23R_.edges[2], pieceBR_.edges[9 - 1 - 4]);
    adjEdges(piece34R_.edges[2], pieceBR_.edges[9 - 1 - 6]);
    adjEdges(piece45R_.edges[2], pieceBR_.edges[9 - 1 - 8]);

    adjEdges(piece1R_.edges[1], pieceBR_.edges[9 - 1 - 1]);
    adjEdges(piece2R_.edges[1], pieceBR_.edges[9 - 1 - 3]);
    adjEdges(piece3R_.edges[1], pieceBR_.edges[9 - 1 - 5]);
    adjEdges(piece4R_.edges[1], pieceBR_.edges[9 - 1 - 7]);

    // adj center
    adjEdges(pieceCL1.edges[3], pieceCL2.edges[0]);
    adjEdges(pieceCL2.edges[3], pieceCL3.edges[0]);
    adjEdges(pieceCL3.edges[3], pieceCL1_.edges[0]);
    adjEdges(pieceCL1_.edges[3], pieceCL2_.edges[0]);
    adjEdges(pieceCL2_.edges[3], pieceCL3_.edges[0]);
    adjEdges(pieceCL3_.edges[3], pieceCL1.edges[0]);

    adjEdges(pieceCR1.edges[3], pieceCR2.edges[0]);
    adjEdges(pieceCR2.edges[3], pieceCR3.edges[0]);
    adjEdges(pieceCR3.edges[3], pieceCR1_.edges[0]);
    adjEdges(pieceCR1_.edges[3], pieceCR2_.edges[0]);
    adjEdges(pieceCR2_.edges[3], pieceCR3_.edges[0]);
    adjEdges(pieceCR3_.edges[3], pieceCR1.edges[0]);

    adjEdges(piece50R.edges[2], pieceCL1.edges[1]);

    adjEdges(piece01L.edges[0], pieceCL1.edges[2]);
    adjEdges(piece12L.edges[0], pieceCL2.edges[1]);
    adjEdges(piece23L.edges[0], pieceCL2.edges[2]);
    adjEdges(piece34L.edges[0], pieceCL3.edges[1]);
    adjEdges(piece45L.edges[0], pieceCL3.edges[2]);

    adjEdges(piece50L.edges[0], pieceCL1_.edges[1]);

    adjEdges(piece01L_.edges[0], pieceCL1_.edges[2]);
    adjEdges(piece12L_.edges[0], pieceCL2_.edges[1]);
    adjEdges(piece23L_.edges[0], pieceCL2_.edges[2]);
    adjEdges(piece34L_.edges[0], pieceCL3_.edges[1]);
    adjEdges(piece45L_.edges[0], pieceCL3_.edges[2]);

    adjEdges(piece50L.edges[2], pieceCR1.edges[1]);

    adjEdges(piece01R.edges[0], pieceCR1.edges[2]);
    adjEdges(piece12R.edges[0], pieceCR2.edges[1]);
    adjEdges(piece23R.edges[0], pieceCR2.edges[2]);
    adjEdges(piece34R.edges[0], pieceCR3.edges[1]);
    adjEdges(piece45R.edges[0], pieceCR3.edges[2]);

    adjEdges(piece50R.edges[0], pieceCR1_.edges[1]);

    adjEdges(piece01R_.edges[0], pieceCR1_.edges[2]);
    adjEdges(piece12R_.edges[0], pieceCR2_.edges[1]);
    adjEdges(piece23R_.edges[0], pieceCR2_.edges[2]);
    adjEdges(piece34R_.edges[0], pieceCR3_.edges[1]);
    adjEdges(piece45R_.edges[0], pieceCR3_.edges[2]);

    // adj corner, edge
    adjEdges(piece0L.edges[2], piece01L.edges[1]);
    adjEdges(piece1L.edges[2], piece12L.edges[1]);
    adjEdges(piece2L.edges[2], piece23L.edges[1]);
    adjEdges(piece3L.edges[2], piece34L.edges[1]);
    adjEdges(piece4L.edges[2], piece45L.edges[1]);

    adjEdges(piece1L.edges[0], piece01L.edges[3]);
    adjEdges(piece2L.edges[0], piece12L.edges[3]);
    adjEdges(piece3L.edges[0], piece23L.edges[3]);
    adjEdges(piece4L.edges[0], piece34L.edges[3]);

    adjEdges(piece0R.edges[1], piece45L.edges[3]);

    adjEdges(piece0L_.edges[2], piece01L_.edges[1]);
    adjEdges(piece1L_.edges[2], piece12L_.edges[1]);
    adjEdges(piece2L_.edges[2], piece23L_.edges[1]);
    adjEdges(piece3L_.edges[2], piece34L_.edges[1]);
    adjEdges(piece4L_.edges[2], piece45L_.edges[1]);

    adjEdges(piece1L_.edges[0], piece01L_.edges[3]);
    adjEdges(piece2L_.edges[0], piece12L_.edges[3]);
    adjEdges(piece3L_.edges[0], piece23L_.edges[3]);
    adjEdges(piece4L_.edges[0], piece34L_.edges[3]);

    adjEdges(piece0R_.edges[1], piece45L_.edges[3]);

    adjEdges(piece0R.edges[2], piece01R.edges[1]);
    adjEdges(piece1R.edges[2], piece12R.edges[1]);
    adjEdges(piece2R.edges[2], piece23R.edges[1]);
    adjEdges(piece3R.edges[2], piece34R.edges[1]);
    adjEdges(piece4R.edges[2], piece45R.edges[1]);

    adjEdges(piece1R.edges[0], piece01R.edges[3]);
    adjEdges(piece2R.edges[0], piece12R.edges[3]);
    adjEdges(piece3R.edges[0], piece23R.edges[3]);
    adjEdges(piece4R.edges[0], piece34R.edges[3]);

    adjEdges(piece0L.edges[1], piece45R.edges[3]);

    adjEdges(piece0R_.edges[2], piece01R_.edges[1]);
    adjEdges(piece1R_.edges[2], piece12R_.edges[1]);
    adjEdges(piece2R_.edges[2], piece23R_.edges[1]);
    adjEdges(piece3R_.edges[2], piece34R_.edges[1]);
    adjEdges(piece4R_.edges[2], piece45R_.edges[1]);

    adjEdges(piece1R_.edges[0], piece01R_.edges[3]);
    adjEdges(piece2R_.edges[0], piece12R_.edges[3]);
    adjEdges(piece3R_.edges[0], piece23R_.edges[3]);
    adjEdges(piece4R_.edges[0], piece34R_.edges[3]);

    adjEdges(piece0L_.edges[1], piece45R_.edges[3]);

    // adj middle edge pieces
    adjEdges(piece50L.edges[1], piece0R.edges[0]);
    adjEdges(piece50L.edges[3], piece0L_.edges[0]);
    adjEdges(piece50R.edges[1], piece0L.edges[0]);
    adjEdges(piece50R.edges[3], piece0R_.edges[0]);
    
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
        piece0L_,
        piece1L_,
        piece2L_,
        piece3L_,
        piece4L_,
        piece0R_,
        piece1R_,
        piece2R_,
        piece3R_,
        piece4R_,
        piece01L_,
        piece12L_,
        piece23L_,
        piece34L_,
        piece45L_,
        piece01R_,
        piece12R_,
        piece23R_,
        piece34R_,
        piece45R_,
        pieceBL_,
        pieceBR_,
        pieceINF_,
        pieceCL1,
        pieceCL2,
        pieceCL3,
        pieceCL1_,
        pieceCL2_,
        pieceCL3_,
        pieceCR1,
        pieceCR2,
        pieceCR3,
        pieceCR1_,
        pieceCR2_,
        pieceCR3_,
        piece50L,
        piece50R,
      ],
      stands: [pieceBR.edges[0], pieceBR_.edges[0]],
    };
  }

  // side = true: left
  export function getCircleEdges(puzzle: Puzzle, side: boolean, sheet: number): Edge[] {
    const edge0 =
      side ?
        puzzle.stands[sheet].adj.next.adj.prev.adj.prev
      : puzzle.stands[sheet].adj.next.adj.prev.adj.next;
    return unrollUntilLoopback(edge0, edge => edge.next.adj.next);
  }

  // side = true: left
  export function getCenterEdges(puzzle: Puzzle, side: boolean, sheet: number): Edge[] {
    const edge0 =
      side ?
        puzzle.stands[sheet].adj.next.adj.prev.adj.next
      : puzzle.stands[sheet].adj.next.adj.prev.adj.prev;
    return unrollUntilLoopback(edge0, edge => edge.next.adj.next.adj.next);
  }

  // side = true: left
  export function getTwistPiece(puzzle: Puzzle, side: boolean, sheet: number): Set<Piece> {
    const edges = getCircleEdges(puzzle, side, sheet);
    const pieces = new Set<Piece>();
    for (const edge of edges)
      pieces.add(edge.aff);
    for (const piece of pieces)
      for (const edge of piece.edges)
        if (!edges.includes(edge))
          pieces.add(edge.adj.aff);
    return pieces;
  }

  // side = true: left
  export function twist(puzzle: Puzzle, side: boolean, sheet: number, forward: boolean): void {
    const edges = getCircleEdges(puzzle, side, sheet);
    const edges_adj = edges.map(edge => edge.adj);
    const edges_adj_rotated =
      forward ? [...edges_adj.slice(2), ...edges_adj.slice(0, 2)]
      : [...edges_adj.slice(-2), ...edges_adj.slice(0, -2)];
    for (const i of indices(edges.length)) {
      adjEdges(edges[i], edges_adj_rotated[i]);
    }
  }
}

export enum StateType { Aligned, LeftShifted, RightShifted }

export type State =
  | { type: StateType.Aligned }
  | { type: StateType.LeftShifted, angle: Geo.Angle }
  | { type: StateType.RightShifted, angle: Geo.Angle };

export type PrincipalPuzzle = {
  radius: Geo.Distance;
  center_x: Geo.Distance;
  R: Geo.Distance;
  space: Puzzle;
  state: State;
  rift_offset: number; // -1 ~ +1
  rift_angle: Geo.Angle; // 0 ~ 4 pi
  ramified_angles: {
    // angle of edges[0] related to right center, ccw as positive
    left: [piece:Piece, n:number]; // n: 0 ~ 12
    // angle of edges[0] related to left center, cw as positive
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

    const space = Puzzle.make();
    const left_center_piece = space.stands[0].adj.next.adj.prev.adj.next.adj.aff;
    const right_center_piece = space.stands[1].adj.next.adj.prev.adj.prev.adj.aff;

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

  export function getTwistCenterPoints(puzzle: PrincipalPuzzle): [left:Geo.Point, right:Geo.Point] {
    return [[-puzzle.center_x, 0], [+puzzle.center_x, 0]];
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

    if (offset < 0) {
      const left_angle = angle;
      let right_angle = -(Geo.angleBetween(f2, f1, middle) + (is_solid ? 0 : Math.PI));
      const n = Math.ceil((left_angle - Math.PI) / (Math.PI*2));
      right_angle = Geo.as0to2pi(right_angle + Math.PI) - Math.PI + n * Math.PI*2;
      return [left_angle, right_angle];
    } else {
      const right_angle = angle;
      let left_angle = Geo.angleBetween(f1, f2, middle) + (is_solid ? 0 : Math.PI);
      const n = Math.ceil((right_angle - Math.PI) / (Math.PI*2));
      left_angle = Geo.as0to2pi(left_angle + Math.PI) - Math.PI + n * Math.PI*2;
      return [left_angle, right_angle];
    }
  }

  function getRamifiedAngles(puzzle: PrincipalPuzzle): {left:[piece:Piece, angle:Geo.Angle], right:[piece:Piece, angle:Geo.Angle]} {
    const left_center: Geo.Vector2 = [-puzzle.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.center_x, 0];
    const [left_angle, right_angle] = getRiftAngles(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);

    const [left_piece1, left_piece1_n] = puzzle.ramified_angles.left;
    const left_piece1_angle =
      -Math.PI/6 + left_piece1_n * Math.PI/3
      + (puzzle.state.type === StateType.LeftShifted ? puzzle.state.angle : 0);

    const [right_piece1, right_piece1_n] = puzzle.ramified_angles.right;
    const right_piece1_angle =
      Math.PI/6 - right_piece1_n * Math.PI/3
      - (puzzle.state.type === StateType.RightShifted ? puzzle.state.angle : 0);

    return {
      left: [left_piece1, left_piece1_angle - left_angle],
      right: [right_piece1, right_piece1_angle - right_angle],
    };
  }

  export function getShiftTransformation(puzzle: PrincipalPuzzle): Geo.RigidTransformation {
    if (puzzle.state.type === StateType.LeftShifted) {
      return Geo.compose(
        Geo.translate([puzzle.center_x, 0]),
        Geo.rotate(puzzle.state.angle),
        Geo.translate([-puzzle.center_x, 0]),
      );
    }
    if (puzzle.state.type === StateType.RightShifted) {
      return Geo.compose(
        Geo.translate([-puzzle.center_x, 0]),
        Geo.rotate(puzzle.state.angle),
        Geo.translate([puzzle.center_x, 0]),
      );
    }
    return Geo.id_trans();
  }
  export function getTwistTransformation(puzzle: PrincipalPuzzle, side: boolean, forward: boolean): Geo.RigidTransformation {
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

  export function twistTo(puzzle: PrincipalPuzzle, angle: Geo.Angle, side: boolean): boolean {
    if (side && puzzle.state.type !== StateType.RightShifted) {
      puzzle.state = {
        type: StateType.LeftShifted,
        angle: angle,
      }
      return true;
    } else if (!side && puzzle.state.type !== StateType.LeftShifted) {
      puzzle.state = {
        type: StateType.RightShifted,
        angle: angle,
      }
      return true;
    } else {
      return false;
    }
  }

  export function snap(puzzle: PrincipalPuzzle): [side: boolean, turn: number] {
    if (puzzle.state.type === StateType.Aligned) return [true, 0];
    let dn: number;
    let side: boolean;
    if (puzzle.state.type === StateType.LeftShifted) {
      dn = Math.round(puzzle.state.angle / (Math.PI/3));
      puzzle.state = { type: StateType.Aligned };
      let n = puzzle.ramified_angles.left[1] + dn;
      n = (n % 12 + 12) % 12;
      puzzle.ramified_angles.left[1] = n;
      side = true;
    } else {
      dn = Math.round(puzzle.state.angle / (Math.PI/3));
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
  export function setRift(puzzle: PrincipalPuzzle, angle: Geo.Angle, offset: number): void {
    angle = Geo.mod1(angle / (Math.PI*4)) * (Math.PI*4);
    puzzle.rift_angle = angle;

    offset = Math.max(Math.min(offset, MAX_RIFT_OFFSET), -MAX_RIFT_OFFSET);
    puzzle.rift_offset = offset;
  }
  export function calculateRiftTuringPoint(puzzle: PrincipalPuzzle): Geo.Point | undefined {
    const left_center: Geo.Vector2 = [-puzzle.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.center_x, 0];
    const [point, is_solid] = getHyperbolaPoint(left_center, right_center, puzzle.rift_offset, puzzle.rift_angle);
    if (!is_solid) return undefined;
    return point;
  }
  export function calculateRiftAngleOffsetFromPoint(puzzle: PrincipalPuzzle, point: Geo.Point): [angle:Geo.Angle, offset:number] {
    const left_center: Geo.Vector2 = [-puzzle.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.center_x, 0];
    const {offset, angle} = getHyperbolaFromPoint(left_center, right_center, point);
    const rift_angle = Geo.as0to2pi(angle - puzzle.rift_angle + Math.PI) - Math.PI + puzzle.rift_angle;
    const rift_offset = Math.max(Math.min(offset, MAX_RIFT_OFFSET), -MAX_RIFT_OFFSET);
    return [rift_angle, rift_offset];
  }

  export function calculateRift(puzzle: PrincipalPuzzle): Geo.Path<undefined> {
    const left_center: Geo.Vector2 = [-puzzle.center_x, 0];
    const right_center: Geo.Vector2 = [+puzzle.center_x, 0];
    
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
    
    function calculateInfPoint(from: Geo.Point, to: Geo.Point, flip: boolean, radius: number): Geo.Point {
      let dir = Geo.normalize(Geo.sub(to, from));
      if (flip) dir = Geo.mul(dir, -1);
      const s = Geo.cross(dir, from);
      const dis = Math.sqrt(radius * radius - s * s) - Geo.dot(dir, from);
      return Geo.add(from, Geo.mul(dir, dis));
    }
    const left_inf = calculateInfPoint(left_center, middle, !is_solid, puzzle.R * 1.5);
    const right_inf = calculateInfPoint(right_center, middle, !is_solid, puzzle.R * 1.5);
    const inf_circle: Geo.DirectionalCircle = { center: [0,0], radius: puzzle.R * 1.5 };
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

  export function calculateShapes(puzzle: PrincipalPuzzle): Map<Piece, Geo.Path<Edge>> {
    const left_trans = getTwistTransformation(puzzle, true, true);
    const left_trans_rev = getTwistTransformation(puzzle, true, false);
    const right_trans = getTwistTransformation(puzzle, false, true);
    const right_trans_rev = getTwistTransformation(puzzle, false, false);

    const left_circle: Geo.DirectionalCircle = { center: [-puzzle.center_x, 0], radius: puzzle.radius };
    const right_circle: Geo.DirectionalCircle = { center: [+puzzle.center_x, 0], radius: puzzle.radius };
    const top_circle = Geo.transformCircle(right_circle, left_trans);
    
    const intersections = Geo.intersectCircles(left_circle, right_circle);
    console.assert(intersections !== undefined);
    const upper_point = intersections!.points[1];
    const lower_point = intersections!.points[0];
    const p0 = upper_point;
    const p1 = Geo.transformPoint(lower_point, right_trans_rev);
    const p2 = Geo.transformPoint(lower_point, left_trans);
    const p3 = Geo.transformPoint(upper_point, right_trans);
    const p4 = Geo.transformPoint(upper_point, left_trans_rev);

    type Arc = { start: Geo.Point, end: Geo.Point, circle: Geo.DirectionalCircle };
    function transformArc(arc: Arc, trans: Geo.RigidTransformation): Arc {
      return {
        start: Geo.transformPoint(arc.start, trans),
        end: Geo.transformPoint(arc.end, trans),
        circle: Geo.transformCircle(arc.circle, trans),
      };
    }
    function flipArc(arc: Arc): Arc {
      return {
        start: arc.end,
        end: arc.start,
        circle: Geo.flipCircle(arc.circle),
      };
    }

    const arcs = new Map<Edge, Arc>();

    {
      const corner_arcs0: Arc[] = [
        { start: p2, end: p0, circle: left_circle },
        { start: p0, end: p1, circle: right_circle },
        { start: p1, end: p2, circle: top_circle },
      ];

      const edge_arcs0: Arc[] = [
        { start: p1, end: p3, circle: right_circle },
        { start: p4, end: p2, circle: left_circle },
      ];

      let left_corner_arcs = corner_arcs0;
      const left_circle_edge0 = puzzle.space.stands[0].adj.next.adj;
      for (const edge of unrollUntilLoopback(left_circle_edge0, edge => edge.next.adj.next.next.adj.next)) {
        if (!arcs.has(edge)) {
          arcs.set(edge, left_corner_arcs[0]);
          arcs.set(edge.next, left_corner_arcs[1]);
          arcs.set(edge.next.next, left_corner_arcs[2]);
        }
        left_corner_arcs = left_corner_arcs.map(arc => transformArc(arc, left_trans));
      }

      let right_corner_arcs = corner_arcs0;
      const right_circle_edge0 = puzzle.space.stands[0].adj.next.adj.next;
      for (const edge of unrollUntilLoopback(right_circle_edge0, seg => seg.next.adj.next.next.adj.next)) {
        if (!arcs.has(edge)) {
          arcs.set(edge, right_corner_arcs[1]);
          arcs.set(edge.next, right_corner_arcs[2]);
          arcs.set(edge.next.next, right_corner_arcs[0]);
        }
        right_corner_arcs = right_corner_arcs.map(arc => transformArc(arc, right_trans));
      }

      let left_edge_arcs = edge_arcs0;
      const left_circle_seg0 = puzzle.space.stands[0].adj.next.adj.prev.adj.prev;
      for (const seg of unrollUntilLoopback(left_circle_seg0, seg => seg.next.adj.next.next.adj.next)) {
        if (!arcs.has(seg)) {
          arcs.set(seg, left_edge_arcs[1]);
          arcs.set(seg.next.next, left_edge_arcs[0]);
        }
        left_edge_arcs = left_edge_arcs.map(arc => transformArc(arc, left_trans));
      }

      let right_edge_arcs = edge_arcs0;
      const right_circle_seg0 = puzzle.space.stands[0].adj.next.adj.prev.adj.next;
      for (const seg of unrollUntilLoopback(right_circle_seg0, seg => seg.next.adj.next.next.adj.next)) {
        if (!arcs.has(seg)) {
          arcs.set(seg, right_edge_arcs[0]);
          arcs.set(seg.next.next, right_edge_arcs[1]);
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
            arcs.set(edge, transformArc(arcs.get(edge)!, left_shift_trans));
    }
    if (puzzle.state.type === StateType.RightShifted) {
      const right_shift_trans = getShiftTransformation(puzzle);
      for (const piece of Puzzle.getTwistPiece(puzzle.space, false, 1))
        for (const edge of piece.edges)
          if (arcs.has(edge))
            arcs.set(edge, transformArc(arcs.get(edge)!, right_shift_trans));
    }

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

    {
      const pieceBR = puzzle.space.stands[0].aff;
      const pieceBL = pieceBR.edges[9].adj.aff;
      const pieceBR_ = puzzle.space.stands[1].aff;
      const pieceBL_ = pieceBR_.edges[9].adj.aff;
      const pieceINF = pieceBR.edges[10].adj.aff;
      const pieceINF_ = pieceBR_.edges[10].adj.aff;

      const circle: Geo.DirectionalCircle = { center: [0, 0], radius: puzzle.R };
      const circle_: Geo.DirectionalCircle = { center: [0, 0], radius: -puzzle.R };

      for (const piece of [pieceBR, pieceBR_, pieceBL, pieceBL_]) {
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
        result.set(piece, path);
      }

      for (const piece of [pieceINF, pieceINF_]) {
        const path: Geo.Path<Edge> = { is_closed: true, segs: [] };
        path.segs.push(Geo.makePathSegArc([0, puzzle.R], [0, -puzzle.R], circle_, piece.edges[0]));
        path.segs.push(Geo.makePathSegArc([0, -puzzle.R], [0, puzzle.R], circle_, piece.edges[1]));
        result.set(piece, path);
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
        console.warn("fail to clip path");
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

      for (const i of indices(left_center_pieces.length)) {
        const piece = left_center_pieces[i];
        const angle = left_piece1_ramified_angle + i * Math.PI*2/3;
        const is_in_angle = Geo.inangle(0, [angle, angle + Math.PI*2/3]);
        const shape = shapes.get(piece)!;
        const res = Geo.cutRegion(shape, rift, {
          index_of_path: 0,
          incident_with_cut_start_or_end: true,
          considered_as_incident: is_in_angle,
        });
        if (res === undefined) {
          console.warn("fail to clip path");
          return undefined;
        }
        append(cutted_shapes, piece, res);

        const is_in_angle_ = Geo.inangle(0, [angle, angle + Math.PI*2/3], 2);
        if (is_in_angle_) {
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

      for (const i of indices(right_center_pieces.length)) {
        const piece = right_center_pieces[i];
        const angle = right_piece1_ramified_angle - i*Math.PI*2/3;
        const is_in_angle = Geo.inangle(0, [angle - Math.PI*2/3, angle]);
        const shape = shapes.get(piece)!;
        const res = Geo.cutRegion(shape, rift, {
          index_of_path: 0,
          incident_with_cut_start_or_end: false,
          considered_as_incident: is_in_angle,
        });
        if (res === undefined) {
          console.warn("fail to clip path");
          return undefined;
        }
        append(cutted_shapes, piece, res);
      }
    }
    if (prin_shape0 === undefined) {
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
        for (const adj of getAdjacentEdges(puzzle, edge, shapes)) {
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

  function getAdjacentEdges<T>(
    puzzle: PrincipalPuzzle,
    edge: Edge,
    shapes: Map<Piece, Geo.Path<T>>,
  ): {edge:Edge, offset:Geo.Distance|Geo.Angle, from:Geo.Distance|Geo.Angle, to:Geo.Distance|Geo.Angle}[] {
    const seg = shapes.get(edge.aff)!.segs[edge.aff.edges.indexOf(edge)];

    const left_cycle = Puzzle.getCircleEdges(puzzle.space, true, 0);
    const right_cycle = Puzzle.getCircleEdges(puzzle.space, false, 1);
    const left_cycle_adj = left_cycle.map(edge => edge.adj).reverse();
    const right_cycle_adj = right_cycle.map(edge => edge.adj).reverse();

    if (puzzle.state.type === StateType.Aligned
      || puzzle.state.type === StateType.LeftShifted && !left_cycle.includes(edge) && !left_cycle_adj.includes(edge)
      || puzzle.state.type === StateType.RightShifted && !right_cycle.includes(edge) && !right_cycle_adj.includes(edge)) {
      return [ {edge: edge.adj, offset: seg.len, from: 0, to: seg.len} ];
    }

    const cycle = [left_cycle, right_cycle, left_cycle_adj, right_cycle_adj].find(cycle => cycle.includes(edge))!;
    cycle.push(...cycle.splice(0, cycle.indexOf(edge)));

    const res: {edge:Edge, offset:Geo.Distance|Geo.Angle, from:Geo.Distance|Geo.Angle, to:Geo.Distance|Geo.Angle}[] = [];
    if (puzzle.state.angle >= 0) {
      let offset = -puzzle.state.angle;
      for (let n = 0;; n = (n + 1) % cycle.length) {
        const adj_edge = cycle[n].adj;
        const adj_seg = shapes.get(adj_edge.aff)!.segs[adj_edge.aff.edges.indexOf(adj_edge)];
        const from = Math.max(offset, 0);
        offset += adj_seg.len;
        const to = Math.min(offset, seg.len);
        if (to > from)
          res.push({edge:adj_edge, offset, from, to});
        if (offset > seg.len)
          break;
      }
    } else {
      let offset;
      {
        const n = 0;
        const adj_edge = cycle[n].adj;
        const adj_seg = shapes.get(adj_edge.aff)!.segs[adj_edge.aff.edges.indexOf(adj_edge)];
        offset = -puzzle.state.angle + adj_seg.len;
      }
      for (let n = 0;; n = (n + cycle.length - 1) % cycle.length) {
        const adj_edge = cycle[n].adj;
        const adj_seg = shapes.get(adj_edge.aff)!.segs[adj_edge.aff.edges.indexOf(adj_edge)];
        const to = Math.min(offset, seg.len);
        offset -= adj_seg.len;
        const from = Math.max(offset, 0);
        if (to > from)
          res.push({edge:adj_edge, offset:offset + adj_seg.len, from, to});
        if (offset < 0)
          break;
      }
      res.reverse();
    }

    return res;
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

export type PrincipalPuzzleWithTexture<Image> = {
  puzzle: PrincipalPuzzle;
  unshifted_positions: Map<Piece, Geo.RigidTransformation>;
  textures: Map<Piece, number>;
  auxiliary_edges: Set<Edge>;
  sheets: [Image, Image, Image, Image];
};

export namespace PrincipalPuzzleWithTexture {
  function _make<Image>(
    puzzle: PrincipalPuzzle,
    f: [Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction, Complex.ComplexFunction],
    draw_image: (f: Complex.ComplexFunction) => Image,
    scale: number = 1,
  ): PrincipalPuzzleWithTexture<Image> {
    const unshifted_positions = new Map(puzzle.space.pieces.map(piece => [piece, Geo.id_trans()]));

    const textures = new Map<Piece, number>();
    {
      const edgeL = puzzle.space.stands[0].adj.next.adj.prev.adj.next;
      const edgeR = puzzle.space.stands[1].adj.next.adj.prev.adj.prev;
      textures.set(edgeL.aff, 3);
      textures.set(edgeL.adj.aff, 3);
      textures.set(edgeL.next.next.adj.aff, 3);
      textures.set(edgeR.aff, 2);
      textures.set(edgeR.adj.aff, 2);
      textures.set(edgeR.next.next.adj.aff, 2);
      
      const prin = new Set<Piece>();
      prin.add(puzzle.space.stands[0].aff);
      for (const piece of prin) {
        for (const edge of piece.edges) {
          const adj_piece = edge.adj.aff;
          if (adj_piece.type !== PieceType.InfPiece && !textures.has(adj_piece)) {
            prin.add(adj_piece);
          }
        }
      }
      
      const comp = new Set<Piece>();
      comp.add(puzzle.space.stands[1].aff);
      for (const piece of comp) {
        for (const edge of piece.edges) {
          const adj_piece = edge.adj.aff;
          if (adj_piece.type !== PieceType.InfPiece && !textures.has(adj_piece)) {
            comp.add(adj_piece);
          }
        }
      }

      for (const piece of prin)
        textures.set(piece, 0);
      for (const piece of comp)
        textures.set(piece, 1);
    }

    const auxiliary_edges = new Set<Edge>();
    {
      auxiliary_edges.add(puzzle.space.stands[0].aff.edges[9]);
      auxiliary_edges.add(puzzle.space.stands[0].aff.edges[10]);
      auxiliary_edges.add(puzzle.space.stands[0].aff.edges[11]);
      auxiliary_edges.add(puzzle.space.stands[1].aff.edges[9]);
      auxiliary_edges.add(puzzle.space.stands[1].aff.edges[10]);
      auxiliary_edges.add(puzzle.space.stands[1].aff.edges[11]);
      for (const edge of Puzzle.getCenterEdges(puzzle.space, true, 0)) {
        auxiliary_edges.add(edge.adj.aff.edges[0]);
      }
      for (const edge of Puzzle.getCenterEdges(puzzle.space, false, 1)) {
        auxiliary_edges.add(edge.adj.aff.edges[0]);
      }
      for (const edge of auxiliary_edges) {
        auxiliary_edges.add(edge.adj);
      }
    }
    
    return {
      puzzle,
      unshifted_positions,
      textures,
      auxiliary_edges,
      sheets: [draw_image(f[0]), draw_image(f[1]), draw_image(f[2]), draw_image(f[3])],
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
    return _make(puzzle, getTextureFunction(puzzle, scale), draw_image, scale);
  }

  export function getPositions<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): Map<Piece, Geo.RigidTransformation> {
    const positions = new Map(puzzle.unshifted_positions);
    if (puzzle.puzzle.state.type === StateType.LeftShifted) {
      const left_shift_trans =
        Geo.compose(
          Geo.translate([puzzle.puzzle.center_x, 0]),
          Geo.rotate(puzzle.puzzle.state.angle),
          Geo.translate([-puzzle.puzzle.center_x, 0]),
        );
      for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, true, 0))
        positions.set(piece, Geo.compose(positions.get(piece)!, left_shift_trans));
    }
    if (puzzle.puzzle.state.type === StateType.RightShifted) {
      const right_shift_trans =
        Geo.compose(
          Geo.translate([-puzzle.puzzle.center_x, 0]),
          Geo.rotate(puzzle.puzzle.state.angle),
          Geo.translate([puzzle.puzzle.center_x, 0]),
        );
      for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, false, 1))
        positions.set(piece, Geo.compose(positions.get(piece)!, right_shift_trans));
    }
    return positions;
  }

  export function getClippedImages<Image>(puzzle: PrincipalPuzzleWithTexture<Image>): Set<ClippedImage<Image>> | undefined {
    const positions = getPositions(puzzle);
    const clipped_shapes = PrincipalPuzzle.calculateClippedShapes(puzzle.puzzle);
    if (clipped_shapes === undefined) return undefined;
    const res = new Set<ClippedImage<Image>>();
    for (const [piece, shapes] of clipped_shapes.principal) {
      for (const shape of shapes) {
        res.add({
          image: puzzle.sheets[puzzle.textures.get(piece)!],
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
    const [side, turn] = PrincipalPuzzle.snap(puzzle.puzzle);
    if (turn === 0) return false;

    const twist_trans1 = PrincipalPuzzle.getTwistTransformation(puzzle.puzzle, side, turn > 0);
    let twist_trans = Geo.id_trans();
    for (let n = 0; n < Math.abs(turn); n++)
      twist_trans = Geo.compose(twist_trans, twist_trans1);

    for (const piece of Puzzle.getTwistPiece(puzzle.puzzle.space, side, 0)) {
      let trans = puzzle.unshifted_positions.get(piece)!;
      trans = Geo.compose(trans, twist_trans);
      puzzle.unshifted_positions.set(piece, trans);
    }
    
    return true;
  }
  export function setRift<Image>(puzzle: PrincipalPuzzleWithTexture<Image>, angle: Geo.Angle, offset: number): void {
    PrincipalPuzzle.setRift(puzzle.puzzle, angle, offset);
  }
};

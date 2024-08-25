
export type Seg = {
  aff: Piece;
  next: Seg;
  prev: Seg;
  adj: Seg;
};

export enum PieceType { NormalPiece, RiftPiece }

export type Piece = {
  type: PieceType;
  segs: Seg[];
};

function makeSeg(piece: Piece): Seg {
  const seg = {
    aff: piece,
    next: undefined,
    prev: undefined,
    adj: undefined,
  } as unknown as Seg;
  seg.next = seg;
  seg.prev = seg;
  seg.adj = seg;
  return seg;
}

function linkSegs(seg1: Seg, seg2: Seg): void {
  seg1.next = seg2;
  seg2.prev = seg1;
}

function adjSegs(seg1: Seg, seg2: Seg): void {
  seg1.adj = seg2;
  seg2.adj = seg1;
}

function makeNormalPiece(reversed: boolean): Piece {
  const piece: Piece = {type: PieceType.NormalPiece, segs: []};
  const seg1 = makeSeg(piece);
  const seg2 = makeSeg(piece);
  const seg3 = makeSeg(piece);
  linkSegs(seg1, seg2);
  linkSegs(seg2, seg3);
  linkSegs(seg3, seg1);
  piece.segs = [seg1, seg2, seg3];
  if (reversed) piece.segs.reverse();
  return piece;
}

function makeRiftPiece(reversed: boolean): Piece {
  const piece: Piece = {type: PieceType.RiftPiece, segs: []};
  const seg1 = makeSeg(piece);
  const seg2 = makeSeg(piece);
  const seg3 = makeSeg(piece);
  const seg1_ = makeSeg(piece);
  const seg2_ = makeSeg(piece);
  const seg3_ = makeSeg(piece);
  linkSegs(seg1, seg2);
  linkSegs(seg2, seg3);
  linkSegs(seg3, seg1_);
  linkSegs(seg1_, seg2_);
  linkSegs(seg2_, seg3_);
  linkSegs(seg3_, seg1);
  piece.segs = [seg1, seg2, seg3, seg1_, seg2_, seg3_];
  if (reversed) piece.segs.reverse();
  return piece;
}

export enum Side { X = 0, Y = 1, Z = 2, X_ = 3, Y_ = 4, Z_ = 5 }

export type Puzzle = {
  pieces: Piece[];
  stand: Seg; // edge of (0,0,-1) -> (0,-1,0)
}

export function makePuzzle(): Puzzle {
  // above pieces

  // segs[Side.X]: x-plane edge
  // segs[Side.Y]: y-plane edge
  // segs[Side.Z]: z-plane edge
  const piece000 = makeNormalPiece(true);
  const piece100 = makeNormalPiece(false);
  const piece010 = makeNormalPiece(false);
  const piece001 = makeNormalPiece(false);
  const piece101 = makeNormalPiece(true);
  const piece011 = makeNormalPiece(true);

  // below pieces

  // segs[Side.X]: x-plane edge
  // segs[Side.Y]: y-plane edge
  // segs[Side.Z]: z-plane edge
  const piece000_ = makeNormalPiece(true);
  const piece100_ = makeNormalPiece(false);
  const piece010_ = makeNormalPiece(false);
  const piece001_ = makeNormalPiece(false);
  const piece101_ = makeNormalPiece(true);
  const piece011_ = makeNormalPiece(true);

  // rift pieces

  // segs[Side.X], segs[Side.X_]: x-plane edge
  // segs[Side.Y], segs[Side.Y_]: y-plane edge
  // segs[Side.Z], segs[Side.Z_]: z-plane edge
  // segs[Side.Z]: the edge into the branch cut
  const piece110r = makeRiftPiece(true); 
  const piece111r = makeRiftPiece(false);

  adjSegs(piece000.segs[Side.X], piece100.segs[Side.X]);
  adjSegs(piece000.segs[Side.Y], piece010.segs[Side.Y]);
  adjSegs(piece000.segs[Side.Z], piece001.segs[Side.Z]);
  adjSegs(piece001.segs[Side.X], piece101.segs[Side.X]);
  adjSegs(piece001.segs[Side.Y], piece011.segs[Side.Y]);
  adjSegs(piece100.segs[Side.Z], piece101.segs[Side.Z]);
  adjSegs(piece010.segs[Side.Z], piece011.segs[Side.Z]);

  adjSegs(piece000_.segs[Side.X], piece100_.segs[Side.X]);
  adjSegs(piece000_.segs[Side.Y], piece010_.segs[Side.Y]);
  adjSegs(piece000_.segs[Side.Z], piece001_.segs[Side.Z]);
  adjSegs(piece001_.segs[Side.X], piece101_.segs[Side.X]);
  adjSegs(piece001_.segs[Side.Y], piece011_.segs[Side.Y]);
  adjSegs(piece100_.segs[Side.Z], piece101_.segs[Side.Z]);
  adjSegs(piece010_.segs[Side.Z], piece011_.segs[Side.Z]);

  adjSegs(piece110r.segs[Side.Z], piece111r.segs[Side.Z_]);
  adjSegs(piece110r.segs[Side.Z_], piece111r.segs[Side.Z]);
  adjSegs(piece110r.segs[Side.X], piece010.segs[Side.X]);
  adjSegs(piece111r.segs[Side.X], piece011.segs[Side.X]);
  adjSegs(piece110r.segs[Side.Y], piece100.segs[Side.Y]);
  adjSegs(piece111r.segs[Side.Y], piece101.segs[Side.Y]);
  adjSegs(piece110r.segs[Side.X_], piece010_.segs[Side.X]);
  adjSegs(piece111r.segs[Side.X_], piece011_.segs[Side.X]);
  adjSegs(piece110r.segs[Side.Y_], piece100_.segs[Side.Y]);
  adjSegs(piece111r.segs[Side.Y_], piece101_.segs[Side.Y]);

  return {
    pieces: [
      piece000,
      piece100,
      piece010,
      piece001,
      piece101,
      piece011,
      piece000_,
      piece100_,
      piece010_,
      piece001_,
      piece101_,
      piece011_,
      piece110r,
      piece111r,
    ],
    stand: piece000.segs[0],
  };
}

function getForward(seg: Seg): Seg {
  return seg.next.adj.next;
}

function getBackward(seg: Seg): Seg {
  return seg.prev.adj.prev;
}

export function twist(puzzle: Puzzle, index: number, side: Side, forward: boolean): void {
  function unrollUntilLoopback<A>(a: A, next: (a: A) => A): A[] {
    const res = [a];
    while (true) {
      a = next(a);
      if (a === res[0]) break;
      res.push(a);
    }
    return res;
  }

  function *indices(n: number): Generator<number> {
    for (let i = 0; i < n; i++)
      yield i;
  }

  function twistAlong(piece: Piece, side: Side, forward: boolean): Seg[] {
    const seg0 = piece.segs[side % piece.segs.length];
    const segs = unrollUntilLoopback(seg0, getForward);
    const segs_adj = segs.map(seg => seg.adj);
    const segs_adj_rotated = segs_adj.map(forward ? getBackward : getForward);
    for (const i of indices(segs.length)) {
      adjSegs(segs[i], segs_adj_rotated[i]);
    }
    return segs;
  }

  const moved = twistAlong(puzzle.pieces[index], side, forward);

  if (moved.map(seg => seg.aff).includes(puzzle.stand.aff)) {
    const stand_segs = unrollUntilLoopback(puzzle.stand, seg => seg.next);
    const index = stand_segs.findIndex(seg => moved.includes(seg));
    console.assert(index !== -1);
    const stand_seg_i = stand_segs[index];
    const moved_stand_seg_i = forward ? getBackward(stand_seg_i) : getForward(stand_seg_i);
    const moved_stand_segs = unrollUntilLoopback(moved_stand_seg_i, seg => seg.prev);
    puzzle.stand = moved_stand_segs[index % moved_stand_segs.length];
  }
}

export enum Point {
  XP = +1,
  XN = -1,
  YP = +2,
  YN = -2,
  ZP = +3,
  ZN = -3,
};

export function getPositions(puzzle: Puzzle): Map<Seg, [start:Point, end:Point]> {
  function crossAxis(s: Point, t: Point): Point | undefined {
    if (Math.abs(s) === Math.abs(t)) {
      return undefined;
    }
    const epsilon: Record<string, number> = { "1,2": 3, "2,3": 1, "3,1": 2 };
    const st = `${[Math.abs(s), Math.abs(t)]}`;
    const ts = `${[Math.abs(t), Math.abs(s)]}`;
    return (epsilon[st] ?? -epsilon[ts]) * Math.sign(s) * Math.sign(t);
  }

  const res = new Map<Seg, [start:Point, end:Point]>();
  res.set(puzzle.stand, [Point.ZN, Point.YN]);
  for (const [seg, [start, end]] of res) {
    if (!res.has(seg.next)) {
      const v = crossAxis(start, end);
      console.assert(v !== undefined);
      res.set(seg.next, [end, v!]);
    }
    if (!res.has(seg.adj)) {
      res.set(seg.adj, [end, start]);
    }
  }
  return res;
}


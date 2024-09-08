import * as Model from "./Model.js";
import * as Draw from "./Draw.js";
import * as Geo from "./Geometry2D.js";
import {assert, indices} from "./Utils.js";

export enum PuzzleControlStateType { Ready, Updated, Twisting, Tearing }
export type PuzzleControlState =
  | {
    type: PuzzleControlStateType.Ready;
  }
  | {
    type: PuzzleControlStateType.Updated;
  }
  | {
    type: PuzzleControlStateType.Twisting;
    start_time: number,
    duration: number,

    side: boolean,
    sheet: number,
    angle_from: number,
    angle_to: number,
  }
  | {
    type: PuzzleControlStateType.Tearing;
    start_time: number,
    duration: number,

    index: number,
    offset_from: number,
    offset_to: number,
    angle_from: number,
    angle_to: number,
  };

const BACKGROUND_STYLE = "rgb(30 30 30)";
const RIFTANGLE_TO_TIME = 100;
const RIFTOFFSET_TO_TIME = 300;
const TWIST_DURATION = 300;
const ROTATE_RIFT_DURATION = 300;
const WHEEL_TO_RIFTANGLE = -0.001;
const WHEEL_TO_RIFTOFFSET = 0.001;
const DRAG_RIFT_RADIUS = 0.3;

export enum Variant {
  _2S = "2s",
  _2Sp = "2s'",
}

export class SpaceRiftPuzzle {
  variant: Variant;
  canvas: HTMLCanvasElement;
  model: Model.PrincipalPuzzleWithTexture<{canvas:HTMLCanvasElement, trans:Draw.CanvasMatrix}>;
  cs: Draw.CoordinateSystem;
  control_state: PuzzleControlState;
  current_images: Set<Model.ClippedImage<{canvas:HTMLCanvasElement, trans:Draw.CanvasMatrix}>>;
  current_rifts: Geo.Path<undefined>[];
  draw_frame: boolean = true;
  
  constructor(arg: {
    variant: Variant;
    canvas: HTMLCanvasElement;
    model: Model.PrincipalPuzzleWithTexture<{canvas:HTMLCanvasElement, trans:Draw.CanvasMatrix}>;
    cs: Draw.CoordinateSystem;
  }) {
    this.variant = arg.variant;
    this.canvas = arg.canvas;
    this.model = arg.model;
    this.cs = arg.cs;
    this.control_state = {type: PuzzleControlStateType.Ready};
    this.current_images = new Set();
    this.current_rifts = [];
  }

  static make(canvas: HTMLCanvasElement, variant: Variant = Variant._2S): SpaceRiftPuzzle {
    const scale = 1; // for debug
    const radius = 1.56;
    const center_x = 1;
    const cs = Draw.makeCoordinateSystem({
      width_pixel: canvas.clientWidth,
      height_pixel: canvas.clientHeight,
      x_range: [-4 * scale, 4 * scale],
      y_range: [-3 * scale, 3 * scale],
    });
    const R = Math.sqrt(cs.x_range[0] * cs.x_range[0] + cs.y_range[0] * cs.y_range[0]) * 1.5 / scale;

    const image_x_range: [number, number] = [cs.x_range[0], cs.x_range[1]];
    const image_y_range: [number, number] = [cs.y_range[0], cs.y_range[1]];

    if (variant === Variant._2S) {
      const model = Model.PrincipalPuzzleWithTexture.makeRamified2SPuzzle(
        radius, center_x, R,
        f => Draw.drawComplex(cs, f, image_x_range, image_y_range),
      );
      
      return new SpaceRiftPuzzle({variant, canvas, model, cs});

    } else {
      const model = Model.PrincipalPuzzleWithTexture.makeRamified2SpPuzzle(
        radius, center_x, R,
        f => Draw.drawComplex(cs, f, image_x_range, image_y_range),
      );
      
      return new SpaceRiftPuzzle({variant, canvas, model, cs});
    }
  }
  init(): void {
    this.registerController();
    this.registerRenderEvent();
  }

  update(): boolean {
    const time = Date.now();

    if (this.control_state.type === PuzzleControlStateType.Ready) {
      return false;

    } else if (this.control_state.type === PuzzleControlStateType.Updated) {
      this.control_state = {type: PuzzleControlStateType.Ready};
      return true;

    } else if (this.control_state.type === PuzzleControlStateType.Twisting) {
      // TODO: rebound if fail to twist
      const t = (time - this.control_state.start_time) / this.control_state.duration;
      if (!Number.isFinite(t) || t > 1) {
        assert(this.model.states[this.control_state.sheet].type !== Model.StateType.Aligned);
        Model.PrincipalPuzzleWithTexture.twistTo(
          this.model,
          this.control_state.side,
          this.control_state.sheet,
          this.control_state.angle_to,
        );
        Model.PrincipalPuzzleWithTexture.snap(this.model);
        this.control_state = {type: PuzzleControlStateType.Ready};
      } else {
        const angle = this.control_state.angle_from + (this.control_state.angle_to - this.control_state.angle_from) * t;
        Model.PrincipalPuzzleWithTexture.twistTo(
          this.model,
          this.control_state.side,
          this.control_state.sheet,
          angle,
        );
      }
      return true;

    } else if (this.control_state.type === PuzzleControlStateType.Tearing) {
      // TODO: rebound if fail to tear
      const t = (time - this.control_state.start_time) / this.control_state.duration;
      if (!Number.isFinite(t) || t > 1) {
        Model.PrincipalPuzzleWithTexture.setRift(
          this.model,
          this.control_state.index,
          {offset:this.control_state.offset_to, angle:this.control_state.angle_to},
        );
        this.control_state = {type: PuzzleControlStateType.Ready};
      } else {
        const angle = this.control_state.angle_from
          + (this.control_state.angle_to - this.control_state.angle_from) * t;
        const offset = this.control_state.offset_from
          + (this.control_state.offset_to - this.control_state.offset_from) * t;
        Model.PrincipalPuzzleWithTexture.setRift(
          this.model,
          this.control_state.index,
          {offset, angle},
        );
      }
      return true;

    } else {
      assert(false);
    }
  }
  render(n: number = 0): boolean {
    const ctx = this.canvas.getContext("2d");
    if (ctx === null) return false;

    // clear
    ctx.fillStyle = BACKGROUND_STYLE;
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

    // draw textures
    const clipped_images = Model.PrincipalPuzzleWithTexture.calculateClippedImages(this.model);
    if (clipped_images === undefined) {
      console.error("fail to calculate clipped images");
      return false;
    }
    this.current_images = clipped_images.images;
    this.current_rifts = clipped_images.rifts;

    for (const clipped_image of this.current_images) {
      const path = Draw.toCanvasPath(this.cs, clipped_image.region);
      const pos = Draw.toCanvasMatrix(this.cs, clipped_image.transformation);
      ctx.save();
      ctx.clip(path);
      ctx.transform(...pos);
      ctx.transform(...clipped_image.image.trans);
      ctx.drawImage(clipped_image.image.canvas, 0, 0);
      ctx.restore();
    }

    // draw frame
    if (this.draw_frame) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "black";
      for (const clipped_image of this.current_images) {
        const path = clipped_image.region;
        const hide = path.segs.map(seg =>
          seg.source.type !== Geo.CutSourceType.Seg
          || seg.source.ref.source.auxiliary
        );
        ctx.stroke(Draw.toCanvasPath(this.cs, path, hide));
      }
      // for (const [_piece, path] of Model.PrincipalPuzzle.calculateShapes(this.model.puzzle)) {
      //   const hide = path.segs.map(seg => seg.source.auxiliary);
      //   ctx.stroke(Draw.toCanvasPath(this.cs, path, hide));
      // }
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = "red";
    for (const rift of this.current_rifts)
      ctx.stroke(Draw.toCanvasPath(this.cs, rift));

    // // for debug
    // ctx.fillStyle = "white";
    // ctx.font = "26px serif";
    // ctx.fillText(`${n}`, 10, 50);

    return true;
  }

  getPosition(event: MouseEvent): Geo.Point {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return Draw.toCoordinate(this.cs, [x, y]);
  }
  pointTo(point_: Geo.Point): Model.Piece | undefined {
    for (const images of this.current_images) {
      const {dis, point} = Geo.calculateNearestPoint(images.region, point_);
      if (dis < 0) {
        return images.region.segs
          .map(seg => seg.source.ref.source?.aff)
          .find(piece => piece !== undefined);
      }
    }
    return undefined;
  }

  twist(side: boolean, sheet: number, turn: number, duration?: number): boolean {
    if (this.control_state.type !== PuzzleControlStateType.Ready) return false;
    const time = Date.now();
    duration ??= TWIST_DURATION;

    const step_angle = Math.PI/3;
    Model.PrincipalPuzzleWithTexture.twistTo(this.model, side, sheet, 0);
    this.control_state = {
      type: PuzzleControlStateType.Twisting,
      duration,
      side,
      sheet,
      angle_from: 0,
      angle_to: turn * step_angle,
      start_time: time,
    };
    return true;
  }
  tear(index: number, angle: Geo.Angle, offset: number, duration?: number): boolean {
    if (this.control_state.type !== PuzzleControlStateType.Ready) return false;
    const time = Date.now();
    duration ??=
      Math.abs(angle - this.model.rifts[index].coord.angle) * RIFTANGLE_TO_TIME
      + Math.abs(offset - this.model.rifts[index].coord.offset) * RIFTOFFSET_TO_TIME;

    this.control_state = {
      type: PuzzleControlStateType.Tearing,
      duration,
      index,
      angle_from: this.model.rifts[index].coord.angle,
      angle_to: angle,
      offset_from: this.model.rifts[index].coord.offset,
      offset_to: offset,
      start_time: time,
    };
    return true;
  }
  tearTo(index: number, point: Geo.Point, duration?: number): boolean {
    const p1 = this.model.branch_cuts[this.model.rifts[index].left].point;
    const p2 = this.model.branch_cuts[this.model.rifts[index].right].point;
    const angle0 = this.model.rifts[index].coord.angle;
    const {offset, angle} = Model.HyperbolicPolarCoordinate.getCoordinateFromPoint(p1, p2, point);
    const angle_ = Geo.as_npi_pi(angle - angle0) + angle0;
    return this.tear(index, angle_, offset, duration);
  }
  serTearTo(index: number, point: Geo.Point): boolean {
    if (this.control_state.type !== PuzzleControlStateType.Ready) return false;
    const p1 = this.model.branch_cuts[this.model.rifts[index].left].point;
    const p2 = this.model.branch_cuts[this.model.rifts[index].right].point;
    const angle0 = this.model.rifts[index].coord.angle;
    const {offset, angle} = Model.HyperbolicPolarCoordinate.getCoordinateFromPoint(p1, p2, point);
    const angle_ = Geo.as_npi_pi(angle - angle0) + angle0;
    const succ = Model.PrincipalPuzzleWithTexture.setRift(this.model, index, {offset, angle:angle_});
    if (!succ) return false;
    this.control_state = {type:PuzzleControlStateType.Updated};
    return true;
  }

  registerController(): void {
    let dragging_rift_index: number | undefined = undefined;

    this.canvas.addEventListener("wheel", event => {
      event.preventDefault();
      if (dragging_rift_index !== undefined) return;
      if (this.current_rifts.length === 0) return;
      if (this.current_images.size === 0) return;
      
      const point = this.getPosition(event);
      const rift_index = this.current_rifts
        .map((rift, index) => ({dis:Math.abs(Geo.calculateNearestPoint(rift, point).dis), index}))
        .reduce((a, b) => a.dis < b.dis ? a : b)
        .index;

      if (event.shiftKey) {
        this.tear(
          rift_index,
          this.model.rifts[rift_index].coord.angle,
          this.model.rifts[rift_index].coord.offset + WHEEL_TO_RIFTOFFSET * event.deltaY,
        );
      } else {
        this.tear(
          rift_index,
          this.model.rifts[rift_index].coord.angle + WHEEL_TO_RIFTANGLE * event.deltaY,
          this.model.rifts[rift_index].coord.offset,
        );
      }
    }, false);

    this.canvas.addEventListener("contextmenu", event => event.preventDefault(), false);
    this.canvas.addEventListener("mousedown", event => {
      event.preventDefault();
      if (dragging_rift_index !== undefined) return;
      if (this.current_rifts.length === 0) return;
      if (this.current_images.size === 0) return;

      const point = this.getPosition(event);

      if (event.button === 1) {
        const rift_index = this.current_rifts
          .map((rift, index) => ({dis:Math.abs(Geo.calculateNearestPoint(rift, point).dis), index}))
          .reduce((a, b) => a.dis < b.dis ? a : b)
          .index;

        this.tear(
          rift_index,
          this.model.rifts[rift_index].coord.angle + Math.PI * 2,
          this.model.rifts[rift_index].coord.offset,
          ROTATE_RIFT_DURATION,
        );
        return;
        
      }
      
      const rift_points = this.model.rifts.map(rift => 
        Model.HyperbolicPolarCoordinate.getHyperbolaPoint(
          this.model.branch_cuts[rift.left].point,
          this.model.branch_cuts[rift.right].point,
          rift.coord,
        )
      );
      const drag_rift_index = rift_points.findIndex(rift_point =>
        rift_point[1]
        && Geo.norm(Geo.sub(rift_point[0], point)) <= DRAG_RIFT_RADIUS
      );
      if (dragging_rift_index === undefined && event.button === 0 && drag_rift_index !== -1) {
        dragging_rift_index = drag_rift_index;
        return;
      }

      if (event.button === 0 || event.button === 2) {
        const [left_circle, right_circle] = Model.Puzzle.getTwistCircles(this.model);
        const left_dis = Geo.norm(Geo.sub(left_circle.center, point));
        const right_dis = Geo.norm(Geo.sub(right_circle.center, point));
        if (left_dis > this.model.radius && right_dis > this.model.radius) return;

        const side = left_dis < right_dis;
        const piece = this.pointTo(point);
        if (piece === undefined) return;
        const sheet = indices(this.model.stands.length)
          .find(sheet => Model.Puzzle.getTwistPieces(this.model, side, sheet)?.pieces.has(piece) ?? false);
        if (sheet === undefined) return;
        const turn = event.button === 0 ? 1 : -1;
        this.twist(side, sheet, turn);
        return;
      }
    }, false);
    this.canvas.addEventListener("mousemove", event => {
      if (dragging_rift_index === undefined) return;
      if (this.current_rifts.length === 0) return;
      if (this.current_images.size === 0) return;
      const point = this.getPosition(event);
      this.serTearTo(dragging_rift_index, point);
    }, false);
    this.canvas.addEventListener("mouseup", event => { dragging_rift_index = undefined; }, false);
    this.canvas.addEventListener("mouseleave", event => { dragging_rift_index = undefined; }, false);
  }

  registerRenderEvent(): void {
    let counter = 0;
    const step = (timeStamp: number) => {
      const updated = this.update();
      if (updated) {
        counter += 1;
        this.render(counter);
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    this.render(counter);
  }
}


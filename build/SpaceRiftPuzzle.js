import * as Model from "./Model.js";
import * as Draw from "./Draw.js";
import * as Geo from "./Geometry2D.js";
import { assert, indices } from "./Utils.js";
export var PuzzleControlStateType;
(function (PuzzleControlStateType) {
    PuzzleControlStateType[PuzzleControlStateType["Ready"] = 0] = "Ready";
    PuzzleControlStateType[PuzzleControlStateType["Updated"] = 1] = "Updated";
    PuzzleControlStateType[PuzzleControlStateType["Twisting"] = 2] = "Twisting";
    PuzzleControlStateType[PuzzleControlStateType["Tearing"] = 3] = "Tearing";
})(PuzzleControlStateType || (PuzzleControlStateType = {}));
const BACKGROUND_STYLE = "rgb(30 30 30)";
const FRAME_COLOR = "black";
const RIFT_COLOR = "rgb(30 30 30)";
const RIFTANGLE_TO_TIME = 100;
const RIFTOFFSET_TO_TIME = 300;
const TWIST_DURATION = 300;
const FLIP_RIFT_DURATION = 300;
const WHEEL_TO_RIFTANGLE = -0.001;
const WHEEL_TO_RIFTOFFSET = 0.001;
const DRAG_RIFT_RADIUS = 0.3;
export var PuzzleVariant;
(function (PuzzleVariant) {
    PuzzleVariant["Dipole2H"] = "Dipole(2) H";
    PuzzleVariant["Dipole2V"] = "Dipole(2) V";
    PuzzleVariant["Dipole3H"] = "Dipole(3) H";
    PuzzleVariant["Dipole3V"] = "Dipole(3) V";
    PuzzleVariant["Quadrapole3"] = "Quadrapole(3)";
})(PuzzleVariant || (PuzzleVariant = {}));
export class SpaceRiftPuzzle {
    constructor(arg) {
        this.draw_frame = true;
        this.draw_layer = 0;
        this.variant = arg.variant;
        this.canvas = arg.canvas;
        this.model = arg.model;
        this.cs = arg.cs;
        this.control_state = { type: PuzzleControlStateType.Ready };
        this.current_images = new Set();
        this.current_rifts = [];
    }
    static make(canvas, variant = PuzzleVariant.Dipole2H) {
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
        const image_x_range = [cs.x_range[0], cs.x_range[1]];
        const image_y_range = [cs.y_range[0], cs.y_range[1]];
        const drawComplex = (f) => Draw.drawComplex(cs, f, image_x_range, image_y_range);
        if (variant === PuzzleVariant.Dipole2H) {
            const model = Model.PrincipalPuzzleWithTexture.makePuzzle(Model.Factory.DH(2, 1), radius, center_x, R, drawComplex);
            return new SpaceRiftPuzzle({ variant, canvas, model, cs });
        }
        else if (variant === PuzzleVariant.Dipole2V) {
            const model = Model.PrincipalPuzzleWithTexture.makePuzzle(Model.Factory.DV(2, 1), radius, center_x, R, drawComplex);
            return new SpaceRiftPuzzle({ variant, canvas, model, cs });
        }
        else if (variant === PuzzleVariant.Dipole3H) {
            const model = Model.PrincipalPuzzleWithTexture.makePuzzle(Model.Factory.DH(3, 1), radius, center_x, R, drawComplex);
            return new SpaceRiftPuzzle({ variant, canvas, model, cs });
        }
        else if (variant === PuzzleVariant.Dipole3V) {
            const model = Model.PrincipalPuzzleWithTexture.makePuzzle(Model.Factory.DV(3, 1), radius, center_x, R, drawComplex);
            return new SpaceRiftPuzzle({ variant, canvas, model, cs });
        }
        else if (variant === PuzzleVariant.Quadrapole3) {
            const model = Model.PrincipalPuzzleWithTexture.makePuzzle(Model.Factory.Q(3, 1), radius, center_x, R, drawComplex);
            return new SpaceRiftPuzzle({ variant, canvas, model, cs });
        }
        else {
            assert(false);
        }
    }
    init() {
        this.registerController();
        this.registerRenderEvent();
    }
    update() {
        const time = Date.now();
        if (this.control_state.type === PuzzleControlStateType.Ready) {
            return false;
        }
        else if (this.control_state.type === PuzzleControlStateType.Updated) {
            this.control_state = { type: PuzzleControlStateType.Ready };
            return true;
        }
        else if (this.control_state.type === PuzzleControlStateType.Twisting) {
            // TODO: rebound if fail to twist
            const t = (time - this.control_state.start_time) / this.control_state.duration;
            if (!Number.isFinite(t) || t > 1) {
                assert(this.model.states[this.control_state.sheet].type !== Model.StateType.Aligned);
                Model.PrincipalPuzzleWithTexture.setShift(this.model, this.control_state.side, this.control_state.sheet, this.control_state.angle_to);
                Model.PrincipalPuzzleWithTexture.snap(this.model);
                assert(Model.Puzzle.isAligned(this.model));
                this.control_state = { type: PuzzleControlStateType.Ready };
            }
            else {
                const angle = this.control_state.angle_from + (this.control_state.angle_to - this.control_state.angle_from) * t;
                Model.PrincipalPuzzleWithTexture.setShift(this.model, this.control_state.side, this.control_state.sheet, angle);
            }
            return true;
        }
        else if (this.control_state.type === PuzzleControlStateType.Tearing) {
            // TODO: rebound if fail to tear
            const t = (time - this.control_state.start_time) / this.control_state.duration;
            if (!Number.isFinite(t) || t > 1) {
                Model.PrincipalPuzzleWithTexture.setRift(this.model, this.control_state.index, { offset: this.control_state.offset_to, angle: this.control_state.angle_to });
                this.control_state = { type: PuzzleControlStateType.Ready };
            }
            else {
                const angle = this.control_state.angle_from
                    + (this.control_state.angle_to - this.control_state.angle_from) * t;
                const offset = this.control_state.offset_from
                    + (this.control_state.offset_to - this.control_state.offset_from) * t;
                Model.PrincipalPuzzleWithTexture.setRift(this.model, this.control_state.index, { offset, angle });
            }
            return true;
        }
        else {
            assert(false);
        }
    }
    renderComplex(f) {
        const ctx = this.canvas.getContext("2d");
        if (ctx === null)
            return false;
        const image_x_range = [this.cs.x_range[0], this.cs.x_range[1]];
        const image_y_range = [this.cs.y_range[0], this.cs.y_range[1]];
        const image = Draw.drawComplex(this.cs, f, image_x_range, image_y_range);
        ctx.save();
        ctx.transform(...image.trans);
        ctx.drawImage(image.canvas, 0, 0);
        ctx.restore();
        return true;
    }
    render(n = 0) {
        const ctx = this.canvas.getContext("2d");
        if (ctx === null)
            return false;
        // clear
        ctx.fillStyle = BACKGROUND_STYLE;
        ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        // draw textures
        const clipped_images = Model.PrincipalPuzzleWithTexture.calculateClippedImages(this.model);
        if (clipped_images === undefined) {
            console.error("fail to calculate clipped images");
            return false;
        }
        this.current_images = clipped_images.images[this.draw_layer];
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
        if (true) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = FRAME_COLOR;
            for (const clipped_image of this.current_images) {
                const path = clipped_image.region;
                const hide = path.segs.map(seg => seg.source.type !== Geo.CutSourceType.Seg
                    || seg.source.ref.source.auxiliary);
                ctx.stroke(Draw.toCanvasPath(this.cs, path, hide));
            }
            // for (const [_piece, path] of Model.PrincipalPuzzle.calculateShapes(this.model.puzzle)) {
            //   const hide = path.segs.map(seg => seg.source.auxiliary);
            //   ctx.stroke(Draw.toCanvasPath(this.cs, path, hide));
            // }
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = RIFT_COLOR;
        for (const rift of this.current_rifts)
            ctx.stroke(Draw.toCanvasPath(this.cs, rift));
        // // for debug
        // ctx.fillStyle = "white";
        // ctx.font = "26px serif";
        // ctx.fillText(`${n}`, 10, 50);
        return true;
    }
    getPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return Draw.toCoordinate(this.cs, [x, y]);
    }
    pointTo(point_) {
        for (const images of this.current_images) {
            const { dis, point } = Geo.calculateNearestPoint(images.region, point_);
            if (dis < 0) {
                return images.region.segs
                    .map(seg => { var _a; return (_a = seg.source.ref.source) === null || _a === void 0 ? void 0 : _a.aff; })
                    .find(piece => piece !== undefined);
            }
        }
        return undefined;
    }
    twist(side, sheet, turn, duration) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const time = Date.now();
        duration !== null && duration !== void 0 ? duration : (duration = TWIST_DURATION);
        const step_angle = Math.PI / 3;
        Model.PrincipalPuzzleWithTexture.setShift(this.model, side, sheet, 0);
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
    tear(index, angle, offset, duration) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const time = Date.now();
        duration !== null && duration !== void 0 ? duration : (duration = Math.abs(angle - this.model.rifts[index].coord.angle) * RIFTANGLE_TO_TIME
            + Math.abs(offset - this.model.rifts[index].coord.offset) * RIFTOFFSET_TO_TIME);
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
    tearTo(index, point, duration) {
        const p1 = this.model.branch_points[this.model.rifts[index].left].point;
        const p2 = this.model.branch_points[this.model.rifts[index].right].point;
        const angle0 = this.model.rifts[index].coord.angle;
        const { offset, angle } = Model.HyperbolicPolarCoordinate.getCoordinateFromPoint(p1, p2, point);
        const angle_ = Geo.as_npi_pi(angle - angle0) + angle0;
        return this.tear(index, angle_, offset, duration);
    }
    tearToImmediately(index, point) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const p1 = this.model.branch_points[this.model.rifts[index].left].point;
        const p2 = this.model.branch_points[this.model.rifts[index].right].point;
        const angle0 = this.model.rifts[index].coord.angle;
        const { offset, angle } = Model.HyperbolicPolarCoordinate.getCoordinateFromPoint(p1, p2, point);
        const angle_ = Geo.as_npi_pi(angle - angle0) + angle0;
        const succ = Model.PrincipalPuzzleWithTexture.setRift(this.model, index, { offset, angle: angle_ });
        if (!succ)
            return false;
        this.control_state = { type: PuzzleControlStateType.Updated };
        return true;
    }
    registerController() {
        let dragging_rift_index = undefined;
        const is_dragging_rift = () => dragging_rift_index !== undefined;
        const start_dragging_rift = (point) => {
            const rift_points = this.model.rifts.map(rift => Model.HyperbolicPolarCoordinate.getHyperbolaPoint(this.model.branch_points[rift.left].point, this.model.branch_points[rift.right].point, rift.coord));
            const drag_rift_index = rift_points.findIndex(rift_point => rift_point[1]
                && Geo.norm(Geo.sub(rift_point[0], point)) <= DRAG_RIFT_RADIUS);
            if (drag_rift_index !== -1) {
                dragging_rift_index = drag_rift_index;
                return true;
            }
            return false;
        };
        const cancel_dragging_rift = () => {
            dragging_rift_index = undefined;
        };
        const drag_rift_to_if_is_dragging = (point) => {
            if (dragging_rift_index !== undefined)
                this.tearToImmediately(dragging_rift_index, point);
        };
        let scrolling_rift_index = undefined;
        const find_nearest_rift = (point) => {
            if (scrolling_rift_index === undefined)
                scrolling_rift_index = this.current_rifts
                    .map((rift, index) => ({ dis: Math.abs(Geo.calculateNearestPoint(rift, point).dis), index }))
                    .reduce((a, b) => a.dis < b.dis ? a : b)
                    .index;
            return scrolling_rift_index;
        };
        const scroll_rift = (point, dx, dy) => {
            const rift_index = find_nearest_rift(point);
            this.tear(rift_index, this.model.rifts[rift_index].coord.angle - WHEEL_TO_RIFTANGLE * dy, this.model.rifts[rift_index].coord.offset - WHEEL_TO_RIFTOFFSET * dx);
        };
        const flip_rift = (point) => {
            const rift_index = find_nearest_rift(point);
            this.tear(rift_index, this.model.rifts[rift_index].coord.angle + Math.PI * 2, this.model.rifts[rift_index].coord.offset, FLIP_RIFT_DURATION);
        };
        const cancel_scrolling_rift = () => {
            scrolling_rift_index = undefined;
        };
        const twist = (point, forward) => {
            const [left_circle, right_circle] = Model.Puzzle.getTwistCircles(this.model);
            const left_dis = Geo.norm(Geo.sub(left_circle.center, point));
            const right_dis = Geo.norm(Geo.sub(right_circle.center, point));
            if (left_dis > this.model.radius && right_dis > this.model.radius)
                return;
            const side = left_dis < right_dis;
            const piece = this.pointTo(point);
            if (piece === undefined)
                return;
            const sheet = indices(this.model.stands.length)
                .find(sheet => { var _a, _b; return (_b = (_a = Model.Puzzle.getTwistPieces(this.model, side, sheet)) === null || _a === void 0 ? void 0 : _a.pieces.has(piece)) !== null && _b !== void 0 ? _b : false; });
            if (sheet === undefined)
                return;
            const turn = forward ? 1 : -1;
            this.twist(side, sheet, turn);
        };
        const inspect = (point) => {
            const piece = this.pointTo(point);
            console.log(piece);
            this.control_state = { type: PuzzleControlStateType.Updated };
        };
        this.canvas.addEventListener("wheel", event => {
            event.preventDefault();
            if (this.current_rifts.length === 0)
                return;
            if (this.current_images.size === 0)
                return;
            if (is_dragging_rift())
                return;
            const point = this.getPosition(event);
            scroll_rift(point, event.deltaX, event.deltaY);
        }, false);
        this.canvas.addEventListener("contextmenu", event => event.preventDefault(), false);
        this.canvas.addEventListener("mousedown", event => {
            event.preventDefault();
            if (is_dragging_rift())
                return;
            if (event.button === 0 && event.ctrlKey) {
                inspect(this.getPosition(event));
                return;
            }
            if (this.current_rifts.length === 0)
                return;
            if (this.current_images.size === 0)
                return;
            const point = this.getPosition(event);
            if (event.button === 1) {
                this.draw_layer = (this.draw_layer + 1) % this.model.stands.length;
                this.control_state = { type: PuzzleControlStateType.Updated };
                return;
            }
            if (!is_dragging_rift() && event.button === 0 && start_dragging_rift(point)) {
                return;
            }
            if (event.button === 0 || event.button === 2) {
                twist(point, event.button === 0);
                return;
            }
        }, false);
        this.canvas.addEventListener("mousemove", event => {
            if (this.current_rifts.length === 0)
                return;
            if (this.current_images.size === 0)
                return;
            cancel_scrolling_rift();
            const point = this.getPosition(event);
            drag_rift_to_if_is_dragging(point);
        }, false);
        this.canvas.addEventListener("mouseup", event => cancel_dragging_rift(), false);
        this.canvas.addEventListener("mouseleave", event => cancel_dragging_rift(), false);
    }
    registerRenderEvent() {
        let counter = 0;
        const step = (timeStamp) => {
            const updated = this.update();
            if (updated) {
                counter += 1;
                this.render(counter);
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        this.render(counter);
    }
}
//# sourceMappingURL=SpaceRiftPuzzle.js.map
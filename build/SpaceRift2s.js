import * as Model from "./Model.js";
import * as Draw from "./Draw.js";
import * as Geo from "./Geometry2D.js";
import { assert } from "./Utils.js";
export var PuzzleControlStateType;
(function (PuzzleControlStateType) {
    PuzzleControlStateType[PuzzleControlStateType["Ready"] = 0] = "Ready";
    PuzzleControlStateType[PuzzleControlStateType["Updated"] = 1] = "Updated";
    PuzzleControlStateType[PuzzleControlStateType["Twisting"] = 2] = "Twisting";
    PuzzleControlStateType[PuzzleControlStateType["Tearing"] = 3] = "Tearing";
})(PuzzleControlStateType || (PuzzleControlStateType = {}));
const BACKGROUND_STYLE = "rgb(30 30 30)";
const RIFTANGLE_TO_TIME = 100;
const RIFTOFFSET_TO_TIME = 300;
const TWIST_DURATION = 300;
const ROTATE_RIFT_DURATION = 300;
const WHEEL_TO_RIFTANGLE = -0.001;
const WHEEL_TO_RIFTOFFSET = 0.001;
const DRAG_RIFT_RADIUS = 0.3;
export class SpaceRiftPuzzle {
    constructor(arg) {
        this.draw_frame = true;
        this.canvas = arg.canvas;
        this.model = arg.model;
        this.cs = arg.cs;
        this.control_state = { type: PuzzleControlStateType.Ready };
    }
    // scale: for debug
    static makeSpaceRift2S(canvas, scale = 1) {
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
        const model = Model.PrincipalPuzzleWithTexture.makeRamified2SPuzzle(radius, center_x, R, f => Draw.drawComplex(cs, f, image_x_range, image_y_range));
        return new SpaceRiftPuzzle({ canvas, model, cs });
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
                Model.PrincipalPuzzleWithTexture.twistTo(this.model, this.control_state.side, this.control_state.sheet, this.control_state.angle_to);
                Model.PrincipalPuzzleWithTexture.snap(this.model);
                this.control_state = { type: PuzzleControlStateType.Ready };
            }
            else {
                const angle = this.control_state.angle_from + (this.control_state.angle_to - this.control_state.angle_from) * t;
                Model.PrincipalPuzzleWithTexture.twistTo(this.model, this.control_state.side, this.control_state.sheet, angle);
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
        for (const clipped_image of clipped_images.images) {
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
            for (const clipped_image of clipped_images.images) {
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
        ctx.strokeStyle = "red";
        for (const rift of clipped_images.rifts)
            ctx.stroke(Draw.toCanvasPath(this.cs, rift));
        // // for debug
        // ctx.fillStyle = "white";
        // ctx.font = "26px serif";
        // ctx.fillText(`${n}`, 10, 50);
        return true;
    }
    twist(side, sheet, turn, duration) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const time = Date.now();
        duration !== null && duration !== void 0 ? duration : (duration = TWIST_DURATION);
        const step_angle = Math.PI / 3;
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
        const p1 = this.model.branch_cuts[this.model.rifts[index].left].point;
        const p2 = this.model.branch_cuts[this.model.rifts[index].right].point;
        const angle0 = this.model.rifts[index].coord.angle;
        const { offset, angle } = Model.HyperbolicPolarCoordinate.getCoordinateFromPoint(p1, p2, point);
        const angle_ = Geo.as_npi_pi(angle - angle0) + angle0;
        return this.tear(index, angle_, offset, duration);
    }
    serTearTo(index, point) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const p1 = this.model.branch_cuts[this.model.rifts[index].left].point;
        const p2 = this.model.branch_cuts[this.model.rifts[index].right].point;
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
        this.canvas.addEventListener("wheel", event => {
            event.preventDefault();
            if (dragging_rift_index !== undefined)
                return;
            // TODO
            const current_rift_index = 0;
            if (event.shiftKey) {
                this.tear(current_rift_index, this.model.rifts[current_rift_index].coord.angle, this.model.rifts[current_rift_index].coord.offset + WHEEL_TO_RIFTOFFSET * event.deltaY);
            }
            else {
                this.tear(current_rift_index, this.model.rifts[current_rift_index].coord.angle + WHEEL_TO_RIFTANGLE * event.deltaY, this.model.rifts[current_rift_index].coord.offset);
            }
        }, false);
        this.canvas.addEventListener("contextmenu", event => event.preventDefault(), false);
        this.canvas.addEventListener("mousedown", event => {
            event.preventDefault();
            if (dragging_rift_index !== undefined)
                return;
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const point = Draw.toCoordinate(this.cs, [x, y]);
            if (event.button === 1) {
                // TODO
                const current_rift_index = 0;
                this.tear(current_rift_index, this.model.rifts[current_rift_index].coord.angle + Math.PI * 2, this.model.rifts[current_rift_index].coord.offset, ROTATE_RIFT_DURATION);
                return;
            }
            const rift_points = this.model.rifts.map(rift => Model.HyperbolicPolarCoordinate.getHyperbolaPoint(this.model.branch_cuts[rift.left].point, this.model.branch_cuts[rift.right].point, rift.coord));
            const drag_rift_index = rift_points.findIndex(rift_point => rift_point[1]
                && Geo.norm(Geo.sub(rift_point[0], point)) <= DRAG_RIFT_RADIUS);
            if (dragging_rift_index === undefined && event.button === 0 && drag_rift_index !== -1) {
                dragging_rift_index = drag_rift_index;
                return;
            }
            if (event.button === 0 || event.button === 2) {
                // TODO
                const current_sheet = 0;
                const [left_circle, right_circle] = Model.Puzzle.getTwistCircles(this.model);
                const left_dis = Geo.norm(Geo.sub(left_circle.center, point));
                const right_dis = Geo.norm(Geo.sub(right_circle.center, point));
                if (left_dis > this.model.radius && right_dis > this.model.radius)
                    return;
                const side = left_dis < right_dis;
                const turn = event.button === 0 ? 1 : -1;
                this.twist(side, current_sheet, turn);
                return;
            }
        }, false);
        this.canvas.addEventListener("mousemove", event => {
            if (dragging_rift_index === undefined)
                return;
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const point = Draw.toCoordinate(this.cs, [x, y]);
            this.serTearTo(dragging_rift_index, point);
        }, false);
        this.canvas.addEventListener("mouseup", event => { dragging_rift_index = undefined; }, false);
        this.canvas.addEventListener("mouseleave", event => { dragging_rift_index = undefined; }, false);
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
//# sourceMappingURL=SpaceRift2s.js.map
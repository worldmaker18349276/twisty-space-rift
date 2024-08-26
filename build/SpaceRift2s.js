import * as Model from "./Model.js";
import * as Draw from "./Draw.js";
import * as Geo from "./Geometry2D.js";
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
export class SpaceRift2s {
    constructor(arg) {
        this.draw_frame = true;
        this.canvas = arg.canvas;
        this.model = arg.model;
        this.cs = arg.cs;
        this.control_state = { type: PuzzleControlStateType.Ready };
    }
    static make(canvas, scale = 1) {
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
        const model = Model.PrincipalPuzzleWithTexture.make(radius, center_x, R, (f) => Draw.drawComplex(cs, f, image_x_range, image_y_range));
        return new SpaceRift2s({ canvas, model, cs });
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
            const t = (time - this.control_state.start_time) / this.control_state.duration;
            if (!Number.isFinite(t) || t > 1) {
                // console.assert(this.model.puzzle.state.type !== Model.StateType.Aligned);
                const side = (this.model.puzzle.state.type === Model.StateType.LeftShifted);
                Model.PrincipalPuzzleWithTexture.twistTo(this.model, this.control_state.shift_to, side);
                Model.PrincipalPuzzleWithTexture.snap(this.model);
                this.control_state = { type: PuzzleControlStateType.Ready };
            }
            else {
                const side = (this.model.puzzle.state.type === Model.StateType.LeftShifted);
                const shift = this.control_state.shift_from + (this.control_state.shift_to - this.control_state.shift_from) * t;
                Model.PrincipalPuzzleWithTexture.twistTo(this.model, shift, side);
            }
            return true;
        }
        else if (this.control_state.type === PuzzleControlStateType.Tearing) {
            const t = (time - this.control_state.start_time) / this.control_state.duration;
            if (!Number.isFinite(t) || t > 1) {
                Model.PrincipalPuzzleWithTexture.setRift(this.model, this.control_state.rift_angle_to, this.control_state.rift_offset_to);
                this.control_state = { type: PuzzleControlStateType.Ready };
            }
            else {
                const angle = this.control_state.rift_angle_from
                    + (this.control_state.rift_angle_to - this.control_state.rift_angle_from) * t;
                const offset = this.control_state.rift_offset_from
                    + (this.control_state.rift_offset_to - this.control_state.rift_offset_from) * t;
                Model.PrincipalPuzzleWithTexture.setRift(this.model, angle, offset);
            }
            return true;
        }
        else {
            console.assert(false, "unreachable");
            return false;
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
        const positions = Model.PrincipalPuzzleWithTexture.getPositions(this.model);
        const clipped_images = Model.PrincipalPuzzleWithTexture.getClippedImages(this.model);
        if (clipped_images === undefined) {
            console.error("fail to calculate clipped images");
            return false;
        }
        for (const clipped_image of clipped_images) {
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
            for (const [_piece, path] of Model.PrincipalPuzzle.calculateShapes(this.model.puzzle)) {
                const hide = path.segs.map(seg => this.model.auxiliary_edges.has(seg.source));
                ctx.stroke(Draw.toCanvasPath(this.cs, path, hide));
            }
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = "red";
        const rift = Model.PrincipalPuzzle.calculateRift(this.model.puzzle);
        ctx.stroke(Draw.toCanvasPath(this.cs, rift));
        // // for debug
        // ctx.fillStyle = "white";
        // ctx.font = "26px serif";
        // ctx.fillText(`${n}`, 10, 50);
        return true;
    }
    twist(turn, side, duration) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const time = Date.now();
        duration !== null && duration !== void 0 ? duration : (duration = TWIST_DURATION);
        const step_angle = Math.PI / 3;
        Model.PrincipalPuzzleWithTexture.twistTo(this.model, 0, side);
        this.control_state = {
            type: PuzzleControlStateType.Twisting,
            duration,
            shift_from: 0,
            shift_to: turn * step_angle,
            start_time: time,
        };
        return true;
    }
    tear(angle, offset, duration) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const time = Date.now();
        duration !== null && duration !== void 0 ? duration : (duration = Math.abs(angle - this.model.puzzle.rift_angle) * RIFTANGLE_TO_TIME
            + Math.abs(offset - this.model.puzzle.rift_offset) * RIFTOFFSET_TO_TIME);
        this.control_state = {
            type: PuzzleControlStateType.Tearing,
            duration,
            rift_angle_from: this.model.puzzle.rift_angle,
            rift_angle_to: angle,
            rift_offset_from: this.model.puzzle.rift_offset,
            rift_offset_to: offset,
            start_time: time,
        };
        return true;
    }
    tearTo(point, duration) {
        const [angle, offset] = Model.PrincipalPuzzle.calculateRiftAngleOffsetFromPoint(this.model.puzzle, point);
        return this.tear(angle, offset, duration);
    }
    serTearTo(point) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const [angle, offset] = Model.PrincipalPuzzle.calculateRiftAngleOffsetFromPoint(this.model.puzzle, point);
        Model.PrincipalPuzzleWithTexture.setRift(this.model, angle, offset);
        this.control_state = { type: PuzzleControlStateType.Updated };
        return true;
    }
    registerController() {
        let is_dragging = false;
        this.canvas.addEventListener("wheel", event => {
            event.preventDefault();
            if (is_dragging)
                return;
            if (event.shiftKey) {
                this.tear(this.model.puzzle.rift_angle, this.model.puzzle.rift_offset + WHEEL_TO_RIFTOFFSET * event.deltaY);
            }
            else {
                this.tear(this.model.puzzle.rift_angle + WHEEL_TO_RIFTANGLE * event.deltaY, this.model.puzzle.rift_offset);
            }
        }, false);
        this.canvas.addEventListener("contextmenu", event => event.preventDefault(), false);
        this.canvas.addEventListener("mousedown", event => {
            event.preventDefault();
            if (is_dragging)
                return;
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const point = Draw.toCoordinate(this.cs, [x, y]);
            const curr = Model.PrincipalPuzzle.calculateRiftTurningPoint(this.model.puzzle);
            if (event.button === 1) {
                this.tear(this.model.puzzle.rift_angle + Math.PI * 2, this.model.puzzle.rift_offset, ROTATE_RIFT_DURATION);
            }
            else if (!is_dragging && event.button === 0 && curr !== undefined && Geo.norm(Geo.sub(curr, point)) <= DRAG_RIFT_RADIUS) {
                is_dragging = true;
            }
            else if (event.button === 0 || event.button === 2) {
                const [left_circle, right_circle] = Model.PrincipalPuzzle.getTwistCircles(this.model.puzzle);
                const left_dis = Geo.norm(Geo.sub(left_circle.center, point));
                const right_dis = Geo.norm(Geo.sub(right_circle.center, point));
                if (left_dis > this.model.puzzle.radius && right_dis > this.model.puzzle.radius)
                    return;
                const side = left_dis < right_dis;
                const turn = event.button === 0 ? 1 : -1;
                this.twist(turn, side);
            }
        }, false);
        this.canvas.addEventListener("mousemove", event => {
            if (!is_dragging)
                return;
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const point = Draw.toCoordinate(this.cs, [x, y]);
            this.serTearTo(point);
        }, false);
        this.canvas.addEventListener("mouseup", event => { is_dragging = false; }, false);
        this.canvas.addEventListener("mouseleave", event => { is_dragging = false; }, false);
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
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
const PENCIL_COLOR = "rgb(100 100 100)";
const RIFT_COLOR = "rgb(30 30 30)";
const FOCUS_FRAME_COLOR = "red";
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
    PuzzleVariant["Dipole_2"] = "Dipole(2)^2";
})(PuzzleVariant || (PuzzleVariant = {}));
export class SpaceRiftPuzzle {
    constructor(arg) {
        this.render_frame = true;
        this.render_ruler = false;
        this.render_counter = false;
        this.rendering_layer = 0;
        this.focus_piece = undefined;
        this.variant = arg.variant;
        this.canvas = arg.canvas;
        this.model = arg.model;
        this.cs = arg.cs;
        this.control_state = { type: PuzzleControlStateType.Ready };
        this.current_images = new Set();
        this.current_rifts = [];
    }
    static make(canvas, variant = PuzzleVariant.Dipole2H) {
        const zoomout_scale = 1; // for debug
        const cs = Draw.makeCoordinateSystem({
            width_pixel: canvas.clientWidth,
            height_pixel: canvas.clientHeight,
            x_range: [-4 * zoomout_scale, 4 * zoomout_scale],
            y_range: [-3 * zoomout_scale, 3 * zoomout_scale],
        });
        const shape = {
            radius: 1.56,
            center_x: 1,
            R: Math.sqrt(cs.x_range[0] * cs.x_range[0] + cs.y_range[0] * cs.y_range[0]) * 1.5 / zoomout_scale,
        };
        let builder;
        if (variant === PuzzleVariant.Dipole2H) {
            builder = Model.Builder.DH(2, 1);
        }
        else if (variant === PuzzleVariant.Dipole2V) {
            builder = Model.Builder.DV(2, 1);
        }
        else if (variant === PuzzleVariant.Dipole3H) {
            builder = Model.Builder.DH(3, 1);
        }
        else if (variant === PuzzleVariant.Dipole3V) {
            builder = Model.Builder.DV(3, 1);
        }
        else if (variant === PuzzleVariant.Quadrapole3) {
            builder = Model.Builder.Q(3, 1);
        }
        else if (variant === PuzzleVariant.Dipole_2) {
            builder = Model.Builder.DD(1);
        }
        else {
            assert(false);
        }
        const image_x_range = [cs.x_range[0], cs.x_range[1]];
        const image_y_range = [cs.y_range[0], cs.y_range[1]];
        const drawComplex = (f) => Draw.drawComplex(cs, f, image_x_range, image_y_range);
        const model = Model.PrincipalPuzzleWithTexture.makePuzzle(builder, shape, drawComplex);
        return new SpaceRiftPuzzle({ variant, canvas, model, cs });
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
                assert(this.model.states[this.control_state.sheet].type !== Model.StateType.Aligned);
                const succ = Model.PrincipalPuzzleWithTexture.setShift(this.model, this.control_state.side, this.control_state.sheet, this.control_state.angle_to);
                if (!succ) {
                    const angle = this.control_state.angle_to;
                    this.control_state.duration = this.control_state.duration;
                    this.control_state.start_time = time;
                    this.control_state.angle_to = this.control_state.angle_from;
                    this.control_state.angle_from = angle;
                }
                else {
                    const succ2 = Model.PrincipalPuzzleWithTexture.snap(this.model);
                    if (!succ2) {
                        console.error("fail to twist");
                    }
                    assert(Model.AbstractPuzzle.isAligned(this.model));
                    this.control_state = { type: PuzzleControlStateType.Ready };
                }
            }
            else {
                const angle = this.control_state.angle_from + (this.control_state.angle_to - this.control_state.angle_from) * t;
                const succ = Model.PrincipalPuzzleWithTexture.setShift(this.model, this.control_state.side, this.control_state.sheet, angle);
                if (!succ) {
                    this.control_state.duration = t * this.control_state.duration;
                    this.control_state.start_time = time;
                    this.control_state.angle_to = this.control_state.angle_from;
                    this.control_state.angle_from = angle;
                }
            }
            return true;
        }
        else if (this.control_state.type === PuzzleControlStateType.Tearing) {
            const t = (time - this.control_state.start_time) / this.control_state.duration;
            if (!Number.isFinite(t) || t > 1) {
                const succ = Model.PrincipalPuzzleWithTexture.setRift(this.model, this.control_state.index, { offset: this.control_state.offset_to, angle: this.control_state.angle_to });
                this.control_state = { type: PuzzleControlStateType.Ready };
            }
            else {
                const angle = this.control_state.angle_from
                    + (this.control_state.angle_to - this.control_state.angle_from) * t;
                const offset = this.control_state.offset_from
                    + (this.control_state.offset_to - this.control_state.offset_from) * t;
                const succ = Model.PrincipalPuzzleWithTexture.setRift(this.model, this.control_state.index, { offset, angle });
                if (!succ) {
                    this.control_state = { type: PuzzleControlStateType.Ready };
                }
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
        this.current_images = clipped_images.images[this.rendering_layer];
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
        if (this.render_frame) {
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
        const CROSS_WIDTH = 0.05;
        for (const rift of this.current_rifts) {
            assert(!rift.is_closed);
            const mask_circles = indices(rift.segs.length)
                .filter(i => rift.segs[i].source.from !== undefined)
                .slice(1)
                .map(i => Geo.getStartPoint(rift, i))
                .map(p => ({
                is_closed: true,
                segs: [
                    {
                        type: Geo.PathSegType.Arc,
                        circle: {
                            center: p,
                            radius: CROSS_WIDTH,
                        },
                        len: Math.PI * 2,
                        source: undefined,
                        target: Geo.add(p, [0, CROSS_WIDTH]),
                    }
                ]
            }));
            ctx.save();
            ctx.clip(Draw.clipPaths(this.cs, mask_circles));
            ctx.stroke(Draw.toCanvasPath(this.cs, rift));
            ctx.restore();
        }
        if (this.focus_piece !== undefined) {
            const images = Model.PrincipalPuzzleWithTexture.calculateImages(this.model);
            const image = [...images].find(image => image.region.segs.some(seg => seg.source.type === Geo.CutSourceType.Seg
                && seg.source.ref.source.aff === this.focus_piece));
            const path = Draw.toCanvasPath(this.cs, image.region);
            const pos = Draw.toCanvasMatrix(this.cs, image.transformation);
            ctx.save();
            ctx.clip(path);
            ctx.transform(...pos);
            ctx.transform(...image.image.trans);
            ctx.drawImage(image.image.canvas, 0, 0);
            ctx.restore();
            ctx.lineWidth = 2;
            ctx.strokeStyle = FOCUS_FRAME_COLOR;
            ctx.stroke(path);
        }
        // ruler
        if (this.render_ruler) {
            const TICK_LEN = 6;
            const TICK_WIDTH = 2;
            const SUBTICK_LEN = 3;
            const SUBTICK_WIDTH = 1;
            const [x0, x1] = this.cs.x_range;
            for (let y = Math.ceil(this.cs.y_range[0] * 10) / 10; y < this.cs.y_range[1]; y += 0.1) {
                const [i, j] = Draw.toViewport(this.cs, [x0, y]);
                ctx.beginPath();
                ctx.moveTo(i, j);
                ctx.lineTo(i + SUBTICK_LEN, j);
                ctx.lineWidth = SUBTICK_WIDTH;
                ctx.strokeStyle = "black";
                ctx.stroke();
                if (Math.abs(y - Math.round(y)) < 1e-5) {
                    ctx.beginPath();
                    ctx.moveTo(i, j);
                    ctx.lineTo(i + TICK_LEN, j);
                    ctx.lineWidth = TICK_WIDTH;
                    ctx.strokeStyle = "black";
                    ctx.stroke();
                }
            }
            for (let y = Math.ceil(this.cs.y_range[0] * 10) / 10; y < this.cs.y_range[1]; y += 0.1) {
                const [i, j] = Draw.toViewport(this.cs, [x1, y]);
                ctx.beginPath();
                ctx.moveTo(i, j);
                ctx.lineTo(i - SUBTICK_LEN, j);
                ctx.lineWidth = SUBTICK_WIDTH;
                ctx.strokeStyle = "black";
                ctx.stroke();
                if (Math.abs(y - Math.round(y)) < 1e-5) {
                    ctx.beginPath();
                    ctx.moveTo(i, j);
                    ctx.lineTo(i - TICK_LEN, j);
                    ctx.lineWidth = TICK_WIDTH;
                    ctx.strokeStyle = "black";
                    ctx.stroke();
                }
            }
            const [y0, y1] = this.cs.y_range;
            for (let x = Math.ceil(this.cs.x_range[0] * 10) / 10; x < this.cs.x_range[1]; x += 0.1) {
                const [i, j] = Draw.toViewport(this.cs, [x, y0]);
                ctx.beginPath();
                ctx.moveTo(i, j);
                ctx.lineTo(i, j - SUBTICK_LEN);
                ctx.lineWidth = SUBTICK_WIDTH;
                ctx.strokeStyle = "black";
                ctx.stroke();
                if (Math.abs(x - Math.round(x)) < 1e-5) {
                    ctx.beginPath();
                    ctx.moveTo(i, j);
                    ctx.lineTo(i, j - TICK_LEN);
                    ctx.lineWidth = TICK_WIDTH;
                    ctx.strokeStyle = "black";
                    ctx.stroke();
                }
            }
            for (let x = Math.ceil(this.cs.x_range[0] * 10) / 10; x < this.cs.x_range[1]; x += 0.1) {
                const [i, j] = Draw.toViewport(this.cs, [x, y1]);
                ctx.beginPath();
                ctx.moveTo(i, j);
                ctx.lineTo(i, j + SUBTICK_LEN);
                ctx.lineWidth = SUBTICK_WIDTH;
                ctx.strokeStyle = "black";
                ctx.stroke();
                if (Math.abs(x - Math.round(x)) < 1e-5) {
                    ctx.beginPath();
                    ctx.moveTo(i, j);
                    ctx.lineTo(i, j + TICK_LEN);
                    ctx.lineWidth = TICK_WIDTH;
                    ctx.strokeStyle = "black";
                    ctx.stroke();
                }
            }
        }
        // counter
        if (this.render_counter) {
            ctx.fillStyle = "white";
            ctx.font = "26px serif";
            ctx.fillText(`${n}`, 10, 50);
        }
        return true;
    }
    startDrawSection(start) {
        const clipped_images = Model.PrincipalPuzzleWithTexture.calculateClippedImages(this.model);
        if (clipped_images === undefined) {
            console.error("fail to calculate clipped images");
            return undefined;
        }
        return (point) => {
            const [x0, y0] = Draw.toViewport(this.cs, start);
            const [x1, y1] = Draw.toViewport(this.cs, point);
            const ctxs = this.model.textures.map(texture => texture.canvas.getContext("2d"));
            for (const clipped_image of clipped_images.images[this.rendering_layer]) {
                const path = Draw.toCanvasPath(this.cs, clipped_image.region);
                const pos = Draw.toCanvasMatrix(this.cs, clipped_image.transformation);
                const ctx = ctxs[this.model.textures.indexOf(clipped_image.image)];
                ctx.save();
                ctx.lineWidth = 2;
                ctx.strokeStyle = PENCIL_COLOR;
                ctx.transform(...Draw.inverse(clipped_image.image.trans));
                ctx.transform(...Draw.inverse(pos));
                ctx.clip(path);
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                ctx.restore();
            }
            start = point;
            return true;
        };
    }
    setUpdated() {
        if (this.control_state.type === PuzzleControlStateType.Ready) {
            this.control_state = { type: PuzzleControlStateType.Updated };
        }
    }
    focus(piece) {
        this.focus_piece = piece;
        this.setUpdated();
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
        const succ = Model.PrincipalPuzzleWithTexture.setShift(this.model, side, sheet, 0);
        if (!succ)
            return false;
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
        const p1 = this.model.rift_endpoints[this.model.rifts[index].left].point;
        const p2 = this.model.rift_endpoints[this.model.rifts[index].right].point;
        const angle0 = this.model.rifts[index].coord.angle;
        const { offset, angle } = Model.HyperbolicPolarCoordinate.getCoordinateFromPoint(p1, p2, point);
        const angle_ = Geo.as_npi_pi(angle - angle0) + angle0;
        return this.tear(index, angle_, offset, duration);
    }
    tearToImmediately(index, point) {
        if (this.control_state.type !== PuzzleControlStateType.Ready)
            return false;
        const p1 = this.model.rift_endpoints[this.model.rifts[index].left].point;
        const p2 = this.model.rift_endpoints[this.model.rifts[index].right].point;
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
        let draw_section = undefined;
        const is_drawing = () => draw_section !== undefined;
        const start_drawing = (point) => { draw_section = this.startDrawSection(point); };
        const cancel_drawing = () => { draw_section = undefined; };
        const draw_to = (point) => {
            assert(draw_section !== undefined);
            draw_section(point);
            this.control_state = { type: PuzzleControlStateType.Updated };
        };
        let dragging_rift_index = undefined;
        const is_dragging_rift = () => dragging_rift_index !== undefined;
        const start_dragging_rift = (point) => {
            const rift_points = this.model.rifts.map(rift => Model.HyperbolicPolarCoordinate.getHyperbolaPoint(this.model.rift_endpoints[rift.left].point, this.model.rift_endpoints[rift.right].point, rift.coord));
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
        const drag_rift_to = (point) => {
            assert(dragging_rift_index !== undefined);
            const succ = this.tearToImmediately(dragging_rift_index, point);
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
                .find(sheet => { var _a, _b; return (_b = (_a = Model.AbstractPuzzle.getTwistPieces(this.model, side, sheet)) === null || _a === void 0 ? void 0 : _a.pieces.has(piece)) !== null && _b !== void 0 ? _b : false; });
            if (sheet === undefined)
                return;
            const turn = forward ? 1 : -1;
            this.twist(side, sheet, turn);
        };
        const inspect = (point) => {
            const piece = this.pointTo(point);
            console.log(piece);
            this.focus(this.focus_piece === piece ? undefined : piece);
        };
        this.canvas.addEventListener("wheel", event => {
            event.preventDefault();
            if (this.current_rifts.length === 0)
                return;
            if (this.current_images.size === 0)
                return;
            if (is_dragging_rift())
                return;
            if (is_drawing())
                return;
            const point = this.getPosition(event);
            scroll_rift(point, event.deltaX, event.deltaY);
        }, false);
        this.canvas.addEventListener("contextmenu", event => event.preventDefault(), false);
        this.canvas.addEventListener("mousedown", event => {
            event.preventDefault();
            if (is_dragging_rift())
                return;
            if (is_drawing())
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
                this.rendering_layer = (this.rendering_layer + 1) % this.model.stands.length;
                this.control_state = { type: PuzzleControlStateType.Updated };
                return;
            }
            if (!is_dragging_rift() && event.button === 0 && start_dragging_rift(point)) {
                return;
            }
            if (!is_drawing() && event.shiftKey && event.button === 0) {
                start_drawing(point);
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
            if (is_dragging_rift())
                drag_rift_to(point);
            else if (is_drawing())
                draw_to(point);
        }, false);
        this.canvas.addEventListener("mouseup", event => {
            cancel_dragging_rift();
            cancel_drawing();
        }, false);
        this.canvas.addEventListener("mouseleave", event => {
            cancel_dragging_rift();
            cancel_drawing();
        }, false);
        // TODO: find a better way
        document.addEventListener("keydown", event => {
            var _a;
            if (event.key === "c") {
                const cmd = prompt("command");
                if (cmd === "m" || cmd === "move") {
                    const n = parseInt(prompt("move focus to"));
                    this.focus((_a = this.focus_piece) === null || _a === void 0 ? void 0 : _a.edges[n].adj.aff);
                }
            }
        }, false);
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
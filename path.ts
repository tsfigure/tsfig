import { _default_clip, _default_move, _default_move_to, _default_rotate, _default_scale, _default_transform, _default_transform_2to2, getter, Movable, Shape } from "./shapes.ts";
import { angle, assert, Box, boxes_bbox, normalize_angle, points_bbox, vec, Vec } from "./util.ts";

export class PathLineCommand {
    delta: Vec

    constructor(delta: Vec) {
        this.delta = delta
    }

    bbox() {
        return points_bbox([vec(0, 0), this.delta])
    }
}

export class PathArcCommand {
    delta: Vec
    radius: number
    large_arc: boolean
    clockwise: boolean

    constructor(delta: Vec, radius: number, large_arc: boolean, clockwise: boolean) {
        assert(delta.norm() <= 2 * radius)
        this.delta = delta
        this.radius = radius
        this.large_arc = large_arc
        this.clockwise = clockwise
    }

    _angle_range_includes(start_angle: number, end_angle: number, angle: number) {
        if (end_angle > start_angle) {
            return (angle > start_angle) && (angle < end_angle)
        } else {
            // Range passes through 0
            return (angle > start_angle) || (angle < end_angle)
        }
    }

    bbox() {
        const delta_norm = this.delta.norm()
        let side = Math.sqrt(this.radius * this.radius - delta_norm * delta_norm / 4)
        if (this.clockwise == this.large_arc) {
            side = -side
        }
        const center = this.delta.mul(0.5).add(this.delta.rotate(90).normalize().mul(side))
        let half_angle = Math.asin((delta_norm / 2) / this.radius) / Math.PI * 180
        if (this.large_arc) {
            half_angle = 180 - half_angle
        }
        let mid_angle = angle(vec(1, 0), this.delta)
        if (this.clockwise) {
            mid_angle -= 90
        } else {
            mid_angle += 90
        }
        const start_angle = normalize_angle(mid_angle - half_angle)
        const end_angle = normalize_angle(mid_angle + half_angle)

        let bbox_points = [vec(0, 0), vec(this.delta)]
        if (this._angle_range_includes(start_angle, end_angle, 0)) {
            bbox_points.push(center.add(vec(this.radius, 0)))
            console.log(bbox_points[2].x, bbox_points[2].y)
        }
        if (this._angle_range_includes(start_angle, end_angle, 90)) {
            bbox_points.push(center.add(vec(0, this.radius)))
        }
        if (this._angle_range_includes(start_angle, end_angle, 180)) {
            bbox_points.push(center.add(vec(-this.radius, 0)))
        }
        if (this._angle_range_includes(start_angle, end_angle, 270)) {
            bbox_points.push(center.add(vec(0, 0 - this.radius)))
        }
        return points_bbox(bbox_points)
    }
}

export class PathBezierCommand {
    // Distances from the first point to all control points
    deltas: Vec[]

    constructor(deltas: Vec[]) {
        this.deltas = deltas
    }
}

function path_bbox(start_pos: Vec, commands) {
    let pos = start_pos
    let command_boxes = []

    for (const cmd of commands) {
        command_boxes.push(cmd.bbox().move(pos))
        pos = pos.add(cmd.delta)
    }

    return boxes_bbox(command_boxes)
}

export class MiteredPath extends Shape implements Movable {
    commands: any[]
    start_pos: Vec
    miter_size: number
    static from_core_properties(start_pos: Vec, commands: any[], miter_size: number) {
        const result = new MiteredPath()
        result.start_pos = start_pos
        result.commands = commands
        result.miter_size = miter_size

        return result
    }

    copy() {
        const result = new MiteredPath(this.properties)
        result.start_pos = this.start_pos
        result.commands = this.commands
        result.miter_size = this.miter_size

        return <any>result
    }

    transform = _default_transform<MiteredPath>
    scale = _default_scale<MiteredPath>
    rotate = _default_rotate<MiteredPath>
    transform_2to2 = _default_transform_2to2<MiteredPath>
    move = _default_move<MiteredPath>
    move_to = _default_move_to<MiteredPath>
    clip = _default_clip
}

export class InflatedPath extends Shape implements Movable {
    bbox = getter(this, "bbox")
    commands: any[]
    start_pos: Vec
    amount: number
    static from_core_properties(start_pos: Vec, commands: any[], amount: number) {
        const result = new InflatedPath()
        result.start_pos = start_pos
        result.commands = commands
        result.amount = amount

        return result
    }

    compute_properties() {
        const original_path_box = path_bbox(this.start_pos, this.commands)
        this.properties.set("bbox", new Box(
            original_path_box.left - this.amount,
            original_path_box.top - this.amount,
            original_path_box.right + this.amount,
            original_path_box.bottom + this.amount
        ))
    }

    copy() {
        this.ensure_defined()
        const result = new InflatedPath(this.properties)
        result.start_pos = this.start_pos
        result.commands = this.commands
        result.amount = this.amount

        return <any>result
    }

    move(dx: number | Vec, dy?: number): Shape & Movable {
        const result = InflatedPath.from_core_properties(this.start_pos.add(dx, dy), this.commands, this.amount)
        if (this.properties.has("fill")) {
            result.properties.set("fill", this.properties.get("fill"))
        }
        return result
    }

    transform = _default_transform<InflatedPath>
    scale = _default_scale<InflatedPath>
    rotate = _default_rotate<InflatedPath>
    transform_2to2 = _default_transform_2to2<InflatedPath>
    move_to = _default_move_to<InflatedPath>
    clip = _default_clip
}

export class Path extends Shape implements Movable {
    bbox = getter(this, "bbox")
    start_pos: Vec
    cur_pos: Vec
    cur_angle: number = 0
    commands: any[]

    constructor(...args) {
        super(...args)
        this.start_pos = vec(0)
        this.cur_pos = vec(0)
        this.commands = []
    }

    static from_core_properties(start_pos: Vec, commands: any[]) {
        const result = new Path()
        result.start_pos = start_pos
        result.commands = commands
        result.ensure_defined()
        return result
    }

    start(x: number | Vec, y?: number) {
        assert(this.commands.length == 0)
        if (x instanceof Vec && arguments.length == 1) {
            this.start_pos = x
        } else if (arguments.length == 2) {
            this.start_pos = vec(x, y)
        } else {
            throw new Error("Incorrect parameters for Path.start()")
        }
        this.cur_pos = this.start_pos

        return this
    }

    angle(angle: number) {
        this.cur_angle = angle
        return this
    }

    line(args: { length?: number, to?: Vec }) {
        assert(!this.finalized)
        if ('length' in args) {
            if ('to' in args) {
                throw new Error("Cannot have both 'length' and 'to'")
            }
            const delta = vec(args.length).rotate(this.cur_angle)
            this.commands.push(new PathLineCommand(delta))

            this.cur_pos = this.cur_pos.add(delta)
            return this
        }

        this.commands.push(new PathLineCommand(args.to.sub(this.cur_pos)))
        this.cur_angle = angle(this.cur_pos, args.to)
        this.cur_pos = args.to

        return this
    }

    arc(args: { angle: number, radius: number }) {
        assert(!this.finalized)
        const to_center = vec(args.radius).rotate(this.cur_angle + (args.angle > 0 ? 90 : -90))
        const from_center = to_center.neg().rotate(args.angle)
        const delta = to_center.add(from_center)
        this.commands.push(new PathArcCommand(delta, args.radius, Math.abs(args.angle) > 180, args.angle > 0))

        this.cur_angle += args.angle
        this.cur_pos = this.cur_pos.add(delta)
        return this
    }

    parabola(args: { to: Vec, middle: Vec }) {
        assert(!this.finalized)

        // control point = 2*middle - 0.5*start - 0.5*end
        const control_pt = args.middle.mul(2)
            .sub(this.cur_pos.mul(0.5))
            .sub(args.to.mul(0.5))

        this.commands.push(new PathBezierCommand([control_pt.sub(this.cur_pos), args.to.sub(this.cur_pos)]))

        this.cur_pos = args.to
        this.cur_angle = angle(control_pt, args.to)

        return this
    }

    compute_properties(): void {
        this.properties.set("bbox", path_bbox(this.start_pos, this.commands))
    }

    copy() {
        const result = new Path(this.properties)
        result.commands = this.commands
        result.start_pos = this.start_pos
        result.cur_angle = this.cur_angle
        result.cur_pos = this.cur_pos
        return <any>result
    }

    miter(amount: number): Path | MiteredPath {
        this.ensure_defined()
        assert(amount >= 0)
        if (amount == 0) {
            return this.copy()
        }
        return MiteredPath.from_core_properties(this.start_pos, this.commands, amount)
    }

    inflate(amount: number): Path | InflatedPath {
        this.ensure_defined()
        assert(amount >= 0)
        if (amount == 0) {
            return this.copy()
        }
        return InflatedPath.from_core_properties(this.start_pos, this.commands, amount)
    }

    move(dx: number | Vec, dy?: number) {
        this.ensure_defined()
        let motion
        if (dx instanceof Vec) {
            if (arguments.length != 1) {
                throw new Error("Incorrect arguments to move()")
            }
            motion = dx
        } else {
            motion = vec(dx, dy)
        }

        const result = Path.from_core_properties(this.start_pos.add(motion), this.commands)
        if (this.properties.has("fill")) {
            result.properties.set("fill", this.properties.get("fill"))
        }
        return result
    }

    transform = _default_transform<Path>
    scale = _default_scale<Path>
    rotate = _default_rotate<Path>
    transform_2to2 = _default_transform_2to2<Path>
    move_to = _default_move_to<Path>
    clip = _default_clip
}

export function path() {
    return new Path()
}
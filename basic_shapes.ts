import { EqSys } from './constraints.ts'
import { path } from './shapes.ts'
import { angle, assert, Box, interpolate, matmul, points_bbox, vec, Vec } from './util.ts'

export function setter<T extends Shape>(obj: T, property: string): ((() => any) & ((...args) => T));
export function setter<T extends Shape, M extends (...args: any) => any>(obj: T, property: string, maker: M): ((() => any) & ((...args: Parameters<M>) => T));
export function setter<T extends Shape>(obj: T, property: string, maker?: (...args: any) => any): ((() => any) & ((...args) => T)) {
    if (typeof maker !== 'undefined') {
        function result(...args: any) {
            if (args.length > 0) {
                if (obj.finalized) {
                    throw new Error(`Trying to set '${property}' on finalized object`)
                }
                obj.properties.set(property, maker(...args))
                return obj
            }
            obj.ensure_defined()
            return obj.properties.get(property)
        }
        return result
    } else {
        function result(...args: any) {
            if (args.length > 0) {
                if (obj.finalized) {
                    throw new Error(`Trying to set '${property}' on finalized object`)
                }
                obj.properties.set(property, args[0])
                return obj
            }
            obj.ensure_defined()
            return obj.properties.get(property)
        }
        return result
    }
}

export function getter(obj: Shape, property: string) {
    function result(...args: any[]) {
        if (args.length > 0) {
            throw new Error(`Trying to set read-only property '${property}'`)
        }
        obj.ensure_defined()
        assert(obj.properties.has(property))
        return obj.properties.get(property)
    }
    return result
}

export function collector<T extends Shape>(obj: T, property: string, element_maker: (...args: any) => any) {
    function add_element(...args: any) {
        if (obj.finalized) {
            throw new Error(`Trying to append to '${property}' on finalized object`)
        }
        if (!obj.properties.has(property)) {
            obj.properties.set(property, [])
        }
        obj.properties.get(property).push(element_maker(...args))
        return obj
    }

    return add_element
}

export function _default_transform<T extends Shape>(this: T, matrix: number[]): LinearTransformOf<T> {
    return <any>new LinearTransform(this, matrix)
}

export function _default_rotate<T extends { transform: any }>(this: T, degrees: number):
    ReturnType<T["transform"]> {
    const radians = degrees / 180 * Math.PI
    return this.transform([
        Math.cos(radians), -Math.sin(radians), 0,
        Math.sin(radians), Math.cos(radians), 0
    ])
}

export function _default_scale<T extends { transform: any }>(this: T, x_scale: number, ...y_scale: number[]):
    ReturnType<T["transform"]> {
    if (y_scale.length == 0) {
        return this.transform([
            x_scale, 0, 0,
            0, x_scale, 0
        ])
    }
    return this.transform([
        x_scale, 0, 0,
        0, y_scale[0], 0
    ])
}

export function _default_move<T extends { transform: any }>(this: T, dx: number | Vec, ...dy: number[]):
    ReturnType<T["transform"]> {
    if (dx instanceof Vec) {
        if (dy.length == 0) {
            return this.transform([
                1, 0, dx.x,
                0, 1, dx.y
            ])
        } else {
            throw new Error(`Incorrect arguments for move()`)
        }
    }
    return this.transform([
        1, 0, dx,
        0, 1, dy[0]
    ])
}

export function _default_move_to<T extends { move: any }>(this: T, what: Vec, where: Vec):
    ReturnType<T["move"]> {
    return this.move(where.x - what.x, where.y - what.y)
}

export function _default_transform_2to2<T extends { transform: any }>(this: T, what1: Vec, what2: Vec, where1: Vec, where2: Vec):
    ReturnType<T["transform"]> {
    const from_vec = what2.sub(what1)
    const to_vec = where2.sub(where1)
    const scale = to_vec.norm() / from_vec.norm()
    const rotate = angle(from_vec, to_vec) / 180 * Math.PI
    const sin = Math.sin(rotate)
    const cos = Math.cos(rotate)
    return this.transform([
        scale * cos, scale * -sin, where1.x - scale * (cos * what1.x - sin * what1.y),
        scale * sin, scale * cos, where1.y - scale * (sin * what1.x + cos * what1.y)
    ])
}

export function _default_clip(clipper: Shape & Movable): Clipped {
    return new Clipped(this, clipper)
}

export interface Movable {
    transform(matrix: number[]): Shape & Movable
    scale(x_scale: number, y_scale?: number): Shape & Movable
    move(dx: number | Vec, dy?: number): Shape & Movable
    move_to(what: Vec, where: Vec): Shape & Movable
    transform_2to2(what1: Vec, what2: Vec, where1: Vec, where2: Vec): Shape & Movable
    rotate(degrees: number): Shape & Movable
    clip(clipper: Shape): Shape & Movable
}

export function _default_open<T extends { inflate: (amount: number) => { inflate } }>(this: T, amount: number):
    ReturnType<ReturnType<T["inflate"]>["inflate"]> {
    return this.inflate(-amount).inflate(amount)
}

export interface Inflatable {
    inflate(amount: number): Shape & Movable
    open(amount: number): Shape & Movable
}

export class Shape {
    properties: Map<string, any>
    finalized: boolean

    constructor(properties?: any) {
        if (properties instanceof Map) {
            this.properties = new Map(properties)
            this.finalized = true
        } else {
            this.properties = new Map()
            this.finalized = false
        }
    }

    ensure_defined() {
        if (!this.finalized) {
            this.compute_properties()
        }
        this.finalized = true
    }

    is_axis_aligned_box(): boolean {
        return false
    }

    compute_properties() { }

    fill(fill): this {
        let result = this.copy()
        result.properties.set("fill", fill)
        return result
    }

    copy(): this {
        throw new Error(`copy() not implemented for ${this.constructor.name}`)
    }
}

export class RectBorder extends Shape implements Movable {
    left = getter(this, "left")
    top = getter(this, "top")
    right = getter(this, "right")
    bottom = getter(this, "bottom")
    center = getter(this, "center")
    width = getter(this, "width")
    height = getter(this, "height")
    bbox = getter(this, "bbox")

    rect_left: number
    rect_top: number
    rect_right: number
    rect_bottom: number
    thickness

    static from_core_properties(rect_left: number, rect_top: number, rect_right: number, rect_bottom: number, thickness: number) {
        const left = rect_left - thickness / 2
        const top = rect_top - thickness / 2
        const right = rect_right + thickness / 2
        const bottom = rect_bottom + thickness / 2
        const properties = new Map<string, any>(
            [
                ["left", left],
                ["top", top],
                ["right", right],
                ["bottom", bottom],
                ["bbox", new Box(left, top, right, bottom)],
                ["width", right - left],
                ["height", bottom - top],
                ["center", new Vec((rect_left + rect_right) / 2, (rect_top + rect_bottom) / 2)]
            ]
        )
        let result = new RectBorder(properties)
        result.rect_left = rect_left
        result.rect_top = rect_top
        result.rect_right = rect_right
        result.rect_bottom = rect_bottom
        result.thickness = thickness
        return result
    }

    miter(amount: number) {
        assert(amount >= 0)
        return RectBorder.from_core_properties(this.rect_left, this.rect_top, this.rect_right, this.rect_bottom, this.thickness + amount)
    }

    copy() {
        this.ensure_defined()
        let result = new RectBorder(this.properties)
        result.thickness = this.thickness
        return <any>result
    }

    is_axis_aligned_box() {
        return true
    }

    transform = _default_transform<RectBorder>
    scale = _default_scale<RectBorder>
    rotate = _default_rotate<RectBorder>
    transform_2to2 = _default_transform_2to2<RectBorder>
    move = _default_move<RectBorder>
    move_to = _default_move_to<RectBorder>
    clip = _default_clip
}

export class RoundRect extends Shape implements Movable {
    left = getter(this, "left")
    top = getter(this, "top")
    right = getter(this, "right")
    bottom = getter(this, "bottom")
    center = getter(this, "center")
    width = getter(this, "width")
    height = getter(this, "height")
    bbox = getter(this, "bbox")
    radius: number

    static from_core_properties(left, top, right, bottom, radius) {
        console.log("roundrect", left, top, right, bottom)
        const properties = new Map<string, any>(
            [
                ["left", left],
                ["top", top],
                ["right", right],
                ["bottom", bottom],
                ["bbox", new Box(left, top, right, bottom)],
                ["width", right - left],
                ["height", bottom - top],
                ["center", new Vec((left + right) / 2, (top + bottom) / 2)]
            ]
        )
        let result = new RoundRect(properties)
        result.radius = radius
        return result
    }

    border() {
        this.ensure_defined()
        return path().start(this.left(), this.bottom() - this.radius).angle(-90)
            .line({ length: this.height() - 2 * this.radius })
            .arc({ angle: 90, radius: this.radius })
            .line({ length: this.width() - 2 * this.radius })
            .arc({ angle: 90, radius: this.radius })
            .line({ length: this.height() - 2 * this.radius })
            .arc({ angle: 90, radius: this.radius })
            .line({ length: this.width() - 2 * this.radius })
            .arc({ angle: 90, radius: this.radius })
    }

    copy() {
        this.ensure_defined()
        let result = new RoundRect(this.properties)
        result.radius = this.radius
        return <any>result
    }

    inflate(amount: number): RoundRect {
        this.ensure_defined()
        assert(amount >= 0)
        if (amount == 0) {
            return this
        }
        let result = RoundRect.from_core_properties(this.left() - amount, this.top() - amount, this.right() + amount, this.bottom() + amount, this.radius + amount)
        if (this.properties.has("fill")) {
            result = result.fill(this.properties.get("fill"))
        }
        return result
    }

    move(dx: number | Vec, dy?: number): Shape & Movable {
        let motion
        if (dx instanceof Vec) {
            if (arguments.length != 1) {
                throw new Error("Incorrect arguments to move()")
            }
            motion = dx
        } else {
            motion = vec(dx, dy)
        }
        const result = RoundRect.from_core_properties(
            this.left() + motion.x,
            this.top() + motion.y,
            this.right() + motion.x,
            this.bottom() + motion.y, this.radius)
        if (this.properties.has("fill")) {
            result.properties.set("fill", this.properties.get("fill"))
        }
        return result
    }

    transform = _default_transform<RoundRect>
    scale = _default_scale<RoundRect>
    rotate = _default_rotate<RoundRect>
    transform_2to2 = _default_transform_2to2<RoundRect>
    move_to = _default_move_to<RoundRect>
    clip = _default_clip
}

export class Rect extends Shape implements Movable, Inflatable {
    left = setter(this, "left")
    top = setter(this, "top")
    right = setter(this, "right")
    bottom = setter(this, "bottom")
    top_left = setter(this, "top_left", vec)
    top_right = setter(this, "top_right", vec)
    bottom_left = setter(this, "bottom_left", vec)
    bottom_right = setter(this, "bottom_right", vec)
    center = setter(this, "center", vec)
    center_x = setter(this, "center_x")
    center_y = setter(this, "center_y")
    width = setter(this, "width")
    height = setter(this, "height")
    bbox = setter(this, "bbox")

    compute_properties() {
        const x_sys = new EqSys()
        const y_sys = new EqSys()
        if (this.properties.has("center")) {
            x_sys.add("center", 0.5, 0.5, this.properties.get("center").x)
            y_sys.add("center", 0.5, 0.5, this.properties.get("center").y)
        }

        x_sys.add_if_exists("center_x", 0.5, 0.5, this.properties)
        y_sys.add_if_exists("center_y", 0.5, 0.5, this.properties)

        x_sys.add_if_exists("left", 1, 0, this.properties)
        y_sys.add_if_exists("top", 1, 0, this.properties)
        x_sys.add_if_exists("right", 0, 1, this.properties)
        y_sys.add_if_exists("bottom", 0, 1, this.properties)

        x_sys.add_if_exists("width", -1, 1, this.properties)
        y_sys.add_if_exists("height", -1, 1, this.properties)

        if (this.properties.has("bbox")) {
            x_sys.add("bbox (left)", 1, 0, this.properties.get("bbox").left)
            y_sys.add("bbox (top)", 1, 0, this.properties.get("bbox").top)
            x_sys.add("bbox (right)", 0, 1, this.properties.get("bbox").right)
            y_sys.add("bbox (bottom)", 0, 1, this.properties.get("bbox").bottom)
        }

        if (this.properties.has("top_left")) {
            x_sys.add("top_left", 1, 0, this.properties.get("top_left").x)
            y_sys.add("top_left", 1, 0, this.properties.get("top_left").y)
        }
        if (this.properties.has("top_right")) {
            x_sys.add("top_right", 0, 1, this.properties.get("top_right").x)
            y_sys.add("top_right", 1, 0, this.properties.get("top_right").y)
        }
        if (this.properties.has("bottom_left")) {
            x_sys.add("bottom_left", 1, 0, this.properties.get("bottom_left").x)
            y_sys.add("bottom_left", 0, 1, this.properties.get("bottom_left").y)
        }
        if (this.properties.has("bottom_right")) {
            x_sys.add("bottom_right", 0, 1, this.properties.get("bottom_right").x)
            y_sys.add("bottom_right", 0, 1, this.properties.get("bottom_right").y)
        }

        // By default, center at (0,0)
        x_sys.add_if_underconstrained(0.5, 0.5, 0)
        y_sys.add_if_underconstrained(0.5, 0.5, 0)

        const [left, right] = x_sys.solve()
        const [top, bottom] = y_sys.solve()
        this.properties.set("left", left)
        this.properties.set("top", top)
        this.properties.set("right", right)
        this.properties.set("bottom", bottom)
        this.properties.set("bbox", new Box(left, top, right, bottom))
        this.properties.set("center", new Vec((left + right) / 2, (top + bottom) / 2))
        this.properties.set("width", right - left)
        this.properties.set("height", bottom - top)
        this.properties.set("top_left", new Vec(left, top))
        this.properties.set("top_right", new Vec(right, top))
        this.properties.set("bottom_left", new Vec(left, bottom))
        this.properties.set("bottom_right", new Vec(right, bottom))
    }

    copy() {
        this.ensure_defined()
        return <any>new Rect(this.properties)
    }

    scale(x_scale: number, y_scale: number) {
        return rect()
            .left(this.left() * x_scale)
            .top(this.top() * y_scale)
            .right(this.right() * x_scale)
            .bottom(this.bottom() * y_scale)
    }

    inflate(amount: number): Rect | RoundRect {
        this.ensure_defined()
        if (amount == 0) {
            return this
        }
        let result
        if (amount > 0) {
            result = RoundRect.from_core_properties(this.left() - amount, this.top() - amount, this.right() + amount, this.bottom() + amount, amount)
        } else {
            assert(-amount < this.height() / 2)
            assert(-amount < this.width() / 2)
            result = rect().left(this.left() - amount).top(this.top() - amount).right(this.right() + amount).bottom(this.bottom() + amount)
        }
        if (this.properties.has("fill")) {
            result = result.fill(this.properties.get("fill"))
        }
        return result
    }

    open = _default_open

    miter(amount: number) {
        this.ensure_defined()
        assert(amount >= 0)
        let result = rect().left(this.left() - amount).top(this.top() - amount).right(this.right() + amount).bottom(this.bottom() + amount)
        if (this.properties.has("fill")) {
            result = result.fill(this.properties.get("fill"))
        }
        return result
    }

    border() {
        this.ensure_defined()
        return RectBorder.from_core_properties(this.left(), this.top(), this.right(), this.bottom(), 0)
    }

    is_axis_aligned_box() {
        return true
    }

    transform = _default_transform<Rect>
    rotate = _default_rotate<Rect>
    transform_2to2 = _default_transform_2to2<Rect>
    move = _default_move<Rect>
    move_to = _default_move_to<Rect>
    clip = _default_clip
}

export function rect(): Rect {
    return new Rect()
}

export class Disk extends Shape implements Movable {
    radius = setter(this, "radius")
    bbox = setter(this, "bbox")
    center = setter(this, "center", vec)
    left = getter(this, "left")
    top = getter(this, "top")
    right = getter(this, "right")
    bottom = getter(this, "bottom")

    compute_properties() {
        if (!this.properties.has("center")) {
            this.properties.set("center", vec(0, 0))
        }
        const center = this.properties.get("center")
        const radius = this.properties.get("radius")
        this.properties.set("bbox", new Box(center.x - radius, center.y - radius, center.x + radius, center.y + radius))
        this.properties.set("left", center.add(vec(-radius, 0)))
        this.properties.set("top", center.add(vec(0, -radius)))
        this.properties.set("right", center.add(vec(radius, 0)))
        this.properties.set("bottom", center.add(vec(0, radius)))
    }

    move(dx: number, dy: number) {
        const result = new Disk().center(this.center().x + dx, this.center().y + dy).radius(this.radius())
        if (this.properties.has("fill")) {
            result.properties.set("fill", this.properties.get("fill"))
        }
        return result
    }

    copy() {
        this.ensure_defined()
        return <any>new Disk(this.properties)
    }

    border() {
        this.ensure_defined()
        return DiskBorder.from_core_properties(this.center(), this.radius(), 0)
    }

    transform = _default_transform<Disk>
    scale = _default_scale<Disk>
    rotate = _default_rotate<Disk>
    transform_2to2 = _default_transform_2to2<Disk>
    move_to = _default_move_to<Disk>
    clip = _default_clip
}

export function disk() {
    return new Disk()
}

export class DiskBorder extends Shape implements Movable, Inflatable {
    bbox = getter(this, "bbox")
    center = getter(this, "center")
    disk_radius: number
    thickness: number

    static from_core_properties(center: Vec, disk_radius: number, thickness: number) {
        let result = new DiskBorder()

        result.properties.set("center", center)
        result.properties.set("bbox", new Box(
            center.x - disk_radius - thickness / 2,
            center.y - disk_radius - thickness / 2,
            center.x + disk_radius + thickness / 2,
            center.y + disk_radius + thickness / 2,
        ))
        result.thickness = thickness
        result.disk_radius = disk_radius

        return result
    }

    move(dx: number, dy: number) {
        const new_center = new Vec(this.center().x + dx, this.center().y + dy)
        return DiskBorder.from_core_properties(new_center, this.disk_radius, this.thickness)
    }

    copy() {
        let result = new DiskBorder(this.properties)
        result.disk_radius = this.disk_radius
        result.thickness = this.thickness
        return <any>result
    }

    inflate(amount: number) {
        assert(amount >= 0)
        return DiskBorder.from_core_properties(this.center(), this.disk_radius, this.thickness + amount * 2)
    }

    open = _default_open

    transform = _default_transform<DiskBorder>
    scale = _default_scale<DiskBorder>
    rotate = _default_rotate<DiskBorder>
    transform_2to2 = _default_transform_2to2<DiskBorder>
    move_to = _default_move_to<DiskBorder>
    clip = _default_clip
}

class PointList extends Array {
    push(...items: any[]): number {
        throw new Error("Cannot add to point list")
    }
}

export class Polygon extends Shape implements Movable {
    points = setter(this, "points", (...args) => {
        if (args.length == 1 && args instanceof Array) {
            return PointList.from(args[0])
        } else {
            return PointList.from(args)
        }
    })
    point = collector(this, "points", vec)
    bbox = getter(this, "bbox")

    transform(matrix: number[]) {
        this.ensure_defined()
        let transformed_points = []
        for (const point of this.points()) {
            const transformed_x = matrix[0] * point.x + matrix[1] * point.y + matrix[2]
            const transformed_y = matrix[3] * point.x + matrix[4] * point.y + matrix[5]
            transformed_points.push(vec(transformed_x, transformed_y))
        }
        let result = polygon().points(transformed_points)
        if (this.properties.has("fill")) {
            result = result.fill(this.properties.get("fill"))
        }
        return result
    }

    compute_properties() {
        this.properties.set("bbox", points_bbox(this.properties.get("points")))
    }

    copy() {
        this.ensure_defined()
        return <any>new Polygon(this.properties)
    }

    scale = _default_scale<Polygon>
    rotate = _default_rotate<Polygon>
    transform_2to2 = _default_transform_2to2<Polygon>
    move = _default_move<Polygon>
    move_to = _default_move_to<Polygon>
    clip = _default_clip
}

export function polygon() {
    return new Polygon()
}

export class Line extends Shape implements Movable {
    start = setter(this, "start", vec)
    end = setter(this, "end", vec)
    vector = setter(this, "vector", vec)
    width = setter(this, "width")
    length = getter(this, "length")
    direction = getter(this, "direction")
    angle = getter(this, "angle")
    bbox = getter(this, "bbox")

    compute_properties() {
        let start
        let end
        if (this.properties.has("vector")) {
            if (this.properties.has("start") && this.properties.has("end")) {
                throw new Error("Cannot specify start, end and vector together")
            }
            if (this.properties.has("start")) {
                start = this.properties.get("start")
                end = start.add(this.properties.get("vector"))
            }
            if (this.properties.has("end")) {
                end = this.properties.get("end")
                start = end.sub(this.properties.get("vector"))
            }
        } else {
            start = this.properties.get("start")
            end = this.properties.get("end")
        }
        this.properties.set("start", start)
        this.properties.set("end", end)
        this.properties.set("vector", end.sub(start))
        this.properties.set("length", end.sub(start).norm())
        this.properties.set("direction", end.sub(start).normalize())
        this.properties.set("angle", angle(vec(1, 0), end.sub(start)))
        this.properties.set("bbox", points_bbox(Line._get_points(start, end, this.properties.get("width"))))
    }

    static _get_points(start: Vec, end: Vec, width: number) {
        const direction = end.sub(start).normalize()
        const halfwidth = direction.rotate(90).mul(width / 2)
        return [
            start.add(halfwidth),
            end.add(halfwidth),
            end.sub(halfwidth),
            start.sub(halfwidth)
        ]
    }

    trim(amount: number, end_amount?: number) {
        if (arguments.length == 1) {
            end_amount = amount
        }
        return this.trim_fraction(amount / this.length(), end_amount / this.length())
    }

    trim_fraction(fraction: number, end_fraction?: number) {
        if (arguments.length == 1) {
            end_fraction = fraction
        }
        assert(fraction + end_fraction <= 1)
        const new_start = interpolate(this.start(), this.end(), fraction)
        const new_end = interpolate(this.end(), this.start(), end_fraction)
        return new Line().start(new_start).end(new_end).width(this.width())
    }

    copy() {
        this.ensure_defined()
        return <any>new Line(this.properties)
    }

    transform = _default_transform<Line>
    scale = _default_scale<Line>
    rotate = _default_rotate<Line>
    transform_2to2 = _default_transform_2to2<Line>
    move = _default_move<Line>
    move_to = _default_move_to<Line>
    clip = _default_clip
}

export function line() {
    return new Line()
}

export type LinearTransformOf<T extends Shape> = T extends LinearTransform<infer C> ? LinearTransform<C> : LinearTransform<T>
export class LinearTransform<C extends Shape> extends Shape implements Movable {
    bbox = getter(this, "bbox")
    child: Shape
    matrix: number[]
    constructor(child: Shape, matrix: number[]) {
        super()

        for (const value of matrix) {
            assert(isFinite(value))
        }
        if (child instanceof LinearTransform) {
            this.child = child.child
            this.matrix = matmul(matrix, child.matrix)
        } else {
            this.child = child
            this.matrix = matrix
        }
    }

    compute_properties() {
        this.child.ensure_defined()
        if (this.child.is_axis_aligned_box() && "bbox" in this.child && typeof this.child.bbox == "function") {
            // These are rect-shaped
            const child_bbox = this.child.bbox()
            let transformed_points = []
            for (const corner_x of [child_bbox.left, child_bbox.right]) {
                for (const corner_y of [child_bbox.top, child_bbox.bottom]) {
                    const transformed_x = this.matrix[0] * corner_x + this.matrix[1] * corner_y + this.matrix[2]
                    const transformed_y = this.matrix[3] * corner_x + this.matrix[4] * corner_y + this.matrix[5]
                    transformed_points.push(vec(transformed_x, transformed_y))
                }
            }
            this.properties.set("bbox", points_bbox(transformed_points))
        }
    }

    fill(fill): this {
        return <this>new LinearTransform(this.child.fill(fill), this.matrix)
    }

    copy(): this {
        this.ensure_defined()
        return <this>new LinearTransform(this.child.copy(), this.matrix)
    }

    transform = _default_transform<LinearTransform<C>>
    scale = _default_scale<LinearTransform<C>>
    rotate = _default_rotate<LinearTransform<C>>
    transform_2to2 = _default_transform_2to2<LinearTransform<C>>
    move = _default_move<LinearTransform<C>>
    move_to = _default_move_to<LinearTransform<C>>
    clip = _default_clip
}

export class Clipped extends Shape implements Movable {
    child: Shape & Movable
    clipper: Shape & Movable
    constructor(child: Shape & Movable, clipper: Shape & Movable) {
        super()
        this.child = child
        this.clipper = clipper
    }

    transform(matrix: number[]): Shape & Movable {
        const result = new Clipped(this.child.transform(matrix), this.clipper.transform(matrix))
        if (this.properties.has("fill")) {
            result.properties.set("fill", this.properties.get("fill"))
        }
        return result
    }

    copy() {
        this.ensure_defined()
        const result = <any>new Clipped(this.child.copy(), this.clipper.copy())
        if (this.properties.has("fill")) {
            result.properties.set("fill", this.properties.get("fill"))
        }
        return result
    }

    scale = _default_scale<Clipped>
    rotate = _default_rotate<Clipped>
    transform_2to2 = _default_transform_2to2<Clipped>
    move = _default_move<Clipped>
    move_to = _default_move_to<Clipped>
    clip = _default_clip
}
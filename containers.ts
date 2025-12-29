import { EqSys } from "./constraints.ts"
import { rgba } from "./fill.ts"
import { _default_clip, _default_move, _default_move_to, _default_rotate, _default_scale, _default_transform_2to2, getter, LinearTransform, Movable, setter, Shape } from "./shapes.ts"
import { assert, Box, boxes_bbox, range, vec, Vec } from "./util.ts"

export class UnionBase extends Shape implements Movable {
    bbox = getter(this, "bbox")
    children = getter(this, "children")

    compute_bbox() {
        const boxes = []
        if (!this.properties.has("children")) {
            this.properties.set("children", [])
        }
        for (const child of this.properties.get("children")) {
            child.ensure_defined()
            if (!child.properties.has("bbox")) {
                // Cannot compute bbox
                return
            }
            boxes.push(child.bbox())
        }
        this.properties.set("bbox", boxes_bbox(boxes))
    }

    compute_properties() {
        this.compute_bbox()
    }

    transform(matrix: number[]) {
        this.ensure_defined()
        const transformed_children = this.children().map((c) => c.transform(matrix))
        return union(transformed_children)
    }

    move(dx: number | Vec, dy?: number): Shape & Movable {
        this.ensure_defined()
        const transformed_children = this.children().map((c) => c.move(dx, dy))
        return union(transformed_children)
    }

    copy() {
        return <any>new Union(this.properties)
    }

    fill(fill: any): this {
        this.ensure_defined()
        const filled_children = this.properties.get("children").map((c) => c.fill(fill))
        const result_properties = new Map(this.properties)
        result_properties.set("children", filled_children)
        return <any>new Union(result_properties)
    }

    child(name: string | number) {
        this.ensure_defined()
        if (typeof name === 'number') {
            return this.children()[name]
        }
        const named_children = this.properties.get("named_children")
        if (typeof named_children === 'undefined' || !named_children.has(name)) {
            throw new Error(`Requesting non-existing child '${name}'`)
        }
        return named_children.get(name)
    }

    scale = _default_scale
    rotate = _default_rotate
    transform_2to2 = _default_transform_2to2
    move_to = _default_move_to
    clip = _default_clip
}

export class Union extends UnionBase implements Movable {

    add(...shapes: (Shape & Movable)[]) {
        assert(!this.finalized)
        if (!this.properties.has("children")) {
            this.properties.set("children", [])
        }
        for (const shape of shapes) {
            if (shape instanceof Union) {
                for (const child of shape.children()) {
                    this.properties.get("children").push(child)
                }
            } else {
                this.properties.get("children").push(shape)
            }
        }
        return this
    }

    add_named(shape: Shape & Movable, name: string) {
        this.add(shape)
        if (!this.properties.has("named_children")) {
            this.properties.set("named_children", new Map())
        }
        this.properties.get("named_children").set(name, shape)
    }
}

export class Figure extends Union implements Movable {
    aspect_ratio = setter(this, "aspect_ratio")
    background = setter(this, "background")

    compute_properties(): void {
        if (!this.properties.has("aspect_ratio")) {
            this.properties.set("aspect_ratio", 1)
        }
        if (!this.properties.has("background")) {
            this.properties.set("background", rgba(0, 0, 0, 0))
        }
        super.compute_properties()
    }

    transform(matrix: number[]): Figure {
        const result = new Figure().aspect_ratio(this.aspect_ratio()).background(this.background())
        for (const child of this.children()) {
            result.add(child.transform(matrix))
        }
        return result
    }

    scale = _default_scale
    rotate = _default_rotate
    transform_2to2 = _default_transform_2to2
    move = _default_move
    move_to = _default_move_to
    clip = _default_clip
}

export function union(...children: (Shape & Movable)[] | [(Shape & Movable)[]] | [object]): Union {
    const result = new Union()
    if (children[0] instanceof Array) {
        children = children[0]
    } else if (!(children[0] instanceof Shape)) {
        const obj = children[0]
        for (const name in obj) {
            result.add_named(obj[name], name)
        }
        return result
    }

    for (const child of <(Shape & Movable)[]>children) {
        result.add(child)
    }
    return result
}

export class Linear extends UnionBase implements Movable {
    left = setter(this, "left")
    top = setter(this, "top")
    right = setter(this, "right")
    bottom = setter(this, "bottom")
    width = setter(this, "width")
    height = setter(this, "height")
    gap = setter(this, "gap")
    center = setter(this, "center", vec)
    center_x = setter(this, "center_x")
    center_y = setter(this, "center_y")
    direction = setter(this, "direction")
    bbox = getter(this, "bbox")
    children = getter(this, "children")

    compute_properties() {
        const num_children = this.properties.get("children").length
        let children_total_along = 0
        let children_max_perpendicular = 0

        if (!this.properties.has("direction")) {
            throw new Error("'direction' not specified for Linear")
        }
        const direction = this.properties.get("direction")

        // Sum children
        for (const child of this.properties.get("handles")) {
            const bbox = child.bbox()
            if (direction == "left" || direction == "right") {
                children_total_along += bbox.width
                children_max_perpendicular = Math.max(children_max_perpendicular, bbox.width)
            } else {
                children_total_along += bbox.height
                children_max_perpendicular = Math.max(children_max_perpendicular, bbox.height)
            }
        }

        // Compute along min, max
        const along_sys = new EqSys()
        if (direction == "right" || direction == "left") {
            along_sys.add_if_exists("width", -1, 1, this.properties)
            along_sys.add_if_exists("left", 1, 0, this.properties)
            along_sys.add_if_exists("right", 0, 1, this.properties)
            along_sys.add_if_exists("center_x", 0.5, 0.5, this.properties)
            if (this.properties.has("center")) {
                along_sys.add("center", 0.5, 0.5, this.properties.get("center").x)
            }
        } else {
            along_sys.add_if_exists("height", -1, 1, this.properties)
            along_sys.add_if_exists("top", 1, 0, this.properties)
            along_sys.add_if_exists("bottom", 0, 1, this.properties)
            along_sys.add_if_exists("center_y", 0.5, 0.5, this.properties)
            if (this.properties.has("center")) {
                along_sys.add("center", 0.5, 0.5, this.properties.get("center").y)
            }
        }
        if (this.properties.has("gap")) {
            along_sys.add("gap", -1, 1, children_total_along + (num_children - 1) * this.properties.get("gap"))
        }

        const [along_min, along_max] = along_sys.solve()

        // Compute perpendicular min, max
        const perp_sys = new EqSys()
        if (direction == "right" || direction == "left") {
            if (this.properties.has("height")) {
                throw new Error(`Cannot specify height for direction '${direction}'`)
            }
        } else {
            if (this.properties.has("width")) {
                throw new Error(`Cannot specify width for direction '${direction}'`)
            }
        }

        perp_sys.add("internal", -1, 1, children_max_perpendicular)
        if (direction == "right" || direction == "left") {
            perp_sys.add_if_exists("top", 1, 0, this.properties)
            perp_sys.add_if_exists("bottom", 0, 1, this.properties)
            perp_sys.add_if_exists("center_y", 0.5, 0.5, this.properties)
            if (this.properties.has("center")) {
                perp_sys.add("center", 0.5, 0.5, this.properties.get("center").y)
            }
        } else {
            perp_sys.add_if_exists("left", 1, 0, this.properties)
            perp_sys.add_if_exists("right", 0, 1, this.properties)
            perp_sys.add_if_exists("center_x", 0.5, 0.5, this.properties)
            if (this.properties.has("center")) {
                perp_sys.add("center", 0.5, 0.5, this.properties.get("center").x)
            }
        }

        const [perp_min, perp_max] = perp_sys.solve()
        const perp_center = (perp_min + perp_max) / 2

        // Compute start pos
        // TODO: justifications other than "center"
        let pos
        if (direction == "right") {
            pos = vec(along_min, perp_center)
        }
        if (direction == "left") {
            pos = vec(along_max, perp_center)
        }
        if (direction == "down") {
            pos = vec(perp_center, along_min)
        }
        if (direction == "up") {
            pos = vec(perp_center, along_max)
        }

        // Compute spacing
        let spacing
        if (num_children == 1) {
            spacing = undefined
        } else {
            spacing = (along_max - along_min - children_total_along) / (num_children - 1)
            if (direction == "right") {
                spacing = vec(spacing, 0)
            }
            if (direction == "left") {
                spacing = vec(-spacing, 0)
            }
            if (direction == "down") {
                spacing = vec(0, spacing)
            }
            if (direction == "up") {
                spacing = vec(0, -spacing)
            }
        }

        let transformed_children = []
        for (const i of range(num_children)) {
            const bbox: Box = this.properties.get("handles")[i].bbox()
            let handle
            let size
            if (direction == "right") {
                handle = bbox.left_center
                size = vec(bbox.width, 0)
            }
            if (direction == "left") {
                handle = bbox.right_center
                size = vec(-bbox.width, 0)
            }
            if (direction == "down") {
                handle = bbox.top_center
                size = vec(0, bbox.height)
            }
            if (direction == "up") {
                handle = bbox.bottom_center
                size = vec(0, -bbox.height)
            }
            transformed_children.push(this.properties.get("children")[i].move_to(handle, pos))
            pos = pos.add(size).add(spacing)
        }
        this.properties.set("children", transformed_children)

        super.compute_bbox()
    }

    add(...shapes: Shape[])
    add(shape: Shape, props?: { handle: Shape })
    add(...args: any[]) {
        assert(!this.finalized)
        if (!this.properties.has("children")) {
            this.properties.set("children", [])
        }
        if (!this.properties.has("handles")) {
            this.properties.set("handles", [])
        }
        if (args.length == 2 && !(args[1] instanceof Shape)) {
            this.properties.get("children").push(args[0])
            this.properties.get("handles").push(args[1].handle)
        } else {
            for (const shape of <Shape[]>args) {
                this.properties.get("children").push(shape)
                this.properties.get("handles").push(shape)
            }
        }
        return this
    }

    copy() {
        this.ensure_defined()
        return <any>new Linear(this.properties)
    }
}

export function linear(...children: Shape[] | [Shape[]]) {
    const result = new Linear()
    if (children[0] instanceof Array) {
        children = children[0]
    }
    for (const child of <Shape[]>children) {
        result.add(child)
    }
    return result
}
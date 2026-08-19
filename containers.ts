import { EqSys } from "./constraints.ts"
import { rgba } from "./fill.ts"
import { _default_clip, _default_move, _default_move_to, _default_rotate, _default_scale, _default_transform_2to2, getter, LinearTransform, Movable, setter, Shape } from "./shapes.ts"
import { assert, Box, boxes_bbox, range, vec, Vec } from "./util.ts"

type ContainerSubclass = Container & { copy_with_transformed_children: any }

function _default_container_transform<T extends ContainerSubclass>(this: T, matrix: number[]):
    ReturnType<T["copy_with_transformed_children"]> {
    this.ensure_defined()
    const transformed_children = this.children().map((c) => c.transform(matrix))
    return this.copy_with_transformed_children(transformed_children)
}

// Handle `move` separately from other container transforms because the children might have a
// specialized `move` implementation that is different from their `transform` implementation
function _default_container_move<T extends ContainerSubclass>(this: T, dx: number | Vec, dy?: number):
    ReturnType<T["copy_with_transformed_children"]> {
    this.ensure_defined()
    let transformed_children
    if (arguments.length == 1) {
        transformed_children = this.children().map((c) => c.move(dx))
    } else {
        transformed_children = this.children().map((c) => c.move(dx, dy))
    }
    return this.copy_with_transformed_children(transformed_children)
}

export class Container extends Shape {
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

    child(name: string | number) {
        this.ensure_defined()
        if (typeof name === 'number') {
            return this.children()[name]
        }
        const named_children = this.properties.get("named_children")
        if (typeof named_children === 'undefined' || !named_children.has(name)) {
            throw new Error(`Requesting non-existing child '${name}'`)
        }
        return this.children()[named_children.get(name)]
    }
}

export class Union extends Container implements Movable {

    add(...shapes: (Shape & Movable)[]) {
        assert(!this.finalized)
        if (!this.properties.has("children")) {
            this.properties.set("children", [])
        }
        for (const shape of shapes) {
            this.properties.get("children").push(shape.geometry())
        }
        return this
    }

    copy() {
        this.ensure_defined()
        return <any>new Union(this.properties)
    }

    copy_with_transformed_children(transformed_children: (Shape & Movable)[]) {
        let result = union(transformed_children)
        if (this.properties.has("fill")) {
            result = result.fill(this.properties.get("fill"))
        }
        return result
    }

    inflate(amount: number): Union {
        assert(amount >= 0)
        this.ensure_defined()
        const transformed_children = this.children().map((c) => c.inflate(amount))
        return this.copy_with_transformed_children(transformed_children)
    }

    transform = _default_container_transform<Union>
    scale = _default_scale<Union>
    rotate = _default_rotate<Union>
    transform_2to2 = _default_transform_2to2<Union>
    move = _default_container_move<Union>
    move_to = _default_move_to<Union>
    clip = _default_clip
}

export class Group extends Container implements Movable {

    add(...shapes: (Shape & Movable)[]) {
        assert(!this.finalized)
        if (!this.properties.has("children")) {
            this.properties.set("children", [])
        }
        for (const shape of shapes) {
            this.properties.get("children").push(shape)
        }
        return this
    }

    add_named(shape: Shape & Movable, name: string) {
        this.add(shape)
        const idx = this.properties.get("children").length - 1
        if (!this.properties.has("named_children")) {
            this.properties.set("named_children", new Map())
        }
        const named_children = this.properties.get("named_children")
        if (named_children.has(name)) {
            throw new Error(`Duplicate child name '${name}'`)
        }
        named_children.set(name, idx)
        return this
    }

    fill(fill: any): this {
        this.ensure_defined()
        const filled_children = this.properties.get("children").map((c) => c.fill(fill))
        return <any>this.copy_with_transformed_children(filled_children)
    }

    miter(amount: number) {
        this.ensure_defined()
        const new_children = this.properties.get("children").map((c) => c.miter(amount))
        return this.copy_with_transformed_children(new_children)
    }

    copy() {
        this.ensure_defined()
        return <any>new Group(this.properties)
    }

    copy_with_transformed_children(transformed_children: (Shape & Movable)[]): Group {
        let result = group(transformed_children)
        if (this.properties.has("named_children")) {
            result.properties.set("named_children", this.properties.get("named_children"))
        }
        return result
    }

    transform = _default_container_transform<Group>
    scale = _default_scale<Group>
    rotate = _default_rotate<Group>
    transform_2to2 = _default_transform_2to2<Group>
    move = _default_container_move<Group>
    move_to = _default_move_to<Group>
    clip = _default_clip
}

export class Figure extends Group implements Movable {
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

    copy() {
        this.ensure_defined()
        return <any>new Figure(this.properties)
    }

    copy_with_transformed_children(transformed_children: (Shape & Movable)[]): Figure {
        const result = new Figure().aspect_ratio(this.aspect_ratio()).background(this.background())
        for (const child of transformed_children) {
            result.add(child)
        }
        return result
    }

    transform = _default_container_transform<Figure>
    scale = _default_scale<Figure>
    rotate = _default_rotate<Figure>
    transform_2to2 = _default_transform_2to2<Figure>
    move = _default_container_move<Figure>
    move_to = _default_move_to<Figure>
    clip = _default_clip
}

// Common handler for the arguments of union(), group() and linear(). Can be
// 1. f(child1, child2, ...)
// 2. f([child1, child2, ...]), or
// 3. f({name1: child1, name2: child2, ...}) (group only)
// (f = union / group / linear)
function add_children(target: Union | Group, children: (Shape & Movable)[] | [(Shape & Movable)[]] | [object]) {
    if (children.length == 0) {
        return
    }
    if (children[0] instanceof Array) {
        children = children[0]
    } else if (!(children[0] instanceof Shape)) {
        if (target instanceof Union) {
            throw new Error("Union doesn't support named children")
        }
        const obj = children[0]
        for (const name in obj) {
            target.add_named(obj[name], name)
        }
        return
    }

    for (const child of <(Shape & Movable)[]>children) {
        target.add(child)
    }
}

export function union(...children: (Shape & Movable)[] | [(Shape & Movable)[]] | [object]): Union {
    const result = new Union()
    add_children(result, children)
    return result
}

export function group(...children: (Shape & Movable)[] | [(Shape & Movable)[]] | [object]): Group {
    const result = new Group()
    add_children(result, children)
    return result
}

export class Linear extends Group implements Movable {
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
        if (!this.properties.has("gap")) {
            this.properties.set("gap", 0)
        }
        along_sys.add("gap", -1, 1, children_total_along + (num_children - 1) * this.properties.get("gap"))
        // By default, the center is (0,0)
        along_sys.add_if_underconstrained(1, 1, 0)

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
        // By default, the center is (0,0)
        perp_sys.add_if_underconstrained(1, 1, 0)

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
            spacing = vec(0, 0)
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
        const bbox = this.properties.get("bbox")
        this.properties.set("left", bbox.left)
        this.properties.set("top", bbox.top)
        this.properties.set("right", bbox.right)
        this.properties.set("bottom", bbox.bottom)
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

    copy_with_transformed_children(transformed_children: (Shape & Movable)[]): Group {
        let result = group(transformed_children)
        if (this.properties.has("named_children")) {
            result.properties.set("named_children", this.properties.get("named_children"))
        }
        return result
    }

    transform = _default_container_transform<Linear>
    scale = _default_scale<Linear>
    rotate = _default_rotate<Linear>
    transform_2to2 = _default_transform_2to2<Linear>
    move = _default_container_move<Linear>
    move_to = _default_move_to<Linear>
    clip = _default_clip
}

export function linear(...children: (Shape & Movable)[] | [(Shape & Movable)[]] | [object]) {
    const result = new Linear()
    add_children(result, children)
    return result
}
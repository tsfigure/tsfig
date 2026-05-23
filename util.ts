import { SolidColor } from "./fill.ts"

export function assert(x: boolean) {
    if (!x) {
        throw new Error("Assertion failure")
    }
}

export function normalize_angle(angle: number) {
    let result = angle % 360
    if (result < 0) {
        result += 360
    }
    return result
}

export class Vec {
    x: number
    y: number
    constructor(x, y?) {
        if (arguments.length == 1) {
            if (x instanceof Vec) {
                this.x = x.x
                this.y = x.y
            } else {
                this.x = x
                this.y = 0
            }
            return
        }
        this.x = x
        this.y = y
    }

    add(other: number | Vec, y?: number) {
        if (other instanceof Vec) {
            return new Vec(this.x + other.x, this.y + other.y)
        }
        if (arguments.length == 1) {
            throw new Error("Missing y value")
        }
        return new Vec(this.x + other, this.y + y)
    }

    sub(other: number | Vec, y?: number) {
        if (other instanceof Vec) {
            return new Vec(this.x - other.x, this.y - other.y)
        }
        if (arguments.length == 1) {
            throw new Error("Missing y value")
        }
        return new Vec(this.x - other, this.y - y)
    }

    mul(a: number) {
        return new Vec(this.x * a, this.y * a)
    }

    neg() {
        return new Vec(-this.x, -this.y)
    }

    dot(other: Vec) {
        return this.x * other.x + this.y * other.y
    }

    norm() {
        return Math.hypot(this.x, this.y)
    }

    normalize() {
        return this.mul(1 / this.norm())
    }

    direction() {
        return Math.atan2(this.y, this.x) / Math.PI * 180
    }

    rotate(degrees: number) {
        const radians = degrees / 180 * Math.PI
        const new_x = Math.cos(radians) * this.x - Math.sin(radians) * this.y
        const new_y = Math.sin(radians) * this.x + Math.cos(radians) * this.y
        return new Vec(new_x, new_y)
    }
}

export function angle(from: Vec, to: Vec) {
    const abs_angle = Math.acos(from.dot(to) / (from.norm() * to.norm())) * 180 / Math.PI
    if (from.x * to.y > from.y * to.x) {
        return abs_angle
    } else {
        return -abs_angle
    }
}

export function vec(x: number | Vec, y?: number) {
    if (arguments.length == 1) {
        return new Vec(x)
    }
    return new Vec(x, y)
}

export function polar(r: number, angle: number) {
    return vec(r, 0).rotate(angle)
}

export class Box {
    left: number
    top: number
    right: number
    bottom: number
    center: Vec
    left_center: Vec
    top_center: Vec
    right_center: Vec
    bottom_center: Vec
    top_left: Vec
    top_right: Vec
    bottom_left: Vec
    bottom_right: Vec
    height: number
    width: number

    constructor(left: number, top: number, right: number, bottom: number) {
        this.left = left
        this.top = top
        this.right = right
        this.bottom = bottom
        this.top_left = new Vec(left, top)
        this.top_right = new Vec(right, top)
        this.bottom_left = new Vec(left, bottom)
        this.bottom_right = new Vec(right, bottom)
        this.left_center = new Vec(left, (top + bottom) / 2)
        this.top_center = new Vec((left + right) / 2, top)
        this.right_center = new Vec(right, (top + bottom) / 2)
        this.bottom_center = new Vec((left + right) / 2, bottom)
        this.height = bottom - top
        this.width = right - left
        this.center = new Vec((left + right) / 2, (top + bottom) / 2)
    }

    move(delta: Vec) {
        return new Box(this.left + delta.x, this.top + delta.y, this.right + delta.x, this.bottom + delta.y)
    }
}

export function points_bbox(points: Vec[]) {
    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity
    for (const point of points) {
        if (point.x < left) {
            left = point.x
        }
        if (point.x > right) {
            right = point.x
        }
        if (point.y < top) {
            top = point.y
        }
        if (point.y > bottom) {
            bottom = point.y
        }
    }
    return new Box(left, top, right, bottom)
}

export function boxes_bbox(boxes: Box[]) {
    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity
    for (const box of boxes) {
        if (box.left < left) {
            left = box.left
        }
        if (box.top < top) {
            top = box.top
        }
        if (box.right > right) {
            right = box.right
        }
        if (box.bottom > bottom) {
            bottom = box.bottom
        }
    }
    return new Box(left, top, right, bottom)
}

export function interpolate(v1: Vec, v2: Vec, amount: number): Vec;
export function interpolate(v1: SolidColor, v2: SolidColor, amount: number): SolidColor;
export function interpolate<T extends Vec | SolidColor>(v1: T, v2: T, amount: number) {
    if (v1 instanceof SolidColor) {
        return new SolidColor(
            v1.r * (1 - amount) + (<SolidColor>v2).r * amount,
            v1.g * (1 - amount) + (<SolidColor>v2).g * amount,
            v1.b * (1 - amount) + (<SolidColor>v2).b * amount,
            v1.a * (1 - amount) + (<SolidColor>v2).a * amount)
    } else {
        return new Vec(v1.x * (1 - amount) + (<Vec>v2).x * amount, v1.y * (1 - amount) + (<Vec>v2).y * amount)
    }
}

export function matmul(m1: number[], m2: number[]) {
    return [
        m1[1] * m2[3] + m1[0] * m2[0],
        m1[1] * m2[4] + m1[0] * m2[1],
        m1[1] * m2[5] + m1[0] * m2[2] + m1[2],
        m1[4] * m2[3] + m1[3] * m2[0],
        m1[4] * m2[4] + m1[3] * m2[1],
        m1[4] * m2[5] + m1[3] * m2[2] + m1[5]
    ]
}

class RangeIterator {
    step: number
    start: number
    count: number
    cur: number
    constructor(start, count, step) {
        this.step = step
        this.start = start
        this.count = count
        this.cur = 0
    }

    next(): IteratorResult<number> {
        if (this.cur < this.count) {
            const result = { value: this.cur * this.step + this.start, done: false }
            this.cur += 1
            return result
        }
        return { value: null, done: true }
    }
}

class RangeIterable {
    start
    count
    step
    constructor(start, count, step) {
        this.start = start
        this.count = count
        this.step = step
    }

    [Symbol.iterator]() {
        return new RangeIterator(this.start, this.count, this.step)
    }

    map<T>(fn: (x: number) => T): T[] {
        let result: T[] = []
        for (const i of this) {
            result.push(fn(i))
        }
        return result
    }
}

class Range extends RangeIterable {
    end: number
    constructor(start, end?) {
        if (arguments.length == 1) {
            super(0, Math.floor(start), 1)
            this.end = start
        } else {
            super(start, Math.floor(end - start), 1)
            this.end = end
        }
    }

    spread(num_points, include_first?: boolean, include_last?: boolean) {
        if (arguments.length == 1) {
            include_first = true
        }
        if (arguments.length < 3) {
            include_last = true
        }
        let spacing
        let first
        if (include_first && include_last) {
            if (num_points == 1) {
                spacing = 0
                first = (this.start + this.end) / 2
            } else {
                spacing = (this.end - this.start) / (num_points - 1)
                first = this.start
            }
        } else if (include_first || include_last) {
            spacing = (this.end - this.start) / (num_points)
            if (include_first) {
                first = this.start
            } else {
                first = this.start + spacing
            }
        } else {
            spacing = (this.end - this.start) / num_points
            first = this.start + spacing / 2
        }
        return new RangeIterable(first, num_points, spacing)
    }
}

export function range(start: number, end?: number) {
    if (arguments.length == 1) {
        return new Range(start)
    }
    return new Range(start, end)
}
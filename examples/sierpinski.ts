import { Figure, polar, polygon, rgb, union, Vec } from "figure";

function triangle(a: Vec, b: Vec, c: Vec, depth: number) {
    if (depth == 0) {
        return polygon().points(a, b, c)
    } else {
        const ab = a.add(b).mul(0.5)
        const bc = b.add(c).mul(0.5)
        const ca = c.add(a).mul(0.5)
        const result = union()
        for (const [x, y, z] of [[a, ab, ca], [b, ab, bc], [c, bc, ca]]) {
            result.add(triangle(x, y, z, depth - 1))
        }
        return result
    }
}

const figure = new Figure().background(rgb(1, 1, 1))

figure.add(triangle(
    polar(0.7, 0),
    polar(0.7, 120),
    polar(0.7, 240),
    4
).rotate(-90).move(0, 0.2).fill(rgb(0, 0, 1)))

export { figure }
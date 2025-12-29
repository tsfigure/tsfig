import { Figure, polygon, rect, rgb, union, vec } from "figure"

function center(shape) {
    return shape.move_to(shape.bbox().center, vec(0, 0))
}

const t = 0.15
const leg = (start, end) => {
    const base = polygon()
        .point(0, 0)
        .point(t, t)
        .point(1 - t, t)
        .point(1, 0)
        .point(1 - t, -t)
        .point(t, -t)
        .fill(rgb(0, 0, 0))
    return base
        .transform_2to2(vec(-0.03, 0), vec(1.03, 0), start, end)
}

const digit = () => {
    return union()
        .add(leg(vec(0, 0), vec(1, 0)))
        .add(leg(vec(0, 0), vec(0, -1)))
        .add(leg(vec(1, 0), vec(1, -1)))
        .add(leg(vec(0, -1), vec(1, -1)))
        .add(leg(vec(0, -1), vec(0, -2)))
        .add(leg(vec(0, -2), vec(1, -2)))
        .add(leg(vec(1, -1), vec(1, -2)))
}

const pair = () => center(union(digit(), digit().move(1.45, 0)))

let figure = new Figure().background(rgb(1, 1, 1)).aspect_ratio(1.2)
figure.add(pair().move(-1.8, 0))
figure.add(pair().move(1.8, 0))

const dot = rect().width(0.3).height(0.3).fill(rgb(0, 0, 0))
figure.add(dot.move(0, 0.4))
figure.add(dot.move(0, -0.4))

figure = figure.scale(0.3)

export { figure }
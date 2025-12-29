import { disk, Figure, range, rgb, union } from "figure"

const slot = (x, y, occupied) => {
    let result = union()
        .add(disk().center(x, y).radius(0.37).border().inflate(0.05))
    if (occupied) {
        result.add(disk().center(x, y).radius(0.2))
    }
    return result.fill(rgb(0, 0, 0))
}

let figure = new Figure().background(rgb(1, 1, 1))
for (const x of range(-3, 4)) {
    for (const y of [-1, 0, 1]) {
        figure.add(slot(x, y, x != 0 || y != 0))
    }
}
for (const x of [-1, 0, 1]) {
    for (const y of [-2, -3, 2, 3]) {
        figure.add(slot(x, y, true))
    }
}

figure = figure.scale(1 / 6)

export { figure }
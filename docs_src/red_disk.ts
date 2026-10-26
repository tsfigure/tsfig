import { Figure, disk, rgb } from "figure"

const d = disk().radius(0.5).fill(rgb(1, 0, 0))

const figure = new Figure().background(rgb(1, 1, 1))

figure.add(d)

export { figure }
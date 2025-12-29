import { disk, Figure, polar, rgb } from "figure";

const spread = 0.7

let c1 = disk().radius(1).center(polar(spread, 0)).fill(rgb(1, 0, 0))
let c2 = disk().radius(1).center(polar(spread, 120)).fill(rgb(0, 1, 0))
let c3 = disk().radius(1).center(polar(spread, 240)).fill(rgb(0, 0, 1))

let figure = new Figure()
figure.add(c1)
figure.add(c2)
figure.add(c3)
figure.add(c1.clip(c2).fill(rgb(1, 1, 0)))
figure.add(c2.clip(c3).fill(rgb(0, 1, 1)))
figure.add(c3.clip(c1).fill(rgb(1, 0, 1)))
figure.add(c3.clip(c1).clip(c2).fill(rgb(1, 1, 1)))
figure = figure.scale(0.5)

export { figure }
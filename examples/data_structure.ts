import { arrow, disk, Figure, Group, group, linear, range, rect, rgb, text, vec } from "figure"

const TEXT_HEIGHT = 0.09

let cell_value = (value, center) =>
    text(`${value}`)
        .height(TEXT_HEIGHT)
        .center(center).move(0, 0.006)

let array = (values) => {
    let cells = values.map((value) =>
        group(
            cell_value(value, vec(0, 0)),
            rect().width(0.2).height(0.15).border().miter(0.01)
        ).fill(rgb(0, 0, 0))
    )
    return linear(cells).direction("right").gap(-0.01)
}

let figure = new Figure()

let vertical = linear().direction("down").gap(-0.01).left(-0.4)
for (const i of range(7)) {
    vertical.add(
        rect()
            .width(0.15)
            .height(0.15)
            .border()
            .miter(0.01))
}

vertical = vertical.fill(rgb(0, 0, 0))
figure.add(vertical)

let dot_arrow = (start, end) => group(
    arrow().start(start).end(end),
    disk().center(start).radius(0.02))
    .fill(rgb(0, 0, 0))

let arr1: Group = array([11, 12, 13])
arr1 = arr1.move_to(
    arr1.bbox().left_center,
    vertical.child(1).bbox().center.add(vec(0.35, 0)))
figure.add(arr1)
figure.add(
    dot_arrow(
        vertical.child(1).bbox().center,
        arr1.bbox().left_center)
)


let arr2: Group = array([41, 43, 45, 47])
arr2 = arr2.move_to(
    arr2.bbox().left_center,
    vertical.child(4).bbox().center.add(vec(0.35, 0)))
figure.add(arr2)
figure.add(
    dot_arrow(
        vertical.child(4).bbox().center,
        arr2.bbox().left_center)
)

figure.add(cell_value(23, vertical.child(2).bbox().center).fill(rgb(0, 0, 0)))
figure.add(cell_value(37, vertical.child(3).bbox().center).fill(rgb(0, 0, 0)))
figure.add(cell_value(62, vertical.child(6).bbox().center).fill(rgb(0, 0, 0)))
figure = figure.scale(1.2).move_to(figure.bbox().center, vec(0, 0))

export { figure }
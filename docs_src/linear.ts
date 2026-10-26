import { Figure, rgb, rect, text, group, linear, polygon, line, vec } from "figure"

const arrow = (start, end) => {
    const HEAD_SIZE = 0.05
    const head = () => polygon().point(0, HEAD_SIZE).point(0, -HEAD_SIZE).point(HEAD_SIZE * 2, 0)
    let body = line().start(start).end(end).width(0.015).trim(HEAD_SIZE * 2)
    const result = group()
    result.add(body)
    result.add(head().rotate(body.angle()).move_to(vec(0, 0), body.end()))
    result.add(head().rotate(body.angle() + 180).move_to(vec(0, 0), body.start()))
    result.add(text("g").height(0.24).center_x((start.x + end.x) / 2).top(0.03))
    return result
}

const obj = (name, w, color) => group(
    rect().width(w).height(1).border().miter(0.05),
    text(name).height(0.5)
).fill(color)

const figure = new Figure().background(rgb(1, 1, 1)).aspect_ratio(3.5)
const layout = linear(
    obj('a', 4, rgb(1, 0, 0)),
    obj('b', 1, rgb(0, 0.8, 0)),
    obj('c', 2, rgb(0, 0, 1))
).gap(0.7).direction('right').scale(0.7)
const layout_with_arrows = group(
    layout,
    arrow(vec(layout.child(0).bbox().right, 0), vec(layout.child(1).bbox().left)).fill(rgb(0, 0, 0)),
    arrow(vec(layout.child(1).bbox().right, 0), vec(layout.child(2).bbox().left)).fill(rgb(0, 0, 0))
)
figure.add(layout_with_arrows.move(0, 0.2))
const title = text("linear(a,b,c).gap(g)").height(0.25).center_x(0).top(-0.8).fill(rgb(0, 0, 0))
figure.add(title)
figure.add(
    line()
        .start(title.bbox().bottom_left)
        .end(title.bbox().bottom_right)
        .trim(-0.07)
        .width(0.02)
        .move(0, 0.05)
        .fill(rgb(0, 0, 0)))


export { figure }
import { Figure, rgb, rect, line, vec, polygon, group, text, disk, polar } from "figure"

const arrow = (start, end, extra_trim = 0) => {
    const HEAD_SIZE = 0.017
    const head = () => polygon().point(0, HEAD_SIZE).point(0, -HEAD_SIZE).point(HEAD_SIZE * 2, 0)
    let body = line().start(start).end(end).width(0.009).trim(HEAD_SIZE * 2 + extra_trim)
    const result = group()
    result.add(body)
    result.add(head().rotate(body.angle()).move_to(vec(0, 0), body.end()))
    result.add(head().rotate(body.angle() + 180).move_to(vec(0, 0), body.start()))
    return result
}

let figure = new Figure().background(rgb(1, 1, 1)).aspect_ratio(1.3)

const frame = rect().height(1).width(1.4).border().miter(0.01).fill(rgb(0, 0, 0))
figure.add(frame)

const my_text = (s) => text(s).height(0.07)
figure.add(arrow(vec(frame.left(), 0.6), vec(frame.right(), 0.6)).fill(rgb(0, 0, 0)))
figure.add(my_text("X").center_x(0).top(0.68).fill(rgb(0, 0, 0)))
figure.add(my_text("-1.4").top(0.68).center_x(frame.left()).fill(rgb(0, 0, 0)))
figure.add(my_text("1.4").top(0.68).center_x(frame.right()).fill(rgb(0, 0, 0)))

figure.add(arrow(vec(-0.8, frame.bottom()), vec(-0.8, frame.top())).fill(rgb(0, 0, 0)))
figure.add(my_text("Y").center_y(0).right(-0.87).fill(rgb(0, 0, 0)))
figure.add(my_text("-1").center_y(frame.top()).right(-0.87).fill(rgb(0, 0, 0)))
figure.add(my_text("1").center_y(frame.bottom()).right(-0.87).fill(rgb(0, 0, 0)))

const point_size = 0.015
const polar_point1 = polar(1, -40).mul(0.5)
const polar_point2 = polar(0.7, 90).mul(0.5)
figure.add(disk().radius(point_size).fill(rgb(0, 0, 0)))
figure.add(disk().radius(point_size).center(polar_point1).fill(rgb(0, 0, 1)))
figure.add(disk().radius(point_size).center(polar_point2).fill(rgb(0, 0, 1)))
figure.add(my_text("(0,0)").right(-0.02).bottom(-0.02).fill(rgb(0, 0, 0)))
figure.add(my_text("polar(1,-40)").right(polar_point1.x - 0.02).bottom(polar_point1.y - 0.02).fill(rgb(0, 0, 0)))
figure.add(my_text("polar(0.7,90)").right(polar_point2.x - 0.02).top(polar_point2.y + 0.02).fill(rgb(0, 0, 0)))
figure.add(arrow(vec(0, 0), polar_point1, point_size + 0.01).fill(rgb(0, 0, 0)))
figure.add(arrow(vec(0, 0), polar_point2, point_size + 0.01).fill(rgb(0, 0, 0)))
figure.add(my_text("1")
    .left(polar_point1.mul(0.5).x + 0.02)
    .top(polar_point1.mul(0.5).y + 0.02)
    .fill(rgb(0, 0, 0))
)
figure.add(my_text("0.7")
    .right(polar_point2.mul(0.5).x - 0.02)
    .center_y(polar_point2.mul(0.5).y + 0.02)
    .fill(rgb(0, 0, 0))
)

figure = figure.scale(1.3).move(0.1, -0.1)

export { figure }
import { disk, Figure, group, line, linear, rgb, text, vec } from "figure"

let make_node = (props: { name: string, children?: any[] }) => {
    let name = props.name
    let children = props?.children ?? []

    let result = group()

    // root at (0,0)
    let head = group(
        disk().radius(0.1).fill(rgb(0.7, 0.7, 1)),
        text(name).height(0.1).fill(rgb(0, 0, 0))
    )
    if (children.length == 0) {
        result.add_named(head, "head")
        return result
    }

    // layout children
    children = children.map(make_node)
    let child_shape = linear(children)
        .direction("right")
        .justify("top")
        .gap(0.1)

    // position children below root
    let child_shape_moved = child_shape
        .move_to(child_shape.bbox().top_center, vec(0, 0.25))

    // lines root -> child roots
    for (const ch of child_shape_moved.children()) {
        result.add(line()
            .start(0, 0)
            .end(ch.child("head").bbox().center)
            .width(0.01)
            .trim(0.13)
            .fill(rgb(0, 0, 0)))
    }

    result.add_named(head, "head")
    result.add(child_shape_moved)
    return result
}

let figure = new Figure().background(rgb(1, 1, 1))
let tree = make_node(
    {
        name: "t",
        children: [
            {
                name: "e",
                children: [
                    { name: "a" },
                    { name: "n" },
                    { name: "x", children: [{ name: "t" }] }
                ]
            },
            {
                name: "i",
                children: [
                    {
                        name: "m",
                        children: [
                            {
                                name: "e",
                                children: [{ name: "s" }]
                            }
                        ]
                    }
                ]
            },
            { name: "o" }
        ]
    }
)
// add it centered
figure.add(tree.move_to(tree.bbox().center, vec(0, 0)))

export { figure }
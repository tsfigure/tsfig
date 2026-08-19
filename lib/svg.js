import { Union, Group } from "./containers.js";
import { rgb, SolidColor } from "./fill.js";
import { InflatedPath, MiteredPath, PathArcCommand, PathBezierCommand, PathLineCommand } from "./path.js";
import { Clipped, Disk, DiskBorder, Line, LinearTransform, Polygon, Rect, RectBorder, RoundRect } from "./shapes.js";
import { Text } from "./text.js";
import { assert, range } from "./util.js";
class Element {
    tag;
    attributes;
    children;
    constructor(tag, attributes_obj, children) {
        this.tag = tag;
        this.attributes = new Map(Object.entries(attributes_obj));
        if (arguments.length == 3) {
            this.children = children;
        }
        else {
            this.children = [];
        }
    }
    text() {
        const attribute_strings = Array.from(this.attributes.entries().map(entry => `${entry[0]}="${entry[1]}"`));
        const open = `<${this.tag} ${attribute_strings.join(" ")}>`;
        const close = `</${this.tag}>`;
        return open + this.children.map((e) => e.text()).join("") + close;
    }
}
class TextNode {
    content;
    constructor(content) {
        this.content = content;
    }
    text() {
        return this.content.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    }
}
class SvgMaker {
    global_id = 0;
    font_required = null;
    svg_for_shape(shape, aa_filter) {
        shape.ensure_defined();
        if (shape instanceof Rect) {
            const element = new Element("rect", {
                x: "" + shape.left(),
                y: "" + shape.top(),
                width: "" + shape.width(),
                height: "" + shape.height(),
                fill: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter,
            });
            return [element];
        }
        if (shape instanceof RectBorder) {
            const thickness = shape.thickness;
            const element = new Element("rect", {
                x: "" + (shape.left() + thickness / 2),
                y: "" + (shape.top() + thickness / 2),
                width: "" + (shape.width() - thickness),
                height: "" + (shape.height() - thickness),
                fill: "none",
                stroke: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter,
                "stroke-width": "" + thickness,
            });
            return [element];
        }
        if (shape instanceof LinearTransform) {
            const child_elements = this.svg_for_shape(shape.child, '');
            const result = child_elements.map(e => {
                const transformed = new Element("g", { transform: svg_transform(shape.matrix) }, [e]);
                return new Element("g", { filter: aa_filter }, [transformed]);
            });
            return result;
        }
        if (shape instanceof Union) {
            const children = [];
            for (const child of shape.children()) {
                children.push(...this.svg_for_shape(child, aa_filter));
            }
            const element = new Element("g", { fill: svg_fill(shape) }, children);
            return [element];
        }
        if (shape instanceof Group) {
            let result = [];
            for (const child of shape.children()) {
                result.push(...this.svg_for_shape(child, aa_filter));
            }
            return result;
        }
        if (shape instanceof Disk) {
            const element = new Element("circle", {
                cx: shape.center().x,
                cy: shape.center().y,
                r: shape.radius(),
                fill: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter,
            });
            return [element];
        }
        if (shape instanceof DiskBorder) {
            const element = new Element("circle", {
                cx: shape.center().x,
                cy: shape.center().y,
                r: "" + shape.disk_radius,
                fill: "none",
                stroke: svg_fill(shape),
                opacity: svg_opacity(shape),
                "stroke-width": "" + shape.thickness,
            });
            return [element];
        }
        if (shape instanceof Polygon) {
            const element = new Element("polygon", {
                points: shape.points().map((pt) => `${pt.x},${pt.y}`).join(" "),
                fill: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter,
            });
            return [element];
        }
        if (shape instanceof Line) {
            const points = Line._get_points(shape.start(), shape.end(), shape.width());
            const element = new Element("polygon", {
                points: points.map((pt) => `${pt.x},${pt.y}`).join(" "),
                fill: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter,
            });
            return [element];
        }
        if (shape instanceof RoundRect) {
            const element = new Element("rect", {
                x: "" + shape.left(),
                y: "" + shape.top(),
                rx: "" + shape.radius,
                ry: "" + shape.radius,
                width: "" + shape.width(),
                height: "" + shape.height(),
                fill: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter,
            });
            return [element];
        }
        if (shape instanceof Clipped) {
            const mask_id = `p${this.global_id}`;
            this.global_id += 1;
            const mask = new Element("mask", { id: mask_id, type: "alpha" }, this.svg_for_shape(shape.clipper.fill(rgb(1, 1, 1)), aa_filter));
            let child_shape = shape.child;
            if (shape.properties.has("fill")) {
                child_shape = shape.child.fill(shape.properties.get("fill"));
            }
            const child = new Element("g", { mask: `url(#${mask_id})` }, this.svg_for_shape(child_shape, aa_filter));
            return [mask, child];
        }
        if (shape instanceof MiteredPath || shape instanceof InflatedPath) {
            const attributes = {
                d: svg_path_d(shape.start_pos, shape.commands),
                fill: "none",
                stroke: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter,
            };
            if (shape instanceof MiteredPath) {
                attributes["stroke-width"] = "" + shape.miter_size * 2;
                attributes["stroke-linejoin"] = "miter";
            }
            else {
                attributes["stroke-width"] = "" + shape.amount * 2;
                attributes["stroke-linejoin"] = "round";
                attributes["stroke-linecap"] = "round";
            }
            const element = new Element("path", attributes);
            return [element];
        }
        if (shape instanceof Text) {
            this.font_required = shape.font;
            const sanitized_text = shape.font.sanitize(shape.text());
            const element = new Element("text", {
                x: "" + shape.left(),
                y: "" + (shape.bottom() - shape.height() * shape.font.baseline_relative_height()),
                "font-size": "" + shape.height(),
                "font-family": "font1",
                fill: svg_fill(shape),
                opacity: svg_opacity(shape),
                filter: aa_filter
            }, [new TextNode(sanitized_text)]);
            return [element];
        }
    }
    font_embedding() {
        if (this.font_required === null) {
            return [];
        }
        const font_bytes = this.font_required.bytes;
        let font_byte_strings = [];
        for (const byte of font_bytes) {
            font_byte_strings.push(String.fromCharCode(byte));
        }
        const font_string = font_byte_strings.join('');
        const style = `
        @font-face {
            font-family: "font1";
            src: url("data:font/ttf;charset=utf-8;base64,${btoa(font_string)}");
        }`;
        return [new Element("style", {}, [new TextNode(style)])];
    }
}
function svg_fill(shape) {
    if (!shape.properties.has("fill")) {
        return "";
    }
    const fill = shape.properties.get("fill");
    if (fill instanceof SolidColor) {
        return `rgb(${fill.r * 255} ${fill.g * 255} ${fill.b * 255})`;
    }
}
function svg_opacity(shape) {
    if (!shape.properties.has("fill")) {
        return "1";
    }
    const fill = shape.properties.get("fill");
    if (fill instanceof SolidColor) {
        return "" + fill.a;
    }
}
function svg_transform(matrix) {
    return `matrix(${matrix[0]} ${matrix[3]} ${matrix[1]} ${matrix[4]} ${matrix[2]} ${matrix[5]})`;
}
function svg_path_d(start_pos, commands) {
    let result = `M ${start_pos.x} ${start_pos.y}`;
    for (const cmd of commands) {
        if (cmd instanceof PathLineCommand) {
            result += ` l ${cmd.delta.x} ${cmd.delta.y}`;
        }
        if (cmd instanceof PathArcCommand) {
            result += ` a ${cmd.radius} ${cmd.radius} 0 ${cmd.large_arc ? 1 : 0} ${cmd.clockwise ? 1 : 0} ${cmd.delta.x} ${cmd.delta.y}`;
        }
        if (cmd instanceof PathBezierCommand) {
            assert(cmd.deltas.length == 2);
            result += ` q ${cmd.deltas[0].x} ${cmd.deltas[0].y} ${cmd.deltas[1].x} ${cmd.deltas[1].y}`;
        }
    }
    return result;
}
const NUM_AA_LEVELS = 10;
function create_aa_filters() {
    const result = [];
    for (const i of range(1, NUM_AA_LEVELS)) {
        const table_values = [];
        for (const j of range(NUM_AA_LEVELS)) {
            if (j < NUM_AA_LEVELS - i) {
                table_values.push("0");
            }
            else {
                table_values.push("1");
            }
        }
        result.push(new Element("filter", {
            id: `aa-fix-layer${i}`,
            filterUnits: "userSpaceOnUse",
            x: "-1",
            y: "-1",
            width: "2",
            height: "2"
        }, [new Element("feComponentTransfer", {}, [
                new Element("feFuncA", {
                    type: "discrete",
                    tableValues: table_values.join(" ")
                })
            ])]));
    }
    return result;
}
function background_element(figure, filter) {
    const min_x = -figure.aspect_ratio();
    const max_x = figure.aspect_ratio();
    return new Element("rect", {
        x: "" + min_x,
        y: "-1",
        width: "" + (max_x - min_x),
        height: "2",
        fill: `rgb(${figure.background().r * 255} ${figure.background().g * 255} ${figure.background().b * 255})`,
        opacity: "" + figure.background().a,
        filter: filter
    });
}
export function svg_tree(figure, do_aa_fix) {
    const min_x = -figure.aspect_ratio();
    const max_x = figure.aspect_ratio();
    const children = [];
    const svg_maker = new SvgMaker();
    if (do_aa_fix) {
        children.push(...create_aa_filters());
        for (const i of range(1, NUM_AA_LEVELS)) {
            const shape_elements = [background_element(figure, `url(#aa-fix-layer${i})`)];
            shape_elements.push(...svg_maker.svg_for_shape(figure, `url(#aa-fix-layer${i})`));
            children.push(new Element("g", { opacity: "" + 1 / i }, shape_elements));
        }
    }
    else {
        children.push(background_element(figure, ""));
        children.push(...svg_maker.svg_for_shape(figure, ""));
    }
    const font_embedding_elements = svg_maker.font_embedding();
    children.splice(0, 0, ...font_embedding_elements);
    return new Element("svg", {
        viewBox: `${min_x} -1 ${max_x - min_x} 2`,
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg"
    }, children);
}

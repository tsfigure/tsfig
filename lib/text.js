import { EqSys } from "./constraints.js";
import { get_builtin_font } from "./font.js";
import { _default_clip, _default_move, _default_move_to, _default_rotate, _default_scale, _default_transform, _default_transform_2to2, getter, setter, Shape } from "./shapes.js";
import { Box, Vec, vec } from "./util.js";
export class Text extends Shape {
    left = setter(this, "left");
    top = setter(this, "top");
    right = setter(this, "right");
    bottom = setter(this, "bottom");
    height = setter(this, "height");
    width = setter(this, "width");
    center = setter(this, "center", vec);
    center_x = setter(this, "center_x");
    center_y = setter(this, "center_y");
    bbox = getter(this, "bbox");
    text = setter(this, "text");
    font;
    compute_properties() {
        this.font = get_builtin_font();
        const aspect_ratio = this.font.text_aspect_ratio(this.properties.get("text"));
        if (this.properties.has("width") && this.properties.has("height")) {
            throw new Error("Cannot specify both width and height for text");
        }
        if (!this.properties.has("width") && !this.properties.has("height")) {
            throw new Error("Must specify either width or height for text");
        }
        if (this.properties.has("width")) {
            this.properties.set("height", this.properties.get("width") / aspect_ratio);
        }
        else {
            this.properties.set("width", this.properties.get("height") * aspect_ratio);
        }
        const x_sys = new EqSys();
        const y_sys = new EqSys();
        if (this.properties.has("center")) {
            x_sys.add("center", 0.5, 0.5, this.properties.get("center").x);
            y_sys.add("center", 0.5, 0.5, this.properties.get("center").y);
        }
        x_sys.add_if_exists("width", -1, 1, this.properties);
        x_sys.add_if_exists("left", 1, 0, this.properties);
        x_sys.add_if_exists("right", 0, 1, this.properties);
        x_sys.add_if_exists("center_x", 0.5, 0.5, this.properties);
        x_sys.add_if_underconstrained(0.5, 0.5, 0);
        y_sys.add_if_exists("height", -1, 1, this.properties);
        y_sys.add_if_exists("top", 1, 0, this.properties);
        y_sys.add_if_exists("bottom", 0, 1, this.properties);
        y_sys.add_if_exists("center_y", 0.5, 0.5, this.properties);
        y_sys.add_if_underconstrained(0.5, 0.5, 0);
        const [left, right] = x_sys.solve();
        const [top, bottom] = y_sys.solve();
        this.properties.set("left", left);
        this.properties.set("top", top);
        this.properties.set("right", right);
        this.properties.set("bottom", bottom);
        this.properties.set("bbox", new Box(left, top, right, bottom));
        this.properties.set("center", new Vec((left + right) / 2, (top + bottom) / 2));
    }
    is_axis_aligned_box() {
        return true;
    }
    copy() {
        this.ensure_defined();
        let result = new Text(this.properties);
        result.font = this.font;
        return result;
    }
    clip = _default_clip;
    move = _default_move;
    move_to = _default_move_to;
    rotate = _default_rotate;
    scale = _default_scale;
    transform = _default_transform;
    transform_2to2 = _default_transform_2to2;
}
export function text(content) {
    return new Text().text(content);
}

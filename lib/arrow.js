import { line, polygon, setter } from "./basic_shapes.js";
import { Union } from "./containers.js";
import { vec } from "./util.js";
export class Arrow extends Union {
    start = setter(this, "start", vec);
    end = setter(this, "end", vec);
    head_len = setter(this, "head_len");
    compute_properties() {
        if (!this.properties.has("head_len")) {
            this.properties.set("head_len", 0.05);
        }
        let head_len = this.properties.get("head_len");
        let head = polygon().points(vec(0, head_len / 2), vec(head_len, 0), vec(0, -head_len / 2));
        let start = this.properties.get("start");
        let end = this.properties.get("end");
        let body = line()
            .start(start)
            .end(end)
            .width(0.01)
            .trim(0, head_len);
        this.add(body);
        this.add(head.rotate(body.angle()).move(body.end()));
        super.compute_properties();
    }
}
export function arrow() {
    return new Arrow();
}

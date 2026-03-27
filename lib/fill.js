export class SolidColor {
    r;
    g;
    b;
    a;
    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
}
export function rgb(r, g, b) {
    return new SolidColor(r, g, b, 1);
}
export function rgba(r, g, b, a) {
    return new SolidColor(r, g, b, a);
}

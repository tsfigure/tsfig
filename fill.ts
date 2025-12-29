export class SolidColor {
    r: number
    g: number
    b: number
    a: number
    constructor(r: number, g: number, b: number, a: number) {
        this.r = r
        this.g = g
        this.b = b
        this.a = a
    }
}

export function rgb(r: number, g: number, b: number) {
    return new SolidColor(r, g, b, 1)
}

export function rgba(r: number, g: number, b: number, a: number) {
    return new SolidColor(r, g, b, a)
}
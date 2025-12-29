import { CommandlineParser } from "./commandline.ts"
import { svg_tree } from "./svg.ts"

const parser = new CommandlineParser([
    { flag: "out", has_arg: true, doc: "Output file path (default: <input>.svg)" },
    { flag: "no-aa-fix", has_arg: false, doc: "Don't add fix for anti-aliasing artifacts (reduces file size)" }
])
const args = parser.parse(Deno.args)

let path = args.arguments[0]
if (!path.startsWith("/")) {
    path = "./" + path
}

const module = await import(path)
const svg = svg_tree(module.figure, !args["no-aa-fix"])

let out_path
if (Object.hasOwn(args, "out")) {
    out_path = args.out
} else {
    out_path = path + ".svg"
}

Deno.writeFile(out_path, new TextEncoder().encode(svg.text()))

// Make typescript consider this file a module
export { }
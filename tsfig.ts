import { CommandlineParser } from "./commandline.ts"
import { svg_tree } from "./svg.ts"

// '\x1B[2J\x1B[H'
const ANSI_CLEAR_SCREEN = new Uint8Array([27, 91, 50, 74, 27, 91, 72])

async function main() {
    const parser = new CommandlineParser([
        { flag: "out", has_arg: true, doc: "Output file path (default: <input>.svg)" },
        { flag: "no-aa-fix", has_arg: false, doc: "Don't add fix for anti-aliasing artifacts (reduces file size)" },
        { flag: "watch", has_arg: false, doc: "Watch for changes in the input file" }
    ])
    const args = parser.parse(Deno.args)
    if (args.arguments.length == 0) {
        parser.print_usage_and_exit()
    }

    let path = args.arguments[0]
    if (!path.startsWith("/")) {
        path = "./" + path
    }

    if (!args["watch"]) {
        await process_path(path, args)
    } else {
        const watcher = Deno.watchFs(path)
        const event_iterator = watcher[Symbol.asyncIterator]()

        while (true) {
            Deno.stdout.writeSync(ANSI_CLEAR_SCREEN)
            console.log(`Watching ${path}`)
            await process_path(path, args)

            let event = { kind: "none" }
            while (event.kind != "modify") {
                event = (await event_iterator.next()).value
            }
        }
    }
}

async function process_path(path: string, args) {
    let module
    try {
        module = await import(path + `?t=${Date.now()}`)
    } catch (e) {
        console.log(e)
        return
    }
    const svg = svg_tree(module.figure, !args["no-aa-fix"])

    let out_path
    if (Object.hasOwn(args, "out")) {
        out_path = args.out
    } else {
        out_path = path + ".svg"
    }

    Deno.writeFileSync(out_path, new TextEncoder().encode(svg.text()))
}

await main()

// Make typescript consider this file a module
export { }
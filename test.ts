function test_example(example_file) {
    const command = new Deno.Command("deno",
        { args: ["--allow-read", "--allow-write", "tsfig.ts", `examples/${example_file}`] })
    command.outputSync()

    let file_info: Deno.FileInfo
    try {
        file_info = Deno.statSync(`examples/${example_file}.svg`)
    } catch (e) {
        if (e.code == "ENOENT") {
            console.log(`Output file examples/${example_file}.svg missing`)
            return false
        }
        throw e
    }

    if (file_info.size == 0) {
        console.log(`Output file examples/${example_file}.svg is empty`)
        return false
    }

    return true
}

function test() {
    for (const example of EXAMPLES) {
        console.log(`Testing ${example}`)
        const ok = test_example(example)
        if (!ok) {
            return false
        }
    }
    return true
}

const EXAMPLES = [
    "peg_solitaire.ts",
    "seven_segment.ts",
    "sierpinski.ts",
    "venn.ts"
]

const ok = test()
if (ok) {
    console.log("OK!")
} else {
    console.log("Error!")
}
type Flag = { flag: string, has_arg: boolean, doc: string }

class CommandlineParser {
    flags: Map<string, Flag>

    constructor(flags: Flag[]) {
        this.flags = new Map(flags.map(flag => [flag.flag, flag]))
    }

    parse(args: string[]): any {
        const result: any = { arguments: [] };
        for (const flag of this.flags.values()) {
            if (!flag.has_arg) {
                result[flag.flag] = false
            }
        }

        let cur_flag: Flag | undefined = undefined;
        for (const arg of args) {
            if (arg.startsWith('--')) {
                if (cur_flag?.has_arg) {
                    throw new Error(`Missing value for flag: --${cur_flag.flag}`);
                }
                const flag_name = arg.slice(2);
                if (flag_name == "help") {
                    this.print_usage_and_exit()
                }
                cur_flag = this.flags.get(flag_name);
                if (cur_flag === undefined) {
                    throw new Error(`Unknown flag: --${flag_name}`);
                }
                if (!cur_flag.has_arg) {
                    result[cur_flag.flag] = true
                }
            } else if (cur_flag?.has_arg) {
                result[cur_flag.flag] = arg;
                cur_flag = undefined;
            } else {
                result.arguments.push(arg)
            }
        }

        if (cur_flag?.has_arg) {
            throw new Error(`Missing value for flag: --${cur_flag.flag}`);
        }

        return result;
    }

    print_usage_and_exit() {
        console.log("Usage: tsfig [OPTIONS] FILE")
        console.log("")
        console.log("Options:")

        const flag_names = Array.from(this.flags.keys()).sort()
        for (const flag_name of flag_names) {
            const flag = this.flags.get(flag_name)
            console.log(`    --${flag.flag.padEnd(20)} ${flag.doc}`)
        }
        Deno.exit(0)
    }
}

export { CommandlineParser };
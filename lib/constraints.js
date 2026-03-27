import { assert } from "./util.js";
export class OverconstrainedError extends Error {
    conflicting_eqs_names;
    constructor(conflicting_eqs_names) {
        super();
        this.conflicting_eqs_names = conflicting_eqs_names;
        this.name = "Overconstrained";
    }
}
export class UnderconstrainedError extends Error {
}
export class EqSys {
    equations;
    constructor() {
        this.equations = new Map();
    }
    add(name, a_coeff, b_coeff, result) {
        assert(!this.equations.has(name));
        if (this.equations.size == 2) {
            const existing = Array.from(this.equations.keys());
            throw new OverconstrainedError([...existing, name]);
        }
        this.equations.set(name, [a_coeff, b_coeff, result]);
    }
    add_if_exists(name, a_coeff, b_coeff, properties) {
        if (properties.has(name)) {
            this.add(name, a_coeff, b_coeff, properties.get(name));
        }
    }
    add_if_underconstrained(a_coeff, b_coeff, result) {
        if (this.equations.size >= 2) {
            return;
        }
        if (this.equations.size == 1) {
            const [eq] = Array.from(this.equations.values());
            const det = a_coeff * eq[1] - b_coeff * eq[0];
            if (Math.abs(det) < 0.001) {
                return; // Equation identical to existing one
            }
        }
        this.add(`[internal${this.equations.size}]`, a_coeff, b_coeff, result);
    }
    solve() {
        if (this.equations.size < 2) {
            throw new UnderconstrainedError();
        }
        const [eq1, eq2] = Array.from(this.equations.values());
        const det = eq1[0] * eq2[1] - eq1[1] * eq2[0];
        assert(Math.abs(det) > 0.001);
        const x1 = (eq2[1] * eq1[2] - eq1[1] * eq2[2]) / det;
        const x2 = (-eq2[0] * eq1[2] + eq1[0] * eq2[2]) / det;
        return [x1, x2];
    }
}

/**
 * Formula engine for database FORMULA property type.
 *
 * Supports:
 *  - prop("PropertyName") → reference another property's value
 *  - Math: + - * / %
 *  - Comparisons: == != > < >= <=
 *  - Logic: and or not if(cond, then, else)
 *  - Functions: concat, length, round, floor, ceil, abs, min, max,
 *    empty, now, toNumber, toString, upper, lower, slice
 *  - String literals: "hello"
 *  - Number literals: 42, 3.14
 *  - Boolean literals: true, false
 *
 * Usage:
 *   const ast = parseFormula('if(prop("Price") > 100, "expensive", "cheap")');
 *   const result = evaluateFormula(ast, rowValues, properties);
 */

// ─── Token types ────────────────────────────────────────

type TokenType =
    | "NUMBER"
    | "STRING"
    | "IDENT"
    | "LPAREN"
    | "RPAREN"
    | "COMMA"
    | "PLUS"
    | "MINUS"
    | "STAR"
    | "SLASH"
    | "PERCENT"
    | "EQ"
    | "NEQ"
    | "GT"
    | "GTE"
    | "LT"
    | "LTE"
    | "AND"
    | "OR"
    | "NOT"
    | "TRUE"
    | "FALSE"
    | "EOF";

interface Token {
    type: TokenType;
    value: string | number | boolean;
    pos: number;
}

// ─── Tokenizer ──────────────────────────────────────────

function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = input.length;

    while (i < len) {
        const ch = input[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (ch === "(") {
            tokens.push({ type: "LPAREN", value: "(", pos: i++ });
        } else if (ch === ")") {
            tokens.push({ type: "RPAREN", value: ")", pos: i++ });
        } else if (ch === ",") {
            tokens.push({ type: "COMMA", value: ",", pos: i++ });
        } else if (ch === "+") {
            tokens.push({ type: "PLUS", value: "+", pos: i++ });
        } else if (ch === "-") {
            tokens.push({ type: "MINUS", value: "-", pos: i++ });
        } else if (ch === "*") {
            tokens.push({ type: "STAR", value: "*", pos: i++ });
        } else if (ch === "/") {
            tokens.push({ type: "SLASH", value: "/", pos: i++ });
        } else if (ch === "%") {
            tokens.push({ type: "PERCENT", value: "%", pos: i++ });
        } else if (ch === "=" && input[i + 1] === "=") {
            tokens.push({ type: "EQ", value: "==", pos: i });
            i += 2;
        } else if (ch === "!" && input[i + 1] === "=") {
            tokens.push({ type: "NEQ", value: "!=", pos: i });
            i += 2;
        } else if (ch === ">" && input[i + 1] === "=") {
            tokens.push({ type: "GTE", value: ">=", pos: i });
            i += 2;
        } else if (ch === "<" && input[i + 1] === "=") {
            tokens.push({ type: "LTE", value: "<=", pos: i });
            i += 2;
        } else if (ch === ">") {
            tokens.push({ type: "GT", value: ">", pos: i++ });
        } else if (ch === "<") {
            tokens.push({ type: "LT", value: "<", pos: i++ });
        } else if (ch === '"' || ch === "'") {
            const quote = ch;
            let str = "";
            i++;
            while (i < len && input[i] !== quote) {
                if (input[i] === "\\" && i + 1 < len) {
                    i++;
                    str += input[i];
                } else {
                    str += input[i];
                }
                i++;
            }
            i++; // skip closing quote
            tokens.push({ type: "STRING", value: str, pos: i });
        } else if (/[0-9]/.test(ch) || (ch === "." && i + 1 < len && /[0-9]/.test(input[i + 1]))) {
            let num = "";
            while (i < len && (/[0-9]/.test(input[i]) || input[i] === ".")) {
                num += input[i++];
            }
            tokens.push({ type: "NUMBER", value: parseFloat(num), pos: i });
        } else if (/[a-zA-Z_]/.test(ch)) {
            let id = "";
            while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
                id += input[i++];
            }
            const lower = id.toLowerCase();
            if (lower === "true") tokens.push({ type: "TRUE", value: true, pos: i });
            else if (lower === "false")
                tokens.push({ type: "FALSE", value: false, pos: i });
            else if (lower === "and") tokens.push({ type: "AND", value: "and", pos: i });
            else if (lower === "or") tokens.push({ type: "OR", value: "or", pos: i });
            else if (lower === "not") tokens.push({ type: "NOT", value: "not", pos: i });
            else tokens.push({ type: "IDENT", value: id, pos: i });
        } else {
            throw new Error(`Unexpected character '${ch}' at position ${i}`);
        }
    }

    tokens.push({ type: "EOF", value: "", pos: i });
    return tokens;
}

// ─── AST ────────────────────────────────────────────────

type ASTNode =
    | { kind: "number"; value: number }
    | { kind: "string"; value: string }
    | { kind: "boolean"; value: boolean }
    | { kind: "binary"; op: string; left: ASTNode; right: ASTNode }
    | { kind: "unary"; op: string; operand: ASTNode }
    | { kind: "call"; name: string; args: ASTNode[] };

// ─── Parser (recursive descent) ─────────────────────────

class Parser {
    private tokens: Token[];
    private pos = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private expect(type: TokenType): Token {
        const tok = this.advance();
        if (tok.type !== type) {
            throw new Error(`Expected ${type}, got ${tok.type} at position ${tok.pos}`);
        }
        return tok;
    }

    parse(): ASTNode {
        const node = this.parseOr();
        if (this.peek().type !== "EOF") {
            throw new Error(`Unexpected token '${this.peek().value}' at position ${this.peek().pos}`);
        }
        return node;
    }

    private parseOr(): ASTNode {
        let left = this.parseAnd();
        while (this.peek().type === "OR") {
            this.advance();
            const right = this.parseAnd();
            left = { kind: "binary", op: "or", left, right };
        }
        return left;
    }

    private parseAnd(): ASTNode {
        let left = this.parseEquality();
        while (this.peek().type === "AND") {
            this.advance();
            const right = this.parseEquality();
            left = { kind: "binary", op: "and", left, right };
        }
        return left;
    }

    private parseEquality(): ASTNode {
        let left = this.parseComparison();
        while (this.peek().type === "EQ" || this.peek().type === "NEQ") {
            const op = this.advance().value as string;
            const right = this.parseComparison();
            left = { kind: "binary", op, left, right };
        }
        return left;
    }

    private parseComparison(): ASTNode {
        let left = this.parseAddSub();
        while (
            this.peek().type === "GT" ||
            this.peek().type === "GTE" ||
            this.peek().type === "LT" ||
            this.peek().type === "LTE"
        ) {
            const op = this.advance().value as string;
            const right = this.parseAddSub();
            left = { kind: "binary", op, left, right };
        }
        return left;
    }

    private parseAddSub(): ASTNode {
        let left = this.parseMulDiv();
        while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
            const op = this.advance().value as string;
            const right = this.parseMulDiv();
            left = { kind: "binary", op, left, right };
        }
        return left;
    }

    private parseMulDiv(): ASTNode {
        let left = this.parseUnary();
        while (
            this.peek().type === "STAR" ||
            this.peek().type === "SLASH" ||
            this.peek().type === "PERCENT"
        ) {
            const op = this.advance().value as string;
            const right = this.parseUnary();
            left = { kind: "binary", op, left, right };
        }
        return left;
    }

    private parseUnary(): ASTNode {
        if (this.peek().type === "NOT") {
            this.advance();
            return { kind: "unary", op: "not", operand: this.parseUnary() };
        }
        if (this.peek().type === "MINUS") {
            this.advance();
            return { kind: "unary", op: "-", operand: this.parseUnary() };
        }
        return this.parsePrimary();
    }

    private parsePrimary(): ASTNode {
        const tok = this.peek();

        if (tok.type === "NUMBER") {
            this.advance();
            return { kind: "number", value: tok.value as number };
        }
        if (tok.type === "STRING") {
            this.advance();
            return { kind: "string", value: tok.value as string };
        }
        if (tok.type === "TRUE") {
            this.advance();
            return { kind: "boolean", value: true };
        }
        if (tok.type === "FALSE") {
            this.advance();
            return { kind: "boolean", value: false };
        }
        if (tok.type === "IDENT") {
            const name = tok.value as string;
            this.advance();
            if (this.peek().type === "LPAREN") {
                // Function call
                this.advance(); // skip (
                const args: ASTNode[] = [];
                if (this.peek().type !== "RPAREN") {
                    args.push(this.parseOr());
                    while (this.peek().type === "COMMA") {
                        this.advance();
                        args.push(this.parseOr());
                    }
                }
                this.expect("RPAREN");
                return { kind: "call", name: name.toLowerCase(), args };
            }
            // Bare identifier — treat as a zero-arg function call (e.g. `now`)
            return { kind: "call", name: name.toLowerCase(), args: [] };
        }
        if (tok.type === "LPAREN") {
            this.advance();
            const inner = this.parseOr();
            this.expect("RPAREN");
            return inner;
        }
        throw new Error(`Unexpected token '${tok.value}' at position ${tok.pos}`);
    }
}

// ─── Public parse ───────────────────────────────────────

export function parseFormula(expression: string): ASTNode {
    const tokens = tokenize(expression);
    return new Parser(tokens).parse();
}

// ─── Evaluator ──────────────────────────────────────────

type Value = string | number | boolean | null | Date;

interface EvalContext {
    /** Map from property name → row value (already resolved from DatabaseValue). */
    props: Record<string, unknown>;
}

function toNumber(v: unknown): number {
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "string") {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }
    return 0;
}

function toString(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString();
    return String(v);
}

function toBool(v: unknown): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return v.length > 0;
    return v !== null && v !== undefined;
}

function evaluate(node: ASTNode, ctx: EvalContext): Value {
    switch (node.kind) {
        case "number":
            return node.value;
        case "string":
            return node.value;
        case "boolean":
            return node.value;

        case "unary": {
            const operand = evaluate(node.operand, ctx);
            if (node.op === "not") return !toBool(operand);
            if (node.op === "-") return -toNumber(operand);
            return null;
        }

        case "binary": {
            const left = evaluate(node.left, ctx);
            const right = evaluate(node.right, ctx);

            switch (node.op) {
                case "+": {
                    // String concatenation if either side is a string
                    if (typeof left === "string" || typeof right === "string") {
                        return toString(left) + toString(right);
                    }
                    return toNumber(left) + toNumber(right);
                }
                case "-":
                    return toNumber(left) - toNumber(right);
                case "*":
                    return toNumber(left) * toNumber(right);
                case "/": {
                    const d = toNumber(right);
                    return d === 0 ? null : toNumber(left) / d;
                }
                case "%": {
                    const d = toNumber(right);
                    return d === 0 ? null : toNumber(left) % d;
                }
                case "==":
                    return left === right;
                case "!=":
                    return left !== right;
                case ">":
                    return toNumber(left) > toNumber(right);
                case ">=":
                    return toNumber(left) >= toNumber(right);
                case "<":
                    return toNumber(left) < toNumber(right);
                case "<=":
                    return toNumber(left) <= toNumber(right);
                case "and":
                    return toBool(left) && toBool(right);
                case "or":
                    return toBool(left) || toBool(right);
                default:
                    return null;
            }
        }

        case "call": {
            const { name, args } = node;

            // prop("PropertyName") — the key function
            if (name === "prop") {
                const propName = args[0] ? toString(evaluate(args[0], ctx)) : "";
                return (ctx.props[propName] as Value) ?? null;
            }

            // Control flow
            if (name === "if") {
                const cond = toBool(evaluate(args[0], ctx));
                return cond
                    ? (args[1] ? evaluate(args[1], ctx) : null)
                    : (args[2] ? evaluate(args[2], ctx) : null);
            }

            // Math
            if (name === "abs")
                return Math.abs(toNumber(evaluate(args[0], ctx)));
            if (name === "round")
                return Math.round(toNumber(evaluate(args[0], ctx)));
            if (name === "floor")
                return Math.floor(toNumber(evaluate(args[0], ctx)));
            if (name === "ceil")
                return Math.ceil(toNumber(evaluate(args[0], ctx)));
            if (name === "min") {
                const vals = args.map((a) => toNumber(evaluate(a, ctx)));
                return vals.length ? Math.min(...vals) : 0;
            }
            if (name === "max") {
                const vals = args.map((a) => toNumber(evaluate(a, ctx)));
                return vals.length ? Math.max(...vals) : 0;
            }
            if (name === "pow") {
                return Math.pow(
                    toNumber(evaluate(args[0], ctx)),
                    toNumber(evaluate(args[1], ctx)),
                );
            }

            // String
            if (name === "concat") {
                return args.map((a) => toString(evaluate(a, ctx))).join("");
            }
            if (name === "length") {
                return toString(evaluate(args[0], ctx)).length;
            }
            if (name === "upper") {
                return toString(evaluate(args[0], ctx)).toUpperCase();
            }
            if (name === "lower") {
                return toString(evaluate(args[0], ctx)).toLowerCase();
            }
            if (name === "slice") {
                const s = toString(evaluate(args[0], ctx));
                const start = toNumber(evaluate(args[1], ctx));
                const end = args[2] ? toNumber(evaluate(args[2], ctx)) : undefined;
                return s.slice(start, end);
            }
            if (name === "contains") {
                const haystack = toString(evaluate(args[0], ctx));
                const needle = toString(evaluate(args[1], ctx));
                return haystack.includes(needle);
            }
            if (name === "replace") {
                const s = toString(evaluate(args[0], ctx));
                const search = toString(evaluate(args[1], ctx));
                const replacement = toString(evaluate(args[2], ctx));
                return s.replaceAll(search, replacement);
            }

            // Type conversion
            if (name === "tonumber")
                return toNumber(evaluate(args[0], ctx));
            if (name === "tostring")
                return toString(evaluate(args[0], ctx));

            // Utility
            if (name === "empty") {
                const v = evaluate(args[0], ctx);
                return v === null || v === undefined || v === "" || (typeof v === "number" && isNaN(v));
            }
            if (name === "now") {
                return new Date().toISOString();
            }

            throw new Error(`Unknown function: ${name}`);
        }
    }
}

// ─── Public API ─────────────────────────────────────────

export interface FormulaResult {
    value: Value;
    error?: string;
}

/**
 * Evaluate a formula expression against a row's property values.
 *
 * @param expression  The formula string, e.g. `prop("Price") * prop("Qty")`
 * @param propValues  Map from property *name* → raw value from the row
 */
export function evaluateFormula(
    expression: string,
    propValues: Record<string, unknown>,
): FormulaResult {
    if (!expression.trim()) return { value: null };
    try {
        const ast = parseFormula(expression);
        const value = evaluate(ast, { props: propValues });
        return { value };
    } catch (err) {
        return {
            value: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

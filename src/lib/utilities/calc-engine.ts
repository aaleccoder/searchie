class ExpressionParser {
  private readonly input: string;
  private index = 0;

  constructor(input: string) {
    this.input = input;
  }

  parse(): number {
    const value = this.parseExpression();
    this.skipWhitespace();
    if (this.index !== this.input.length) {
      throw new Error("Invalid expression: unexpected trailing characters");
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (true) {
      this.skipWhitespace();
      const char = this.peek();
      if (char === "+") {
        this.index += 1;
        value += this.parseTerm();
      } else if (char === "-") {
        this.index += 1;
        value -= this.parseTerm();
      } else {
        break;
      }
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (true) {
      this.skipWhitespace();
      const char = this.peek();
      if (char === "*") {
        this.index += 1;
        value *= this.parseFactor();
      } else if (char === "/") {
        this.index += 1;
        const divisor = this.parseFactor();
        if (divisor === 0) {
          throw new Error("Invalid expression: division by zero");
        }
        value /= divisor;
      } else {
        break;
      }
    }

    return value;
  }

  private parseFactor(): number {
    this.skipWhitespace();

    const char = this.peek();
    if (char === "-") {
      this.index += 1;
      return -this.parseFactor();
    }

    if (char === "(") {
      this.index += 1;
      const value = this.parseExpression();
      this.skipWhitespace();
      if (this.peek() !== ")") {
        throw new Error("Invalid expression: missing closing parenthesis");
      }
      this.index += 1;
      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipWhitespace();
    const start = this.index;
    let seenDigit = false;
    let seenDot = false;

    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (char >= "0" && char <= "9") {
        seenDigit = true;
        this.index += 1;
        continue;
      }
      if (char === "." && !seenDot) {
        seenDot = true;
        this.index += 1;
        continue;
      }
      break;
    }

    if (!seenDigit) {
      throw new Error("Invalid expression: expected number");
    }

    const raw = this.input.slice(start, this.index);
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) {
      throw new Error("Invalid expression: malformed number");
    }

    return value;
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && /\s/.test(this.input[this.index] ?? "")) {
      this.index += 1;
    }
  }

  private peek(): string | undefined {
    return this.input[this.index];
  }
}

export function evaluateExpression(expression: string): number {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new Error("Invalid expression: empty input");
  }

  const parser = new ExpressionParser(trimmed);
  return parser.parse();
}

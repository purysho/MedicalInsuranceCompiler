import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, p), "utf8");

// Regression guard: the legacy dashboard stylesheet redefined :root design
// tokens (notably --primary -> a blue), which silently overrode the PLAN 2
// palette across the whole app. Keep the token system authoritative.
describe("design tokens are authoritative", () => {
  it("tokens.css defines the PLAN 2 brand primary (teal)", () => {
    const css = read("./tokens.css");
    expect(css).toMatch(/--primary:\s*#0F766E/i);
    expect(css).toMatch(/--aria:\s*#6756C8/i);
  });

  it("main.tsx does NOT import the legacy styles.css (which overrode tokens)", () => {
    const main = read("./main.tsx");
    expect(main).not.toMatch(/import\s+["']\.\/styles\.css["']/);
    expect(main).toMatch(/tokens\.css/);
  });
});

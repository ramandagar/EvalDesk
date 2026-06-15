import { describe, it, expect } from "vitest";
import { scanContent, scanSrc } from "../../../../scripts/check-open-core.mjs";

describe("open-core boundary guard", () => {
  it("the MIT core (src/**) imports NO commercial @evaldesk/suite-* pack", () => {
    const violations = scanSrc();
    expect(violations, `boundary violations:\n${violations.map((v: { file: string; line: number }) => `${v.file}:${v.line}`).join("\n")}`).toEqual([]);
  });

  it("flags a planted commercial import (the guard actually works)", () => {
    const bad = `import { hipaa } from "@evaldesk/suite-hipaa";\nconst x = 1;`;
    const v = scanContent("src/lib/evil.ts", bad);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("no-commercial-suite-import");
  });

  it("flags a dynamic require of a commercial namespace", () => {
    const bad = `const sso = require("@evaldesk/enterprise/sso");`;
    expect(scanContent("src/lib/x.ts", bad)).toHaveLength(1);
  });

  it("does NOT flag legitimate internal imports", () => {
    expect(scanContent("src/lib/x.ts", `import { foo } from "@/lib/suites/manifest";`)).toEqual([]);
  });
});

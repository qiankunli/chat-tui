import { describe, expect, test } from "bun:test";

import { composerHeightFor } from "../src/components/composer.tsx";

describe("composerHeightFor", () => {
  test("keeps short input inside the taller centered composer", () => {
    expect(composerHeightFor("")).toBe(4);
    expect(composerHeightFor("1\n2")).toBe(4);
  });

  test("grows with explicit lines up to the maximum", () => {
    expect(composerHeightFor("1\n2\n3\n4")).toBe(6);
    expect(composerHeightFor("1\n2\n3\n4\n5\n6\n7")).toBe(8);
  });
});

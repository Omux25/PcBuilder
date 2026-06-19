import { describe, expect, test } from "bun:test";
import { getInitials } from "../initials.formatter";

describe("getInitials", () => {
  test("returns initials for a two-word name", () => {
    expect(getInitials("PC Builder")).toBe("PB");
  });

  test("returns initials for a multi-word name", () => {
    expect(getInitials("PC Builder Morocco")).toBe("PB");
  });

  test("returns first two letters for a single-word name", () => {
    expect(getInitials("Component")).toBe("CO");
  });

  test("returns single letter if name is one letter", () => {
    expect(getInitials("C")).toBe("C");
  });

  test("handles extra spaces", () => {
    expect(getInitials("  PC   Builder  ")).toBe("PB");
  });

  test("handles hyphens and underscores", () => {
    expect(getInitials("PC-Builder")).toBe("PB");
    expect(getInitials("PC_Builder")).toBe("PB");
  });
});

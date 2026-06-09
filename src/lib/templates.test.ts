import { describe, expect, it } from "vitest";
import { createTemplateSections } from "@/lib/templates";

describe("report template", () => {
  it("creates the complete MVP section set", () => {
    const sections = createTemplateSections();
    expect(sections).toHaveLength(10);
    expect(sections[0].title).toBe("Executive Summary");
    expect(sections.at(-1)?.title).toBe("References");
  });

  it("marks evidence-dependent sections", () => {
    const sections = createTemplateSections();
    expect(sections.find((section) => section.title === "Legal / Administrative Background")?.sourceRequired).toBe(true);
  });
});

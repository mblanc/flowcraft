import { describe, it, expect } from "vitest";
import { loadAllSkillsInDir } from "@google/adk";
import path from "path";

const SKILLS_DIR = path.resolve(__dirname, "../lib/canvas/adk/skills");

describe("skill files", () => {
    it("loads all skills without error", async () => {
        const skills = await loadAllSkillsInDir(SKILLS_DIR);
        expect(Object.keys(skills).length).toBeGreaterThanOrEqual(4);
    });

    it("image-generation skill has valid frontmatter", async () => {
        const skills = await loadAllSkillsInDir(SKILLS_DIR);
        const t2i = skills["image-generation"];
        expect(t2i).toBeDefined();
        expect(t2i.frontmatter.name).toBe("image-generation");
        expect(t2i.frontmatter.description.length).toBeLessThanOrEqual(1024);
        expect(t2i.frontmatter.metadata?.type).toBe("primitive");
        expect(t2i.instructions).toBeTruthy();
    });

    it("video-generation skill has valid frontmatter", async () => {
        const skills = await loadAllSkillsInDir(SKILLS_DIR);
        const i2v = skills["video-generation"];
        expect(i2v).toBeDefined();
        expect(i2v.frontmatter.name).toBe("video-generation");
        expect(i2v.frontmatter.metadata?.type).toBe("primitive");
    });

    it("t2s skill has valid frontmatter", async () => {
        const skills = await loadAllSkillsInDir(SKILLS_DIR);
        const t2s = skills["t2s"];
        expect(t2s).toBeDefined();
        expect(t2s.frontmatter.name).toBe("t2s");
        expect(t2s.frontmatter.metadata?.type).toBe("primitive");
    });

    it("virtual-tryon skill has pattern type", async () => {
        const skills = await loadAllSkillsInDir(SKILLS_DIR);
        const vt = skills["virtual-tryon"];
        expect(vt).toBeDefined();
        expect(vt.frontmatter.name).toBe("virtual-tryon");
        expect(vt.frontmatter.metadata?.type).toBe("pattern");
        expect(vt.instructions).toContain("character sheet");
    });
});

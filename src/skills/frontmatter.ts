import matter from "gray-matter";
import { z } from "zod";

const skillFrontmatterYamlSchema = z.object({
  name: z.string().trim().min(1, "name must be a non-empty string"),
  description: z
    .string()
    .trim()
    .min(1, "description must be a non-empty string"),
  metadata: z.object({
    attachtype: z.enum(["always", "on-demand"], {
      error: 'metadata.attachtype must be "always" or "on-demand"',
    }),
    version: z.string().trim().min(1).optional(),
    allowedTools: z.array(z.string()).optional(),
  }),
});

const skillFrontmatterSchema = skillFrontmatterYamlSchema.transform((data) => ({
  name: data.name,
  description: data.description,
  metadata: {
    attachType: data.metadata.attachtype,
    version: data.metadata.version,
    allowedTools: data.metadata.allowedTools,
  },
}));

export type SkillFrontmatter = z.output<typeof skillFrontmatterSchema>;
export type AttachType = SkillFrontmatter["metadata"]["attachType"];

type ParsedSkillMd = {
  frontmatter: SkillFrontmatter;
  body: string;
};

export class SkillFrontmatterParser {
  parse(content: string, skillId: string): ParsedSkillMd {
    if (!matter.test(content)) {
      throw new Error(
        `skills/${skillId}/SKILL.md: missing YAML frontmatter (expected --- ... ---)`,
      );
    }

    let file: matter.GrayMatterFile<string>;
    try {
      file = matter(content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `skills/${skillId}/SKILL.md: invalid YAML frontmatter (${detail})`,
      );
    }

    const parsed = skillFrontmatterSchema.safeParse(file.data);
    if (!parsed.success) {
      throw new Error(this.formatZodIssues(skillId, parsed.error));
    }

    return {
      frontmatter: parsed.data,
      body: file.content,
    };
  }

  private formatZodIssues(skillId: string, error: z.ZodError): string {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `skills/${skillId}/SKILL.md: ${path}: ${issue.message}`;
      })
      .join("\n");
  }
}

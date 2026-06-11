import { z } from "zod/v3";

export const createReportSchema = z.object({
  reportTypeId: z.string().trim().optional(),
  reportTypeName: z.string().trim().max(160).optional(),
  projectName: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().max(100).optional(),
  neighborhood: z.string().trim().max(100).optional(),
  parcelInfo: z.string().trim().max(500).optional(),
  manualNotes: z.string().max(10000).optional(),
  outputLanguage: z.string().min(2).max(50),
  allowWebResearch: z.boolean().default(false),
  desiredLength: z.number().int().min(5).max(100),
});

const reportTypeSectionSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().max(160).optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
  sortOrder: z.number().int().min(0).optional(),
}).superRefine((section, context) => {
  const hasContent = Boolean(section.title || section.description);
  if (!hasContent) return;
  if (!section.title) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["title"],
      message: "Section title is required.",
    });
  }
});

const reportTypeSourceSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().max(160).optional().default(""),
  url: z.string().trim().optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
}).superRefine((source, context) => {
  const hasContent = Boolean(source.name || source.url || source.description);
  if (!hasContent) return;
  if (!source.name) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "Source name is required.",
    });
  }
  if (!source.url) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["url"],
      message: "Source URL is required.",
    });
    return;
  }
  const urlCheck = z.string().url().safeParse(source.url);
  if (!urlCheck.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["url"],
      message: "Source URL must be a valid URL.",
    });
  }
});

export const createReportTypeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional().default(""),
  sections: z.array(reportTypeSectionSchema).max(100).optional().default([]),
  sources: z.array(reportTypeSourceSchema).max(100).optional().default([]),
});

export const updateReportTypeSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional().default(""),
  sections: z.array(reportTypeSectionSchema).max(100),
  sources: z.array(reportTypeSourceSchema).max(100),
});

export const sourceSchema = z.object({
  url: z.string().url(),
});

export const generationSchema = z.object({
  sectionId: z.string().min(1),
  instruction: z.string().max(1000).optional(),
});

export const chatSchema = z.object({
  sectionId: z.string().min(1),
  message: z.string().trim().min(1).max(2000),
});

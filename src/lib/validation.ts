import { z } from "zod";

export const createReportSchema = z.object({
  reportTypeId: z.string().trim().min(1),
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
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  sortOrder: z.number().int().min(0).optional(),
});

const reportTypeSourceSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1).max(160),
  url: z.string().trim().url(),
  description: z.string().trim().max(5000).optional(),
});

export const createReportTypeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional().default(""),
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

import { z } from "zod";

export const createReportSchema = z.object({
  reportType: z.string().trim().min(2).max(100),
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

export const reportTypeSourcesSchema = z.object({
  reportType: z.string().trim().min(2).max(100),
  urls: z.array(z.string().trim().url()).max(50),
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

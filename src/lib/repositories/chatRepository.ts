import { getPrismaClient } from "@/lib/prisma";

export interface CreateChatMessageInput {
  reportId: string;
  sectionId?: string;
  role: string;
  content: string;
}

export async function createChatMessage(input: CreateChatMessageInput) {
  return getPrismaClient().chatMessage.create({ data: input });
}

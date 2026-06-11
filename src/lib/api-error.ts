import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod/v3";

export function apiErrorResponse(
  error: unknown,
  fallback: string,
  defaultStatus = 500,
) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request data.", details: error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "This record already exists." }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "The requested record was not found." }, { status: 404 });
    }
    return NextResponse.json({ error: fallback }, { status: defaultStatus });
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return NextResponse.json(
      { error: "Database service is temporarily unavailable." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: defaultStatus },
  );
}

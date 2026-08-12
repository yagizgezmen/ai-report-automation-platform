import { LoginPageClient } from "@/app/login/login-page-client";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextValue = resolvedSearchParams?.next;
  const nextPath = Array.isArray(nextValue) ? nextValue[0] : nextValue;

  return <LoginPageClient nextPath={typeof nextPath === "string" ? nextPath : "/"} />;
}
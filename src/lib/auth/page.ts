export interface AuthPageProps {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
    success?: string | string[];
  }>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function getAuthPageState(searchParams: AuthPageProps["searchParams"]) {
  const params = await searchParams;
  const error = first(params.error);
  const success = first(params.success);
  const requestedNext = first(params.next);
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/account";

  return {
    message: error
      ? { kind: "error" as const, text: error }
      : success
        ? { kind: "success" as const, text: success }
        : undefined,
    next,
  };
}

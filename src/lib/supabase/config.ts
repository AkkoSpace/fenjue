export function getSupabasePublicConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase public configuration is missing");
  }

  return { publishableKey, url };
}

export function hasSupabasePublicConfig() {
  try {
    getSupabasePublicConfig();
    return true;
  } catch {
    return false;
  }
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

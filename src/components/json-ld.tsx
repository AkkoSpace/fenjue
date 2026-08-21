interface JsonLdProps {
  data: unknown;
}

export function JsonLd({ data }: JsonLdProps) {
  const serialized = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script type="application/ld+json">{serialized}</script>;
}

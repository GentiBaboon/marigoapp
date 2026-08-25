import * as React from 'react';

/**
 * Shared shell for /terms and /privacy.
 *
 * The two documents cross-reference each other constantly, so they need to
 * look like one pair rather than two pages that happened to be written
 * separately. Plain prose in a readable measure — a legal document people
 * cannot get through is not consent, and the previous cards-per-clause layout
 * made every clause look equally important.
 */

/** Set explicitly, never `new Date()`. A document that claims to be revised
 *  today on every page load is telling the reader something untrue, and it is
 *  the one date a regulator or a court would actually look at. */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto px-4 py-10">
      <article className="mx-auto max-w-2xl">
        <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        <div className="mt-6 text-[15px] leading-relaxed text-foreground/90">{intro}</div>
        <div className="mt-10 space-y-10">{children}</div>
      </article>
    </div>
  );
}

export function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-headline text-xl font-bold tracking-tight">
        <span className="text-muted-foreground mr-2">{n}.</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Definition-style rows, for the data table in the privacy policy. */
export function DataTable({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="divide-y rounded-lg border">
      {rows.map(([term, def], i) => (
        <div key={i} className="grid gap-1 p-3 sm:grid-cols-3 sm:gap-4">
          <dt className="font-medium">{term}</dt>
          <dd className="text-muted-foreground sm:col-span-2">{def}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Passes the root <main>'s leftover height straight through to the page, so
  // the auth screens can fill it exactly.
  return <main className="flex flex-1 flex-col bg-background">{children}</main>;
}

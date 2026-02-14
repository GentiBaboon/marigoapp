export default function OrderSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-col min-h-screen bg-background">
        {children}
    </main>
  );
}

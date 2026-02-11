export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto h-[calc(100vh-4rem)] max-w-4xl px-0 md:px-4 py-0 md:py-8">
      {children}
    </div>
  );
}

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // flex-1 claims exactly the space the root <main> has left over; min-h-0
    // lets it shrink below its content so the thread scrolls internally rather
    // than pushing the composer past the bottom of the screen.
    // md:min-h-[36rem]: on desktop the site footer shares the viewport, which
    // would otherwise squeeze the thread to ~288px. A floor keeps it usable and
    // lets the page scroll to reach the footer, as it did before.
    <div className="container mx-auto flex min-h-0 flex-1 flex-col max-w-4xl px-0 md:px-4 py-0 md:py-8 md:min-h-[36rem]">
      {children}
    </div>
  );
}

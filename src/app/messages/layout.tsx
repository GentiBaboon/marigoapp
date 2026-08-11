export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // h-[calc(100vh-4rem)] only subtracted the bottom nav, ignoring the
    // announcement bar + header above (116px) and the 4rem `main` reserves for
    // the nav — so the page overflowed by ~116px on a phone and pushed the
    // composer below the fold. h-viewport-content subtracts the real chrome.
    <div className="container mx-auto h-viewport-content max-w-4xl px-0 md:px-4 py-0 md:py-8">
      {children}
    </div>
  );
}

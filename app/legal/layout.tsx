export default function LegalLayout({ children }: { children: React.ReactNode }) {
    return (
      <main
        className="max-w-3xl mx-auto px-4 py-16 prose prose-sm sm:prose-base"
      >
        {children}
      </main>
    );
  }
  
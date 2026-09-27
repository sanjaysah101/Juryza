export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Notils
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">juryza</h1>
          <p className="text-muted-foreground text-lg">
            Your app starts here. Edit{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">
              src/app/page.tsx
            </code>{" "}
            to replace this page.
          </p>
        </div>

        <div className="text-muted-foreground flex flex-col gap-2 border-t pt-6 text-sm">
          <p>
            Add capabilities with{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              notils add &lt;name&gt;
            </code>
            .
          </p>
          <p>
            See{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">README.md</code> for
            the project layout and conventions.
          </p>
        </div>
      </div>
    </main>
  );
}

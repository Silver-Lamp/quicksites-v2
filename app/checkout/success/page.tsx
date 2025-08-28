export default function Success({ searchParams }: { searchParams: { order?: string } }) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">Payment received 🎉</h1>
        <p className="mt-2 text-neutral-400">Order: <code className="font-mono">{searchParams.order || '(unknown)'}</code></p>
        <a className="mt-6 inline-block rounded bg-neutral-900 px-4 py-2 ring-1 ring-neutral-800" href="/">Back home</a>
      </div>
    );
  }
  
export default function Cancel({ searchParams }: { searchParams: { order?: string } }) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">Checkout canceled</h1>
        <p className="mt-2 text-neutral-400">You can resume your order anytime.</p>
        <a className="mt-6 inline-block rounded bg-neutral-900 px-4 py-2 ring-1 ring-neutral-800" href="/">Back home</a>
      </div>
    );
  }
  
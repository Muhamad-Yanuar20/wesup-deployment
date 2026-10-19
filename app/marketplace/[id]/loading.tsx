export default function MarketplaceDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8" aria-label="Memuat detail penawaran" aria-busy="true">
      <div className="h-5 w-48 animate-pulse bg-wesup-paper-sub motion-reduce:animate-none" />
      <div className="mt-4 overflow-hidden border border-wesup-ink/15 bg-wesup-paper">
        <div className="aspect-[16/9] w-full animate-pulse bg-wesup-paper-sub motion-reduce:animate-none" />
        <div className="flex flex-col gap-5 p-5 md:p-8">
          <div className="h-9 w-3/4 animate-pulse bg-wesup-paper-sub motion-reduce:animate-none" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-20 animate-pulse bg-wesup-paper-sub motion-reduce:animate-none" />
            <div className="h-20 animate-pulse bg-wesup-paper-sub motion-reduce:animate-none" />
          </div>
          <div className="h-64 animate-pulse bg-wesup-paper-sub motion-reduce:animate-none" />
          <div className="h-28 animate-pulse bg-wesup-paper-sub motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

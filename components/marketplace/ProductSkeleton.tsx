import { Skeleton } from "@/components/ui/SkeletonLoading";

export default function ProductSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-wesup-paper border border-wesup-ink/15 overflow-hidden flex flex-col h-full animate-pulse motion-reduce:animate-none"
    >
      <Skeleton className="w-full h-48 bg-wesup-paper-sub" />
      <div className="p-4 flex flex-col flex-1 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-4/5 bg-wesup-paper-sub" />
          <Skeleton className="h-4 w-1/2 bg-wesup-paper-sub" />
        </div>
        <div className="flex gap-4 p-3 bg-wesup-paper border border-wesup-ink/10 tabular-nums">
          <Skeleton className="h-4 w-1/3 bg-wesup-paper-sub" />
          <Skeleton className="h-4 w-1/3 bg-wesup-paper-sub" />
        </div>
        <div className="mt-auto pt-2 space-y-2">
          <Skeleton className="h-3 w-1/3 bg-wesup-paper-sub" />
          <div className="flex items-end gap-2 tabular-nums">
            <Skeleton className="h-8 w-3/5 bg-wesup-paper-sub" />
            <Skeleton className="mb-1 h-4 w-1/4 bg-wesup-paper-sub" />
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-4 border-t border-wesup-ink/10 tabular-nums">
          <div className="flex justify-between items-center tabular-nums">
            <Skeleton className="h-3 w-3/5 bg-wesup-paper-sub" />
            <Skeleton className="h-3 w-1/6 bg-wesup-paper-sub" />
          </div>
          <Skeleton className="w-full h-2.5 bg-wesup-paper-sub" />
        </div>
      </div>
    </div>
  );
}

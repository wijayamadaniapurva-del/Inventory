import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-2 h-4 w-16" />
      <div className="mb-4 mt-4 flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="card !p-0 mb-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-stone-100 px-4 py-3 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-36" />
    </div>
  );
}

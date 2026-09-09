import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-6 w-16" />
      <Skeleton className="mt-2 h-4 w-28" />
      <div className="mb-3 mt-4 flex justify-between">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="card !p-0 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-stone-100 px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

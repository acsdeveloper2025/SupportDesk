export function Skeleton({ className = "" }: Readonly<{ className?: string }>) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
  );
}

export function TicketDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading ticket details" className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      {/* Info section */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="space-y-1" key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
      {/* Comments section */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

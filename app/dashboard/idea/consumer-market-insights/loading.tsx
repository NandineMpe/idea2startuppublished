export default function Loading() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="h-8 w-64 bg-white/10 rounded animate-pulse mb-6"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg p-6 h-48 animate-pulse"
          >
            <div className="h-6 w-24 bg-white/10 rounded mb-4"></div>
            <div className="h-4 w-full bg-white/10 rounded mb-2"></div>
            <div className="h-4 w-3/4 bg-white/10 rounded mb-2"></div>
            <div className="h-4 w-5/6 bg-white/10 rounded"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg p-6 h-64 animate-pulse">
          <div className="h-6 w-32 bg-white/10 rounded mb-4"></div>
          <div className="h-4 w-full bg-white/10 rounded mb-2"></div>
          <div className="h-4 w-5/6 bg-white/10 rounded mb-2"></div>
          <div className="h-4 w-4/5 bg-white/10 rounded"></div>
        </div>

        <div className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg p-6 h-64 animate-pulse">
          <div className="h-6 w-32 bg-white/10 rounded mb-4"></div>
          <div className="h-40 w-full bg-white/10 rounded"></div>
        </div>
      </div>

      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-6 animate-pulse">
          <div className="h-6 w-48 bg-white/10 rounded mb-4"></div>
          <div className="h-4 w-full bg-white/10 rounded mb-2"></div>
          <div className="h-4 w-5/6 bg-white/10 rounded mb-2"></div>
          <div className="h-4 w-4/5 bg-white/10 rounded mb-2"></div>
          <div className="h-4 w-3/4 bg-white/10 rounded"></div>
        </div>
      ))}
    </div>
  )
}

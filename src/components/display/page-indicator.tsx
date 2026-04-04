interface PageIndicatorProps {
  totalPages: number
  currentPage: number
}

function PageIndicator({ totalPages, currentPage }: PageIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalPages }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-2 w-2 ${i === currentPage ? 'bg-ember' : 'bg-surface-steel'}`}
        />
      ))}
    </div>
  )
}

export { PageIndicator }

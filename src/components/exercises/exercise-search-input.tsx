import { useEffect, useRef } from 'react'

interface ExerciseSearchInputProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function ExerciseSearchInput({
  value,
  onChange,
  autoFocus = true,
}: ExerciseSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  return (
    <div className="relative flex items-center border-b-2 border-surface-steel bg-transparent transition-colors focus-within:border-ember">
      <span className="material-symbols-outlined pointer-events-none ml-2 text-warm-ash text-xl">
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="SEARCH EXERCISES"
        className="min-h-12 w-full bg-transparent px-3 py-3 font-body text-sm text-bone-white placeholder:text-warm-ash/60 placeholder:tracking-widest placeholder:uppercase focus:outline-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mr-2 flex min-h-12 min-w-12 items-center justify-center text-warm-ash hover:text-bone-white"
          aria-label="Clear search"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      )}
    </div>
  )
}

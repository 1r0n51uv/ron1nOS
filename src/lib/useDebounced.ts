import { useEffect, useState } from 'react'

// Il valore dopo `ms` senza cambi: per le ricerche mentre si scrive.
export function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

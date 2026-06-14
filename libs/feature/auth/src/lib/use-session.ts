import PocketBase from 'pocketbase'
import { useEffect, useState } from 'react'

export function useSession(url: string) {
  const [pb] = useState(() => new PocketBase(url))
  const [user, setUser] = useState(pb.authStore.record)
  useEffect(() => {
    return pb.authStore.onChange(() => setUser(pb.authStore.record))
  }, [pb])
  return { pb, user }
}

export type ApiResponse<T> = { data: T; ok: true } | { ok: false; error: string; status: number }

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number }

export type FavoriteLine = { id: string; routeId: string; label?: string; createdAt: string }

export type ApiClientOptions = {
  baseUrl: string
  defaultHeaders?: Record<string, string>
  fetchImpl?: typeof fetch
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async request<T>(method: string, path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.options.baseUrl).toString()
    const headers = new Headers(init.headers)
    if (this.options.defaultHeaders) {
      for (const [k, v] of Object.entries(this.options.defaultHeaders)) headers.set(k, v)
    }
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    const res = await this.fetchImpl(url, { ...init, method, headers })
    if (!res.ok) {
      const body = await safeReadBody(res)
      throw new ApiError(`HTTP ${res.status} on ${method} ${path}`, res.status, body)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  get<T>(path: string) {
    return this.request<T>('GET', path)
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body: body ? JSON.stringify(body) : undefined })
  }
}

async function safeReadBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

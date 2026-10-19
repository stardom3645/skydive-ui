// Reuse the existing session token when a restored login has no browser cookie.
// Keep caller headers, bodies, cancellation and cookie behavior unchanged.
export const authenticatedRequestOptions = (token?: string, options: RequestInit = {}): RequestInit => {
    const headers = new Headers(options.headers)
    if (token && !headers.has('X-Auth-Token') && !headers.has('Authorization')) {
        headers.set('X-Auth-Token', token)
    }
    return { ...options, headers }
}

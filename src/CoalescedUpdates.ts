export interface UpdateTimer {
    set(callback: () => void, delay: number): any
    clear(handle: any): void
}

export type CoalescedUpdate<T extends any[]> = ((...args: T) => void) & { cancel(): void }

// Unlike a trailing debounce, a continuous event stream cannot postpone work
// forever. Retain only the latest arguments and at most one pending timer.
export function coalesceUpdates<T extends any[]>(
    delay: number,
    callback: (...args: T) => void,
    timer: UpdateTimer = {
        set: (fn, ms) => setTimeout(fn, ms),
        clear: handle => clearTimeout(handle)
    }
): CoalescedUpdate<T> {
    let handle: any
    let pending: T | undefined
    const update = ((...args: T) => {
        pending = args
        if (handle !== undefined) return
        handle = timer.set(() => {
            handle = undefined
            const latest = pending!
            pending = undefined
            callback(...latest)
        }, delay)
    }) as CoalescedUpdate<T>
    update.cancel = () => {
        if (handle !== undefined) timer.clear(handle)
        handle = undefined
        pending = undefined
    }
    return update
}

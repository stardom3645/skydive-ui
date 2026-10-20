export interface KubernetesDetailRefreshEnvironment {
    setTimeout: (callback: () => void, delay: number) => any
    clearTimeout: (timer: any) => void
    visibility?: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>
}

/** One request at a time per mounted panel. Identity changes invalidate even
 * transports that ignore AbortSignal; hidden documents do not keep polling. */
export class KubernetesDetailRefresh {
    private active = false
    private generation = 0
    private controller?: AbortController
    private timer: any
    private timeout: any
    private environment: KubernetesDetailRefreshEnvironment
    constructor(private load: (signal: AbortSignal, current: () => boolean) => Promise<void>, private interval = 60000,
        environment?: KubernetesDetailRefreshEnvironment) {
        this.environment = environment || {
            // Native browser timers reject the environment object as their receiver.
            setTimeout: (callback, delay) => setTimeout(callback, delay),
            clearTimeout: timer => clearTimeout(timer),
            visibility: typeof document === 'undefined' ? undefined : document
        }
    }
    private visible = () => !this.environment.visibility?.hidden
    private onVisibility = () => {
        this.cancel()
        if (this.visible()) this.refresh()
    }
    start() {
        if (this.active) return
        this.active = true
        this.environment.visibility?.addEventListener('visibilitychange', this.onVisibility)
        this.refresh()
    }
    stop() {
        this.active = false
        this.environment.visibility?.removeEventListener('visibilitychange', this.onVisibility)
        this.cancel()
    }
    private cancel() {
        this.generation++
        this.controller?.abort()
        this.controller = undefined
        this.environment.clearTimeout(this.timer)
        this.environment.clearTimeout(this.timeout)
    }
    refresh(replace = false) {
        if (replace) this.cancel()
        if (!this.active || !this.visible() || this.controller) return
        this.environment.clearTimeout(this.timer)
        const generation = ++this.generation
        const controller = this.controller = new AbortController()
        const current = () => this.active && this.generation === generation
        this.timeout = this.environment.setTimeout(() => controller.abort(), 15000)
        Promise.resolve().then(() => current() ? this.load(controller.signal, current) : undefined).catch(() => {
            // Panels present their own query failure; always release the slot.
        }).finally(() => {
            if (!current()) return
            this.environment.clearTimeout(this.timeout)
            this.controller = undefined
            this.timer = this.environment.setTimeout(() => this.refresh(), this.interval)
        })
    }
}

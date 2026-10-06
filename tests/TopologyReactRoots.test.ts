import * as assert from 'assert'
import { TopologyReactRoots } from '../src/TopologyReactRoots'

function rootsProbe() {
    let created = 0, rendered = 0, removed = 0
    const deferred: (() => void)[] = []
    const roots = new TopologyReactRoots(() => {
        created++
        return { render: () => rendered++, unmount: () => removed++ }
    }, callback => deferred.push(callback))
    return { roots, counts: () => ({ created, rendered, removed }),
        flush: () => { deferred.splice(0).forEach(callback => callback()) } }
}

describe('D3-managed React 18 roots', () => {
    it('calls the browser microtask scheduler with a valid receiver', () => {
        const nativeScheduler = global.queueMicrotask
        const deferred: (() => void)[] = []
        let removed = 0
        try {
            // Browser WebIDL functions reject an arbitrary class as `this`.
            global.queueMicrotask = function (callback: () => void) {
                if (this !== undefined && this !== global) throw new TypeError('Illegal invocation')
                deferred.push(callback)
            }
            const roots = new TopologyReactRoots(() => ({ render: () => undefined, unmount: () => removed++ }))
            const element = {} as Element
            roots.render(null, element)
            roots.unmount(element)
            deferred.forEach(callback => callback())
            assert.strictEqual(removed, 1)
        } finally {
            global.queueMicrotask = nativeScheduler
        }
    })

    it('reuses a root across 10000 badge refreshes and releases it on node exit', () => {
        const { roots, counts, flush } = rootsProbe()
        const element = {} as Element
        for (let index = 0; index < 10000; index++) roots.render(null, element)
        assert.deepStrictEqual(counts(), { created: 1, rendered: 10000, removed: 0 })
        roots.unmount(element)
        roots.unmount(element)
        flush()
        assert.strictEqual(counts().removed, 1)
        roots.render(null, element)
        assert.strictEqual(counts().created, 2)
    })

    it('cancels disposal when a D3 container is reused before the commit finishes', () => {
        const { roots, counts, flush } = rootsProbe()
        const element = {} as Element
        roots.render(null, element)
        roots.unmount(element)
        roots.render(null, element)
        flush()
        assert.deepStrictEqual(counts(), { created: 1, rendered: 2, removed: 0 })
        roots.unmount(element)
        flush()
        assert.strictEqual(counts().removed, 1)
    })

    it('disposes only once when exit/re-entry/exit occur during the same commit', () => {
        const { roots, counts, flush } = rootsProbe()
        const element = {} as Element
        roots.render(null, element)
        roots.unmount(element)
        roots.render(null, element)
        roots.unmount(element)
        flush()
        assert.strictEqual(counts().removed, 1)
    })
})

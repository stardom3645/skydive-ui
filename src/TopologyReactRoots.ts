import { ReactNode, createElement, Fragment, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'

interface TopologyReactRoot {
    render(content: ReactNode): void
    unmount(): void
}

function RootContent({ content, onRendered }: { content: ReactNode, onRendered?: () => void }) {
    useLayoutEffect(() => { onRendered?.() }, [onRendered])
    return createElement(Fragment, null, content)
}

// D3 owns these containers; React owns only their contents. Reuse one React 18
// root per container instead of invoking the deprecated render API each tick.
export class TopologyReactRoots {
    private roots = new WeakMap<Element, { root: TopologyReactRoot, removing: boolean }>()

    constructor(
        private create: (element: Element) => TopologyReactRoot = createRoot,
        private defer: (callback: () => void) => void = callback => queueMicrotask(callback)
    ) { }

    render(content: ReactNode, element: Element, onRendered?: () => void) {
        let entry = this.roots.get(element)
        if (!entry) {
            entry = { root: this.create(element), removing: false }
            this.roots.set(element, entry)
        }
        entry.removing = false
        entry.root.render(createElement(RootContent, { content, onRendered }))
    }

    unmount(element: Element) {
        const entry = this.roots.get(element)
        if (!entry || entry.removing) return
        entry.removing = true
        // Topology teardown can run during the parent React root's commit.
        // Dispose nested roots after that commit, before the next browser task.
        this.defer(() => {
            if (!entry.removing || this.roots.get(element) !== entry) return
            entry.root.unmount()
            this.roots.delete(element)
        })
    }
}

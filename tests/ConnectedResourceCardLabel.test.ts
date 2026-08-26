import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

describe('connected resource card semantic labels', () => {
    const component = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.tsx'), 'utf8')
    const css = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.css'), 'utf8')

    it('splits long Kubernetes resource kinds at meaningful boundaries', () => {
        assert.ok(component.includes("'\uB124\uC784\uC2A4\uD398\uC774\uC2A4': ['\uB124\uC784', '\uC2A4\uD398\uC774\uC2A4']"))
        assert.ok(component.includes("StorageClass: ['Storage', 'Class']"))
        assert.ok(component.includes('renderDetailResourceLabel(label)'))
    })

    it('keeps each semantic segment on one line within the shared two-line label', () => {
        assert.match(css, /\.netdive-detail-resource__label-lines\s*\{[^}]*flex-direction:\s*column/s)
        assert.match(css, /\.netdive-detail-resource__label-lines\s*>\s*span\s*\{[^}]*white-space:\s*nowrap/s)
    })
})

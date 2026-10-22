import fork from '@ant-design/icons-svg/lib/asn/ForkOutlined'

// Use the same Ant Design Fork icon as Mold, including SVG-only graph surfaces.
export const virtualRouterIconPath: string = (fork.icon as any).children[0].attrs.d
export const virtualRouterIconHref = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="64 64 896 896" fill="#1890ff"><path d="${virtualRouterIconPath}"/></svg>`)

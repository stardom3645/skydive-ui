import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as ts from 'typescript'
import * as vm from 'vm'
import * as path from 'path'
import { TopologyRelationGraph, connectionEvidenceLabel } from '../src/TopologyRelationTraversal'
const file = (name: string) => ts.createSourceFile(name, readFileSync(path.resolve(__dirname, '../src', name), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const topology=file('Topology.tsx'), app=file('App.tsx')
function methods(source: ts.SourceFile, className: string, names: string[]) {
    const cls=source.statements.filter(ts.isClassDeclaration).find(node=>node.name?.text===className)!
    return names.map(name=>cls.members.find(member=>member.name?.getText(source)===name)!.getText(source)).join('\n')
}
function focusFixture() {
    const nodes = new Map<string, any>(['vm','nic','host','other','hidden'].map((id,i)=>[id,{id,data:{Name:id,Type:id==='vm'||id==='other'?'libvirt':'device'},state:{expanded:false},x:i*100,y:i*50}]))
    const rendered=new Map([...nodes].filter(([id])=>id!=='hidden').map(([id,node])=>[id,{data:{id,wrapped:node}}]))
    const edges:any[]=[{id:'vm-nic',source:nodes.get('vm'),target:nodes.get('nic'),data:{RelationType:'vlayer2'}},
        {id:'host-vm',source:nodes.get('host'),target:nodes.get('vm'),data:{RelationType:'ownership'}},
        {id:'host-other',source:nodes.get('host'),target:nodes.get('other'),data:{RelationType:'ownership'}},
        {id:'hidden',source:nodes.get('vm'),target:nodes.get('hidden'),data:{RelationType:'novel',hidden:true}}]
    const each=(items:any[])=>({selectAll:()=>({each:(callback:any)=>items.forEach(callback)})})
    const source=methods(topology,'Topology',['recordConnectionRelation','forgetConnectionRelation','connectionFocus','setConnectionScope','retargetConnectionFocus','refreshTopologyNodeFocus','clearTopologyNodeFocus','topologyFocusTargetExists','renderedFocusNode'])
    const context:any={TopologyRelationGraph,Set,Map};vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${source} }; this.probe=new Probe()`,{target:ts.ScriptTarget.ES2018}),context)
    const p=context.probe
    let updates=0,applies=0
    Object.assign(p,{nodes,groups:new Map(),collectedRelations:new Map(edges.map(e=>[e.id,e])),props:{},d3nodes:rendered,
        gNodes:each([...rendered.values()]),gLinks:each(edges),gHieraLinks:each([{source:rendered.get('host'),target:rendered.get('vm')}]),
        visibleNodeIDForID:(id:string)=>id,linkDisplayOpacity:(e:any)=>e.data.hidden?0:1,hierarchyLinkKey:(a:string,b:string)=>`${a}->${b}`,displayedNodeName:(node:any)=>node.data.Name,
        forceUpdate:()=>updates++,applyTopologyNodeFocus:()=>applies++})
    p.topologyNodeFocus={mode:'connections',focusedNodeID:'vm',focusedNodeName:'vm',connectionScope:'direct',...p.connectionFocus(rendered.get('vm'))}
    return {p,nodes,rendered,edges,get updates(){return updates},get applies(){return applies}}
}
describe('Production connection-focus modes and presentation projection',()=>{
    it('keeps canonical hidden relations without highlighting their hidden traffic lines or arbitrary ancestors',()=>{
        const h=focusFixture(),f=h.p.topologyNodeFocus
        assert.deepEqual([...f.canonicalNodeIDs].sort(),['hidden','host','nic','vm'])
        assert.deepEqual([...f.nodeIDs].sort(),['host','nic','vm'])
        assert.equal(f.hiddenNodeCount,1)
        assert.ok(!f.relationLinkIDs.has('hidden'));assert.ok(!f.visibleRelationLinkIDs.has('hidden'))
        assert.ok(f.hierarchyLinkKeys.has('host->vm'))
    })
    it('recomputes on mode and anchor change without touching node positions/expansion/zoom and clears focus completely',()=>{
        const h=focusFixture(),before=JSON.stringify([...h.nodes.values()])
        h.p.setConnectionScope('all');assert.equal(h.p.topologyNodeFocus.connectionScope,'all')
        h.p.retargetConnectionFocus('other');assert.equal(h.p.topologyNodeFocus.focusedNodeID,'other');assert.equal(h.p.topologyNodeFocus.connectionScope,'all')
        assert.ok(h.p.topologyNodeFocus.canonicalNodeIDs.has('host'));assert.ok(!h.p.topologyNodeFocus.canonicalNodeIDs.has('vm'))
        h.p.setConnectionScope('direct');assert.equal(h.p.topologyNodeFocus.connectionScope,'direct')
        h.p.clearTopologyNodeFocus();assert.equal(h.p.topologyNodeFocus,null)
        assert.equal(JSON.stringify([...h.nodes.values()]),before);assert.ok(h.applies>=4)
    })
    it('invalidates the graph index for live edge mutation/deletion and preserves focus during sync reset',()=>{
        const h=focusFixture()
        h.p.forgetConnectionRelation('vm-nic');h.p.refreshTopologyNodeFocus()
        assert.ok(!h.p.topologyNodeFocus.canonicalNodeIDs.has('nic'))
        h.p.recordConnectionRelation('new',h.nodes.get('vm'),h.nodes.get('other'),{RelationType:'novel'});h.p.refreshTopologyNodeFocus()
        assert.ok(h.p.topologyNodeFocus.canonicalNodeIDs.has('other'))
        h.nodes.delete('vm');h.rendered.delete('vm');h.p.topologySyncInProgress=true;h.p.refreshTopologyNodeFocus();assert.ok(h.p.topologyNodeFocus)
        h.p.topologySyncInProgress=false;h.p.refreshTopologyNodeFocus();assert.equal(h.p.topologyNodeFocus,null)
    })
    it('distinguishes unknown/failed collection from a graph with no observed relationship',()=>{
        assert.equal(connectionEvidenceLabel({id:'a',data:{K8s:{CollectionStatus:'failed'}}},0),'수집/관계 미확인')
        assert.equal(connectionEvidenceLabel({id:'a',data:{K8s:{CollectionStatus:'active'}}},0),'수집된 관계 없음')
        assert.equal(connectionEvidenceLabel({id:'a',data:{CollectionStatus:'stale'}},2),'관련 2개 · 수집 확인 필요')
    })
})
describe('Canonical relationship provenance before display filtering',()=>{
    it('retains ownership and hidden Kubernetes detail edges before rendering filters, updates and deletes by stable edge ID',()=>{
        const host={id:'host',data:{Type:'host'}},vmNode={id:'vm',data:{Type:'libvirt'}},service={id:'service',data:{Type:'service',Manager:'k8s'}},pod={id:'pod',data:{Type:'pod',Manager:'k8s'}}
        const records=new Map(),drawn:any[]=[],parents:any[]=[],nodes=new Map([host,vmNode,service,pod].map(n=>[n.id,n]))
        const context:any={KUBERNETES_DETAIL_ONLY_TYPES:new Set(['service']),KUBERNETES_INTERMEDIATE_RELATION_TYPES:new Set()};vm.createContext(context)
        const source=methods(app,'App',['addEdge','updatedEdge','delEdge'])
        vm.runInContext(ts.transpile(`class Probe { ${source} }; this.probe=new Probe()`,{target:ts.ScriptTarget.ES2018}),context)
        const p=context.probe
        Object.assign(p,{pendingTopologyEdges:{remove(){},has(){return false},defer(){}},config:{isHierarchyLink:(d:any)=>['ownership','vownership'].includes(d.RelationType)},
            tc:{nodes,root:{id:'root'},recordConnectionRelation:(id:string,source:any,target:any,data:any)=>records.set(id,{source,target,data}),forgetConnectionRelation:(id:string)=>records.delete(id),setParent:(a:any,b:any)=>parents.push([a,b]),addLink:(...args:any[])=>drawn.push(args),updateLink(){},delLink(){}}})
        const own={ID:'own',Parent:'host',Child:'vm',Metadata:{RelationType:'ownership'}}
        assert.equal(p.addEdge(own),true);assert.ok(records.has('own'));assert.equal(parents.length,1);assert.equal(drawn.length,0)
        p.addEdge({ID:'service-pod',Parent:'service',Child:'pod',Metadata:{RelationType:'service'}})
        assert.ok(records.has('service-pod'));assert.equal(drawn.length,0)
        p.updatedEdge({...own,Metadata:{RelationType:'ownership',Revision:2}});assert.equal((records.get('own') as any).data.Revision,2)
        p.delEdge(own);assert.ok(!records.has('own'))
    })
})

import { strict as assert } from 'assert'
import { RelationNode, RelationEdge, TopologyRelationGraph, connectionRelationKind } from '../src/TopologyRelationTraversal'
const n = (id: string, type: string, k8s = false, data: any = {}): RelationNode => ({ id, data: { Name: id, Type: type, ...(k8s ? { Manager: 'k8s', ClusterName: 'a' } : {}), ...data } })
const e = (a: RelationNode, b: RelationNode, relation: string, data: any = {}): RelationEdge => ({ id: `${a.id}-${b.id}-${relation}`, source: a, target: b, data: { RelationType: relation, ...data } })
const graph = (nodes: RelationNode[], edges: RelationEdge[]) => new TopologyRelationGraph(new Map(nodes.map(node => [node.id, node])), edges)
const ids = (result: ReturnType<TopologyRelationGraph['traverse']>) => [...result.nodeIDs].sort()

describe('Every object kind: canonical one-hop coverage', () => {
    for (const [kube, types] of [[false, 'host libvirt switch switchport device nic interface bond bridge vlan tuntap veth ovsbridge openvswitch ovsport port network storage netns container runc'],
        [true, 'cluster namespace node deployment replicaset replicationcontroller daemonset statefulset job cronjob pod container service endpoints endpointslice ingress persistentvolumeclaim persistentvolume storageclass secret configmap serviceaccount networkpolicy horizontalpodautoscaler poddisruptionbudget']] as Array<[boolean,string]>) {
        for (const type of types.split(' ')) it(`${kube ? 'Kubernetes' : 'Infrastructure'} ${type}`, () => {
            const seed=n('seed',type,kube),a=n('a',type,kube),b=n('b',type,kube),far=n('far',type,kube)
            const g=graph([seed,a,b,far],[e(a,seed,'ownership'),e(seed,b,'novel'),e(b,far,'ownership')])
            assert.deepEqual(ids(g.traverse('seed','direct')),['a','b','seed']); assert.equal(g.traverse('seed','direct').linkIDs.size,2)
        })
    }
})
describe('Infrastructure: network and common-parent barriers', () => {
    const host=n('host','host'),vm=n('ccvm','libvirt'),tap=n('tap','tuntap'),br=n('bridge','bridge'),nic=n('nic','device'),port=n('port','switchport'),sw=n('switch','switch'),other=n('other-vm','libvirt'),otherTap=n('other-tap','tuntap'),otherPort=n('other-port','switchport'),otherNIC=n('other-nic','device')
    const nodes=[host,vm,tap,br,nic,port,sw,other,otherTap,otherPort,otherNIC]
    const edges=[e(host,vm,'ownership'),e(host,tap,'ownership'),e(vm,tap,'vownership'),e(tap,vm,'vlayer2'),e(br,tap,'layer2'),e(br,nic,'layer2'),e(host,nic,'ownership'),e(port,nic,'manual'),e(sw,port,'ownership'),e(sw,port,'layer2'),e(br,otherTap,'layer2'),e(other,otherTap,'vownership'),e(host,other,'ownership'),e(sw,otherPort,'ownership'),e(otherPort,otherNIC,'layer2')]
    it('CCVM direct includes host and NIC; all follows its actual bridge/NIC/manual switch uplink only',()=>{
        const g=graph(nodes,edges)
        assert.deepEqual(ids(g.traverse(vm.id,'direct')),['ccvm','host','tap'])
        assert.deepEqual(ids(g.traverse(vm.id,'all')),['bridge','ccvm','host','nic','port','switch','tap'])
        assert.ok(g.traverse(vm.id,'all').linkIDs.has(e(port,nic,'manual').id))
    })
    it('a host/switch anchor can expand its branches, while a reached common parent cannot',()=>{
        const g=graph(nodes,edges)
        assert.ok(g.traverse(host.id,'all').nodeIDs.has(other.id)); assert.ok(g.traverse(sw.id,'all').nodeIDs.has(otherNIC.id))
        assert.ok(!g.traverse(vm.id,'all').nodeIDs.has(other.id)); assert.ok(!g.traverse(vm.id,'all').nodeIDs.has(otherNIC.id))
    })
    it('SR-IOV VF/PF edges retain their declared direction and do not leak into sibling VFs',()=>{
        const vf=n('vf','device'),pf=n('pf','device'),otherVF=n('other-vf','device')
        const g=graph([vf,pf,otherVF],[e(pf,vf,'vf'),e(pf,otherVF,'vf')])
        assert.deepEqual(ids(g.traverse('vf','all')),['pf','vf'])
        assert.deepEqual(ids(g.traverse('pf','all')),['other-vf','pf','vf'])
    })
    it('follows VLAN uplinks but cannot fan from a reached physical NIC into other VLANs',()=>{
        const vlan=n('vlan','vlan'),vb=n('vb','bridge'),extra=n('extra','vlan')
        const g=graph([...nodes,vlan,vb,extra],[e(vm,tap,'vlayer2'),e(tap,vb,'layer2'),e(vb,vlan,'layer2'),e(vlan,nic,'layer2'),e(nic,extra,'layer2')])
        assert.deepEqual(ids(g.traverse(vm.id,'all')),['ccvm','nic','tap','vb','vlan']); assert.ok(g.traverse(nic.id,'all').nodeIDs.has(extra.id))
    })
})
describe('Kubernetes: ownership, references and scheduling are not communication paths',()=>{
    const cl=n('cluster','cluster',true),ns=n('ns','namespace',true),d=n('deployment','deployment',true),rs=n('rs','replicaset',true),p=n('pod','pod',true),sibling=n('sibling','pod',true),other=n('other','deployment',true),node=n('node','node',true),otherNode=n('other-node','node',true),svc=n('service','service',true),ing=n('ingress','ingress',true),pvc=n('pvc','persistentvolumeclaim',true),pv=n('pv','persistentvolume',true),sc=n('sc','storageclass',true),cm=n('config','configmap',true)
    const nodes=[cl,ns,d,rs,p,sibling,other,node,otherNode,svc,ing,pvc,pv,sc,cm]
    const edges=[e(cl,ns,'ownership'),e(cl,node,'ownership'),e(ns,d,'ownership'),e(ns,p,'ownership'),e(ns,other,'ownership'),e(d,rs,'deployment'),e(rs,p,'replicaset'),e(rs,sibling,'replicaset'),e(node,p,'node'),e(otherNode,sibling,'node'),e(svc,p,'service'),e(svc,sibling,'service'),e(ing,svc,'ingress'),e(p,pvc,'pod'),e(sibling,pvc,'pod'),e(pvc,pv,'persistentvolumeclaim'),e(sc,pvc,'storageclass'),e(p,cm,'pod')]
    it('Pod direct uses graph hops, not rendered Deployment shortcuts or cluster ancestry',()=>assert.deepEqual(ids(graph(nodes,edges).traverse('pod','direct')),['config','node','ns','pod','pvc','rs','service']))
    it('Pod all resolves owner chain, storage and references without siblings or common-parent fan-out',()=>{
        const result=graph(nodes,edges).traverse('pod','all')
        for(const id of ['deployment','rs','cluster','ns','pv','node','service','ingress','config'])assert.ok(result.nodeIDs.has(id),id)
        for(const id of ['sibling','other-node','other'])assert.ok(!result.nodeIDs.has(id),id)
    })
    it('controller, namespace, cluster and Service anchors expand their confirmed children; Node only its own Pods',()=>{
        const g=graph(nodes,edges)
        for(const seed of ['deployment','ns','cluster','service'])assert.ok(g.traverse(seed,'all').nodeIDs.has('sibling'),seed)
        const fromNode=g.traverse('node','all');assert.ok(fromNode.nodeIDs.has('deployment'));assert.ok(fromNode.nodeIDs.has('pv'));assert.ok(!fromNode.nodeIDs.has('sibling'))
        assert.ok(!g.traverse('service','all').nodeIDs.has('other'))
    })
    it('a shared PVC is a reference barrier unless it is itself the selected object',()=>{
        const g=graph(nodes,edges);assert.ok(!g.traverse('pod','all').nodeIDs.has('sibling'));assert.ok(g.traverse('pvc','all').nodeIDs.has('sibling'));assert.ok(g.traverse('pvc','all').nodeIDs.has('pv'))
    })
    for(const [a,b,r,kind] of [['cronjob','job','cronjob','owner'],['job','pod','job','owner'],['daemonset','pod','daemonset','owner'],['statefulset','pod','statefulset','owner'],['replicationcontroller','pod','replicationcontroller','owner'],['service','endpoints','service','reference'],['service','endpointslice','service','reference'],['pod','secret','pod','reference'],['pod','serviceaccount','pod','reference'],['networkpolicy','pod','networkpolicy','reference'],['horizontalpodautoscaler','deployment','horizontalpodautoscaler','reference'],['poddisruptionbudget','pod','poddisruptionbudget','reference'],['persistentvolume','node','persistentvolume','placement']])it(`${a} → ${b}: ${kind}`,()=>assert.equal(connectionRelationKind(e(n('a',a,true),n('b',b,true),r)),kind))
    it('does not cross into a hosting infrastructure subtree or another cluster',()=>{
        const host=n('host','host'),vm=n('vm','libvirt'),foreign=n('foreign','pod',true,{ClusterName:'b'})
        const g=graph([...nodes,host,vm,foreign],[...edges,e(host,node,'node'),e(host,vm,'ownership'),e(svc,foreign,'service')])
        assert.ok(!g.traverse('pod','all').nodeIDs.has('vm'));assert.ok(g.traverse('host','all').nodeIDs.has('node'));assert.ok(!g.traverse('host','all').nodeIDs.has('pod'));assert.ok(!g.traverse('service','direct').nodeIDs.has('foreign'))
    })
    it('rejects known stale PV bindings and old-claim UID references',()=>{
        for(const data of [{K8s:{Extra:{Status:{Phase:'Released'}}}},{K8s:{Extra:{Spec:{ClaimRef:{UID:'old'}}}}}]){
            const a=n('a','persistentvolumeclaim',true,{K8s:{UID:'current'}}),b=n('b','persistentvolume',true,data)
            assert.deepEqual(ids(graph([a,b],[e(a,b,'persistentvolumeclaim')]).traverse('a','direct')),['a'])
        }
    })
})
describe('Incomplete evidence and bounded traversal',()=>{
    it('never invents name/IP/group relationships or treats missing edges as proof of disconnection',()=>{
        const a=n('a','libvirt',false,{Name:'same',IP:'1.2.3.4'}),b=n('b','libvirt',false,{Name:'same',IP:'1.2.3.4'}),group=n('group','host',false,{IsTopologyGroup:true})
        assert.deepEqual(ids(graph([a,b,group],[e(group,a,'ownership')]).traverse('a','all')),['a'])
    })
    it('unclassified relationships are direct only',()=>{
        const a=n('a','unknown'),b=n('b','unknown'),c=n('c','unknown'),g=graph([a,b,c],[e(a,b,'novel'),e(b,c,'novel')]);const result=g.traverse('a','all');assert.deepEqual(ids(result),['a','b']);assert.equal(result.unknownRelations,1)
    })
    it('expires LLDP while keeping manual mappings and null expiry evidence',()=>{
        const a=n('a','device'),b=n('b','switchport'),c=n('c','switchport'),d=n('d','device');const result=graph([a,b,c,d],[e(a,b,'layer2',{LLDP:{ExpiresAt:5}}),e(a,c,'manual'),e(a,d,'layer2',{LLDP:{ExpiresAt:null}})]).traverse('a','direct',{now:10});assert.deepEqual(ids(result),['a','c','d'])
    })
    it('stops long equal-tier chains at the depth bound without recursion',()=>{
        const nodes=Array.from({length:100},(_,i)=>n(String(i),'device')),edges=nodes.slice(1).map((node,i)=>e(nodes[i],node,'layer2'))
        const result=graph(nodes,edges).traverse('0','all',{depth:5});assert.ok(result.truncated);assert.ok(result.nodeIDs.size<=6)
    })
    it('bounds high-degree graphs, cycles, duplicate visits and depth with an explicit partial-result flag',()=>{
        const nodes=Array.from({length:2000},(_,i)=>n(String(i),'device')),edges=nodes.slice(1).map(node=>e(nodes[0],node,'layer2'));edges.push(e(nodes[1],nodes[2],'layer2'))
        const result=graph(nodes,edges).traverse('0','all',{nodes:30,edges:100});assert.ok(result.truncated);assert.ok(result.nodeIDs.size<=30);assert.ok(result.examined<=101)
    })
})

import { useState, useEffect } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { api } from '../lib/api'

const C = {
  green:'#00c896', teal:'#008B87', deep:'#036271',
  bg:'#02100c', panel:'#061812', border:'#0d3828',
  text:'#d0f0e4', muted:'#3a8a62', red:'#ff3f5a', amber:'#ffb800', input:'#0a2018',
}

const Panel = ({children,style})=><div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:18,...style}}>{children}</div>
const Sec = ({children,style})=><div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.teal,textTransform:'uppercase',marginBottom:12,fontFamily:"'Righteous',sans-serif",...style}}>{children}</div>
const Btn = ({children,onClick,variant='primary',size='md',style})=>{
  const sz={sm:{fontSize:11,padding:'4px 10px'},md:{fontSize:12,padding:'7px 14px'}}[size]
  const v={primary:{background:`linear-gradient(135deg,${C.green},${C.teal})`,color:'#02100c',border:'none'},ghost:{background:'transparent',color:C.muted,border:`1px solid ${C.border}`},teal:{background:`${C.teal}18`,color:C.teal,border:`1px solid ${C.teal}44`}}[variant]||{}
  return <button onClick={onClick} style={{borderRadius:7,cursor:'pointer',fontFamily:"'Righteous',sans-serif",fontWeight:700,transition:'all .2s',...sz,...v,...style}}>{children}</button>
}

const StatusBadge = ({status})=>{
  const m={up:[C.green,'#001a10','ONLINE'],warning:[C.amber,'#1a0f00','ALERTA'],down:[C.red,'#1a0008','OFFLINE']}
  const [col,bg,lbl]=m[status]||['#555','#111',status]
  return <span style={{fontSize:10,fontWeight:700,letterSpacing:1,padding:'2px 8px',borderRadius:4,color:col,background:bg,border:`1px solid ${col}33`}}>{lbl}</span>
}

function StatCard({label,value,sub,color,small}){
  return (
    <div style={{background:C.bg,borderRadius:8,padding:'12px 14px'}}>
      <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{label}</div>
      <div style={{fontSize:small?16:22,fontWeight:800,color:color||C.text,fontFamily:"'Righteous',sans-serif"}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{sub}</div>}
    </div>
  )
}

function LinkCard({link,selected,onSelect}){
  const col = link.status==='up'?C.green:link.status==='warning'?C.amber:C.red
  const utilIn  = Math.min(100, (link.in/(link.bw_mbps/1000))*100)
  const utilOut = Math.min(100, (link.out/(link.bw_mbps/1000))*100)

  return (
    <div onClick={()=>onSelect(link)} style={{
      background:C.panel, border:`1px solid ${selected?col:C.border}`,
      borderLeft:`4px solid ${col}`, borderRadius:10, padding:16, cursor:'pointer',
      transition:'all .2s', boxShadow:selected?`0 0 0 1px ${col}33`:undefined,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <div style={{fontFamily:"'Righteous',sans-serif",fontSize:14,color:C.text}}>{link.name}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{link.provider} · {link.bw}{link.bwUnit}bps · {link.asnPeer||'—'}</div>
        </div>
        <StatusBadge status={link.status}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="IN"       value={`${(link.in||0).toFixed(2)}G`}  color={C.green} small/>
        <StatCard label="OUT"      value={`${(link.out||0).toFixed(2)}G`} color={C.teal}  small/>
        <StatCard label="LATÊNCIA" value={`${link.lat||0}ms`}            color={link.lat>50?C.amber:C.green} small/>
        <StatCard label="PERDA"    value={`${(link.loss||0).toFixed(1)}%`} color={(link.loss||0)>1?C.red:C.green} small/>
      </div>

      {/* Utilização */}
      <div style={{marginBottom:8}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <span style={{fontSize:10,color:C.muted}}>Utilização IN</span>
          <span style={{fontSize:10,color:utilIn>80?C.red:utilIn>60?C.amber:C.green}}>{utilIn.toFixed(0)}%</span>
        </div>
        <div style={{height:4,background:'#ffffff12',borderRadius:2,overflow:'hidden'}}>
          <div style={{width:`${utilIn}%`,height:'100%',background:utilIn>80?C.red:utilIn>60?C.amber:C.green,transition:'width .5s'}}/>
        </div>
      </div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <span style={{fontSize:10,color:C.muted}}>Utilização OUT</span>
          <span style={{fontSize:10,color:utilOut>80?C.red:utilOut>60?C.amber:C.teal}}>{utilOut.toFixed(0)}%</span>
        </div>
        <div style={{height:4,background:'#ffffff12',borderRadius:2,overflow:'hidden'}}>
          <div style={{width:`${utilOut}%`,height:'100%',background:utilOut>80?C.red:utilOut>60?C.amber:C.teal,transition:'width .5s'}}/>
        </div>
      </div>

      {link.availability!==undefined && (
        <div style={{marginTop:10,fontSize:11,color:C.muted,display:'flex',justifyContent:'space-between'}}>
          <span>Disponibilidade: <span style={{color:link.availability>99?C.green:link.availability>95?C.amber:C.red,fontWeight:700}}>{link.availability}%</span></span>
          <span>P95 lat: <span style={{color:C.teal}}>{link.avg_latency}ms</span></span>
        </div>
      )}
    </div>
  )
}

function LinkDetail({link}){
  const [period,setPeriod] = useState(6)

  if (!link) return (
    <Panel style={{display:'flex',alignItems:'center',justifyContent:'center',height:300}}>
      <div style={{textAlign:'center',color:C.muted}}>
        <div style={{fontSize:32,marginBottom:8}}>📡</div>
        <div>Selecione um link para ver o histórico</div>
      </div>
    </Panel>
  )

  const history = link.history || []

  return (
    <Panel style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontFamily:"'Righteous',sans-serif",fontSize:16,color:C.text}}>{link.name}</div>
          <div style={{fontSize:12,color:C.muted}}>{link.provider} · {link.ip||'—'}</div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {[1,3,6,24].map(h=>(
            <Btn key={h} onClick={()=>setPeriod(h)} variant={period===h?'primary':'ghost'} size="sm">{h}h</Btn>
          ))}
        </div>
      </div>

      {/* Latência */}
      <div>
        <Sec style={{marginBottom:8}}>Latência (ms)</Sec>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={history} margin={{top:4,right:8,bottom:0,left:-10}}>
            <defs>
              <linearGradient id="glat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.teal} stopOpacity={.4}/>
                <stop offset="100%" stopColor={C.teal} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
            <XAxis dataKey="ts" tick={{fill:C.muted,fontSize:9}} tickLine={false} interval={Math.floor(history.length/6)}/>
            <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} tickFormatter={v=>`${v}ms`}/>
            <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}
              formatter={v=>[`${v?.toFixed(1)}ms`,'Latência']}/>
            <ReferenceLine y={50} stroke={C.amber} strokeDasharray="4 4" strokeWidth={1}/>
            <Area type="monotone" dataKey="latency" stroke={C.teal} strokeWidth={2} fill="url(#glat)" dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Perda */}
      <div>
        <Sec style={{marginBottom:8}}>Perda de Pacotes (%)</Sec>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={history} margin={{top:4,right:8,bottom:0,left:-10}}>
            <defs>
              <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.red} stopOpacity={.4}/>
                <stop offset="100%" stopColor={C.red} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
            <XAxis dataKey="ts" tick={{fill:C.muted,fontSize:9}} tickLine={false} interval={Math.floor(history.length/6)}/>
            <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} tickFormatter={v=>`${v}%`}/>
            <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}
              formatter={v=>[`${v?.toFixed(2)}%`,'Perda']}/>
            <ReferenceLine y={1} stroke={C.amber} strokeDasharray="4 4" strokeWidth={1}/>
            <Area type="monotone" dataKey="loss" stroke={C.red} strokeWidth={2} fill="url(#gloss)" dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tráfego */}
      <div>
        <Sec style={{marginBottom:8}}>Tráfego IN/OUT</Sec>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={history} margin={{top:4,right:8,bottom:0,left:-10}}>
            <defs>
              <linearGradient id="gin2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.green} stopOpacity={.35}/><stop offset="100%" stopColor={C.green} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gout2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.teal} stopOpacity={.35}/><stop offset="100%" stopColor={C.teal} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
            <XAxis dataKey="ts" tick={{fill:C.muted,fontSize:9}} tickLine={false} interval={Math.floor(history.length/6)}/>
            <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} tickFormatter={v=>`${(v/1e9).toFixed(1)}G`}/>
            <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}
              formatter={(v,n)=>[`${(v/1e9).toFixed(2)} Gbps`,n==='in_bps'?'IN':'OUT']}/>
            <Area type="monotone" dataKey="in_bps"  stroke={C.green} strokeWidth={1.5} fill="url(#gin2)"  dot={false} isAnimationActive={false}/>
            <Area type="monotone" dataKey="out_bps" stroke={C.teal}  strokeWidth={1.5} fill="url(#gout2)" dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
        <StatCard label="Lat. média"  value={`${link.avg_latency||link.lat||0}ms`} color={C.teal}  small/>
        <StatCard label="Lat. máx"   value={`${link.max_latency||0}ms`}           color={C.amber} small/>
        <StatCard label="Perda média" value={`${link.avg_loss||0}%`}              color={link.avg_loss>1?C.red:C.green} small/>
        <StatCard label="Disponib."  value={`${link.availability||99.9}%`}        color={C.green} small/>
      </div>
    </Panel>
  )
}

export default function LinksPage({ toast }) {
  const [links,setLinks]     = useState([])
  const [selected,setSelected] = useState(null)
  const [loading,setLoading] = useState(true)
  const [totalIn,setTotalIn] = useState(0)
  const [totalOut,setTotalOut] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getLinksMetrics()
      setLinks(data)
      setTotalIn(data.reduce((s,l)=>s+(l.in||0),0))
      setTotalOut(data.reduce((s,l)=>s+(l.out||0),0))
      if (data.length > 0 && !selected) setSelected(data[0])
    } catch(e) {
      // Fallback para API básica
      try {
        const data = await api.getLinks()
        setLinks(data)
        setTotalIn(data.reduce((s,l)=>s+(l.in||0),0))
        setTotalOut(data.reduce((s,l)=>s+(l.out||0),0))
        if (data.length > 0) setSelected(data[0])
      } catch(e2) { toast('Erro ao carregar links','error') }
    }
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  // Atualiza o link selecionado quando os dados mudam
  useEffect(()=>{
    if (selected) setSelected(links.find(l=>l.id===selected.id)||selected)
  },[links])

  const up      = links.filter(l=>l.status==='up').length
  const warning = links.filter(l=>l.status==='warning').length
  const down    = links.filter(l=>l.status==='down').length
  const avgLoss = links.length>0 ? links.reduce((s,l)=>s+(l.loss||0),0)/links.length : 0
  const avgLat  = links.length>0 ? links.reduce((s,l)=>s+(l.lat||0),0)/links.length  : 0

  if (loading) return <div style={{padding:40,textAlign:'center',color:C.muted}}>Carregando links...</div>

  if (links.length === 0) return (
    <Panel style={{padding:40,textAlign:'center'}}>
      <div style={{fontSize:32,marginBottom:12}}>📡</div>
      <div style={{color:C.text,marginBottom:8,fontFamily:"'Righteous',sans-serif",fontSize:16}}>Nenhum link cadastrado</div>
      <div style={{color:C.muted,fontSize:13}}>Vá em <strong>Links</strong> no menu e adicione seus uplinks.</div>
    </Panel>
  )

  return (
    <div>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
        {[
          {l:'Links Online', v:`${up}/${links.length}`, c:C.green},
          {l:'Alertas',      v:warning,                  c:C.amber},
          {l:'Offline',      v:down,                     c:C.red},
          {l:'IN Total',     v:`${totalIn.toFixed(2)}G`, c:'#00e8c8'},
          {l:'OUT Total',    v:`${totalOut.toFixed(2)}G`,c:C.teal},
          {l:'Lat. média',   v:`${avgLat.toFixed(0)}ms`, c:avgLat>50?C.amber:C.green},
          {l:'Perda média',  v:`${avgLoss.toFixed(2)}%`, c:avgLoss>1?C.red:C.green},
        ].map((k,i)=>(
          <Panel key={i} style={{padding:'12px 14px'}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{k.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"'Righteous',sans-serif"}}>{k.v}</div>
          </Panel>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'380px 1fr',gap:14}}>
        {/* Lista de links */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{links.length} links · clique para ver histórico</span>
            <Btn onClick={load} variant="ghost" size="sm">↻</Btn>
          </div>
          {links.map(l=>(
            <LinkCard key={l.id} link={l} selected={selected?.id===l.id} onSelect={setSelected}/>
          ))}
        </div>

        {/* Detalhe do link selecionado */}
        <LinkDetail link={selected}/>
      </div>
    </div>
  )
}

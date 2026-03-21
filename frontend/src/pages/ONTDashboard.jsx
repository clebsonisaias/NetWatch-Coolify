import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api'

const C = {
  green:'#00c896', teal:'#008B87', bg:'#02100c', panel:'#061812',
  border:'#0d3828', text:'#d0f0e4', muted:'#3a8a62', red:'#ff3f5a', amber:'#ffb800',
}

const Panel = ({children,style})=><div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:18,...style}}>{children}</div>
const Sec = ({children})=><div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.teal,textTransform:'uppercase',marginBottom:12,fontFamily:"'Righteous',sans-serif"}}>{children}</div>

function OLTCard({ olt, onSelect, selected }) {
  const avail = olt.availability || 0
  const col = avail >= 99 ? C.green : avail >= 95 ? C.amber : C.red
  const offlinePct = olt.total > 0 ? (olt.offline / olt.total * 100).toFixed(1) : 0

  return (
    <div onClick={() => onSelect(olt)} style={{
      background: C.panel, border: `1px solid ${selected ? col : C.border}`,
      borderLeft: `4px solid ${col}`, borderRadius: 10, padding: 16,
      cursor: 'pointer', transition: 'all .2s',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <div style={{fontFamily:"'Righteous',sans-serif",fontSize:14,color:C.text}}>{olt.device_name}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{olt.model} · {olt.ip}</div>
          <div style={{fontSize:10,color:C.muted}}>{olt.location}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontFamily:"'Righteous',sans-serif",fontSize:22,color:col}}>{avail}%</div>
          <div style={{fontSize:10,color:C.muted}}>disponível</div>
        </div>
      </div>

      {/* ONT counters */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,marginBottom:12}}>
        {[
          ['Total',   olt.total,   C.teal],
          ['Online',  olt.online,  C.green],
          ['Offline', olt.offline, C.red],
          ['LOS',     olt.los,     C.amber],
        ].map(([l,v,c],i)=>(
          <div key={i} style={{background:C.bg,borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
            <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{l}</div>
            <div style={{fontSize:18,fontWeight:800,color:c,fontFamily:"'Righteous',sans-serif"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Offline progress bar */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <span style={{fontSize:10,color:C.muted}}>ONTs offline</span>
          <span style={{fontSize:10,color:olt.offline>0?C.red:C.green}}>{offlinePct}%</span>
        </div>
        <div style={{height:4,background:'#ffffff12',borderRadius:2,overflow:'hidden'}}>
          <div style={{width:`${offlinePct}%`,height:'100%',background:C.red,transition:'width .5s'}}/>
        </div>
      </div>

      {olt.power_issues > 0 && (
        <div style={{marginTop:8,padding:'6px 10px',background:`${C.amber}15`,borderRadius:4,fontSize:11,color:C.amber}}>
          ⚠ {olt.power_issues} ONT(s) com problema de potência óptica
        </div>
      )}
    </div>
  )
}

function OLTDetail({ olt }) {
  if (!olt) return (
    <Panel style={{display:'flex',alignItems:'center',justifyContent:'center',height:300}}>
      <div style={{textAlign:'center',color:C.muted}}>
        <div style={{fontSize:32,marginBottom:8}}>🔆</div>
        <div>Selecione uma OLT para ver o histórico de ONTs</div>
      </div>
    </Panel>
  )

  const history = olt.history || []
  const trend = history.length >= 2
    ? history[history.length-1].offline - history[0].offline : 0

  return (
    <Panel>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          <div style={{fontFamily:"'Righteous',sans-serif",fontSize:16,color:C.text}}>{olt.device_name}</div>
          <div style={{fontSize:12,color:C.muted}}>{olt.model}</div>
        </div>
        <div style={{textAlign:'right'}}>
          {trend > 5 && <div style={{fontSize:11,color:C.red}}>↑ {trend} ONTs offline nas últimas horas</div>}
          {trend < -5 && <div style={{fontSize:11,color:C.green}}>↓ {Math.abs(trend)} ONTs recuperadas</div>}
          {Math.abs(trend) <= 5 && <div style={{fontSize:11,color:C.muted}}>Estável</div>}
        </div>
      </div>

      <Sec>ONTs Online vs Offline — Últimas 24h</Sec>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={history} margin={{top:4,right:8,bottom:0,left:-10}}>
          <defs>
            <linearGradient id="gonline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.green} stopOpacity={.35}/>
              <stop offset="100%" stopColor={C.green} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="goffline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.red} stopOpacity={.5}/>
              <stop offset="100%" stopColor={C.red} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
          <XAxis dataKey="ts" tick={{fill:C.muted,fontSize:9}} tickLine={false} interval={5}/>
          <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false}/>
          <Tooltip
            contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}
            formatter={(v,n)=>[v,n==='online'?'Online':'Offline']}/>
          <Area type="monotone" dataKey="online"  stroke={C.green} strokeWidth={2} fill="url(#gonline)"  dot={false} isAnimationActive={false}/>
          <Area type="monotone" dataKey="offline" stroke={C.red}   strokeWidth={2} fill="url(#goffline)" dot={false} isAnimationActive={false}/>
        </AreaChart>
      </ResponsiveContainer>

      {/* Status breakdown */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginTop:16}}>
        <div style={{background:C.bg,borderRadius:8,padding:14}}>
          <Sec>Causas de Offline</Sec>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              ['LOS (perda óptica)',   olt.los,          C.red],
              ['Problema de energia',  olt.power_issues,  C.amber],
              ['Outros',               Math.max(0,(olt.offline||0)-(olt.los||0)-(olt.power_issues||0)), C.muted],
            ].map(([l,v,c],i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:C.muted}}>{l}</span>
                <span style={{fontSize:14,fontWeight:700,color:c,fontFamily:"'Righteous',sans-serif"}}>{v||0}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:C.bg,borderRadius:8,padding:14}}>
          <Sec>Resumo</Sec>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              ['Total de ONTs',    olt.total,        C.teal],
              ['Online agora',     olt.online,       C.green],
              ['Disponibilidade',  `${olt.availability}%`, olt.availability>=99?C.green:C.amber],
              ['Offline agora',    olt.offline,      olt.offline>0?C.red:C.green],
            ].map(([l,v,c],i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:C.muted}}>{l}</span>
                <span style={{fontSize:14,fontWeight:700,color:c,fontFamily:"'Righteous',sans-serif"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dica técnica */}
      <div style={{marginTop:12,padding:'10px 14px',background:`${C.teal}12`,borderRadius:6,fontSize:11,color:C.teal,border:`1px solid ${C.teal}22`}}>
        💡 Para ver potência óptica por ONT individualmente, execute no MA5800:
        <code style={{display:'block',marginTop:4,fontFamily:'monospace',color:C.text,background:C.bg,padding:'4px 8px',borderRadius:4}}>
          display ont optical-info 0 all
        </code>
      </div>
    </Panel>
  )
}

export default function ONTDashboard({ toast }) {
  const [olts,setOlts]       = useState([])
  const [selected,setSelected] = useState(null)
  const [loading,setLoading]  = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getONTs()
      setOlts(data)
      if (data.length > 0 && !selected) setSelected(data[0])
    } catch(e) { toast('Erro ao carregar ONTs: '+e.message,'error') }
    setLoading(false)
  }

  useEffect(()=>{ load() },[])
  useEffect(()=>{ if(selected) setSelected(olts.find(o=>o.device_id===selected.device_id)||selected) },[olts])

  const totalONTs    = olts.reduce((s,o)=>s+(o.total||0),0)
  const totalOnline  = olts.reduce((s,o)=>s+(o.online||0),0)
  const totalOffline = olts.reduce((s,o)=>s+(o.offline||0),0)
  const totalLOS     = olts.reduce((s,o)=>s+(o.los||0),0)
  const avgAvail     = olts.length>0 ? olts.reduce((s,o)=>s+(o.availability||0),0)/olts.length : 0

  if (loading) return <div style={{padding:40,textAlign:'center',color:C.muted}}>Carregando ONTs...</div>

  if (olts.length === 0) return (
    <Panel style={{padding:40,textAlign:'center'}}>
      <div style={{fontSize:32,marginBottom:12}}>🔆</div>
      <div style={{color:C.text,marginBottom:8,fontFamily:"'Righteous',sans-serif",fontSize:16}}>Nenhuma OLT Huawei cadastrada</div>
      <div style={{color:C.muted,fontSize:13}}>Adicione sua OLT Huawei MA5800 em Dispositivos com fabricante Huawei.</div>
    </Panel>
  )

  return (
    <div>
      {/* KPIs globais */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
        {[
          {l:'Total ONTs',    v:totalONTs,              c:C.teal},
          {l:'Online',        v:totalOnline,             c:C.green},
          {l:'Offline',       v:totalOffline,            c:C.red},
          {l:'LOS',           v:totalLOS,                c:C.amber},
          {l:'Disponib.',     v:`${avgAvail.toFixed(1)}%`, c:avgAvail>=99?C.green:C.amber},
          {l:'OLTs ativas',   v:olts.length,             c:C.teal},
        ].map((k,i)=>(
          <Panel key={i} style={{padding:'12px 14px'}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{k.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"'Righteous',sans-serif"}}>{k.v}</div>
          </Panel>
        ))}
      </div>

      {totalOffline > 0 && (
        <div style={{marginBottom:14,padding:'10px 16px',background:`${C.red}12`,border:`1px solid ${C.red}33`,borderRadius:8,fontSize:12,color:C.red}}>
          🔴 {totalOffline} ONTs offline agora — verifique a planta de fibra nas regiões afetadas
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:14}}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:C.muted}}>{olts.length} OLT(s) monitorada(s)</span>
            <button onClick={load} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 10px',color:C.muted,fontSize:11,cursor:'pointer',fontFamily:"'Righteous',sans-serif"}}>↻</button>
          </div>
          {olts.map(o=>(
            <OLTCard key={o.device_id} olt={o} selected={selected?.device_id===o.device_id} onSelect={setSelected}/>
          ))}
        </div>
        <OLTDetail olt={selected}/>
      </div>
    </div>
  )
}

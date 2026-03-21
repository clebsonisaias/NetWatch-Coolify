import { useState, useEffect } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api'

const C = {
  green:'#00c896', teal:'#008B87', bg:'#02100c', panel:'#061812',
  border:'#0d3828', text:'#d0f0e4', muted:'#3a8a62', red:'#ff3f5a', amber:'#ffb800',
}

const Panel = ({children,style})=><div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:16,...style}}>{children}</div>
const Sec = ({children})=><div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.teal,textTransform:'uppercase',marginBottom:10,fontFamily:"'Righteous',sans-serif"}}>{children}</div>
const Btn = ({children,onClick,variant='primary',size='sm',style})=>{
  const sz={sm:{fontSize:11,padding:'4px 10px'},md:{fontSize:12,padding:'7px 14px'}}[size]
  const v={primary:{background:`linear-gradient(135deg,${C.green},${C.teal})`,color:'#02100c',border:'none'},ghost:{background:'transparent',color:C.muted,border:`1px solid ${C.border}`}}[variant]||{}
  return <button onClick={onClick} style={{borderRadius:6,cursor:'pointer',fontFamily:"'Righteous',sans-serif",fontWeight:700,...sz,...v,...style}}>{children}</button>
}

const GBar = ({v,max=100,color})=>{
  const p = Math.min(100,(v/max)*100)
  const c = color||(p>85?C.red:p>65?C.amber:C.green)
  return (
    <div style={{height:4,background:'#ffffff10',borderRadius:2,overflow:'hidden'}}>
      <div style={{width:`${p}%`,height:'100%',background:c,transition:'width .5s'}}/>
    </div>
  )
}

export default function DeviceDetail({ device, onClose }) {
  const [history, setHistory] = useState([])
  const [ifaces,  setIfaces]  = useState({})
  const [hours,   setHours]   = useState(6)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    if (!device) return
    setLoading(true)
    Promise.all([
      api.getDeviceHistory(device.id, hours),
      api.getDeviceInterfaces(device.id, Math.min(hours, 3)),
    ]).then(([h,i])=>{ setHistory(h); setIfaces(i) })
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[device?.id, hours])

  if (!device) return null

  const VM = { mikrotik:C.green, edd:C.teal, huawei:C.deep||C.teal }
  const statusColor = s=>({up:C.green,warning:C.amber,down:C.red,unknown:'#555'})[s]||'#555'
  const lastCPU = history.length ? history[history.length-1].cpu : device.cpu||0
  const lastMEM = history.length ? history[history.length-1].mem : device.mem||0

  const ifaceNames = Object.keys(ifaces)

  return (
    <div style={{position:'fixed',inset:0,background:'#000000d0',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'flex-end',padding:16}} onClick={onClose}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,width:'100%',maxWidth:700,height:'calc(100vh - 32px)',overflowY:'auto',display:'flex',flexDirection:'column',gap:14,padding:20}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
              <span style={{fontFamily:"'Righteous',sans-serif",fontSize:20,color:C.text}}>{device.name}</span>
              <span style={{width:10,height:10,borderRadius:'50%',background:statusColor(device.status),boxShadow:`0 0 8px ${statusColor(device.status)}`,display:'inline-block'}}/>
            </div>
            <div style={{fontSize:12,color:C.muted}}>{device.vendor?.toUpperCase()} · {device.model} · {device.ip}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{device.location}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>✕</button>
        </div>

        {/* Current stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Panel style={{padding:14}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>CPU</div>
            <div style={{fontFamily:"'Righteous',sans-serif",fontSize:28,color:lastCPU>70?C.red:lastCPU>50?C.amber:C.green,marginBottom:8}}>{lastCPU.toFixed(0)}%</div>
            <GBar v={lastCPU}/>
          </Panel>
          <Panel style={{padding:14}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Memória</div>
            <div style={{fontFamily:"'Righteous',sans-serif",fontSize:28,color:lastMEM>80?C.red:lastMEM>60?C.amber:C.green,marginBottom:8}}>{lastMEM.toFixed(0)}%</div>
            <GBar v={lastMEM}/>
          </Panel>
        </div>

        {/* Period selector */}
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:11,color:C.muted,marginRight:4}}>Período:</span>
          {[1,3,6,24].map(h=>(
            <Btn key={h} onClick={()=>setHours(h)} variant={hours===h?'primary':'ghost'}>{h}h</Btn>
          ))}
          {loading && <span style={{fontSize:11,color:C.muted,marginLeft:8}}>Carregando...</span>}
        </div>

        {/* CPU History */}
        <Panel>
          <Sec>CPU — histórico {hours}h</Sec>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={history} margin={{top:4,right:8,bottom:0,left:-20}}>
              <defs>
                <linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity={.4}/>
                  <stop offset="100%" stopColor={C.green} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
              <XAxis dataKey="ts" tick={{fill:C.muted,fontSize:9}} tickLine={false} interval={Math.floor(history.length/8)}/>
              <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}
                formatter={v=>[`${v?.toFixed(1)}%`,'CPU']}/>
              <Area type="monotone" dataKey="cpu" stroke={C.green} strokeWidth={2} fill="url(#gcpu)" dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Memory History */}
        <Panel>
          <Sec>Memória — histórico {hours}h</Sec>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={history} margin={{top:4,right:8,bottom:0,left:-20}}>
              <defs>
                <linearGradient id="gmem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.teal} stopOpacity={.4}/>
                  <stop offset="100%" stopColor={C.teal} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
              <XAxis dataKey="ts" tick={{fill:C.muted,fontSize:9}} tickLine={false} interval={Math.floor(history.length/8)}/>
              <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}
                formatter={v=>[`${v?.toFixed(1)}%`,'Memória']}/>
              <Area type="monotone" dataKey="mem" stroke={C.teal} strokeWidth={2} fill="url(#gmem)" dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Interfaces */}
        {ifaceNames.length > 0 && (
          <Panel>
            <Sec>Interfaces — tráfego (último {Math.min(hours,3)}h)</Sec>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {ifaceNames.slice(0,4).map(name=>{
                const data = ifaces[name] || []
                const lastRx = data.length ? data[data.length-1].rx_bps : 0
                const lastTx = data.length ? data[data.length-1].tx_bps : 0
                return (
                  <div key={name}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:12,color:C.text,fontFamily:'monospace'}}>{name}</span>
                      <span style={{fontSize:11,color:C.muted}}>
                        ↓ {(lastRx/1e6).toFixed(0)}M · ↑ {(lastTx/1e6).toFixed(0)}M
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={50}>
                      <AreaChart data={data} margin={{top:0,right:0,bottom:0,left:0}}>
                        <defs>
                          <linearGradient id={`gi${name}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.teal} stopOpacity={.4}/>
                            <stop offset="100%" stopColor={C.teal} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis hide dataKey="ts"/>
                        <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:10}}
                          formatter={(v,n)=>[`${(v/1e6).toFixed(1)} Mbps`,n==='rx_bps'?'RX':'TX']}/>
                        <Area type="monotone" dataKey="rx_bps" stroke={C.green} strokeWidth={1} fill={`url(#gi${name})`} dot={false} isAnimationActive={false}/>
                        <Area type="monotone" dataKey="tx_bps" stroke={C.teal}  strokeWidth={1} fill="none" dot={false} isAnimationActive={false}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )
              })}
            </div>
          </Panel>
        )}

        {/* Device info */}
        <Panel>
          <Sec>Informações</Sec>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12}}>
            {[
              ['IP',         device.ip],
              ['Modelo',     device.model||'—'],
              ['Fabricante', device.vendor?.toUpperCase()],
              ['Localização',device.location||'—'],
              ['Uptime',     device.uptime||'—'],
              ['Último ping',device.last_seen ? new Date(device.last_seen).toLocaleTimeString('pt-BR') : '—'],
              ['Feature',    device.feature||'—'],
              ['Protocolo',  device.vendor==='mikrotik'?'RouterOS API :8728':device.vendor==='edd'?'SNMP :161':'NETCONF :830'],
            ].map(([k,v],i)=>(
              <div key={i} style={{display:'flex',gap:8}}>
                <span style={{color:C.muted,minWidth:80}}>{k}:</span>
                <span style={{color:C.text,fontFamily:k==='IP'?'monospace':'inherit'}}>{v}</span>
              </div>
            ))}
          </div>
          {device.notes && (
            <div style={{marginTop:10,fontSize:11,color:C.muted,fontStyle:'italic',borderTop:`1px solid ${C.border}`,paddingTop:8}}>
              {device.notes}
            </div>
          )}
        </Panel>

      </div>
    </div>
  )
}

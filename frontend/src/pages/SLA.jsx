import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { api } from '../lib/api'

const C = {
  green:'#00c896', teal:'#008B87', bg:'#02100c', panel:'#061812',
  border:'#0d3828', text:'#d0f0e4', muted:'#3a8a62', red:'#ff3f5a', amber:'#ffb800', input:'#0a2018',
}

const Panel = ({children,style})=><div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:18,...style}}>{children}</div>
const Sec = ({children,style})=><div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.teal,textTransform:'uppercase',marginBottom:12,fontFamily:"'Righteous',sans-serif",...style}}>{children}</div>
const Btn = ({children,onClick,variant='primary',size='md',disabled,style})=>{
  const sz={sm:{fontSize:11,padding:'4px 10px'},md:{fontSize:12,padding:'7px 14px'}}[size]
  const v={primary:{background:`linear-gradient(135deg,${C.green},${C.teal})`,color:'#02100c',border:'none'},ghost:{background:'transparent',color:C.muted,border:`1px solid ${C.border}`},danger:{background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}44`},teal:{background:`${C.teal}18`,color:C.teal,border:`1px solid ${C.teal}44`}}[variant]||{}
  return <button onClick={onClick} disabled={disabled} style={{borderRadius:7,cursor:'pointer',fontFamily:"'Righteous',sans-serif",fontWeight:700,...sz,...v,...style}}>{children}</button>
}

// ─── SLA Table ────────────────────────────────────────────────────────────────
function SLATable({ sla, days, setDays }) {
  const VM = { mikrotik:'#00c896', edd:'#008B87', huawei:'#036271' }
  return (
    <Panel>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <Sec style={{marginBottom:0}}>SLA por Dispositivo</Sec>
        <div style={{display:'flex',gap:6}}>
          {[7,30,90].map(d=>(
            <Btn key={d} onClick={()=>setDays(d)} variant={days===d?'primary':'ghost'} size="sm">{d}d</Btn>
          ))}
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{color:C.muted,fontSize:10,letterSpacing:1}}>
              {['DISPOSITIVO','LOCAL','STATUS','UPTIME %','DOWNTIME','INCIDENTES','SLA'].map((h,i)=>(
                <th key={i} style={{textAlign:'left',padding:'5px 10px',borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sla.map((s,i)=>{
              const col = s.uptime_pct>=99.5?C.green:s.uptime_pct>=95?C.amber:C.red
              const vc  = VM[s.vendor]||C.muted
              return (
                <tr key={i} style={{borderBottom:`1px solid ${C.border}55`,transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#0a2018'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'9px 10px'}}>
                    <span style={{fontSize:10,padding:'2px 6px',borderRadius:3,border:`1px solid ${vc}44`,color:vc,fontWeight:700,marginRight:6}}>{s.vendor?.toUpperCase()}</span>
                    <span style={{color:C.text,fontWeight:600}}>{s.device_name}</span>
                  </td>
                  <td style={{padding:'9px 10px',color:C.muted}}>{s.location||'—'}</td>
                  <td style={{padding:'9px 10px'}}>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:`${s.status==='up'?C.green:C.red}15`,color:s.status==='up'?C.green:C.red}}>
                      {s.status==='up'?'UP':'DOWN'}
                    </span>
                  </td>
                  <td style={{padding:'9px 10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:60,height:4,background:'#ffffff12',borderRadius:2,overflow:'hidden'}}>
                        <div style={{width:`${s.uptime_pct}%`,height:'100%',background:col}}/>
                      </div>
                      <span style={{fontWeight:700,color:col,fontFamily:'monospace'}}>{s.uptime_pct}%</span>
                    </div>
                  </td>
                  <td style={{padding:'9px 10px',color:s.downtime_min>60?C.red:C.muted,fontFamily:'monospace'}}>
                    {s.downtime_min>=60?`${(s.downtime_min/60).toFixed(1)}h`:`${s.downtime_min}min`}
                  </td>
                  <td style={{padding:'9px 10px',color:s.incidents>5?C.red:s.incidents>0?C.amber:C.green,fontWeight:700,fontFamily:'monospace'}}>{s.incidents}</td>
                  <td style={{padding:'9px 10px'}}>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:s.sla_ok?`${C.green}15`:`${C.red}15`,color:s.sla_ok?C.green:C.red,fontWeight:700}}>
                      {s.sla_ok?'✓ OK':'✗ BREACH'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

// ─── PPPoE Panel ──────────────────────────────────────────────────────────────
function PPPoEPanel({ pppoe }) {
  if (!pppoe.length) return null
  return (
    <Panel>
      <Sec>Sessões PPPoE — Mikrotik</Sec>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:14}}>
        {pppoe.map(p=>(
          <div key={p.device_id} style={{background:C.bg,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <div style={{fontFamily:"'Righteous',sans-serif",fontSize:13,color:C.text}}>{p.device_name}</div>
                <div style={{fontSize:10,color:C.muted}}>{p.ip}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'Righteous',sans-serif",fontSize:22,color:C.green}}>{p.active}</div>
                <div style={{fontSize:10,color:C.muted}}>ativos</div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,fontSize:11}}>
              <span style={{color:C.muted}}>Pico hoje: <span style={{color:C.amber,fontWeight:700}}>{p.peak_today}</span></span>
              <span style={{color:C.muted}}>Util: <span style={{color:C.teal,fontWeight:700}}>{p.peak_today>0?Math.round(p.active/p.peak_today*100):100}%</span></span>
            </div>
            <ResponsiveContainer width="100%" height={70}>
              <AreaChart data={p.history||[]} margin={{top:0,right:0,bottom:0,left:0}}>
                <defs>
                  <linearGradient id={`gp${p.device_id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.green} stopOpacity={.4}/>
                    <stop offset="100%" stopColor={C.green} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="ts" hide/>
                <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={v=>[v,'Sessões']}/>
                <Area type="monotone" dataKey="active" stroke={C.green} strokeWidth={1.5} fill={`url(#gp${p.device_id})`} dot={false} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ─── Alert Rules ─────────────────────────────────────────────────────────────
function AlertRulesPanel({ toast, role }) {
  const [rules,setRules] = useState([])
  const [form,setForm]   = useState(false)
  const [f,setF]         = useState({name:'',metric:'cpu',operator:'>',threshold:80,duration_min:5,level:'warning',notify_wa:true,notify_tg:false})

  useEffect(()=>{ api.getAlertRules().then(setRules).catch(()=>{}) },[])

  const save = async () => {
    try {
      const r = await api.createAlertRule(f)
      setRules(p=>[...p,r]); setForm(false)
      toast('Regra criada!')
    } catch(e) { toast(e.message,'error') }
  }

  const del = async (id) => {
    try {
      await api.deleteAlertRule(id)
      setRules(p=>p.filter(r=>r.id!==id))
      toast('Regra removida.','warn')
    } catch(e) { toast(e.message,'error') }
  }

  const METRICS = [
    {value:'cpu',label:'CPU (%)'},
    {value:'mem',label:'Memória (%)'},
    {value:'loss',label:'Perda de Pacotes (%)'},
    {value:'latency',label:'Latência (ms)'},
    {value:'ont_offline',label:'ONTs Offline (qtd)'},
    {value:'pppoe_drop',label:'Queda de PPPoE (qtd)'},
  ]

  const set = k => v => setF(p=>({...p,[k]:v}))

  return (
    <Panel>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <Sec style={{marginBottom:0}}>Regras de Alertas</Sec>
        {role==='admin' && <Btn onClick={()=>setForm(p=>!p)} size="sm">{form?'Cancelar':'+ Nova Regra'}</Btn>}
      </div>

      {form && (
        <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14,border:`1px solid ${C.border}`}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:12}}>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:11,color:C.muted}}>Nome</label>
              <input value={f.name} onChange={e=>set('name')(e.target.value)} placeholder="CPU alta"
                style={{background:'#0a2018',border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:11,color:C.muted}}>Métrica</label>
              <select value={f.metric} onChange={e=>set('metric')(e.target.value)}
                style={{background:'#0a2018',border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
                {METRICS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:11,color:C.muted}}>Threshold</label>
              <input type="number" value={f.threshold} onChange={e=>set('threshold')(parseFloat(e.target.value))}
                style={{background:'#0a2018',border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:11,color:C.muted}}>Por (min)</label>
              <input type="number" value={f.duration_min} onChange={e=>set('duration_min')(parseInt(e.target.value))}
                style={{background:'#0a2018',border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:11,color:C.muted}}>Nível</label>
              <select value={f.level} onChange={e=>set('level')(e.target.value)}
                style={{background:'#0a2018',border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:12}}>
            <label style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:C.text,cursor:'pointer'}}>
              <input type="checkbox" checked={f.notify_wa} onChange={e=>set('notify_wa')(e.target.checked)} style={{accentColor:C.green}}/> WhatsApp
            </label>
            <label style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:C.text,cursor:'pointer'}}>
              <input type="checkbox" checked={f.notify_tg} onChange={e=>set('notify_tg')(e.target.checked)} style={{accentColor:C.green}}/> Telegram
            </label>
          </div>
          <Btn onClick={save}>Salvar Regra</Btn>
        </div>
      )}

      {rules.length === 0 && !form && (
        <div style={{color:C.muted,fontSize:12,textAlign:'center',padding:20}}>
          Nenhuma regra configurada. Crie regras para receber alertas automáticos.
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {rules.map(r=>{
          const col = r.level==='error'?C.red:C.amber
          const METRIC_LABELS = {cpu:'CPU',mem:'Memória',loss:'Perda',latency:'Latência',ont_offline:'ONTs Offline',pppoe_drop:'PPPoE Drop'}
          return (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:C.bg,borderRadius:8,border:`1px solid ${C.border}`,borderLeft:`3px solid ${col}`}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.name}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  {METRIC_LABELS[r.metric]||r.metric} {r.operator} {r.threshold} por {r.duration_min}min
                  · {r.notify_wa&&'WhatsApp'} {r.notify_tg&&'Telegram'}
                </div>
              </div>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:`${col}15`,color:col}}>{r.level}</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:r.active?`${C.green}15`:`${C.muted}15`,color:r.active?C.green:C.muted}}>{r.active?'Ativa':'Inativa'}</span>
              {role==='admin' && <Btn onClick={()=>del(r.id)} variant="danger" size="sm">×</Btn>}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SLAPage({ toast, role }) {
  const [tab,setTab]     = useState('sla')
  const [sla,setSla]     = useState([])
  const [pppoe,setPppoe] = useState([])
  const [days,setDays]   = useState(30)
  const [loading,setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s,p] = await Promise.all([
        api.getSLA(days),
        api.getPPPoE(),
      ])
      setSla(s); setPppoe(p)
    } catch(e) { toast('Erro: '+e.message,'error') }
    setLoading(false)
  }

  useEffect(()=>{ load() },[days])

  const avgUptime = sla.length>0 ? sla.reduce((s,r)=>s+r.uptime_pct,0)/sla.length : 0
  const slaOK     = sla.filter(s=>s.sla_ok).length
  const totalDown = sla.reduce((s,r)=>s+r.downtime_min,0)

  const tabs = [
    {id:'sla',    label:'SLA & Disponibilidade'},
    {id:'pppoe',  label:'PPPoE Sessions'},
    {id:'rules',  label:'Regras de Alerta'},
  ]

  return (
    <div>
      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'8px 16px',background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                    fontFamily:"'Righteous',sans-serif",color:tab===t.id?C.green:C.muted,
                    borderBottom:tab===t.id?`2px solid ${C.green}`:'2px solid transparent'}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='sla' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
            {[
              {l:'Uptime médio',    v:`${avgUptime.toFixed(2)}%`, c:avgUptime>=99?C.green:C.amber},
              {l:'SLA OK',          v:`${slaOK}/${sla.length}`,  c:C.green},
              {l:'SLA Breach',      v:sla.length-slaOK,          c:C.red},
              {l:'Downtime total',  v:totalDown>=60?`${(totalDown/60).toFixed(1)}h`:`${totalDown}min`, c:totalDown>60?C.red:C.muted},
            ].map((k,i)=>(
              <Panel key={i} style={{padding:'12px 14px'}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"'Righteous',sans-serif"}}>{k.v}</div>
              </Panel>
            ))}
          </div>

          {loading ? <div style={{padding:20,textAlign:'center',color:C.muted}}>Calculando SLA...</div>
            : <SLATable sla={sla} days={days} setDays={setDays}/>}
        </div>
      )}

      {tab==='pppoe' && (
        loading ? <div style={{padding:20,textAlign:'center',color:C.muted}}>Carregando...</div>
          : <PPPoEPanel pppoe={pppoe}/>
      )}

      {tab==='rules' && <AlertRulesPanel toast={toast} role={role}/>}
    </div>
  )
}

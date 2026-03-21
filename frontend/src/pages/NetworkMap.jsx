import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const C = {
  green:'#00c896', teal:'#008B87', deep:'#036271',
  bg:'#02100c', panel:'#061812', border:'#0d3828',
  text:'#d0f0e4', muted:'#3a8a62', red:'#ff3f5a', amber:'#ffb800', input:'#0a2018',
}

const POP_TYPES = {
  datacenter: { label:'Datacenter',  icon:'🏢', color:'#00c896' },
  pop:        { label:'POP',         icon:'📡', color:'#008B87' },
  cto:        { label:'CTO',         icon:'🔷', color:'#036271' },
  ceo:        { label:'CEO',         icon:'🔶', color:'#ffb800' },
  splitter:   { label:'Splitter',    icon:'⬡',  color:'#7a5af8' },
  client:     { label:'Cliente',     icon:'🏠', color:'#3b82f6' },
}

const FIBER_TYPES = {
  backbone:     { label:'Backbone',     color:'#00c896', width:4 },
  distribution: { label:'Distribuição', color:'#008B87', width:3 },
  access:       { label:'Acesso',       color:'#ffb800', width:2 },
  drop:         { label:'Drop',         color:'#3b82f6', width:1.5 },
}

const Panel = ({children,style})=><div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16,...style}}>{children}</div>
const Btn = ({children,onClick,variant='primary',size='md',disabled,style})=>{
  const sz={sm:{fontSize:11,padding:'4px 10px'},md:{fontSize:12,padding:'8px 16px'}}[size]
  const v={
    primary:{background:`linear-gradient(135deg,${C.green},${C.teal})`,color:'#02100c',border:'none'},
    danger: {background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}44`},
    ghost:  {background:'transparent',color:C.muted,border:`1px solid ${C.border}`},
    teal:   {background:`${C.teal}18`,color:C.teal,border:`1px solid ${C.teal}44`},
    amber:  {background:`${C.amber}18`,color:C.amber,border:`1px solid ${C.amber}44`},
  }[variant]||{}
  return <button onClick={onClick} disabled={disabled}
    style={{borderRadius:7,cursor:disabled?'not-allowed':'pointer',fontFamily:"'Righteous',sans-serif",
            fontWeight:700,transition:'all .2s',opacity:disabled?.5:1,...sz,...v,...style}}>
    {children}
  </button>
}

const Inp = ({label,value,onChange,type='text',placeholder,style})=>(
  <div style={{display:'flex',flexDirection:'column',gap:4,...style}}>
    {label&&<label style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
  </div>
)

const Sel = ({label,value,onChange,options})=>(
  <div style={{display:'flex',flexDirection:'column',gap:4}}>
    {label&&<label style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

// ─── POP Form ─────────────────────────────────────────────────────────────────
function PopForm({ initial, onSave, onClose, devices }) {
  const [f,setF] = useState(initial || {name:'',type:'pop',lat:'-5.7945',lng:'-35.2110',address:'',city:'Natal',status:'up',notes:'',power_type:'grid',capacity:0,used:0,device_id:''})
  const set = k => v => setF(p=>({...p,[k]:v}))
  const save = async () => {
    if(!f.name||!f.lat||!f.lng){alert('Nome, lat e lng obrigatórios');return}
    onSave({...f,lat:parseFloat(f.lat),lng:parseFloat(f.lng),capacity:parseInt(f.capacity)||0,used:parseInt(f.used)||0,device_id:f.device_id||null})
  }
  return (
    <div style={{position:'fixed',inset:0,background:'#000000d0',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:24,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <span style={{fontFamily:"'Righteous',sans-serif",fontSize:16,color:C.text}}>{initial?.id?'Editar POP':'Novo POP'}</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Inp label="Nome *" value={f.name} onChange={set('name')} placeholder="POP Centro"/>
          <Sel label="Tipo" value={f.type} onChange={set('type')} options={Object.entries(POP_TYPES).map(([v,t])=>({value:v,label:t.label}))}/>
          <Inp label="Latitude *" value={f.lat} onChange={set('lat')} placeholder="-5.7945"/>
          <Inp label="Longitude *" value={f.lng} onChange={set('lng')} placeholder="-35.2110"/>
          <Inp label="Endereço" value={f.address} onChange={set('address')} placeholder="Rua..."/>
          <Inp label="Cidade" value={f.city} onChange={set('city')} placeholder="Natal"/>
          <Sel label="Status" value={f.status} onChange={set('status')} options={[{value:'up',label:'Online'},{value:'warning',label:'Alerta'},{value:'down',label:'Offline'},{value:'unknown',label:'Desconhecido'}]}/>
          <Sel label="Alimentação" value={f.power_type} onChange={set('power_type')} options={[{value:'grid',label:'Rede elétrica'},{value:'nobreak',label:'Nobreak'},{value:'solar',label:'Solar'}]}/>
          <Inp label="Capacidade (portas)" value={String(f.capacity)} onChange={set('capacity')} placeholder="48"/>
          <Inp label="Em uso" value={String(f.used)} onChange={set('used')} placeholder="32"/>
          <div style={{gridColumn:'1/-1'}}>
            <Sel label="Device vinculado" value={f.device_id||''} onChange={set('device_id')}
              options={[{value:'',label:'— Nenhum —'},...(devices||[]).map(d=>({value:String(d.id),label:`${d.name} (${d.ip})`}))]}/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <Inp label="Observações" value={f.notes} onChange={set('notes')} placeholder=""/>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:18}}>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
          <Btn onClick={save}>Salvar POP</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Fiber Form ───────────────────────────────────────────────────────────────
function FiberForm({ initial, onSave, onClose, pops }) {
  const [f,setF] = useState(initial || {name:'',type:'backbone',color:'#00c896',coordinates:'',length_m:0,fiber_count:12,status:'up',pop_start_id:'',pop_end_id:'',notes:''})
  const set = k => v => setF(p=>({...p,[k]:v}))
  const save = () => {
    if(!f.name){alert('Nome obrigatório');return}
    let coords
    try {
      // Accept JSON array or "lat,lng;lat,lng" format
      if(f.coordinates.trim().startsWith('[')) {
        coords = JSON.parse(f.coordinates)
      } else {
        coords = f.coordinates.split(';').map(p=>p.split(',').map(Number))
      }
    } catch { alert('Coordenadas inválidas. Use: lat,lng;lat,lng'); return }
    onSave({...f,coordinates:coords,length_m:parseFloat(f.length_m)||0,fiber_count:parseInt(f.fiber_count)||12,
            pop_start_id:f.pop_start_id||null,pop_end_id:f.pop_end_id||null})
  }
  return (
    <div style={{position:'fixed',inset:0,background:'#000000d0',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:24,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <span style={{fontFamily:"'Righteous',sans-serif",fontSize:16,color:C.text}}>{initial?.id?'Editar Fibra':'Nova Rota de Fibra'}</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Inp label="Nome *" value={f.name} onChange={set('name')} placeholder="Backbone Centro-Norte"/>
          <Sel label="Tipo" value={f.type} onChange={set('type')} options={Object.entries(FIBER_TYPES).map(([v,t])=>({value:v,label:t.label}))}/>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{fontSize:11,color:C.muted,fontWeight:600}}>Cor</label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="color" value={f.color} onChange={e=>set('color')(e.target.value)} style={{width:40,height:36,border:'none',borderRadius:6,cursor:'pointer'}}/>
              <input type="text" value={f.color} onChange={e=>set('color')(e.target.value)}
                style={{flex:1,background:C.input,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',color:C.text,fontSize:12,fontFamily:'monospace',outline:'none'}}/>
            </div>
          </div>
          <Sel label="Status" value={f.status} onChange={set('status')} options={[{value:'up',label:'Ativo'},{value:'warning',label:'Alerta'},{value:'down',label:'Cortado'}]}/>
          <Inp label="Comprimento (m)" value={String(f.length_m)} onChange={set('length_m')} placeholder="1500"/>
          <Inp label="Qtd fibras" value={String(f.fiber_count)} onChange={set('fiber_count')} placeholder="12"/>
          <Sel label="POP início" value={f.pop_start_id||''} onChange={set('pop_start_id')}
            options={[{value:'',label:'— Selecione —'},...(pops||[]).map(p=>({value:String(p.id),label:p.name}))]}/>
          <Sel label="POP fim" value={f.pop_end_id||''} onChange={set('pop_end_id')}
            options={[{value:'',label:'— Selecione —'},...(pops||[]).map(p=>({value:String(p.id),label:p.name}))]}/>
          <div style={{gridColumn:'1/-1'}}>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:11,color:C.muted,fontWeight:600}}>Coordenadas * (lat,lng;lat,lng...)</label>
              <textarea value={f.coordinates} onChange={e=>set('coordinates')(e.target.value)} rows={3}
                placeholder="-5.794,-35.211;-5.780,-35.200;-5.770,-35.195"
                style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',color:C.text,fontSize:11,fontFamily:'monospace',outline:'none',resize:'vertical'}}/>
              <span style={{fontSize:10,color:C.muted}}>Dica: copie coordenadas do Google Maps (clique direito → copiar coords)</span>
            </div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:18}}>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
          <Btn onClick={save}>Salvar Fibra</Btn>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN MAP PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function NetworkMapPage({ toast, role, primaryColor }) {
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const markersRef = useRef([])
  const polylinesRef = useRef([])
  const alertCirclesRef = useRef([])

  const [pops,setPops]       = useState([])
  const [fibers,setFibers]   = useState([])
  const [alerts,setAlerts]   = useState([])
  const [summary,setSummary] = useState(null)
  const [devices,setDevices] = useState([])

  const [panel,setPanel]   = useState('list')  // list | pops | fibers
  const [popForm,setPopForm]   = useState(null)
  const [fiberForm,setFiberForm] = useState(null)
  const [selected,setSelected] = useState(null)
  const [loading,setLoading] = useState(false)

  const accentColor = primaryColor || C.green

  // ── Load Leaflet ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if (leafletRef.current) return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = window.L
      leafletRef.current = L

      const map = L.map('netwatch-map', {
        center: [-5.7945, -35.2110], // Natal/RN
        zoom: 12,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      // Click to get coords
      map.on('click', e => {
        const info = document.getElementById('map-coords')
        if(info) info.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`
      })

      leafletRef.current = { L, map }
      loadData()
    }
    document.head.appendChild(script)

    return () => {
      if (leafletRef.current?.map) {
        leafletRef.current.map.remove()
        leafletRef.current = null
      }
    }
  }, [])

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const [p,f,a,s,d] = await Promise.all([
        api.getPops(), api.getFibers(), api.getMapAlerts(),
        api.getMapSummary(), api.getDevices(),
      ])
      setPops(p); setFibers(f); setAlerts(a); setSummary(s); setDevices(d)
    } catch(e) { toast('Erro ao carregar mapa: '+e.message,'error') }
  }

  // ── Render map layers ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(!leafletRef.current?.map) return
    const { L, map } = leafletRef.current

    // Clear old layers
    markersRef.current.forEach(m=>m.remove())
    polylinesRef.current.forEach(p=>p.remove())
    alertCirclesRef.current.forEach(c=>c.remove())
    markersRef.current = []
    polylinesRef.current = []
    alertCirclesRef.current = []

    // Draw fiber routes
    fibers.forEach(f=>{
      const ft = FIBER_TYPES[f.type]||FIBER_TYPES.backbone
      const color = f.status==='down'?C.red:f.status==='warning'?C.amber:f.color||ft.color
      const pl = L.polyline(f.coordinates, {
        color, weight: ft.width, opacity: 0.85,
        dashArray: f.status==='down'?'8 4':undefined,
      }).addTo(map)
      pl.bindPopup(`
        <div style="font-family:monospace;font-size:12px">
          <b>${f.name}</b><br/>
          Tipo: ${ft.label}<br/>
          Fibras: ${f.fiber_count}<br/>
          Comprimento: ${(f.length_m/1000).toFixed(2)}km<br/>
          Status: <b style="color:${color}">${f.status.toUpperCase()}</b>
        </div>
      `)
      polylinesRef.current.push(pl)
    })

    // Draw alert circles
    alerts.forEach(a=>{
      if(!a.lat||!a.lng) return
      const color = a.level==='error'?C.red:a.level==='warning'?C.amber:C.green
      const circle = L.circle([a.lat,a.lng], {
        radius: a.radius_m, color, fillColor:color, fillOpacity:0.15, weight:2,
      }).addTo(map)
      circle.bindPopup(`<b style="color:${color}">${a.level.toUpperCase()}</b><br/>${a.message}`)
      alertCirclesRef.current.push(circle)
    })

    // Draw POPs
    pops.forEach(p=>{
      const pt = POP_TYPES[p.type]||POP_TYPES.pop
      const statusColor = p.status==='up'?C.green:p.status==='warning'?C.amber:p.status==='down'?C.red:'#555'
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:32px;border-radius:50%;
          background:${statusColor};border:3px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;cursor:pointer;
          box-shadow:0 2px 8px ${statusColor}88;
        ">${pt.icon}</div>`,
        iconSize: [32,32], iconAnchor: [16,16],
      })
      const marker = L.marker([p.lat,p.lng], {icon}).addTo(map)
      const used_pct = p.capacity>0?Math.round(p.used/p.capacity*100):0
      marker.bindPopup(`
        <div style="font-family:monospace;font-size:12px;min-width:180px">
          <b style="font-size:14px">${p.name}</b><br/>
          <span style="color:#666">${pt.label}</span><br/>
          <br/>
          📍 ${p.address||p.city||''}<br/>
          ⚡ ${p.power_type}<br/>
          ${p.capacity>0?`📊 ${p.used}/${p.capacity} portas (${used_pct}%)<br/>`:''}
          ${p.device?`🖥️ ${p.device.name} — CPU ${p.device.cpu}%<br/>`:''}
          ${p.notes?`📝 ${p.notes}<br/>`:''}
          <br/>
          <b style="color:${statusColor}">${p.status.toUpperCase()}</b>
        </div>
      `)
      marker.on('click', ()=> setSelected(p))
      markersRef.current.push(marker)
    })

  }, [pops, fibers, alerts])

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const savePop = async (data) => {
    setLoading(true)
    try {
      if(data.id) {
        const u = await api.updatePop(data.id, data); setPops(p=>p.map(x=>x.id===data.id?u:x))
        toast('POP atualizado!')
      } else {
        const n = await api.createPop(data); setPops(p=>[...p,n])
        toast('POP criado!')
      }
      setPopForm(null)
    } catch(e){ toast(e.message,'error') }
    setLoading(false)
  }

  const saveFiber = async (data) => {
    setLoading(true)
    try {
      if(data.id) {
        const u = await api.updateFiber(data.id, data); setFibers(f=>f.map(x=>x.id===data.id?u:x))
        toast('Rota atualizada!')
      } else {
        const n = await api.createFiber(data); setFibers(f=>[...f,n])
        toast('Rota de fibra criada!')
      }
      setFiberForm(null)
    } catch(e){ toast(e.message,'error') }
    setLoading(false)
  }

  const deletePop = async (id) => {
    if(!confirm('Remover este POP?')) return
    await api.deletePop(id); setPops(p=>p.filter(x=>x.id!==id)); toast('POP removido.','warn')
  }

  const deleteFiber = async (id) => {
    if(!confirm('Remover esta rota?')) return
    await api.deleteFiber(id); setFibers(f=>f.filter(x=>x.id!==id)); toast('Rota removida.','warn')
  }

  const flyTo = (lat, lng) => {
    if(leafletRef.current?.map) leafletRef.current.map.flyTo([lat,lng], 16)
  }

  const statusColor = s => ({up:C.green,warning:C.amber,down:C.red,unknown:'#555'}[s]||'#555')

  return (
    <div style={{display:'flex',gap:14,height:'calc(100vh - 90px)'}}>
      {popForm   && <PopForm   initial={popForm==='new'?null:popForm}   onSave={savePop}   onClose={()=>setPopForm(null)}   devices={devices}/>}
      {fiberForm && <FiberForm initial={fiberForm==='new'?null:fiberForm} onSave={saveFiber} onClose={()=>setFiberForm(null)} pops={pops}/>}

      {/* ── LEFT PANEL ── */}
      <div style={{width:300,display:'flex',flexDirection:'column',gap:10,overflowY:'auto',flexShrink:0}}>

        {/* Summary KPIs */}
        {summary && (
          <Panel style={{padding:'12px 14px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                ['POPs Online', summary.pops_up,     C.green],
                ['POPs Offline',summary.pops_down,   C.red],
                ['Alertas',     summary.alerts_error, C.amber],
                ['Fibra (km)',  summary.fiber_km,    C.teal],
              ].map(([l,v,c],i)=>(
                <div key={i} style={{background:C.bg,borderRadius:6,padding:'8px 10px'}}>
                  <div style={{fontSize:9,color:C.muted}}>{l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:c,fontFamily:"'Righteous',sans-serif"}}>{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:4}}>
          {['list','pops','fibers'].map(t=>(
            <button key={t} onClick={()=>setPanel(t)}
              style={{flex:1,padding:'7px',background:panel===t?`${accentColor}18`:'transparent',
                border:`1px solid ${panel===t?accentColor:C.border}`,borderRadius:6,
                color:panel===t?accentColor:C.muted,fontSize:11,fontWeight:600,cursor:'pointer',
                fontFamily:"'Righteous',sans-serif"}}>
              {t==='list'?'Alertas':t==='pops'?'POPs':'Fibras'}
            </button>
          ))}
        </div>

        {/* Panel content */}
        {panel==='list' && (
          <Panel style={{flex:1,overflowY:'auto',padding:12}}>
            <div style={{fontSize:10,fontWeight:700,color:C.teal,letterSpacing:2,marginBottom:10,fontFamily:"'Righteous',sans-serif"}}>ALERTAS ATIVOS</div>
            {alerts.length===0 && <div style={{color:C.muted,fontSize:12,textAlign:'center',padding:16}}>✓ Nenhum alerta</div>}
            {alerts.map(a=>{
              const col = a.level==='error'?C.red:a.level==='warning'?C.amber:C.green
              return (
                <div key={a.id} onClick={()=>a.lat&&flyTo(a.lat,a.lng)}
                  style={{padding:'8px 10px',borderLeft:`3px solid ${col}`,background:`${col}08`,borderRadius:4,marginBottom:8,cursor:a.lat?'pointer':'default'}}>
                  <div style={{fontSize:11,color:C.text}}>{a.message}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{new Date(a.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              )
            })}
          </Panel>
        )}

        {panel==='pops' && (
          <Panel style={{flex:1,overflowY:'auto',padding:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.teal,letterSpacing:2,fontFamily:"'Righteous',sans-serif"}}>POPs ({pops.length})</div>
              {role==='admin'&&<Btn onClick={()=>setPopForm('new')} size="sm">+ Novo</Btn>}
            </div>
            {pops.map(p=>{
              const pt = POP_TYPES[p.type]||POP_TYPES.pop
              return (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:C.bg,borderRadius:6,marginBottom:6,cursor:'pointer',border:`1px solid ${C.border}`}}
                  onClick={()=>flyTo(p.lat,p.lng)}>
                  <span style={{fontSize:16}}>{pt.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                    <div style={{fontSize:10,color:C.muted}}>{pt.label} · {p.city||'—'}</div>
                  </div>
                  <div style={{width:8,height:8,borderRadius:'50%',background:statusColor(p.status),flexShrink:0}}/>
                  {role==='admin'&&(
                    <div style={{display:'flex',gap:4}}>
                      <Btn onClick={e=>{e.stopPropagation();setPopForm(p)}} variant="teal" size="sm">✎</Btn>
                      <Btn onClick={e=>{e.stopPropagation();deletePop(p.id)}} variant="danger" size="sm">×</Btn>
                    </div>
                  )}
                </div>
              )
            })}
          </Panel>
        )}

        {panel==='fibers' && (
          <Panel style={{flex:1,overflowY:'auto',padding:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.teal,letterSpacing:2,fontFamily:"'Righteous',sans-serif"}}>FIBRAS ({fibers.length})</div>
              {role==='admin'&&<Btn onClick={()=>setFiberForm('new')} size="sm">+ Nova</Btn>}
            </div>
            {fibers.map(f=>{
              const ft = FIBER_TYPES[f.type]||FIBER_TYPES.backbone
              const sc = f.status==='down'?C.red:f.status==='warning'?C.amber:f.color||ft.color
              return (
                <div key={f.id} style={{padding:'8px 10px',background:C.bg,borderRadius:6,marginBottom:6,border:`1px solid ${C.border}`,borderLeft:`3px solid ${sc}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:C.text}}>{f.name}</div>
                      <div style={{fontSize:10,color:C.muted}}>{ft.label} · {f.fiber_count} fibras · {(f.length_m/1000).toFixed(2)}km</div>
                    </div>
                    {role==='admin'&&(
                      <div style={{display:'flex',gap:4}}>
                        <Btn onClick={()=>setFiberForm(f)} variant="teal" size="sm">✎</Btn>
                        <Btn onClick={()=>deleteFiber(f.id)} variant="danger" size="sm">×</Btn>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </Panel>
        )}

        {/* Coords helper */}
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 12px',fontSize:11,color:C.muted}}>
          Clique no mapa para copiar coordenadas:<br/>
          <span id="map-coords" style={{color:accentColor,fontFamily:'monospace'}}>—</span>
        </div>
      </div>

      {/* ── MAP ── */}
      <div style={{flex:1,borderRadius:12,overflow:'hidden',border:`1px solid ${C.border}`,position:'relative'}}>
        <div id="netwatch-map" style={{width:'100%',height:'100%'}}/>

        {/* Legend */}
        <div style={{position:'absolute',bottom:16,right:16,zIndex:1000,background:'rgba(6,24,18,0.92)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:11}}>
          <div style={{color:C.teal,fontWeight:700,letterSpacing:1,marginBottom:8,fontFamily:"'Righteous',sans-serif"}}>LEGENDA</div>
          {Object.entries(FIBER_TYPES).map(([k,v])=>(
            <div key={k} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <div style={{width:24,height:3,background:v.color,borderRadius:2}}/>
              <span style={{color:C.muted}}>{v.label}</span>
            </div>
          ))}
          <div style={{borderTop:`1px solid ${C.border}`,marginTop:8,paddingTop:8}}>
            {[['Online',C.green],['Alerta',C.amber],['Offline',C.red]].map(([l,c])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:c}}/>
                <span style={{color:C.muted}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reload button */}
        <button onClick={loadData}
          style={{position:'absolute',top:16,right:16,zIndex:1000,background:'rgba(6,24,18,0.92)',
                  border:`1px solid ${C.border}`,borderRadius:6,padding:'6px 12px',
                  color:C.green,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'Righteous',sans-serif"}}>
          ↻ Atualizar
        </button>
      </div>
    </div>
  )
}

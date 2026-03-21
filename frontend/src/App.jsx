import { useState, useEffect, useRef, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api, setToken, getToken, createWS } from './api'
import SuperAdminPage from './pages/SuperAdmin'

// ─── Brand ────────────────────────────────────────────────────────────────────
const C = {
  green:'#00c896', teal:'#008B87', deep:'#036271',
  bg:'#02100c', panel:'#061812', card:'#081e15',
  border:'#0d3828', text:'#d0f0e4', muted:'#3a8a62',
  red:'#ff3f5a', amber:'#ffb800', input:'#0a2018',
}

const VM = {
  mikrotik:{ color:C.green, label:'Mikrotik',  proto:'RouterOS API :8728' },
  edd:     { color:C.teal,  label:'EDD',        proto:'SNMP v2c :161'     },
  huawei:  { color:C.deep,  label:'Huawei',     proto:'NETCONF :830'      },
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
const StatusDot = ({ s }) => {
  const c = { up:C.green, warning:C.amber, down:C.red, unknown:'#555' }[s]||'#555'
  return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:c,boxShadow:`0 0 6px ${c}`}}/>
}

const Badge = ({ s }) => {
  const m = { up:[C.green,'#001a10','ONLINE'], warning:[C.amber,'#1a0f00','ALERTA'], down:[C.red,'#1a0008','OFFLINE'], unknown:['#555','#111','?'] }
  const [col,bg,lbl] = m[s]||m.unknown
  return <span style={{fontSize:10,fontWeight:700,letterSpacing:1,padding:'2px 8px',borderRadius:4,color:col,background:bg,border:`1px solid ${col}33`}}>{lbl}</span>
}

const VTag = ({ v }) => {
  const m = VM[v]||{ color:'#555', label:v }
  return <span style={{fontSize:10,padding:'2px 8px',borderRadius:3,border:`1px solid ${m.color}44`,color:m.color,fontWeight:700}}>{m.label}</span>
}

const GBar = ({ v, max=100 }) => {
  const p = Math.min(100,(v/max)*100)
  const c = p>85?C.red:p>65?C.amber:C.green
  return <div style={{height:3,background:'#ffffff10',borderRadius:2,overflow:'hidden'}}><div style={{width:`${p}%`,height:'100%',background:c,transition:'width .5s'}}/></div>
}

const Panel = ({ children, style }) => (
  <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:18,...style}}>{children}</div>
)

const Sec = ({ children, style }) => (
  <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.teal,textTransform:'uppercase',marginBottom:14,fontFamily:"'Righteous',sans-serif",...style}}>{children}</div>
)

const Btn = ({ children, onClick, variant='primary', size='md', disabled, style }) => {
  const sz = { sm:{fontSize:11,padding:'5px 12px'}, md:{fontSize:12,padding:'9px 18px'}, lg:{fontSize:14,padding:'12px 24px'} }[size]
  const vs = {
    primary: { background:`linear-gradient(135deg,${C.green},${C.teal})`, color:'#02100c', border:'none' },
    danger:  { background:`${C.red}18`, color:C.red, border:`1px solid ${C.red}44` },
    ghost:   { background:'transparent', color:C.muted, border:`1px solid ${C.border}` },
    teal:    { background:`${C.teal}18`, color:C.teal, border:`1px solid ${C.teal}44` },
  }[variant]||{}
  return (
    <button onClick={onClick} disabled={disabled}
      style={{borderRadius:7,cursor:disabled?'not-allowed':'pointer',fontFamily:"'Righteous',sans-serif",
              fontWeight:700,transition:'all .2s',opacity:disabled?.5:1,...sz,...vs,...style}}>
      {children}
    </button>
  )
}

const Inp = ({ label, value, onChange, type='text', placeholder, required }) => (
  <div style={{display:'flex',flexDirection:'column',gap:5}}>
    {label && <label style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}{required&&<span style={{color:C.red}}> *</span>}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:7,padding:'9px 12px',
              color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
  </div>
)

const Sel = ({ label, value, onChange, options }) => (
  <div style={{display:'flex',flexDirection:'column',gap:5}}>
    {label && <label style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:7,padding:'9px 12px',
              color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

const Modal = ({ title, onClose, children, width=520 }) => (
  <div style={{position:'fixed',inset:0,background:'#000000d0',zIndex:300,display:'flex',
               alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:24,
                 width:'100%',maxWidth:width,maxHeight:'90vh',overflowY:'auto'}}
         onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <span style={{fontFamily:"'Righteous',sans-serif",fontSize:16,color:C.text}}>{title}</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}>✕</button>
      </div>
      {children}
    </div>
  </div>
)

const Toast = ({ msg, type, onDone }) => {
  useEffect(()=>{ const t=setTimeout(onDone,3000); return()=>clearTimeout(t) },[])
  const col = type==='error'?C.red:type==='warn'?C.amber:C.green
  return (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:500,background:C.panel,
                 border:`1px solid ${col}44`,borderLeft:`3px solid ${col}`,borderRadius:8,
                 padding:'12px 18px',color:C.text,fontSize:13,boxShadow:'0 8px 32px #00000088',
                 animation:'fadein .3s ease'}}>
      {msg}
    </div>
  )
}

function gen(base,v,n=35){
  const now=Date.now()
  return Array.from({length:n},(_,i)=>({
    t:new Date(now-(n-i)*60000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    v:Math.max(0,base+(Math.random()-.5)*v*2),
  }))
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [email,setEmail] = useState('')
  const [pass,setPass]   = useState('')
  const [err,setErr]     = useState('')
  const [loading,setLoading] = useState(false)

  const submit = async () => {
    if (!email||!pass){ setErr('Preencha email e senha.'); return }
    setLoading(true); setErr('')
    try {
      const data = await api.login(email, pass)
      setToken(data.access_token)
      onLogin({ name:data.name, email:data.email, role:data.role, token:data.access_token })
    } catch(e) {
      setErr(e.message||'Erro ao conectar. Verifique a API.')
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',
                 justifyContent:'center',position:'relative',overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Montserrat:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg};font-family:'Montserrat',sans-serif}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        input::placeholder{color:${C.muted};opacity:.7}
        select option{background:${C.panel}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>

      {/* BG Grid */}
      <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:.3}}/>

      {/* Floating hexagons */}
      {[{s:180,x:'7%',y:'8%',d:6},{s:100,x:'83%',y:'12%',d:9},{s:140,x:'72%',y:'68%',d:7}].map((h,i)=>(
        <svg key={i} width={h.s} height={h.s} style={{position:'absolute',left:h.x,top:h.y,animation:`float ${h.d}s ease-in-out infinite`,opacity:.07}}>
          <polygon points={`${h.s/2},4 ${h.s-4},${h.s*.26} ${h.s-4},${h.s*.74} ${h.s/2},${h.s-4} 4,${h.s*.74} 4,${h.s*.26}`} fill="none" stroke={C.green} strokeWidth="2"/>
        </svg>
      ))}

      <div style={{position:'relative',zIndex:10,width:'100%',maxWidth:420,padding:16,animation:'fadein .6s ease'}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:36}}>
          <svg width="52" height="52" viewBox="0 0 52 52" style={{marginBottom:12}}>
            <polygon points="26,3 47,14.5 47,37.5 26,49 5,37.5 5,14.5" fill={`${C.green}15`} stroke={C.green} strokeWidth="1.5"/>
            <polygon points="26,11 40,19 40,33 26,41 12,33 12,19" fill={`${C.teal}12`} stroke={C.teal} strokeWidth="1"/>
            {[[26,18],[34,26],[26,34],[18,26]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2" fill="white"/>)}
            <line x1="26" y1="18" x2="34" y2="26" stroke="white" strokeWidth="1.2" opacity=".6"/>
            <line x1="34" y1="26" x2="26" y2="34" stroke="white" strokeWidth="1.2" opacity=".6"/>
            <line x1="26" y1="34" x2="18" y2="26" stroke="white" strokeWidth="1.2" opacity=".6"/>
            <line x1="18" y1="26" x2="26" y2="18" stroke="white" strokeWidth="1.2" opacity=".6"/>
          </svg>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:1}}>
            <span style={{fontFamily:"'Righteous',sans-serif",fontSize:32,color:C.green}}>CIT</span>
            <span style={{fontFamily:"'Righteous',sans-serif",fontSize:32,color:C.teal}}>max</span>
          </div>
          <div style={{fontSize:11,color:C.muted,letterSpacing:3,marginTop:6,fontFamily:"'Righteous',sans-serif"}}>NETWORK MONITOR</div>
        </div>

        <Panel style={{padding:28}}>
          <div style={{fontFamily:"'Righteous',sans-serif",fontSize:18,color:C.text,marginBottom:6}}>Acesso ao Sistema</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:24}}>Entre com suas credenciais</div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Inp label="Email" value={email} onChange={setEmail} placeholder="clebson@cit.net.br"/>
            <Inp label="Senha" type="password" value={pass} onChange={setPass} placeholder="••••••••"/>
            {err && <div style={{fontSize:12,color:C.red,padding:'8px 12px',background:`${C.red}12`,borderRadius:6,border:`1px solid ${C.red}33`}}>{err}</div>}
            <Btn onClick={submit} disabled={loading} size="lg" style={{width:'100%',marginTop:4}}>
              {loading ? 'Verificando...' : 'ENTRAR'}
            </Btn>
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DEVICE FORM
// ════════════════════════════════════════════════════════════════════════════
function DeviceForm({ initial, onSave, onClose }) {
  const PORT_DEFAULT = { mikrotik:'8728', edd:'161', huawei:'830' }
  const [f,setF] = useState(initial||{name:'',vendor:'mikrotik',model:'',ip:'',location:'DC Natal',community:'citmax',port:'8728',username:'admin',password:'',feature:'',notes:''})
  const set = k => v => setF(p=>({...p,[k]:v}))

  const save = async () => {
    if (!f.name||!f.ip){ alert('Nome e IP obrigatórios'); return }
    onSave({ ...f, port: parseInt(f.port)||161 })
  }

  return (
    <Modal title={f.id ? 'Editar Dispositivo' : 'Novo Dispositivo'} onClose={onClose} width={580}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Inp label="Nome *" value={f.name} onChange={set('name')} placeholder="EDGE-RB-01"/>
        <Sel label="Fabricante *" value={f.vendor} onChange={v=>{ set('vendor')(v); set('port')(PORT_DEFAULT[v]||'161') }}
          options={[{value:'mikrotik',label:'Mikrotik'},{value:'edd',label:'EDD Datacom'},{value:'huawei',label:'Huawei'}]}/>
        <Inp label="Modelo" value={f.model} onChange={set('model')} placeholder="CCR2004-16G-2S+"/>
        <Inp label="Endereço IP *" value={f.ip} onChange={set('ip')} placeholder="10.0.0.1"/>
        <Inp label="Localização" value={f.location} onChange={set('location')} placeholder="DC Natal"/>
        <Sel label="Status" value={f.status||'unknown'} onChange={set('status')}
          options={[{value:'unknown',label:'Desconhecido'},{value:'up',label:'Online'},{value:'warning',label:'Alerta'},{value:'down',label:'Offline'}]}/>
        <Inp label="Usuário (API/SSH)" value={f.username} onChange={set('username')} placeholder="admin"/>
        <Inp label="Senha" type="password" value={f.password} onChange={set('password')} placeholder="••••••••"/>
        <Inp label="Community SNMP" value={f.community} onChange={set('community')} placeholder="citmax"/>
        <Inp label="Porta" value={String(f.port)} onChange={set('port')} placeholder="8728"/>
        <Inp label="Feature / Função" value={f.feature} onChange={set('feature')} placeholder="BGP/OSPF"/>
        <div/>
        <div style={{gridColumn:'1/-1'}}>
          <Inp label="Observações" value={f.notes} onChange={set('notes')} placeholder=""/>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        <Btn onClick={save}>Salvar</Btn>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LINK FORM
// ════════════════════════════════════════════════════════════════════════════
function LinkForm({ initial, onSave, onClose }) {
  const [f,setF] = useState(initial||{name:'',provider:'',bw_mbps:10000,ip_peer:'',asn_peer:'',asn_local:'AS65001',notes:''})
  const set = k => v => setF(p=>({...p,[k]:v}))
  const save = () => {
    if (!f.name||!f.provider){ alert('Nome e provedor obrigatórios'); return }
    onSave({ ...f, bw_mbps: parseInt(f.bw_mbps)||1000 })
  }
  return (
    <Modal title={f.id ? 'Editar Link' : 'Novo Link'} onClose={onClose}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Inp label="Nome *" value={f.name} onChange={set('name')} placeholder="VIVO-10G-01"/>
        <Inp label="Provedor *" value={f.provider} onChange={set('provider')} placeholder="Vivo"/>
        <Inp label="IP / Gateway peer" value={f.ip_peer} onChange={set('ip_peer')} placeholder="189.1.2.1"/>
        <Inp label="ASN do Peer" value={f.asn_peer} onChange={set('asn_peer')} placeholder="AS7738"/>
        <Inp label="Capacidade (Mbps)" value={String(f.bw_mbps)} onChange={set('bw_mbps')} placeholder="10000"/>
        <Inp label="ASN Local" value={f.asn_local} onChange={set('asn_local')} placeholder="AS65001"/>
        <div style={{gridColumn:'1/-1'}}>
          <Inp label="Observações" value={f.notes} onChange={set('notes')} placeholder=""/>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        <Btn onClick={save}>Salvar</Btn>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// USER FORM
// ════════════════════════════════════════════════════════════════════════════
function UserForm({ initial, onSave, onClose }) {
  const [f,setF] = useState(initial||{name:'',email:'',password:'',role:'operator',active:true})
  const set = k => v => setF(p=>({...p,[k]:v}))
  const save = () => {
    if (!f.name||!f.email){ alert('Nome e email obrigatórios'); return }
    if (!f.id && !f.password){ alert('Senha obrigatória para novo usuário'); return }
    onSave(f)
  }
  return (
    <Modal title={f.id ? 'Editar Usuário' : 'Novo Usuário'} onClose={onClose} width={460}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Inp label="Nome *" value={f.name} onChange={set('name')} placeholder="João Silva"/>
        <Inp label="Email *" type="email" value={f.email} onChange={set('email')} placeholder="joao@cit.net.br"/>
        <Inp label={f.id ? 'Nova senha (deixe vazio para não alterar)' : 'Senha *'} type="password" value={f.password||''} onChange={set('password')} placeholder="••••••••"/>
        <Sel label="Perfil" value={f.role} onChange={set('role')}
          options={[{value:'admin',label:'Administrador'},{value:'operator',label:'Operador NOC'},{value:'viewer',label:'Visualizador'}]}/>
        <label style={{display:'flex',alignItems:'center',gap:10,fontSize:12,color:C.text,cursor:'pointer'}}>
          <input type="checkbox" checked={f.active} onChange={e=>set('active')(e.target.checked)} style={{accentColor:C.green}}/>
          Conta ativa
        </label>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        <Btn onClick={save}>Salvar</Btn>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ════════════════════════════════════════════════════════════════════════════
function Confirm({ msg, onConfirm, onClose }) {
  return (
    <Modal title="Confirmar" onClose={onClose} width={360}>
      <div style={{fontSize:13,color:C.text,marginBottom:20}}>{msg}</div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        <Btn onClick={onConfirm} variant="danger">Confirmar</Btn>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ════════════════════════════════════════════════════════════════════════════
function OverviewPage({ devices, links, alerts, liveMetrics, pingData }) {
  const [traffic,setTraffic] = useState(()=>gen(6.5,1.5,40).map((d,i)=>({...d,out:gen(4,1,40)[i].v})))

  // Atualiza gráfico de tráfego com dados reais dos links quando chegam via WS
  useEffect(()=>{
    if (!liveMetrics.length) return
    const now = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    const totalIn  = links.reduce((s,l)=>s+(l.in||0),0)
    const totalOut = links.reduce((s,l)=>s+(l.out||0),0)
    setTraffic(p=>[...p.slice(1),{t:now,v:totalIn||Math.random()*8,out:totalOut||Math.random()*5}])
  },[liveMetrics])

  const up   = devices.filter(d=>d.status==='up').length
  const warn = devices.filter(d=>d.status==='warning').length
  const down = devices.filter(d=>d.status==='down').length
  const totalIn  = links.reduce((s,l)=>s+(l.in||0),0)
  const totalOut = links.reduce((s,l)=>s+(l.out||0),0)

  return (
    <div>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
        {[
          {l:'Online',    v:`${up}/${devices.length}`, c:C.green},
          {l:'Alertas',   v:warn,                       c:C.amber},
          {l:'Offline',   v:down,                       c:C.red},
          {l:'Links OK',  v:`${links.filter(l=>l.status==='up').length}/${links.length}`, c:C.green},
          {l:'IN Total',  v:`${totalIn.toFixed(1)} G`,  c:'#00e8c8'},
          {l:'OUT Total', v:`${totalOut.toFixed(1)} G`, c:C.teal},
        ].map((k,i)=>(
          <Panel key={i} style={{padding:'12px 16px'}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:.5,marginBottom:5}}>{k.l}</div>
            <div style={{fontSize:22,fontWeight:800,color:k.c,fontFamily:"'Righteous',sans-serif"}}>{k.v}</div>
          </Panel>
        ))}
      </div>

      {/* Traffic + Alerts */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14,marginBottom:14}}>
        <Panel>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <Sec style={{marginBottom:0}}>Tráfego Total — Tempo Real</Sec>
            <div style={{display:'flex',gap:12,fontSize:11}}><span style={{color:C.green}}>● IN</span><span style={{color:C.teal}}>● OUT</span></div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={traffic} margin={{top:4,right:6,bottom:0,left:-12}}>
              <defs>
                <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={.35}/><stop offset="100%" stopColor={C.green} stopOpacity={0}/></linearGradient>
                <linearGradient id="gout" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={.35}/><stop offset="100%" stopColor={C.teal} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
              <XAxis dataKey="t" tick={{fill:C.muted,fontSize:9}} tickLine={false} interval={8}/>
              <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} tickFormatter={v=>`${v.toFixed(0)}G`}/>
              <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}} formatter={(v,n)=>[`${v.toFixed(2)} Gbps`,n==='v'?'IN':'OUT']}/>
              <Area type="monotone" dataKey="v"   stroke={C.green} strokeWidth={2} fill="url(#gin)"  dot={false} isAnimationActive={false}/>
              <Area type="monotone" dataKey="out" stroke={C.teal}  strokeWidth={2} fill="url(#gout)" dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel>
          <Sec>Alertas Ativos</Sec>
          <div style={{display:'flex',flexDirection:'column',gap:7,maxHeight:200,overflowY:'auto'}}>
            {alerts.length===0 && <div style={{fontSize:12,color:C.muted,textAlign:'center',padding:20}}>✓ Nenhum alerta ativo</div>}
            {alerts.map((a,i)=>{
              const col = a.level==='error'?C.red:C.amber
              return (
                <div key={i} style={{padding:'8px 10px',borderLeft:`3px solid ${col}`,background:`${col}08`,borderRadius:4}}>
                  <div style={{fontSize:11,color:C.text}}>{a.message}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{a.source_name} · {new Date(a.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* Device cards */}
      <Panel>
        <Sec>Dispositivos — Status Atual</Sec>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
          {devices.map(d=>{
            const m = VM[d.vendor]||{color:'#555'}
            const ping = pingData[d.ip]
            return (
              <div key={d.id} style={{background:C.bg,borderRadius:8,padding:12,border:`1px solid ${C.border}`,borderLeft:`3px solid ${m.color}`}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontFamily:"'Righteous',sans-serif",fontSize:12,color:C.text}}>{d.name}</span>
                  <StatusDot s={d.status}/>
                </div>
                <div style={{fontSize:10,color:C.muted,marginBottom:8}}>{d.ip} · {d.location}</div>
                <div style={{display:'flex',gap:6,marginBottom:4,alignItems:'center'}}>
                  <span style={{fontSize:10,color:C.muted,minWidth:28}}>CPU</span>
                  <div style={{flex:1}}><GBar v={d.cpu||0}/></div>
                  <span style={{fontSize:10,color:(d.cpu||0)>70?C.red:C.text,minWidth:30,textAlign:'right'}}>{d.cpu||0}%</span>
                </div>
                <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                  <span style={{fontSize:10,color:C.muted,minWidth:28}}>MEM</span>
                  <div style={{flex:1}}><GBar v={d.mem||0}/></div>
                  <span style={{fontSize:10,color:(d.mem||0)>80?C.red:C.text,minWidth:30,textAlign:'right'}}>{d.mem||0}%</span>
                </div>
                {ping && (
                  <div style={{fontSize:10,color:ping.loss_pct>1?C.amber:C.muted}}>
                    ping {ping.latency_avg?.toFixed(1)||'—'}ms · perda {ping.loss_pct?.toFixed(1)||0}%
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DEVICES PAGE
// ════════════════════════════════════════════════════════════════════════════
function DevicesPage({ devices, setDevices, toast, role }) {
  const [form,setForm]   = useState(null)
  const [confirm,setConfirm] = useState(null)
  const [search,setSearch]   = useState('')
  const [fv,setFv]           = useState('all')
  const [fs,setFs]           = useState('all')
  const [loading,setLoading] = useState(false)

  const filtered = devices.filter(d=>{
    const q = search.toLowerCase()
    return (!q||(d.name+d.ip+d.model+d.location).toLowerCase().includes(q)) &&
           (fv==='all'||d.vendor===fv) && (fs==='all'||d.status===fs)
  })

  const save = async (data) => {
    setLoading(true)
    try {
      if (data.id) {
        const updated = await api.updateDevice(data.id, data)
        setDevices(p=>p.map(d=>d.id===data.id?updated:d))
        toast('Dispositivo atualizado!')
      } else {
        const created = await api.createDevice(data)
        setDevices(p=>[...p, created])
        toast('Dispositivo criado!')
      }
      setForm(null)
    } catch(e) { toast(e.message,'error') }
    setLoading(false)
  }

  const remove = async (id) => {
    try {
      await api.deleteDevice(id)
      setDevices(p=>p.filter(d=>d.id!==id))
      toast('Dispositivo removido.','warn')
    } catch(e) { toast(e.message,'error') }
    setConfirm(null)
  }

  const collectNow = async (d) => {
    toast(`Coletando ${d.name}...`)
    try {
      const r = await api.collectNow(d.id)
      if (r.cpu_pct !== undefined) {
        setDevices(p=>p.map(x=>x.id===d.id?{...x,cpu:r.cpu_pct,mem:r.mem_pct,status:r.status}:x))
        toast(`${d.name}: CPU ${r.cpu_pct?.toFixed(0)}% MEM ${r.mem_pct?.toFixed(0)}%`)
      }
    } catch(e) { toast(e.message,'error') }
  }

  return (
    <div>
      {form && <DeviceForm initial={form==='new'?null:form} onSave={save} onClose={()=>setForm(null)}/>}
      {confirm && <Confirm msg={confirm.msg} onConfirm={confirm.fn} onClose={()=>setConfirm(null)}/>}

      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Buscar nome, IP, modelo..."
          style={{flex:1,minWidth:200,background:C.input,border:`1px solid ${C.border}`,borderRadius:8,
                  padding:'9px 14px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
        <select value={fv} onChange={e=>setFv(e.target.value)}
          style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
          <option value="all">Todos fabricantes</option>
          <option value="mikrotik">Mikrotik</option>
          <option value="edd">EDD Datacom</option>
          <option value="huawei">Huawei</option>
        </select>
        <select value={fs} onChange={e=>setFs(e.target.value)}
          style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
          <option value="all">Todos status</option>
          <option value="up">Online</option>
          <option value="warning">Alerta</option>
          <option value="down">Offline</option>
        </select>
        {role==='admin' && <Btn onClick={()=>setForm('new')}>+ Novo Dispositivo</Btn>}
      </div>

      <Panel>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <Sec style={{marginBottom:0}}>Dispositivos ({filtered.length})</Sec>
          <span style={{fontSize:11,color:C.muted}}>
            {devices.filter(d=>d.status==='up').length} online · {devices.filter(d=>d.status==='warning').length} alerta · {devices.filter(d=>d.status==='down').length} offline
          </span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{color:C.muted,fontSize:10,letterSpacing:1}}>
                {['FABRICANTE','NOME','MODELO','IP','LOCAL','STATUS','CPU','MEM','UPTIME','AÇÕES'].map((h,i)=>(
                  <th key={i} style={{textAlign:'left',padding:'5px 10px',borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && (
                <tr><td colSpan={10} style={{padding:'30px',textAlign:'center',color:C.muted}}>Nenhum dispositivo encontrado.</td></tr>
              )}
              {filtered.map(d=>(
                <tr key={d.id} style={{borderBottom:`1px solid ${C.border}55`,transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#0a2018'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'9px 10px'}}><VTag v={d.vendor}/></td>
                  <td style={{padding:'9px 10px',fontWeight:700,color:C.text,fontFamily:"'Righteous',sans-serif",fontSize:11}}>{d.name}</td>
                  <td style={{padding:'9px 10px',color:C.muted,fontSize:11}}>{d.model}</td>
                  <td style={{padding:'9px 10px',color:C.teal,fontFamily:'monospace',fontSize:11}}>{d.ip}</td>
                  <td style={{padding:'9px 10px',color:C.muted}}>{d.location}</td>
                  <td style={{padding:'9px 10px'}}><Badge s={d.status||'unknown'}/></td>
                  <td style={{padding:'9px 10px',minWidth:80}}>
                    <div style={{display:'flex',gap:5,alignItems:'center'}}>
                      <span style={{fontFamily:'monospace',fontSize:11,color:(d.cpu||0)>70?C.red:C.text,minWidth:28}}>{d.cpu||0}%</span>
                      <div style={{flex:1}}><GBar v={d.cpu||0}/></div>
                    </div>
                  </td>
                  <td style={{padding:'9px 10px',minWidth:80}}>
                    <div style={{display:'flex',gap:5,alignItems:'center'}}>
                      <span style={{fontFamily:'monospace',fontSize:11,color:(d.mem||0)>80?C.red:C.text,minWidth:28}}>{d.mem||0}%</span>
                      <div style={{flex:1}}><GBar v={d.mem||0}/></div>
                    </div>
                  </td>
                  <td style={{padding:'9px 10px',color:C.muted,fontFamily:'monospace',fontSize:11}}>{d.uptime||'—'}</td>
                  <td style={{padding:'9px 10px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <Btn onClick={()=>collectNow(d)} variant="ghost" size="sm">▶</Btn>
                      {role==='admin' && <>
                        <Btn onClick={()=>setForm(d)} variant="teal" size="sm">Editar</Btn>
                        <Btn onClick={()=>setConfirm({msg:`Remover ${d.name}?`,fn:()=>remove(d.id)})} variant="danger" size="sm">×</Btn>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LINKS PAGE
// ════════════════════════════════════════════════════════════════════════════
function LinksPage({ links, setLinks, pingData, toast, role }) {
  const [form,setForm]       = useState(null)
  const [confirm,setConfirm] = useState(null)

  const save = async (data) => {
    try {
      if (data.id) {
        const updated = await api.updateLink(data.id, data)
        setLinks(p=>p.map(l=>l.id===data.id?updated:l))
        toast('Link atualizado!')
      } else {
        const created = await api.createLink(data)
        setLinks(p=>[...p,created])
        toast('Link criado!')
      }
      setForm(null)
    } catch(e) { toast(e.message,'error') }
  }

  const remove = async (id) => {
    try {
      await api.deleteLink(id)
      setLinks(p=>p.filter(l=>l.id!==id))
      toast('Link removido.','warn')
    } catch(e) { toast(e.message,'error') }
    setConfirm(null)
  }

  return (
    <div>
      {form && <LinkForm initial={form==='new'?null:form} onSave={save} onClose={()=>setForm(null)}/>}
      {confirm && <Confirm msg={confirm.msg} onConfirm={confirm.fn} onClose={()=>setConfirm(null)}/>}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        {role==='admin' && <Btn onClick={()=>setForm('new')}>+ Novo Link</Btn>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
        {links.map(l=>{
          const col = l.status==='up'?C.green:l.status==='warning'?C.amber:C.red
          const ping = pingData[l.ip]
          return (
            <Panel key={l.id} style={{borderLeft:`4px solid ${col}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                <div>
                  <div style={{fontFamily:"'Righteous',sans-serif",fontSize:14,color:C.text}}>{l.name}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:3}}>{l.provider} · {l.bw}{l.bwUnit}bps · {l.asnPeer}</div>
                </div>
                <Badge s={l.status||'unknown'}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
                {[['IN',`${(l.in||0).toFixed(2)}G`,C.green],['OUT',`${(l.out||0).toFixed(2)}G`,C.teal],
                  ['LAT',ping?`${ping.latency_avg?.toFixed(0)||'—'}ms`:`${l.lat||'—'}ms`,(l.lat||0)>50?C.amber:C.green]
                ].map(([k,v,c],i)=>(
                  <div key={i} style={{background:C.bg,borderRadius:5,padding:'6px 8px'}}>
                    <div style={{fontSize:9,color:C.muted}}>{k}</div>
                    <div style={{fontSize:14,fontWeight:700,color:c,fontFamily:"'Righteous',sans-serif"}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.muted,marginBottom:10}}>
                <span>Perda: <span style={{color:(l.loss||0)>.5?C.red:C.muted}}>{(l.loss||0).toFixed(1)}%</span></span>
                {ping && <span style={{color:ping.loss_pct>5?C.red:C.muted}}>ping {ping.loss_pct?.toFixed(0)}% loss</span>}
              </div>
              {l.notes && <div style={{fontSize:11,color:C.muted,marginBottom:10,fontStyle:'italic'}}>{l.notes}</div>}
              {role==='admin' && (
                <div style={{display:'flex',gap:8}}>
                  <Btn onClick={()=>setForm(l)} variant="teal" size="sm">Editar</Btn>
                  <Btn onClick={()=>setConfirm({msg:`Remover ${l.name}?`,fn:()=>remove(l.id)})} variant="danger" size="sm">Remover</Btn>
                </div>
              )}
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// USERS PAGE
// ════════════════════════════════════════════════════════════════════════════
function UsersPage({ toast, role }) {
  const [users,setUsers]     = useState([])
  const [form,setForm]       = useState(null)
  const [confirm,setConfirm] = useState(null)

  useEffect(()=>{ if(role==='admin') api.getUsers().then(setUsers).catch(()=>{}) },[role])

  if (role!=='admin') return <Panel><div style={{padding:20,textAlign:'center',color:C.muted}}>Acesso restrito a administradores.</div></Panel>

  const save = async (data) => {
    try {
      if (data.id) {
        const updated = await api.updateUser(data.id, data)
        setUsers(p=>p.map(u=>u.id===data.id?updated:u))
        toast('Usuário atualizado!')
      } else {
        const created = await api.createUser(data)
        setUsers(p=>[...p,created])
        toast('Usuário criado!')
      }
      setForm(null)
    } catch(e) { toast(e.message,'error') }
  }

  const remove = async (id) => {
    try {
      await api.deleteUser(id)
      setUsers(p=>p.filter(u=>u.id!==id))
      toast('Usuário removido.','warn')
    } catch(e) { toast(e.message,'error') }
    setConfirm(null)
  }

  const roleColor = { admin:C.green, operator:C.teal, viewer:C.muted }
  const roleLabel = { admin:'Administrador', operator:'Operador NOC', viewer:'Visualizador' }

  return (
    <div>
      {form && <UserForm initial={form==='new'?null:form} onSave={save} onClose={()=>setForm(null)}/>}
      {confirm && <Confirm msg={confirm.msg} onConfirm={confirm.fn} onClose={()=>setConfirm(null)}/>}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <Btn onClick={()=>setForm('new')}>+ Novo Usuário</Btn>
      </div>
      <Panel>
        <Sec>Usuários do Sistema</Sec>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {users.map(u=>(
            <div key={u.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${C.green}33,${C.deep}33)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:C.green,border:`1px solid ${C.border}`}}>
                {u.name[0]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:C.text,fontSize:13}}>{u.name}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{u.email}</div>
              </div>
              <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:`${roleColor[u.role]||'#555'}15`,color:roleColor[u.role]||'#555',border:`1px solid ${roleColor[u.role]||'#555'}33`}}>{roleLabel[u.role]||u.role}</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:u.active?`${C.green}15`:`${C.red}15`,color:u.active?C.green:C.red}}>{u.active?'Ativo':'Inativo'}</span>
              <div style={{display:'flex',gap:8}}>
                <Btn onClick={()=>setForm(u)} variant="teal" size="sm">Editar</Btn>
                <Btn onClick={()=>setConfirm({msg:`Remover ${u.name}?`,fn:()=>remove(u.id)})} variant="danger" size="sm">×</Btn>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// AI NOC
// ════════════════════════════════════════════════════════════════════════════
function AIPage({ devices, links }) {
  const [msgs,setMsgs]   = useState([{role:'assistant',text:'Olá! Sou o Maxxi NOC. Analiso sua rede CITmax com Mikrotik, EDD e Huawei em tempo real. Como posso ajudar?'}])
  const [input,setInput] = useState('')
  const [loading,setLoading] = useState(false)
  const endRef = useRef(null)
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) },[msgs])

  const ctx = `Você é o Maxxi NOC, assistente de rede da CITmax (provedor de internet Natal/RN).
Dispositivos: ${devices.map(d=>`${d.name}(${d.vendor},${d.model},status=${d.status},CPU=${d.cpu}%,MEM=${d.mem}%,IP=${d.ip})`).join('; ')}.
Links: ${links.map(l=>`${l.name}(${l.provider},${l.bw}${l.bwUnit}bps,IN=${l.in}G,perda=${l.loss}%,lat=${l.lat}ms)`).join('; ')}.
Responda em português, técnico e direto. Use os dados reais ao analisar.`

  const send = async () => {
    if (!input.trim()||loading) return
    const q = input.trim(); setInput('')
    setMsgs(p=>[...p,{role:'user',text:q}]); setLoading(true)
    try {
      const history = msgs.map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.text}))
      const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,system:ctx,messages:[...history,{role:'user',content:q}]})})
      const d = await res.json()
      setMsgs(p=>[...p,{role:'assistant',text:d.content?.[0]?.text||'Erro.'}])
    } catch { setMsgs(p=>[...p,{role:'assistant',text:'Erro de conexão.'}]) }
    setLoading(false)
  }

  const sugs = ['Dispositivos com problema agora','Analise a qualidade dos links','Como integrar Mikrotik com Python?','Configurar SNMP no EDD','ONTs offline no Huawei MA5800']

  return (
    <div style={{maxWidth:800,margin:'0 auto'}}>
      <Panel style={{display:'flex',flexDirection:'column',height:560}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${C.green},${C.deep})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>⚡</div>
          <div>
            <div style={{fontFamily:"'Righteous',sans-serif",fontSize:14,color:C.text}}>MAXXI NOC — Assistente IA</div>
            <div style={{fontSize:10,color:C.green}}>● {devices.length} dispositivos · {links.length} links carregados</div>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingRight:4,marginBottom:10}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{maxWidth:'84%',padding:'10px 14px',borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',background:m.role==='user'?`linear-gradient(135deg,${C.deep},${C.teal})`:'#0d2a1e',border:m.role==='assistant'?`1px solid ${C.border}`:'none',fontSize:12,color:C.text,lineHeight:1.65,whiteSpace:'pre-wrap'}}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{display:'flex'}}><div style={{padding:'10px 14px',borderRadius:'14px 14px 14px 4px',background:'#0d2a1e',border:`1px solid ${C.border}`,fontSize:12,color:C.muted,animation:'pulse 1s infinite'}}>Analisando...</div></div>}
          <div ref={endRef}/>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
          {sugs.map((s,i)=>(
            <button key={i} onClick={()=>setInput(s)} style={{fontSize:10,padding:'4px 10px',borderRadius:20,background:'#0d2a1e',border:`1px solid ${C.border}`,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>{s}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Pergunte sobre a rede..."
            style={{flex:1,background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
          <Btn onClick={send} disabled={loading}>{loading?'...':'ENVIAR'}</Btn>
        </div>
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]         = useState(null)
  const [tab,setTab]           = useState('overview')
  const [devices,setDevices]   = useState([])
  const [links,setLinks]       = useState([])
  const [alerts,setAlerts]     = useState([])
  const [pingData,setPingData] = useState({})
  const [liveMetrics,setLiveMetrics] = useState([])
  const [now,setNow]           = useState(new Date())
  const [toastMsg,setToastMsg] = useState(null)
  const [wsStatus,setWsStatus] = useState('offline')
  const wsCleanup              = useRef(null)

  const toast = (msg,type='success') => setToastMsg({msg,type})

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(()=>{ const iv=setInterval(()=>setNow(new Date()),1000); return()=>clearInterval(iv) },[])

  // ── Auto login com token salvo ─────────────────────────────────────────────
  useEffect(()=>{
    const t = getToken()
    if (t) {
      api.login && setUser({ name:'...', role:'operator' }) // placeholder até /me
    }
  },[])

  // ── Carregar dados quando logar ────────────────────────────────────────────
  useEffect(()=>{
    if (!user) return
    Promise.all([
      api.getDevices().then(setDevices),
      api.getLinks().then(setLinks),
      api.getAlerts().then(setAlerts),
    ]).catch(e=>{ if(e.message?.includes('401')){ setUser(null); setToken(null) } })
  },[user])

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    if (!user) return
    setWsStatus('connecting')
    const cleanup = createWS(msg=>{
      if (msg.type==='metrics_update') {
        setLiveMetrics(msg.data)
        setWsStatus('online')
        // Atualiza CPU/mem/status dos devices em tempo real
        setDevices(prev=>prev.map(d=>{
          const live = msg.data.find(m=>m.device_id===d.id)
          return live ? {...d, cpu:Math.round(live.cpu_pct||0), mem:Math.round(live.mem_pct||0), status:live.status||d.status} : d
        }))
      }
      if (msg.type==='ping_update') {
        setPingData(prev=>({...prev,...msg.data}))
      }
    })
    wsCleanup.current = cleanup
    return ()=>{ cleanup(); setWsStatus('offline') }
  },[user])

  const logout = () => {
    setToken(null)
    setUser(null)
    wsCleanup.current?.()
    setDevices([]); setLinks([]); setAlerts([])
  }

  if (!user) return <LoginScreen onLogin={setUser}/>

  const tabs = [
    {id:'overview', label:'Visão Geral'},
    {id:'devices',  label:'Dispositivos'},
    {id:'links',    label:'Links'},
    {id:'users',    label:'Usuários', adminOnly:true},
    {id:'ai',       label:'⚡ Maxxi NOC'},
    {id:'superadmin', label:'Super Admin', adminOnly:true},
  ].filter(t=>!t.adminOnly||user.role==='admin')

  const wsColor = wsStatus==='online'?C.green:wsStatus==='connecting'?C.amber:C.red

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Montserrat',sans-serif"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(90deg,${C.bg} 0%,#041a0e 50%,${C.bg} 100%)`,borderBottom:`1px solid ${C.border}`,padding:'0 18px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <svg width="26" height="26" viewBox="0 0 26 26">
            <polygon points="13,2 23,7.5 23,18.5 13,24 3,18.5 3,7.5" fill={`${C.green}15`} stroke={C.green} strokeWidth="1.5"/>
            {[[13,8],[19,13],[13,18],[7,13]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="1.5" fill="white"/>)}
            <line x1="13" y1="8"  x2="19" y2="13" stroke="white" strokeWidth="1" opacity=".6"/>
            <line x1="19" y1="13" x2="13" y2="18" stroke="white" strokeWidth="1" opacity=".6"/>
            <line x1="13" y1="18" x2="7"  y2="13" stroke="white" strokeWidth="1" opacity=".6"/>
            <line x1="7"  y1="13" x2="13" y2="8"  stroke="white" strokeWidth="1" opacity=".6"/>
          </svg>
          <span style={{fontFamily:"'Righteous',sans-serif",fontSize:18,color:C.green}}>CIT</span>
          <span style={{fontFamily:"'Righteous',sans-serif",fontSize:18,color:C.teal,marginLeft:-10}}>max</span>
          <div style={{width:1,height:18,background:C.border,margin:'0 4px'}}/>
          <span style={{fontSize:10,color:C.muted,letterSpacing:2,fontWeight:600}}>NETWORK MONITOR</span>
        </div>

        <div style={{display:'flex',gap:3}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'6px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:600,
                      background:tab===t.id?`${C.green}15`:'transparent',color:tab===t.id?C.green:C.muted,
                      borderBottom:tab===t.id?`2px solid ${C.green}`:'2px solid transparent',transition:'all .2s'}}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:wsColor}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:wsColor,boxShadow:`0 0 6px ${wsColor}`,display:'inline-block',animation:wsStatus==='online'?'pulse 2.5s infinite':undefined}}/>
            WS {wsStatus}
          </div>
          <span style={{fontSize:11,color:C.teal,fontFamily:'monospace'}}>{now.toLocaleTimeString('pt-BR')}</span>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 10px',borderRadius:20,background:C.card,border:`1px solid ${C.border}`}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:`linear-gradient(135deg,${C.green}44,${C.deep}44)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:C.green,fontWeight:700}}>{user.name[0]}</div>
            <span style={{fontSize:11,color:C.text}}>{user.name.split(' ')[0]}</span>
            <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,background:`${user.role==='admin'?C.green:C.teal}15`,color:user.role==='admin'?C.green:C.teal}}>{user.role}</span>
          </div>
          <button onClick={logout} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 10px',color:C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Sair</button>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1440,margin:'0 auto',padding:18}}>
        {tab==='overview' && <OverviewPage devices={devices} links={links} alerts={alerts} liveMetrics={liveMetrics} pingData={pingData}/>}
        {tab==='devices'  && <DevicesPage  devices={devices} setDevices={setDevices} toast={toast} role={user.role}/>}
        {tab==='links'    && <LinksPage    links={links} setLinks={setLinks} pingData={pingData} toast={toast} role={user.role}/>}
        {tab==='users'    && <UsersPage    toast={toast} role={user.role}/>}
        {tab==='ai'       && <AIPage devices={devices} links={links}/>}
        {tab==='superadmin' && <SuperAdminPage toast={toast}/>}
      </div>

      <div style={{textAlign:'center',padding:14,color:C.border,fontSize:10,letterSpacing:2,fontFamily:"'Righteous',sans-serif"}}>
        CITMAX NETWORK MONITOR · NATAL–RN · MIKROTIK · EDD DATACOM · HUAWEI
      </div>

      {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} onDone={()=>setToastMsg(null)}/>}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const C = {
  green:'#00c896', teal:'#008B87', deep:'#036271',
  bg:'#02100c', panel:'#061812', card:'#081e15',
  border:'#0d3828', text:'#d0f0e4', muted:'#3a8a62',
  red:'#ff3f5a', amber:'#ffb800', input:'#0a2018',
}

const Panel = ({children,style})=><div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:18,...style}}>{children}</div>
const Sec = ({children,style})=><div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.teal,textTransform:'uppercase',marginBottom:14,fontFamily:"'Righteous',sans-serif",...style}}>{children}</div>

const Btn = ({children,onClick,variant='primary',size='md',disabled,style})=>{
  const sz={sm:{fontSize:11,padding:'4px 12px'},md:{fontSize:12,padding:'8px 16px'}}[size]
  const v={
    primary:{background:`linear-gradient(135deg,${C.green},${C.teal})`,color:'#02100c',border:'none'},
    danger: {background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}44`},
    ghost:  {background:'transparent',color:C.muted,border:`1px solid ${C.border}`},
    teal:   {background:`${C.teal}18`,color:C.teal,border:`1px solid ${C.teal}44`},
    amber:  {background:`${C.amber}18`,color:C.amber,border:`1px solid ${C.amber}44`},
  }[variant]||{}
  return <button onClick={onClick} disabled={disabled}
    style={{borderRadius:7,cursor:disabled?'not-allowed':'pointer',fontFamily:"'Righteous',sans-serif",
            fontWeight:700,transition:'all .2s',opacity:disabled?.5:1,...sz,...v,...style}}>{children}</button>
}

const Badge = ({status})=>{
  const m={
    active:  [C.green,  '#001a10','ATIVO'],
    trial:   [C.amber,  '#1a0f00','TRIAL'],
    suspended:[C.red,   '#1a0008','SUSPENSO'],
    cancelled:['#555',  '#111',   'CANCELADO'],
  }
  const [col,bg,lbl] = m[status]||['#555','#111',status]
  return <span style={{fontSize:10,fontWeight:700,letterSpacing:1,padding:'2px 10px',borderRadius:4,color:col,background:bg,border:`1px solid ${col}33`}}>{lbl}</span>
}

const Modal = ({title,onClose,children,width=500})=>(
  <div style={{position:'fixed',inset:0,background:'#000000d0',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:24,width:'100%',maxWidth:width,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <span style={{fontFamily:"'Righteous',sans-serif",fontSize:16,color:C.text}}>{title}</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}>✕</button>
      </div>
      {children}
    </div>
  </div>
)

// ─── Tenant Detail Modal ──────────────────────────────────────────────────────
function TenantModal({ tenant, onClose, onAction, toast }) {
  const [plan, setPlan] = useState(tenant.plan?.name || 'starter')
  const [loading, setLoading] = useState(false)

  const action = async (type) => {
    setLoading(true)
    try { await onAction(tenant.id, type, plan); onClose() }
    catch(e) { toast(e.message,'error') }
    setLoading(false)
  }

  const fields = [
    ['Empresa',    tenant.company_name],
    ['Email',      tenant.email],
    ['Telefone',   tenant.phone || '—'],
    ['Cidade/UF',  tenant.city ? `${tenant.city}/${tenant.state}` : '—'],
    ['Slug',       tenant.slug],
    ['Plano',      tenant.plan?.display_name || '—'],
    ['Status',     tenant.status],
    ['Criado em',  new Date(tenant.created_at).toLocaleDateString('pt-BR')],
    ['Trial até',  tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString('pt-BR') : '—'],
    ['Dispositivos', tenant.device_count || 0],
    ['Stripe',     tenant.has_stripe ? '✓ Configurado' : '✗ Não configurado'],
    ['WhatsApp',   tenant.whatsapp_configured ? '✓' : '✗'],
    ['Telegram',   tenant.telegram_configured ? '✓' : '✗'],
  ]

  return (
    <Modal title={tenant.company_name} onClose={onClose} width={560}>
      {/* Branding preview */}
      <div style={{padding:'12px 16px',background:C.bg,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
        {tenant.logo_url && <img src={tenant.logo_url} alt="" style={{height:28,objectFit:'contain'}} onError={e=>e.target.style.display='none'}/>}
        <span style={{fontFamily:"'Righteous',sans-serif",fontSize:16,color:tenant.primary_color||C.green}}>{tenant.app_name||'NetWatch'}</span>
        <div style={{width:16,height:16,borderRadius:'50%',background:tenant.primary_color||C.green,marginLeft:'auto'}}/>
        <span style={{fontSize:11,color:C.muted}}>{tenant.primary_color||'#00c896'}</span>
      </div>

      {/* Info grid */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
        {fields.map(([k,v],i)=>(
          <div key={i} style={{background:C.bg,borderRadius:6,padding:'8px 12px'}}>
            <div style={{fontSize:9,color:C.muted,marginBottom:2,letterSpacing:.5}}>{k.toUpperCase()}</div>
            <div style={{fontSize:12,color:C.text,fontFamily:'monospace'}}>{String(v)}</div>
          </div>
        ))}
      </div>

      {/* Ações */}
      <Sec>Ações</Sec>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
        {tenant.status !== 'active' &&
          <Btn onClick={()=>action('activate')} disabled={loading}>✓ Ativar</Btn>}
        {tenant.status !== 'suspended' &&
          <Btn onClick={()=>action('suspend')} variant="danger" disabled={loading}>⊘ Suspender</Btn>}
      </div>

      {/* Mudar plano */}
      <Sec>Mudar Plano</Sec>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <select value={plan} onChange={e=>setPlan(e.target.value)}
          style={{flex:1,background:C.input,border:`1px solid ${C.border}`,borderRadius:7,padding:'9px 12px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
          <option value="starter">Starter — R$97/mês</option>
          <option value="pro">Pro — R$197/mês</option>
          <option value="enterprise">Enterprise — R$397/mês</option>
        </select>
        <Btn onClick={()=>action('change_plan')} variant="teal" disabled={loading}>Aplicar</Btn>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function SuperAdminPage({ toast }) {
  const [stats,setStats]     = useState(null)
  const [tenants,setTenants] = useState([])
  const [selected,setSelected] = useState(null)
  const [search,setSearch]   = useState('')
  const [filter,setFilter]   = useState('all')
  const [loading,setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([
        api.superAdminStats(),
        api.superAdminTenants(),
      ])
      setStats(s)
      setTenants(t)
    } catch(e) {
      toast('Erro ao carregar dados: ' + e.message, 'error')
    }
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  const handleAction = async (tenantId, type, plan) => {
    if (type === 'activate')    await api.superAdminActivate(tenantId)
    if (type === 'suspend')     await api.superAdminSuspend(tenantId)
    if (type === 'change_plan') await api.superAdminChangePlan(tenantId, plan)
    toast('Ação executada com sucesso!')
    await load()
  }

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase()
    const matchQ = !q || (t.company_name + t.email + t.city).toLowerCase().includes(q)
    const matchF = filter === 'all' || t.status === filter
    return matchQ && matchF
  })

  // MRR estimado
  const mrr = tenants.filter(t=>t.status==='active').reduce((s,t)=>{
    const prices = { starter:97, pro:197, enterprise:397 }
    return s + (prices[t.plan?.name] || 0)
  }, 0)

  if (loading) return <div style={{padding:40,textAlign:'center',color:C.muted}}>Carregando...</div>

  return (
    <div>
      {selected && (
        <TenantModal
          tenant={selected}
          onClose={()=>setSelected(null)}
          onAction={handleAction}
          toast={toast}
        />
      )}

      {/* KPIs */}
      {stats && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
          {[
            {l:'Total Provedores', v:stats.total_tenants,  c:C.teal},
            {l:'Ativos',          v:stats.active_tenants,  c:C.green},
            {l:'Em Trial',        v:stats.trial_tenants,   c:C.amber},
            {l:'Total Devices',   v:stats.total_devices,   c:C.teal},
            {l:'MRR Estimado',    v:`R$ ${mrr.toLocaleString('pt-BR')}`, c:C.green},
            {l:'MRR Anual',       v:`R$ ${(mrr*12).toLocaleString('pt-BR')}`, c:C.green},
          ].map((k,i)=>(
            <Panel key={i} style={{padding:'12px 16px'}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:.5,marginBottom:5}}>{k.l}</div>
              <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"'Righteous',sans-serif"}}>{k.v}</div>
            </Panel>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Buscar por nome, email, cidade..."
          style={{flex:1,minWidth:200,background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 14px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)}
          style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}>
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="trial">Em Trial</option>
          <option value="suspended">Suspensos</option>
        </select>
        <Btn onClick={load} variant="ghost">↻ Atualizar</Btn>
      </div>

      {/* Tabela de tenants */}
      <Panel>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <Sec style={{marginBottom:0}}>Provedores ({filtered.length})</Sec>
          <span style={{fontSize:11,color:C.muted}}>
            {tenants.filter(t=>t.status==='active').length} ativos · {tenants.filter(t=>t.status==='trial').length} trial · {tenants.filter(t=>t.status==='suspended').length} suspensos
          </span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{color:C.muted,fontSize:10,letterSpacing:1}}>
                {['PROVEDOR','EMAIL','CIDADE','PLANO','STATUS','DEVICES','TRIAL ATÉ','BRANDING','AÇÕES'].map((h,i)=>(
                  <th key={i} style={{textAlign:'left',padding:'5px 10px',borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && (
                <tr><td colSpan={9} style={{padding:'30px',textAlign:'center',color:C.muted}}>Nenhum provedor encontrado.</td></tr>
              )}
              {filtered.map(t=>(
                <tr key={t.id}
                  style={{borderBottom:`1px solid ${C.border}55`,cursor:'pointer',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#0a2018'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'10px 10px'}}>
                    <div style={{fontWeight:700,color:C.text,fontFamily:"'Righteous',sans-serif",fontSize:12}}>{t.company_name}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{t.slug}</div>
                  </td>
                  <td style={{padding:'10px 10px',color:C.muted,fontSize:11}}>{t.email}</td>
                  <td style={{padding:'10px 10px',color:C.muted,fontSize:11}}>{t.city||'—'}/{t.state||'—'}</td>
                  <td style={{padding:'10px 10px'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:4,
                      background:t.plan?.name==='enterprise'?`${C.green}15`:t.plan?.name==='pro'?`${C.teal}15`:`${C.muted}15`,
                      color:t.plan?.name==='enterprise'?C.green:t.plan?.name==='pro'?C.teal:C.muted,
                      border:`1px solid ${t.plan?.name==='enterprise'?C.green:t.plan?.name==='pro'?C.teal:C.muted}33`}}>
                      {t.plan?.display_name||'—'}
                    </span>
                  </td>
                  <td style={{padding:'10px 10px'}}><Badge status={t.status}/></td>
                  <td style={{padding:'10px 10px',color:C.teal,fontWeight:700,fontFamily:'monospace'}}>{t.device_count||0}</td>
                  <td style={{padding:'10px 10px',color:C.muted,fontSize:11,fontFamily:'monospace'}}>
                    {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{padding:'10px 10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:14,height:14,borderRadius:'50%',background:t.primary_color||C.green,border:`1px solid ${C.border}`}}/>
                      {t.logo_url && <span style={{fontSize:10,color:C.green}}>logo ✓</span>}
                    </div>
                  </td>
                  <td style={{padding:'10px 10px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <Btn onClick={()=>setSelected(t)} variant="teal" size="sm">Detalhes</Btn>
                      {t.status==='trial' && (
                        <Btn onClick={async()=>{
                          await handleAction(t.id,'activate','')
                        }} variant="primary" size="sm">Ativar</Btn>
                      )}
                      {t.status==='active' && (
                        <Btn onClick={async()=>{
                          if(confirm(`Suspender ${t.company_name}?`)) await handleAction(t.id,'suspend','')
                        }} variant="danger" size="sm">Suspender</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Resumo financeiro */}
      {tenants.length > 0 && (
        <Panel style={{marginTop:16}}>
          <Sec>Distribuição por Plano</Sec>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {['starter','pro','enterprise'].map(planName=>{
              const count = tenants.filter(t=>t.plan?.name===planName && t.status==='active').length
              const prices = {starter:97,pro:197,enterprise:397}
              const revenue = count * prices[planName]
              const labels = {starter:'Starter',pro:'Pro',enterprise:'Enterprise'}
              const colors = {starter:C.muted,pro:C.teal,enterprise:C.green}
              return (
                <div key={planName} style={{background:C.bg,borderRadius:8,padding:16,border:`1px solid ${C.border}`,borderLeft:`3px solid ${colors[planName]}`}}>
                  <div style={{fontSize:12,color:colors[planName],fontWeight:700,marginBottom:8,fontFamily:"'Righteous',sans-serif"}}>{labels[planName]}</div>
                  <div style={{fontSize:24,fontWeight:800,color:C.text,fontFamily:"'Righteous',sans-serif",marginBottom:4}}>{count}</div>
                  <div style={{fontSize:11,color:C.muted}}>provedores ativos</div>
                  <div style={{fontSize:14,color:colors[planName],fontWeight:700,marginTop:8}}>R$ {revenue.toLocaleString('pt-BR')}/mês</div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}
    </div>
  )
}

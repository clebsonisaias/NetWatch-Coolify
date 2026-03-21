import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const C = {
  green:'#00c896', teal:'#008B87', bg:'#02100c',
  panel:'#061812', border:'#0d3828', text:'#d0f0e4',
  muted:'#3a8a62', red:'#ff3f5a', amber:'#ffb800', input:'#0a2018',
}
const Panel = ({children,style})=><div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:20,...style}}>{children}</div>
const Sec = ({children})=><div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.teal,textTransform:'uppercase',marginBottom:14,fontFamily:"'Righteous',sans-serif"}}>{children}</div>
const Inp = ({label,value,onChange,type='text',placeholder})=>(
  <div style={{display:'flex',flexDirection:'column',gap:5,flex:1}}>
    {label&&<label style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{background:C.input,border:`1px solid ${C.border}`,borderRadius:7,padding:'9px 12px',color:C.text,fontSize:12,fontFamily:'inherit',outline:'none'}}/>
  </div>
)
const Btn = ({children,onClick,variant='primary',disabled,style})=>{
  const v={primary:{background:`linear-gradient(135deg,${C.green},${C.teal})`,color:'#02100c',border:'none'},
            ghost:{background:'transparent',color:C.muted,border:`1px solid ${C.border}`},
            danger:{background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}44`}}[variant]||{}
  return <button onClick={onClick} disabled={disabled}
    style={{padding:'9px 18px',borderRadius:7,fontWeight:700,fontFamily:"'Righteous',sans-serif",fontSize:12,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,transition:'all .2s',...v,...style}}>{children}</button>
}

export default function SettingsPage({ user, toast }) {
  const [tenant,setTenant]   = useState(null)
  const [usage,setUsage]     = useState(null)
  const [payments,setPayments] = useState([])
  const [saving,setSaving]   = useState(false)
  const [tab,setTab]         = useState('branding')

  // Branding form
  const [appName,setAppName]       = useState('')
  const [primaryColor,setColor]    = useState('#00c896')
  const [logoUrl,setLogoUrl]       = useState('')
  const [companyName,setCompany]   = useState('')
  const [phone,setPhone]           = useState('')

  // Notifications form
  const [waUrl,setWaUrl]     = useState('')
  const [waKey,setWaKey]     = useState('')
  const [waGroup,setWaGroup] = useState('')
  const [tgToken,setTgToken] = useState('')
  const [tgChat,setTgChat]   = useState('')

  useEffect(()=>{
    api.getMyTenant().then(t=>{
      setTenant(t)
      setAppName(t.app_name||'NetWatch')
      setColor(t.primary_color||'#00c896')
      setLogoUrl(t.logo_url||'')
      setCompany(t.company_name||'')
      setPhone(t.phone||'')
    }).catch(()=>{})
    api.getUsage().then(setUsage).catch(()=>{})
    if (user.role==='admin') api.getPayments().then(setPayments).catch(()=>{})
  },[])

  const saveBranding = async () => {
    setSaving(true)
    try {
      const updated = await api.updateTenant({ app_name:appName, primary_color:primaryColor, logo_url:logoUrl, company_name:companyName, phone })
      setTenant(updated)
      toast('Configurações salvas!')
      // Recarrega para aplicar cores
      setTimeout(()=>window.location.reload(), 500)
    } catch(e){ toast(e.message,'error') }
    setSaving(false)
  }

  const saveNotifications = async () => {
    setSaving(true)
    try {
      await api.updateTenant({ whatsapp_api_url:waUrl, whatsapp_api_key:waKey, whatsapp_group:waGroup, telegram_token:tgToken, telegram_chat_id:tgChat })
      toast('Notificações salvas!')
    } catch(e){ toast(e.message,'error') }
    setSaving(false)
  }

  const openBillingPortal = async () => {
    try {
      const r = await api.getBillingPortal()
      window.open(r.portal_url, '_blank')
    } catch(e){ toast(e.message,'error') }
  }

  const tabs = [{id:'branding',label:'Identidade Visual'},{id:'notifications',label:'Notificações'},{id:'billing',label:'Plano & Faturamento'}]

  if(!tenant) return <div style={{padding:40,color:C.muted,textAlign:'center'}}>Carregando...</div>

  return (
    <div>
      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:`1px solid ${C.border}`,paddingBottom:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 16px',background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'Righteous',sans-serif",color:tab===t.id?C.green:C.muted,borderBottom:tab===t.id?`2px solid ${C.green}`:'2px solid transparent',transition:'all .2s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BRANDING */}
      {tab==='branding' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <Panel style={{gridColumn:'1/-1'}}>
            <Sec>Identidade Visual (White-label)</Sec>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <Inp label="Nome da Plataforma" value={appName} onChange={setAppName} placeholder="NetWatch"/>
              <Inp label="Nome do Provedor" value={companyName} onChange={setCompany} placeholder="Minha Telecom"/>
              <Inp label="URL da Logo (PNG/SVG)" value={logoUrl} onChange={setLogoUrl} placeholder="https://..."/>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:11,color:C.muted,fontWeight:600}}>Cor Principal</label>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <input type="color" value={primaryColor} onChange={e=>setColor(e.target.value)}
                    style={{width:44,height:44,border:'none',borderRadius:8,cursor:'pointer',background:'none'}}/>
                  <input type="text" value={primaryColor} onChange={e=>setColor(e.target.value)}
                    style={{flex:1,background:C.input,border:`1px solid ${C.border}`,borderRadius:7,padding:'9px 12px',color:C.text,fontSize:12,fontFamily:'monospace',outline:'none'}}/>
                </div>
              </div>
              <Inp label="Telefone / WhatsApp da empresa" value={phone} onChange={setPhone} placeholder="(84) 2018-2178"/>
            </div>
            {/* Preview */}
            <div style={{marginTop:20,padding:16,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>PREVIEW</div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {logoUrl && <img src={logoUrl} alt="logo" style={{height:28,objectFit:'contain'}} onError={e=>e.target.style.display='none'}/>}
                <span style={{fontFamily:"'Righteous',sans-serif",fontSize:18,color:primaryColor}}>{appName}</span>
              </div>
              <div style={{marginTop:10,display:'flex',gap:8}}>
                <div style={{background:`linear-gradient(135deg,${primaryColor},${primaryColor}88)`,color:'#02100c',padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,fontFamily:"'Righteous',sans-serif"}}>Botão primário</div>
                <div style={{border:`1px solid ${primaryColor}`,color:primaryColor,padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600}}>Botão secundário</div>
              </div>
            </div>
            <div style={{marginTop:16,display:'flex',justifyContent:'flex-end'}}>
              <Btn onClick={saveBranding} disabled={saving}>{saving?'Salvando...':'Salvar Identidade Visual'}</Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* NOTIFICAÇÕES */}
      {tab==='notifications' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <Panel>
            <Sec>WhatsApp (Evolution API)</Sec>
            <div style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:1.7}}>
              Para receber alertas no WhatsApp, configure sua instância da <a href="https://evolution-api.com" style={{color:C.green}} target="_blank">Evolution API</a>.
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <Inp label="URL da API" value={waUrl} onChange={setWaUrl} placeholder="http://sua-vps:8080"/>
              <Inp label="API Key" value={waKey} onChange={setWaKey} placeholder="sua_chave_aqui" type="password"/>
              <div style={{gridColumn:'1/-1'}}>
                <Inp label="Número ou Grupo destino" value={waGroup} onChange={setWaGroup} placeholder="5584999999999@s.whatsapp.net"/>
              </div>
            </div>
          </Panel>
          <Panel>
            <Sec>Telegram Bot</Sec>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <Inp label="Bot Token" value={tgToken} onChange={setTgToken} placeholder="1234567890:ABC..." type="password"/>
              <Inp label="Chat ID ou Group ID" value={tgChat} onChange={setTgChat} placeholder="-100123456789"/>
            </div>
          </Panel>
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <Btn onClick={saveNotifications} disabled={saving}>{saving?'Salvando...':'Salvar Notificações'}</Btn>
          </div>
        </div>
      )}

      {/* BILLING */}
      {tab==='billing' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Status do plano */}
          {usage && (
            <Panel>
              <Sec>Plano Atual</Sec>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:16}}>
                {[
                  {l:'Plano', v:usage.plan, c:C.green},
                  {l:'Status', v:tenant?.status?.toUpperCase(), c:tenant?.status==='active'?C.green:C.amber},
                  {l:'Dispositivos', v:`${usage.devices.current}/${usage.devices.max===-1?'∞':usage.devices.max}`, c:C.teal},
                  {l:'Usuários', v:`${usage.users.current}/${usage.users.max===-1?'∞':usage.users.max}`, c:C.teal},
                ].map((k,i)=>(
                  <div key={i} style={{background:C.bg,borderRadius:8,padding:'12px 16px'}}>
                    <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"'Righteous',sans-serif"}}>{k.v}</div>
                  </div>
                ))}
              </div>
              {usage.trial_ends && (
                <div style={{padding:'10px 14px',background:`${C.amber}12`,border:`1px solid ${C.amber}33`,borderRadius:6,fontSize:12,color:C.amber}}>
                  ⏰ Trial expira em: {new Date(usage.trial_ends).toLocaleDateString('pt-BR')} — Ative seu plano para continuar.
                </div>
              )}
              <div style={{display:'flex',gap:10,marginTop:16}}>
                <Btn onClick={openBillingPortal}>Gerenciar assinatura</Btn>
                <Btn variant="ghost" onClick={()=>window.open('/','_blank')}>Ver outros planos</Btn>
              </div>
            </Panel>
          )}

          {/* Histórico de pagamentos */}
          {payments.length > 0 && (
            <Panel>
              <Sec>Histórico de Pagamentos</Sec>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{color:C.muted,fontSize:10,letterSpacing:1}}>
                    {['DATA','DESCRIÇÃO','VALOR','STATUS'].map((h,i)=>(
                      <th key={i} style={{textAlign:'left',padding:'5px 10px',borderBottom:`1px solid ${C.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${C.border}55`}}>
                      <td style={{padding:'8px 10px',color:C.muted,fontFamily:'monospace'}}>{p.paid_at?new Date(p.paid_at).toLocaleDateString('pt-BR'):'-'}</td>
                      <td style={{padding:'8px 10px',color:C.text}}>{p.description||'Assinatura'}</td>
                      <td style={{padding:'8px 10px',color:C.green,fontWeight:700}}>R$ {p.amount_brl.toFixed(2)}</td>
                      <td style={{padding:'8px 10px'}}>
                        <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,
                          background:p.status==='paid'?`${C.green}15`:`${C.red}15`,
                          color:p.status==='paid'?C.green:C.red}}>
                          {p.status==='paid'?'PAGO':'PENDENTE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

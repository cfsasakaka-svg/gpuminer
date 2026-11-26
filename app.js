const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); } catch {}

let sdkReady = false;
let account = null;
let busy = false;
let gpmBusy = false;
function notifyUser(title, message, type='success') {
  const layer=document.getElementById('appNoticeLayer');
  const card=layer?.querySelector('.appNoticeCard');
  if(!layer||!card){alert(title+'\n'+message);return;}
  card.className='appNoticeCard '+type;
  document.getElementById('appNoticeIcon').textContent=type==='error'?'!':type==='info'?'i':'✓';
  document.getElementById('appNoticeTitle').textContent=title;
  document.getElementById('appNoticeMessage').textContent=message;
  layer.classList.add('show');
  layer.setAttribute('aria-hidden','false');
  const close=()=>{layer.classList.remove('show');layer.setAttribute('aria-hidden','true');};
  document.getElementById('appNoticeAccept').onclick=close;
  layer.onclick=e=>{if(e.target===layer)close();};
  try{tg?.HapticFeedback?.notificationOccurred(type==='error'?'error':'success');}catch{}
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const layer=document.getElementById('appNoticeLayer');if(layer?.classList.contains('show')){layer.classList.remove('show');layer.setAttribute('aria-hidden','true');}}});

let toastTimer = null;
function showToast(message, type = 'success') {
  let box = document.getElementById('gpmToast');
  if (!box) { box = document.createElement('div'); box.id = 'gpmToast'; box.setAttribute('role','status'); box.setAttribute('aria-live','polite'); document.body.appendChild(box); }
  box.className = 'gpm-toast ' + type;
  box.innerHTML = '<span class="toast-mark">' + (type === 'error' ? '!' : type === 'pending' ? '…' : '✓') + '</span><span></span>';
  box.lastElementChild.textContent = message;
  requestAnimationFrame(() => box.classList.add('visible'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('visible'), 3400);
}
function animateButton(button) {
  if (!button) return;
  button.classList.remove('tap-pop');
  void button.offsetWidth;
  button.classList.add('tap-pop');
  setTimeout(() => button.classList.remove('tap-pop'), 420);
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button && !button.disabled) animateButton(button);
});

function show(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector(`[data-view="${id}"]`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const section = document.getElementById(id)?.querySelector('.section-title')?.textContent || ({farm:'Granja',deposit:'Tienda GPM',withdraw:'Retirar',partners:'Socios',profile:'Perfil'}[id] || 'Sección');
  showToast(section + ' abierta.');
}
function rankName(n) {
  return ["", "Rookie", "Miner", "Tech", "Advanced", "Expert", "Master", "Elite", "Legend"][Math.min(n, 8)] || "Legend";
}
function authHeaders() {
  return { "X-Telegram-Init-Data": tg?.initData || "" };
}
function setNotice(message) {
  const el = document.getElementById('adStatus');
  if (el) el.textContent = message;
}
function updateAccount(data) {
  account = data;
  document.getElementById('balance').textContent = Number(data.balance || 0).toFixed(6) + ' USDT';
  const xp = Number(data.xp || 0), rank = Number(data.rank || 1);
  document.getElementById('xp').textContent = (xp % 100) + ' / 100';
  document.getElementById('xpbar').style.width = (xp % 100) + '%';
  document.getElementById('rank').textContent = rankName(rank);
  document.getElementById('rankShort').textContent = rank;
  document.getElementById('profRank').textContent = rankName(rank);
  document.getElementById('profXP').textContent = xp;
  document.getElementById('missionCount').textContent = String(data.rewards || 0);
  const user = data.user || {};
  const nameEl = document.getElementById('tgName');
  if (nameEl) nameEl.textContent = user.firstName || user.username || ('Telegram ' + user.id);const u=document.getElementById('profUsername');if(u)u.textContent=user.username?'@'+user.username:'Sin nombre de usuario';const rb=document.getElementById('profUSDT');if(rb)rb.textContent=Number(data.balance||0).toFixed(6)+' USDT';const rw=document.getElementById('profRewards');if(rw)rw.textContent=String(data.rewards||0);
}
async function refreshAccount() {
  if (!tg?.initData) throw new Error('Abre GPU Miner desde Telegram para autenticar tu cuenta.');
  const response = await fetch('/api/me', { headers: authHeaders(), cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error === 'unauthorized' ? 'Telegram no pudo validar la sesión. Cierra y vuelve a abrir la Mini App.' : 'No se pudo consultar el saldo verificado.');
  updateAccount(data);
  return data;
}

async function refreshGPM() {
  if (!tg?.initData || gpmBusy) return;
  gpmBusy = true;
  try {
    const response = await fetch('/api/gpm', { method:'POST', headers: authHeaders(), cache:'no-store' });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error('No se pudo consultar GPM.');
    const balance = Number(data.gpm || 0).toFixed(3);
    const el=document.getElementById('gpmBalance'); if(el) el.textContent=balance+' GPM';
    const profile=document.getElementById('profGPM'); if(profile) profile.textContent=balance;
    const status=document.getElementById('gpmStatus');
    if(status) status.textContent='Registro sincronizado. La acumulación virtual se calcula por nivel, con intervalos de actividad limitados.';
    const level=Number(data.level||1);const wc=document.getElementById('welcomeBtn');if(wc){wc.disabled=!!data.welcomeClaimed;wc.textContent=data.welcomeClaimed?'Bono reclamado':'Reclamar bono';}const ws=document.getElementById('welcomeStatus');if(ws)ws.textContent=data.welcomeClaimed?'Bono de bienvenida ya registrado.':'Bono único de 500 GPM disponible.';renderMachines(data);const machine=document.getElementById('gpmMachine');if(machine)machine.textContent='GPU virtual · Nivel '+level;
    const prod=document.getElementById('gpmProduction');if(prod)prod.textContent='Producción total: '+Number(data.ratePerMinute||0).toFixed(3)+' GPM/min · '+Number(data.ratePerHour||0).toFixed(2)+' GPM/h';
    const cost=document.getElementById('gpmUpgradeCost');if(cost)cost.textContent=data.nextCost===null?'Nivel máximo alcanzado':'Próxima mejora: '+Number(data.nextCost).toFixed(3)+' GPM';
    const buy=document.getElementById('gpmBuy');if(buy){buy.disabled=data.nextCost===null;buy.textContent=data.nextCost===null?'Nivel máximo':'Mejorar';}
    const shop=document.getElementById('gpmShopStatus');if(shop)shop.textContent=data.nextCost===null?'Máximo nivel disponible alcanzado.':'Mejora disponible: usa GPM acumulados para aumentar la producción virtual.';
  } catch(error) { const status=document.getElementById('gpmStatus'); if(status) status.textContent=error.message; }
  finally { gpmBusy=false; }
}


async function buyGPMUpgrade(){
  const button=document.getElementById('gpmBuy'), status=document.getElementById('gpmShopStatus');
  if(button)button.disabled=true;
  try{
    const response=await fetch('/api/gpm',{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify({action:'buy_upgrade'})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error==='insufficient_gpm'?'No tienes suficientes GPM para esta mejora.':data.error==='max_level'?'Ya alcanzaste el nivel máximo.':'No se pudo completar la compra.');
    if(status)status.textContent='Mejora comprada y registrada en el servidor.';notifyUser('Mejora completada','Tu mejora fue comprada y registrada correctamente.','success');
    await refreshGPM();
  }catch(e){if(status)status.textContent=e.message;showToast(e.message,'error');await refreshGPM();}
  finally{if(button)button.disabled=false;}
}



async function claimWelcome(){try{const r=await fetch('/api/gpm',{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify({action:'welcome'})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error==='welcome_already_claimed'?'El bono ya fue reclamado.':'No se pudo reclamar el bono.');const el=document.getElementById('welcomeStatus');if(el)el.textContent='Bono de bienvenida registrado en tu cuenta.';notifyUser('Bono reclamado','¡Tu bono fue reclamado con éxito y quedó registrado en tu cuenta!','success');await refreshGPM();}catch(e){const el=document.getElementById('welcomeStatus');if(el)el.textContent=e.message;showToast(e.message,'error');}}
function renderMachines(data){const el=document.getElementById('machineCatalog');if(!el||!data.catalog)return;const owned={};(data.machines||[]).forEach(x=>owned[x.machine_id]={qty:Number(x.quantity),level:Number(x.upgrade_level||0)});el.innerHTML=data.catalog.map((m,i)=>{const o=owned[m.id]||{qty:0,level:0};const locked=!m.unlocked;const cost=m.upgradeCosts[o.level]??null;return `<div class="gpu ${locked?'locked':''}"><div class="gpu-visual">${['▣','◈','⬡','◆'][i]}</div><h3>${m.name}${locked?' · Bloqueada':''}</h3><div class="meta">${m.description||'Minadora virtual'}</div><div class="meta">Base: ${Number(m.rateGpmMinute).toFixed(3)} GPM/min · ${(Number(m.rateGpmHour)).toFixed(2)} GPM/h</div><div class="meta">En propiedad: ${o.qty} · Mejoras: ${o.level}/${m.upgradeMax}</div><div class="price">Precio: ${Number(m.costGpm).toLocaleString('es-VE',{maximumFractionDigits:3})} GPM</div>${locked?'<div class="notice">Completa 5 mejoras en la máquina anterior para desbloquear.</div>':`<button class="btn secondary full" onclick="buyMachine('${m.id}')">Comprar minadora</button>`}${o.qty?`<div class="notice" style="margin:8px 0">Nivel de mejora ${o.level}/${m.upgradeMax}${cost!==null?' · siguiente: '+Number(cost).toLocaleString('es-VE')+' GPM':''}</div><button class="btn full" ${o.level>=m.upgradeMax?'disabled':''} onclick="upgradeMachine('${m.id}')">${o.level>=m.upgradeMax?'Mejoras completas':'Mejorar minadora'}</button>`:''}</div>`}).join('');}
async function buyMachine(machine){const st=document.getElementById('gpmShopStatus');try{const r=await fetch('/api/gpm',{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify({action:'buy_machine',machine})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error==='insufficient_gpm'?'Saldo GPM insuficiente.':'No se pudo comprar la máquina.');if(st)st.textContent='Máquina comprada y registrada.';notifyUser('¡Compra exitosa!','Tu minadora fue comprada y ya está registrada en tu cuenta.','success');await refreshGPM();}catch(e){if(st)st.textContent=e.message;showToast(e.message,'error');}}
async function upgradeMachine(machine){const st=document.getElementById('gpmShopStatus');try{const r=await fetch('/api/gpm',{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify({action:'upgrade_machine',machine})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error==='insufficient_gpm'?'GPM insuficiente para la mejora.':d.error==='upgrade_max'?'Esta minadora ya alcanzó su nivel máximo.':'No se pudo aplicar la mejora.');if(st)st.textContent='Mejora aplicada: producción aumentada.';notifyUser('Mejora aplicada','Tu minadora fue mejorada correctamente.','success');await refreshGPM();}catch(e){if(st)st.textContent=e.message;showToast(e.message,'error');}}
async function doubleGPMAd(){const b=document.getElementById('doubleGPMButton'),st=document.getElementById('doubleGPMStatus');if(busy)return;try{if(!tg?.initData)throw new Error('Abre la Mini App desde Telegram.');if(!sdkReady)await loadMonetag();busy=true;if(b){b.disabled=true;b.textContent='Preparando anuncio…'}const current=await fetch('/api/gpm',{method:'POST',headers:authHeaders()});const cur=await current.json();if(!current.ok||Number(cur.gpmMilli)<=0)throw new Error('Necesitas GPM acumulado para duplicarlo.');const base=Number(cur.gpmMilli);const ss=await fetch('/api/ad-session',{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify({requestVar:'double_gpm'})});const session=await ss.json();if(!ss.ok)throw new Error(session.error==='empty_gpm'?'Todavía no tienes GPM que duplicar.':'No se pudo iniciar el anuncio.');const expected=base+Number(session.gpmSnapshotMilli||base);if(st)st.textContent='Anuncio recompensado en curso. El servidor confirmará el duplicado.';const result=await window.monetagShow({type:'end',ymid:session.ymid,requestVar:'double_gpm'});if(!result||result.reward_event_type!=='valued'){if(st)st.textContent='Anuncio no validado como recompensado. No se duplicó GPM.';return;}for(let i=0;i<12;i++){await new Promise(resolve=>setTimeout(resolve,1500));const r=await fetch('/api/gpm',{method:'POST',headers:authHeaders()});const fresh=await r.json();if(Number(fresh.gpmMilli)>=expected){if(st)st.textContent='Duplicación verificada por servidor: se añadió '+(Number(session.gpmSnapshotMilli||base)/1000).toLocaleString('es-VE')+' GPM.';notifyUser('¡Recompensa acreditada!','Tu saldo GPM fue duplicado y confirmado por el servidor.','success');await refreshGPM();return;}}if(st)st.textContent='Evento confirmado por Monetag; el abono aún se está procesando en el servidor.';showToast('Anuncio validado. El abono está pendiente de confirmación del servidor.','pending');}catch(e){if(st)st.textContent=e.message;showToast(e.message,'error');}finally{busy=false;if(b){b.disabled=false;b.textContent='Duplicar GPM · Ver anuncio';}}}


async function refreshStore(){
 const status=document.getElementById('storeStatus'),list=document.getElementById('storeOrders');
 if(!tg?.initData)return;
 try{
  const response=await fetch('/api/store',{headers:authHeaders(),cache:'no-store'}),data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('No se pudo consultar la tienda.');
  if(list){
   if(!data.orders?.length)list.innerHTML='<div class="empty">Todavía no tienes pedidos.</div>';
   else list.innerHTML=data.orders.map(o=>{const sku=String(o.sku||'').replace(/</g,'&lt;');const st=String(o.status||'pending').replace(/</g,'&lt;');return '<div class="listrow"><strong>'+sku+'</strong><span style="float:right">'+(Number(o.amount_usd_cents)/100).toFixed(2)+' USD · '+(Number(o.gpm_milli)/1000).toFixed(3)+' GPM</span><div class="small muted">'+st+' · '+String(o.created_at||'')+'</div></div>';}).join('');
  }
 }catch(e){if(status)status.textContent=e.message;}
}
async function storeOrder(sku){
 const status=document.getElementById('storeStatus');
 try{
  const response=await fetch('/api/store',{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify({sku})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('No se pudo registrar el pedido.');
  if(status)status.textContent='Pedido '+data.orderId+' registrado como pendiente. No se acreditó GPM; falta habilitar y confirmar el pago.';showToast('Pedido creado. El pago está pendiente; todavía no se ha completado la compra.','pending');
  await refreshStore();
 }catch(e){if(status)status.textContent=e.message;showToast(e.message,'error');}
}

async function loadMonetag() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  const config = await response.json();
  if (!response.ok || !config.rewardedAdsConfigured || !config.sdkScriptUrl || !config.sdkZoneId) {
    throw new Error('La zona de anuncios de Monetag no está configurada en el servidor.');
  }
  const scriptUrl = new URL(config.sdkScriptUrl, location.href);
  if (scriptUrl.protocol !== 'https:') throw new Error('La URL del SDK no es HTTPS.');
  const sdkName = 'show_' + String(config.sdkZoneId);
  if (typeof window[sdkName] === 'function') { sdkReady = true; return; }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl.href;
    script.async = true;
    script.dataset.zone = String(config.sdkZoneId);
    script.dataset.sdk = sdkName;
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de Monetag.'));
    document.head.appendChild(script);
  });
  if (typeof window[sdkName] !== 'function') throw new Error('Monetag cargó, pero no publicó la función ' + sdkName + '.');
  window.monetagShow = window[sdkName];
  sdkReady = true;
}
async function adPlaceholder() {
  if (busy) return;
  const button = document.getElementById('rewardAdButton');
  try {
    if (!tg?.initData) throw new Error('Abre GPU Miner desde el botón de Telegram para identificar tu cuenta.');
    if (!sdkReady) await loadMonetag();
    if (typeof window.monetagShow !== 'function') throw new Error('El SDK de Monetag todavía no está disponible.');
    busy = true;
    if (button) { button.disabled = true; button.textContent = 'Cargando…'; }
    setNotice('Solicitando una sesión de anuncio segura…');
    const sessionResponse = await fetch('/api/ad-session', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ requestVar: 'daily_mission' })
    });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !session.ymid) throw new Error(session.error === 'unauthorized' ? 'La sesión de Telegram no fue validada.' : 'No se pudo crear la sesión de anuncio.');
    setNotice('Anuncio iniciado. Esperando la confirmación de Monetag…');
    const result = await window.monetagShow({ type: 'end', ymid: session.ymid, requestVar: 'daily_mission' });
    if (!result || result.reward_event_type !== 'valued') {
      setNotice('Monetag no confirmó una impresión recompensada. No se añadió saldo ni XP.');
      return;
    }
    setNotice('Monetag confirmó el evento. Verificando el abono en el servidor…');
    const before = Number(account?.balance || 0);
    const rewardsBefore = Number(account?.rewards || 0);
    let confirmed = false;
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const fresh = await refreshAccount();
      if (Number(fresh.balance || 0) > before || Number(fresh.rewards || 0) > rewardsBefore) { confirmed = true; break; }
    }
    setNotice(confirmed
      ? 'Recompensa registrada en tu cuenta mediante el servidor.'
      : 'Monetag confirmó el anuncio, pero el postback todavía no refleja un abono. No se acreditó saldo localmente.');
    if(confirmed)notifyUser('¡Recompensa acreditada!','El servidor confirmó el abono de tu recompensa.','success');else showToast('Anuncio visto; la recompensa aún no está acreditada.','pending');
  } catch (error) {
    setNotice(error?.message || 'No se pudo completar el anuncio.');
    showToast(error?.message || 'No se pudo completar el anuncio.','error');
  } finally {
    busy = false;
    if (button) { button.disabled = false; button.textContent = 'Ver anuncio'; }
  }
}
async function initialize() {
  if (!tg?.initData) {
    const nameEl = document.getElementById('tgName');
    if (nameEl) nameEl.textContent = 'Abre desde Telegram';
    setNotice('Para activar tu cuenta, anuncios y saldo, abre el bot @GPU_MINERBOT y pulsa «Abrir GPU Miner».');
    return;
  }
  try { await loadMonetag(); setNotice('Monetag conectado. Las recompensas requieren confirmación del servidor.'); }
  catch (error) { setNotice(error.message); }
  try { await refreshAccount(); }
  catch (error) {
    const nameEl = document.getElementById('tgName');
    if (nameEl) nameEl.textContent = 'Abre desde Telegram';
    setNotice(error.message);
  }
  await refreshGPM();
  await refreshStore();
  await refreshOwnerTokenomics();
  setInterval(refreshGPM, 60000);
}
window.show = show;
window.adPlaceholder = adPlaceholder;
window.buyGPMUpgrade = buyGPMUpgrade;window.claimWelcome=claimWelcome;window.buyMachine=buyMachine;window.upgradeMachine=upgradeMachine;window.doubleGPMAd=doubleGPMAd;
window.storeOrder = storeOrder;
window.addEventListener('error', event => { console.error('GPU Miner runtime error:', event.error || event.message); setNotice('Se produjo un error interno. Cierra y vuelve a abrir GPU Miner desde Telegram.'); });
window.addEventListener('unhandledrejection', event => { console.error('GPU Miner async error:', event.reason); setNotice('Falló una operación. Comprueba tu conexión e inténtalo de nuevo.'); });
initialize();

async function refreshOwnerTokenomics() {
  const card = document.getElementById('ownerTokenomicsCard');
  if (!card || !tg?.initData) return;
  try {
    const response = await fetch('/api/admin/tokenomics', { headers: authHeaders(), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 403 || response.status === 401) { card.style.display = 'none'; return; }
    if (!response.ok) throw new Error('No se pudo consultar la tokenómica.');
    card.style.display = 'block';
    document.getElementById('ownerReserveInitial').textContent = Number(data.initialReserveGPM || 0).toLocaleString('es-VE') + ' GPM';
    document.getElementById('ownerAllocation').textContent = Number(data.plannedOwnerAllocationPercent || 0) + '%';
    document.getElementById('ownerUsers').textContent = Number(data.users || 0).toLocaleString('es-VE');
    document.getElementById('ownerContract').textContent = data.contractDeployed ? 'Desplegado' : 'No desplegado';
    document.getElementById('ownerTokenomicsNotice').textContent = data.notice + ' ' + data.issuancePolicy;
  } catch (error) {
    card.style.display = 'none';
    console.warn(error);
  }
}

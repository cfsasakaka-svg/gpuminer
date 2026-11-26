const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); } catch {}

let sdkReady = false;
let account = null;
let busy = false;
let gpmBusy = false;

function show(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector(`[data-view="${id}"]`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (nameEl) nameEl.textContent = user.firstName || user.username || ('Telegram ' + user.id);
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
    if(status) status.textContent='Registro sincronizado. '+Number(data.ratePerMinute||0).toFixed(3)+' GPM por minuto de actividad, con límite de acreditación por intervalo.';
  } catch(error) { const status=document.getElementById('gpmStatus'); if(status) status.textContent=error.message; }
  finally { gpmBusy=false; }
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
  } catch (error) {
    setNotice(error?.message || 'No se pudo completar el anuncio.');
  } finally {
    busy = false;
    if (button) { button.disabled = false; button.textContent = 'Ver anuncio'; }
  }
}
async function initialize() {
  try { await loadMonetag(); setNotice('Monetag conectado. Las recompensas requieren confirmación del servidor.'); }
  catch (error) { setNotice(error.message); }
  try { await refreshAccount(); }
  catch (error) {
    const nameEl = document.getElementById('tgName');
    if (nameEl) nameEl.textContent = 'Abre desde Telegram';
    setNotice(error.message);
  }
  await refreshGPM();
  setInterval(refreshGPM, 60000);
}
window.show = show;
window.adPlaceholder = adPlaceholder;
initialize();

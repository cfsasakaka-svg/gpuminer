import { json } from "../_lib/auth.js";
let publicKeyPromise;
async function publicKey(){if(!publicKeyPromise)publicKeyPromise=fetch("https://api.cryptapi.io/pubkey/").then(r=>r.json()).then(d=>{const pem=d.public_key||d.pubkey||d.key;if(!pem)throw new Error("CryptAPI public key unavailable");return pem;}).catch(e=>{publicKeyPromise=null;throw e;});return publicKeyPromise;}
async function verify(data,signature){try{if(!signature)return false;const pem=await publicKey();const bytes=Uint8Array.from(atob(pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\\s/g,"")),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey("spki",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);const sig=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));return crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,sig,new TextEncoder().encode(data));}catch{return false;}}
export async function onRequestPost({request,env}){
 if(!env.DB)return json({error:"service_unavailable"},503);
 const raw=await request.text();if(raw.length>20000)return json({error:"payload_too_large"},413);
 if(!await verify(raw,request.headers.get("x-ca-signature")))return json({error:"invalid_signature"},401);
 let p;try{p=JSON.parse(raw);}catch{return json({error:"invalid_json"},400);}
 return processCallback(request,env,p);
}
export async function onRequestGet({request,env}){
 if(!env.DB)return json({error:"service_unavailable"},503);
 const url=new URL(request.url);
 if(!await verify(url.toString(),request.headers.get("x-ca-signature")))return json({error:"invalid_signature"},401);
 return processCallback(request,env,Object.fromEntries(url.searchParams));
}
async function processCallback(request,env,p){
 const url=new URL(request.url),orderId=url.searchParams.get("order_id"),nonce=url.searchParams.get("nonce");
 if(!orderId||!nonce)return new Response("*ok*",{status:200});
 const order=await env.DB.prepare("SELECT * FROM gpm_orders WHERE id=? AND callback_nonce=?").bind(orderId,nonce).first();
 if(!order||order.status!=="pending"||!["0",0,false].includes(p.pending))return new Response("*ok*",{status:200});
 const coin=String(p.coin||"").toLowerCase();
 if(!["bep20_usdt","bep20/usdt"].includes(coin)||order.coin!=="bep20/usdt"||order.address_in!==p.address_in)return new Response("*ok*",{status:200});
 const paidUSD=Number(p.value_coin_convert||p.value_forwarded_coin_convert||0);
 if(!Number.isFinite(paidUSD)||paidUSD+0.000001<(Number(order.amount_usd_cents)/100))return new Response("*ok*",{status:200});
 const uuid=String(p.uuid||p.txid_in||"");if(!uuid)return new Response("*ok*",{status:200});
 const now=Math.floor(Date.now()/1000);
 await env.DB.prepare("INSERT INTO gpm_state (telegram_id,balance_milli,last_tick_at,updated_at) VALUES (?,0,?,datetime('now')) ON CONFLICT(telegram_id) DO NOTHING").bind(order.telegram_id,now).run();
 await env.DB.batch([
  env.DB.prepare("UPDATE gpm_orders SET status='paid',paid_at=datetime('now'),txid=?,cryptapi_uuid=? WHERE id=? AND status='pending' AND expires_at>datetime('now')").bind(String(p.txid_in||""),uuid,orderId),
  env.DB.prepare("UPDATE gpm_state SET balance_milli=balance_milli+?,updated_at=datetime('now') WHERE telegram_id=? AND changes()>0").bind(order.gpm_milli,order.telegram_id),
  env.DB.prepare("INSERT INTO gpm_ledger (telegram_id,amount_milli,reason,created_at) SELECT ?,?,'cryptapi_purchase',datetime('now') WHERE changes()>0").bind(order.telegram_id,order.gpm_milli)
 ]);
 return new Response("*ok*",{status:200});
}

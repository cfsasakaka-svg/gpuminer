import { json, requireTelegram } from "../_lib/auth.js";
const catalog=[
 {sku:"pack_1",name:"Starter",usd:100,gpm:1000},
 {sku:"pack_5",name:"Miner",usd:500,gpm:6000},
 {sku:"pack_10",name:"Pro",usd:1000,gpm:13000},
 {sku:"pack_25",name:"Elite",usd:2500,gpm:35000},
 {sku:"pack_50",name:"Ultra",usd:5000,gpm:80000},
 {sku:"chest_basic",name:"Cofre básico",usd:300,gpm:3000},
 {sku:"chest_plus",name:"Cofre avanzado",usd:1000,gpm:11000},
 {sku:"chest_legend",name:"Cofre legendario",usd:2500,gpm:30000}
];
const ticker="bep20/usdt";
export async function onRequestPost({request,env}){
 if(!env.DB)return json({error:"service_unavailable"},503);
 const user=await requireTelegram(request,env);if(!user)return json({error:"unauthorized"},401);
 if(!env.CRYPTAPI_WALLET_ADDRESS||!env.CRYPTAPI_CALLBACK_BASE)return json({error:"cryptapi_not_configured",message:"La pasarela aún no está configurada."},503);
 let body;try{body=await request.json();}catch{return json({error:"invalid_request"},400);}
 const item=catalog.find(x=>x.sku===body.sku);if(!item)return json({error:"invalid_sku"},400);
 const id=crypto.randomUUID(),nonce=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO users (telegram_id,username,first_name,created_at,updated_at) VALUES (?, ?, ?, datetime('now'),datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,updated_at=datetime('now')").bind(user.id,user.username,user.firstName).run();
 await env.DB.prepare("INSERT INTO gpm_orders (id,telegram_id,sku,amount_usd_cents,gpm_milli,status,created_at,coin,callback_nonce,expires_at) VALUES (?,?,?,?,?,'pending',datetime('now'),?,?,datetime('now','+45 minutes'))").bind(id,user.id,item.sku,item.usd,item.gpm,ticker,nonce).run();
 const callback=new URL(env.CRYPTAPI_CALLBACK_BASE);callback.searchParams.set("order_id",id);callback.searchParams.set("nonce",nonce);
 const api=new URL("https://api.cryptapi.io/"+ticker+"/create/");
 api.searchParams.set("address",env.CRYPTAPI_WALLET_ADDRESS);api.searchParams.set("callback",callback.toString());api.searchParams.set("pending","1");api.searchParams.set("convert","1");api.searchParams.set("json","1");
 let data,conversion;
 try{
  const convUrl=new URL("https://api.cryptapi.io/"+ticker+"/convert/");convUrl.searchParams.set("value",String(item.usd/100));convUrl.searchParams.set("from","USD");
  const convRes=await fetch(convUrl.toString());conversion=await convRes.json();
  if(!convRes.ok||conversion.status!=="success"||!Number.isFinite(Number(conversion.value_coin)))throw new Error("Conversion unavailable");
  const res=await fetch(api.toString());data=await res.json();
  if(!res.ok||data.status!=="success"||!data.address_in)throw new Error(data.error||"CryptAPI error");
  if(Number(conversion.value_coin)<Number(data.minimum_transaction_coin||0))throw new Error("Payment below network minimum");
 }catch(e){
  await env.DB.prepare("UPDATE gpm_orders SET status='failed' WHERE id=? AND status='pending'").bind(id).run();
  return json({error:"cryptapi_error",message:"No se pudo preparar el pago. Puede existir un mínimo de red superior al paquete."},502);
 }
 await env.DB.prepare("UPDATE gpm_orders SET address_in=? WHERE id=?").bind(data.address_in,id).run();
 return json({orderId:id,sku:item.sku,amountUSD:item.usd/100,coin:ticker,amountCoin:conversion.value_coin,address:data.address_in,minimum:data.minimum_transaction_coin||null,expiresAt:"45 minutos",status:"pending",gpmAmount:item.gpm/1000},201);
}

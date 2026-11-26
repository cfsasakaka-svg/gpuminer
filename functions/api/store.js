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
export async function onRequestGet({request,env}){
 const user=await requireTelegram(request,env);if(!user)return json({error:"unauthorized"},401);
 return json({catalog:catalog.map(x=>({...x,priceUSD:x.usd/100,gpmAmount:x.gpm/1000})),paymentsEnabled:false});
}
export async function onRequestPost({request,env}){
 if(!env.DB)return json({error:"service_unavailable"},503);
 const user=await requireTelegram(request,env);if(!user)return json({error:"unauthorized"},401);
 let body;try{body=await request.json();}catch{return json({error:"invalid_request"},400);}
 const item=catalog.find(x=>x.sku===body.sku);if(!item)return json({error:"invalid_sku"},400);
 const id=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO users (telegram_id,username,first_name,created_at,updated_at) VALUES (?, ?, ?, datetime('now'),datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,updated_at=datetime('now')").bind(user.id,user.username,user.firstName).run();
 await env.DB.prepare("INSERT INTO gpm_orders (id,telegram_id,sku,amount_usd_cents,gpm_milli,status,created_at) VALUES (?,?,?,?,?,'pending',datetime('now'))").bind(id,user.id,item.sku,item.usd,item.gpm).run();
 return json({orderId:id,sku:item.sku,status:"pending",paymentsEnabled:false,message:"Pedido registrado como pendiente. No se acredita GPM sin pago confirmado."},202);
}

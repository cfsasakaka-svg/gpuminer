import { json, requireTelegram } from "../_lib/auth.js";
const MAX_CREDIT_SECONDS=300;
const RATES=[0,200,350,550,850,1200,1600,2100,2700,3400,4200];
const COSTS=[0,25000,100000,350000,1000000,2500000,5000000,10000000,20000000,40000000];
const MACHINES=[{id:'starter',name:'GPU Starter',cost:500000,rate:300},{id:'miner',name:'GPU Miner',cost:1500000,rate:700},{id:'pro',name:'GPU Pro',cost:5000000,rate:1500},{id:'elite',name:'GPU Elite',cost:15000000,rate:3000}];
function rate(level){return RATES[Math.min(Math.max(1,Number(level)||1),RATES.length-1)]||200;}
async function accrue(env,id,now){
 await env.DB.prepare("INSERT INTO gpm_state (telegram_id,balance_milli,last_tick_at,updated_at) VALUES (?,0,?,datetime('now')) ON CONFLICT(telegram_id) DO NOTHING").bind(id,now).run();
 const st=await env.DB.prepare("SELECT balance_milli,last_tick_at,machine_level FROM gpm_state WHERE telegram_id=?").bind(id).first();
 const elapsed=Math.max(0,Math.min(now-Number(st.last_tick_at||now),MAX_CREDIT_SECONDS)),award=Math.floor(elapsed*rate(st.machine_level)/60);
 if(award>0)await env.DB.batch([env.DB.prepare("UPDATE gpm_state SET balance_milli=balance_milli+?,last_tick_at=?,updated_at=datetime('now') WHERE telegram_id=?").bind(award,now,id),env.DB.prepare("INSERT INTO gpm_ledger (telegram_id,amount_milli,reason,created_at) VALUES (?,?,'farm_activity',datetime('now'))").bind(id,award)]);
 else await env.DB.prepare("UPDATE gpm_state SET last_tick_at=?,updated_at=datetime('now') WHERE telegram_id=?").bind(now,id).run();
}
async function state(env,id){return env.DB.prepare("SELECT balance_milli,last_tick_at,machine_level,welcome_claimed FROM gpm_state WHERE telegram_id=?").bind(id).first();}
export async function onRequestPost({request,env}){
 if(!env.DB)return json({error:"service_unavailable"},503);
 const user=await requireTelegram(request,env);if(!user)return json({error:"unauthorized"},401);
 await env.DB.prepare("INSERT INTO users (telegram_id,username,first_name,created_at,updated_at) VALUES (?, ?, ?, datetime('now'),datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,updated_at=datetime('now')").bind(user.id,user.username,user.firstName).run();
 let body={};try{body=await request.json();}catch{}
 const now=Math.floor(Date.now()/1000);await accrue(env,user.id,now);
 if(body.action==='welcome'){
  const st=await state(env,user.id);if(st.welcome_claimed)return json({error:'welcome_already_claimed'},409);
  const bonus=500000;await env.DB.batch([env.DB.prepare("UPDATE gpm_state SET balance_milli=balance_milli+?,welcome_claimed=1,updated_at=datetime('now') WHERE telegram_id=? AND welcome_claimed=0").bind(bonus,user.id),env.DB.prepare("INSERT INTO gpm_ledger (telegram_id,amount_milli,reason,created_at) SELECT ?,?,'welcome_bonus',datetime('now') WHERE EXISTS(SELECT 1 FROM gpm_state WHERE telegram_id=? AND welcome_claimed=1)").bind(user.id,bonus,user.id)]);
 }
 if(body.action==='buy_machine'){
  const item=MACHINES.find(x=>x.id===body.machine);if(!item)return json({error:'invalid_machine'},400);
  const st=await state(env,user.id);if(Number(st.balance_milli)<item.cost)return json({error:'insufficient_gpm'},400);
  const own=await env.DB.prepare("SELECT COUNT(*) n FROM gpm_machines WHERE telegram_id=? AND machine_id=?").bind(user.id,item.id).first();
  if(Number(own?.n||0)>=10)return json({error:'machine_limit'},400);
  const res=await env.DB.prepare("UPDATE gpm_state SET balance_milli=balance_milli-?,updated_at=datetime('now') WHERE telegram_id=? AND balance_milli>=?").bind(item.cost,user.id,item.cost).run();
  if(!(res.meta?.changes>0))return json({error:'purchase_conflict'},409);
  await env.DB.batch([env.DB.prepare("INSERT INTO gpm_machines (telegram_id,machine_id,created_at) VALUES (?, ?,datetime('now'))").bind(user.id,item.id),env.DB.prepare("INSERT INTO gpm_ledger (telegram_id,amount_milli,reason,created_at) VALUES (?,?,'machine_purchase',datetime('now'))").bind(user.id,-item.cost)]);
 }
 if(body.action==='buy_upgrade'){
  const st=await state(env,user.id);const level=Number(st.machine_level||1),cost=COSTS[level];if(!cost||level+1>=RATES.length)return json({error:'max_level'},400);
  if(Number(st.balance_milli)<cost)return json({error:'insufficient_gpm'},400);
  const res=await env.DB.prepare("UPDATE gpm_state SET balance_milli=balance_milli-?,machine_level=machine_level+1,updated_at=datetime('now') WHERE telegram_id=? AND machine_level=? AND balance_milli>=?").bind(cost,user.id,level,cost).run();
  if(!(res.meta?.changes>0))return json({error:'purchase_conflict'},409);
  await env.DB.prepare("INSERT INTO gpm_ledger (telegram_id,amount_milli,reason,created_at) VALUES (?,?,'machine_upgrade',datetime('now'))").bind(user.id,-cost).run();
 }
 const st=await state(env,user.id),machines=await env.DB.prepare("SELECT machine_id,COUNT(*) quantity FROM gpm_machines WHERE telegram_id=? GROUP BY machine_id").bind(user.id).all();
 const history=await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN amount_milli>0 THEN amount_milli ELSE 0 END),0) total_milli FROM gpm_ledger WHERE telegram_id=?").bind(user.id).first();
 return json({gpm:Number(st.balance_milli||0)/1000,gpmMilli:Number(st.balance_milli||0),earnedMilli:Number(history?.total_milli||0),level:Number(st.machine_level||1),ratePerMinute:rate(st.machine_level)/1000,nextCost:COSTS[st.machine_level]?COSTS[st.machine_level]/1000:null,maxLevel:!COSTS[st.machine_level],welcomeClaimed:!!st.welcome_claimed,machines:machines.results||[],catalog:MACHINES.map(x=>({...x,costGpm:x.cost/1000,rateGpmMinute:x.rate/1000})),virtual:true});
}

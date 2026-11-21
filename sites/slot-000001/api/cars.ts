import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/slot-db";
import { resolveSlotDatabaseConfig } from "@/lib/db-config";
import { parseManifest } from "@/lib/manifest";
import rawManifest from "../manifest.json";
import { apiError, apiJson, type SlotApiHandler } from "@/lib/site-contract";
const manifest=parseManifest(rawManifest);
const config=resolveSlotDatabaseConfig(manifest.slotId,manifest.database);
const pool=()=>getPool(config);
const schema='"slot_000001"';
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
let ready:Promise<void>|null=null;
async function ensureTables(){
 if(!ready) ready=(async()=>{
  await pool().query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await pool().query(`CREATE TABLE IF NOT EXISTS ${schema}.cars(id uuid PRIMARY KEY,label varchar(100) NOT NULL,public_token varchar(80) UNIQUE NOT NULL,owner_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),active boolean NOT NULL DEFAULT true)`);
  await pool().query(`CREATE TABLE IF NOT EXISTS ${schema}.alerts(id uuid PRIMARY KEY,car_id uuid NOT NULL REFERENCES ${schema}.cars(id) ON DELETE CASCADE,type varchar(24) NOT NULL CHECK(type IN ('blocked','lights','something','damage','other')),note varchar(400),status varchar(20) NOT NULL DEFAULT 'new',reply varchar(40),created_at timestamptz NOT NULL DEFAULT now(),replied_at timestamptz)`);
  await pool().query(`CREATE INDEX IF NOT EXISTS alerts_car_created_idx ON ${schema}.alerts(car_id,created_at DESC)`);
 })();
 return ready;
}
function ownerKey(req:Request){const v=req.headers.get("authorization")||"";return v.startsWith("Bearer ")?v.slice(7).trim():"";}
const quickReplies:Record<string,string>={now:"نازل دلوقتي",two:"دقيقتين",cannot:"مش هقدر أنزل",arrived:"وصلت"};
export const listCars:SlotApiHandler=async(req)=>{
 await ensureTables();const token=new URL(req.url).searchParams.get("token");
 if(token){const r=await pool().query(`SELECT id,label,public_token FROM ${schema}.cars WHERE public_token=$1 AND active=true LIMIT 1`,[token]);if(!r.rows[0])return apiError(404,"car_not_found","Car code not found.");return apiJson({car:{id:r.rows[0].id,label:r.rows[0].label,token:r.rows[0].public_token}});}
 const key=ownerKey(req);if(key.length<32)return apiError(401,"owner_key_required","Owner key required.");
 const digest=hash(key);const r=await pool().query(`SELECT id,label,public_token,created_at FROM ${schema}.cars WHERE owner_hash=$1 AND active=true ORDER BY created_at DESC`,[digest]);
 const a=await pool().query(`SELECT a.id,a.type,a.note,a.status,a.reply,a.created_at,c.label car_label FROM ${schema}.alerts a JOIN ${schema}.cars c ON c.id=a.car_id WHERE c.owner_hash=$1 ORDER BY a.created_at DESC LIMIT 100`,[digest]);
 return apiJson({cars:r.rows.map(x=>({id:x.id,label:x.label,token:x.public_token,createdAt:x.created_at})),alerts:a.rows.map(x=>({id:x.id,type:x.type,note:x.note,status:x.status,reply:x.reply,createdAt:x.created_at,carLabel:x.car_label}))});
};
export const createCar:SlotApiHandler=async(req)=>{
 await ensureTables();const key=ownerKey(req);if(key.length<32)return apiError(401,"owner_key_required","Owner key required.");
 let body:any;try{body=await req.json();}catch{return apiError(400,"invalid_json","Invalid request.");}
 const label=typeof body.label==="string"?body.label.trim().slice(0,100):"My car";if(!label)return apiError(400,"invalid_label","Car label required.");
 const id=randomUUID(),token=randomBytes(24).toString("base64url");await pool().query(`INSERT INTO ${schema}.cars(id,label,public_token,owner_hash) VALUES($1,$2,$3,$4)`,[id,label,token,hash(key)]);
 return apiJson({car:{id,label,token,createdAt:new Date().toISOString()}},{status:201});
};
export const createAlert:SlotApiHandler=async(req)=>{
 await ensureTables();let b:any;try{b=await req.json();}catch{return apiError(400,"invalid_json","Invalid request.");}
 const token=typeof b.token==="string"?b.token:"",type=typeof b.type==="string"?b.type:"",note=typeof b.note==="string"?b.note.trim().slice(0,400):"";
 if(!token||!["blocked","lights","something","damage","other"].includes(type))return apiError(400,"invalid_alert","Choose a valid alert type.");
 const car=await pool().query(`SELECT id,label FROM ${schema}.cars WHERE public_token=$1 AND active=true LIMIT 1`,[token]);if(!car.rows[0])return apiError(404,"car_not_found","Car not found.");
 const id=randomUUID();await pool().query(`INSERT INTO ${schema}.alerts(id,car_id,type,note) VALUES($1,$2,$3,$4)`,[id,car.rows[0].id,type,note||null]);
 return apiJson({alert:{id,type,note,status:"new",reply:null,carLabel:car.rows[0].label,createdAt:new Date().toISOString()}},{status:201});
};
export const replyAlert:SlotApiHandler=async(req)=>{
 await ensureTables();const key=ownerKey(req);if(key.length<32)return apiError(401,"owner_key_required","Owner key required.");
 let b:any;try{b=await req.json();}catch{return apiError(400,"invalid_json","Invalid request.");}
 const id=typeof b.alertId==="string"?b.alertId:"",reply=typeof b.reply==="string"?b.reply:"";if(!id||!quickReplies[reply])return apiError(400,"invalid_reply","Invalid quick reply.");
 const r=await pool().query(`UPDATE ${schema}.alerts a SET reply=$1,status='replied',replied_at=now() FROM ${schema}.cars c WHERE a.car_id=c.id AND c.owner_hash=$2 AND a.id=$3 RETURNING a.id`,[quickReplies[reply],hash(key),id]);
 if(!r.rows[0])return apiError(404,"alert_not_found","Alert not found.");return apiJson({ok:true});
};

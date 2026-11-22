import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { apiError, apiJson, type SlotApiHandler } from "@/lib/site-contract";
import { createRateLimiter, clientKey } from "@/lib/rate-limit";
const alertLimiter=createRateLimiter({windowMs:10*60*1000,max:5});

type CarRecord = { kind:"car"; id:string; label:string; token:string; ownerHash:string; createdAt:string; active:boolean };
type ChatMessage = { id:string; sender:"visitor"|"owner"; text:string; createdAt:string };\ntype AlertRecord = { kind:"alert"; id:string; carId:string; type:string; note:string|null; status:string; reply:string|null; createdAt:string; repliedAt:string|null; messages?:ChatMessage[] };
const prefix="ive-arrived-sir";
const storageToken=process.env.BLOB_READ_WRITE_TOKEN;
function encryptionKey(){if(!storageToken)throw new Error("Blob storage is not configured.");return createHash("sha256").update("iavs-private-records-v1:").update(storageToken).digest();}
function seal(value:unknown){const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return JSON.stringify({v:1,iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:encrypted.toString("base64")});}
function open<T>(value:string):T{const box=JSON.parse(value);if(box.v!==1)throw new Error("Unsupported encrypted record.");const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(box.iv,"base64"));decipher.setAuthTag(Buffer.from(box.tag,"base64"));const clear=Buffer.concat([decipher.update(Buffer.from(box.data,"base64")),decipher.final()]).toString("utf8");return JSON.parse(clear) as T;}
async function save(path:string,value:unknown,overwrite=false){if(!storageToken)throw new Error("Blob storage is not configured.");await put(path,seal(value),{access:"private",token:storageToken,addRandomSuffix:false,allowOverwrite:overwrite,contentType:"application/json",cacheControlMaxAge:0});}
async function records<T>(pathPrefix:string):Promise<T[]>{if(!storageToken)throw new Error("Blob storage is not configured.");let cursor:string|undefined;const out:T[]=[];do{const page=await list({prefix:pathPrefix,limit:1000,cursor,token:storageToken});for(const blob of page.blobs){try{const response=await get(blob.pathname,{access:"private",token:storageToken});if(response?.statusCode===200)out.push(open<T>(await new Response(response.stream).text()));}catch{ /* Ignore an unreadable individual record; never expose ciphertext. */ }}cursor=page.hasMore?page.cursor:undefined;}while(cursor);return out;}
async function find<T>(path:string):Promise<T|null>{const all=await records<T>(path);return all[0]??null;}
function ownerKey(request:Request){const encoded=request.headers.get("x-owner-key");if(encoded!==null){try{return decodeURIComponent(encoded).trim()}catch{return ""}}const value=request.headers.get("authorization")||"";return value.startsWith("Bearer ")?value.slice(7).trim():"";}
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
function same(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
const replyKeys=new Set(["now","two","cannot","arrived"]);

export const listCars:SlotApiHandler=async(request)=>{
 const token=new URL(request.url).searchParams.get("token");
 if(token){const all=await records<CarRecord>(prefix+"/cars/");const car=all.find(item=>item.active&&same(item.token,token));if(!car)return apiError(404,"car_not_found","Car code not found.");return apiJson({car:{id:car.id,label:car.label,token:car.token}});}
 const key=ownerKey(request);if(key.length<32)return apiError(401,"owner_key_required","Owner key required.");
 const ownerHash=hash(key);const allCars=await records<CarRecord>(prefix+"/cars/");const cars=allCars.filter(car=>car.active&&same(car.ownerHash,ownerHash));
 const ids=new Set(cars.map(car=>car.id));const allAlerts=await records<AlertRecord>(prefix+"/alerts/");
 const alerts=allAlerts.filter(alert=>ids.has(alert.carId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
 return apiJson({cars:cars.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({id,label,token,createdAt})=>({id,label,token,createdAt})),alerts:alerts.map(alert=>({...alert,carLabel:cars.find(car=>car.id===alert.carId)?.label||"Car"}))});
};

export const createCar:SlotApiHandler=async(request)=>{
 const key=ownerKey(request);if(key.length<32)return apiError(401,"owner_key_required","Owner key required.");
 let body:any;try{body=await request.json();}catch{return apiError(400,"invalid_json","Invalid request.");}
 const label=typeof body.label==="string"?body.label.trim().slice(0,100):"My car";if(!label)return apiError(400,"invalid_label","Car label required.");
 const car:CarRecord={kind:"car",id:randomUUID(),label,token:randomBytes(32).toString("base64url"),ownerHash:hash(key),createdAt:new Date().toISOString(),active:true};
 await save(prefix+"/cars/"+car.id+".json",car);
 return apiJson({car:{id:car.id,label:car.label,token:car.token,createdAt:car.createdAt}},{status:201});
};

export const createAlert:SlotApiHandler=async(request)=>{
 const limit=alertLimiter.check(clientKey(request));if(!limit.ok)return Response.json({ok:false,error:{code:"rate_limited",message:"Please wait before sending another alert."}},{status:429,headers:{"Retry-After":String(limit.retryAfterSeconds)}});
 let body:any;try{body=await request.json();}catch{return apiError(400,"invalid_json","Invalid request.");}
 const token=typeof body.token==="string"?body.token:"",type=typeof body.type==="string"?body.type:"",note=typeof body.note==="string"?body.note.trim().slice(0,400):"";
 if(!token||!["blocked","lights","something","damage","other"].includes(type))return apiError(400,"invalid_alert","Choose a valid alert type.");
 const cars=await records<CarRecord>(prefix+"/cars/");const car=cars.find(item=>item.active&&same(item.token,token));if(!car)return apiError(404,"car_not_found","Car not found.");
 const alert:AlertRecord={kind:"alert",id:randomUUID(),carId:car.id,type,note:note||null,status:"new",reply:null,createdAt:new Date().toISOString(),repliedAt:null};
 await save(prefix+"/alerts/"+alert.id+".json",alert);
 return apiJson({alert:{id:alert.id,type,note:alert.note,status:alert.status,reply:null,carLabel:car.label,createdAt:alert.createdAt}},{status:201});
};

export const getAlert:SlotApiHandler=async(request)=>{
 const id=new URL(request.url).searchParams.get("id")||"";if(!/^[0-9a-f-]{36}$/i.test(id))return apiError(400,"invalid_id","Invalid alert id.");
 const alert=await find<AlertRecord>(prefix+"/alerts/"+id+".json");if(!alert)return apiError(404,"alert_not_found","Alert not found.");
 return apiJson({alert:{id:alert.id,status:alert.status,reply:alert.reply,messages:alert.messages||[]}});
};

export const replyAlert:SlotApiHandler=async(request)=>{
 const key=ownerKey(request);if(key.length<32)return apiError(401,"owner_key_required","Owner key required.");
 let body:any;try{body=await request.json();}catch{return apiError(400,"invalid_json","Invalid request.");}
 const id=typeof body.alertId==="string"?body.alertId:"",reply=typeof body.reply==="string"?body.reply:"",message=typeof body.message==="string"?body.message.trim().slice(0,1000):"";if(!id||(!replyKeys.has(reply)&&!message))return apiError(400,"invalid_reply","Invalid reply.");
 const alert=await find<AlertRecord>(prefix+"/alerts/"+id+".json");if(!alert)return apiError(404,"alert_not_found","Alert not found.");
 const cars=await records<CarRecord>(prefix+"/cars/");const car=cars.find(item=>item.id===alert.carId&&same(item.ownerHash,hash(key)));if(!car)return apiError(404,"alert_not_found","Alert not found.");
 if(replyKeys.has(reply)){alert.reply=reply;alert.status="replied";alert.repliedAt=new Date().toISOString();}if(message){alert.messages=[...(alert.messages||[]),{id:randomUUID(),sender:"owner",text:message,createdAt:new Date().toISOString()}];}await save(prefix+"/alerts/"+id+".json",alert,true);
 return apiJson({ok:true});
};

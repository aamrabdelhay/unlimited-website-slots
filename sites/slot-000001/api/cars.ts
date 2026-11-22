import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual, createECDH, createPrivateKey, sign, hkdfSync } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { apiError, apiJson, type SlotApiHandler } from "@/lib/site-contract";
import { createRateLimiter, clientKey } from "@/lib/rate-limit";
const alertLimiter=createRateLimiter({windowMs:10*60*1000,max:5});

type CarRecord = { kind:"car"; id:string; label:string; token:string; ownerHash:string; createdAt:string; active:boolean };
type ChatMessage = { id:string; sender:"visitor"|"owner"; text:string; createdAt:string };
type AlertRecord = { kind:"alert"; id:string; carId:string; type:string; note:string|null; status:string; reply:string|null; createdAt:string; repliedAt:string|null; messages?:ChatMessage[] };
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
 let body:any;try{body=await request.json();}catch{return apiError(400,"invalid_json","Invalid request.");}
 if(typeof body.alertId==="string"&&typeof body.message==="string"){const id=body.alertId.trim(),message=body.message.trim().slice(0,1000);if(!/^[0-9a-f-]{36}$/i.test(id)||!message)return apiError(400,"invalid_message","Write a message.");const alert=await find<AlertRecord>(prefix+"/alerts/"+id+".json");if(!alert)return apiError(404,"alert_not_found","Conversation not found.");alert.messages=[...(alert.messages||[]),{id:randomUUID(),sender:"visitor",text:message,createdAt:new Date().toISOString()}];await save(prefix+"/alerts/"+id+".json",alert,true);const cars=await records<CarRecord>(prefix+"/cars/");const car=cars.find(item=>item.id===alert.carId);if(car)await notifyOwner(car,alert,new URL(request.url).origin);return apiJson({ok:true,messages:alert.messages});}
 const limit=alertLimiter.check(clientKey(request));if(!limit.ok)return Response.json({ok:false,error:{code:"rate_limited",message:"Please wait before sending another alert."}},{status:429,headers:{"Retry-After":String(limit.retryAfterSeconds)}});
 const token=typeof body.token==="string"?body.token:"",type=typeof body.type==="string"?body.type:"",note=typeof body.note==="string"?body.note.trim().slice(0,400):"";
 if(!token||!["blocked","lights","something","damage","other"].includes(type))return apiError(400,"invalid_alert","Choose a valid alert type.");
 const cars=await records<CarRecord>(prefix+"/cars/");const car=cars.find(item=>item.active&&same(item.token,token));if(!car)return apiError(404,"car_not_found","Car not found.");
 const alert:AlertRecord={kind:"alert",id:randomUUID(),carId:car.id,type,note:note||null,status:"new",reply:null,createdAt:new Date().toISOString(),repliedAt:null,messages:[]};
 await save(prefix+"/alerts/"+alert.id+".json",alert);
 await notifyOwner(car,alert,new URL(request.url).origin);
 return apiJson({alert:{id:alert.id,type,note:alert.note,status:alert.status,reply:null,carLabel:car.label,createdAt:alert.createdAt}},{status:201});
};

export const getAlert:SlotApiHandler=async(request)=>{
 const id=new URL(request.url).searchParams.get("id")||"";if(!/^[0-9a-f-]{36}$/i.test(id))return apiError(400,"invalid_id","Invalid alert id.");
 const alert=await find<AlertRecord>(prefix+"/alerts/"+id+".json");if(!alert)return apiError(404,"alert_not_found","Alert not found.");
 const cars=await records<CarRecord>(prefix+"/cars/");const car=cars.find(item=>item.id===alert.carId&&item.active);return apiJson({alert:{id:alert.id,status:alert.status,reply:alert.reply,messages:alert.messages||[],type:alert.type,note:alert.note,createdAt:alert.createdAt,carLabel:car?.label||"Car"}});
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

type PushSubscriptionRecord = { kind:"push-subscription"; id:string; ownerHash:string; subscription:{endpoint:string;expirationTime?:number|null;keys:{p256dh:string;auth:string}}; createdAt:string };
const b64url=(value:Buffer)=>value.toString("base64url");
const fromB64url=(value:string)=>Buffer.from(value,"base64url");
function hkdf(ikm:Buffer,salt:Buffer,info:Buffer,length:number){return Buffer.from(hkdfSync("sha256",ikm,salt,info,length));}
function vapidJwt(endpoint:string){
 const publicKey=process.env.VAPID_PUBLIC_KEY||"",privateKey=process.env.VAPID_PRIVATE_KEY||"",subject=process.env.VAPID_SUBJECT||"";
 if(!publicKey||!privateKey||!subject)throw new Error("Web Push VAPID keys are not configured.");
 const raw=fromB64url(publicKey);if(raw.length!==65||raw[0]!==4)throw new Error("Invalid VAPID public key.");
 const header=b64url(Buffer.from(JSON.stringify({typ:"JWT",alg:"ES256"})));
 const payload=b64url(Buffer.from(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+12*60*60,sub:subject})));
 const unsigned=header+"."+payload;
 const key=createPrivateKey({key:{kty:"EC",crv:"P-256",x:b64url(raw.subarray(1,33)),y:b64url(raw.subarray(33,65)),d:privateKey},format:"jwk"});
 return unsigned+"."+b64url(sign("sha256",Buffer.from(unsigned),{key,dsaEncoding:"ieee-p1363"}));
}
function encryptPush(subscription:PushSubscriptionRecord["subscription"],payload:string){
 const clientPublic=fromB64url(subscription.keys.p256dh),authSecret=fromB64url(subscription.keys.auth);
 if(clientPublic.length!==65||authSecret.length<16)throw new Error("Invalid push subscription keys.");
 const ecdh=createECDH("prime256v1");ecdh.generateKeys();const serverPublic=ecdh.getPublicKey();const shared=ecdh.computeSecret(clientPublic);
 const keyInfo=Buffer.concat([Buffer.from("WebPush: info\0"),clientPublic,serverPublic]);
 const ikm=hkdf(shared,authSecret,keyInfo,32),salt=randomBytes(16);
 const cek=hkdf(ikm,salt,Buffer.from("Content-Encoding: aes128gcm\0"),16);
 const nonce=hkdf(ikm,salt,Buffer.from("Content-Encoding: nonce\0"),12);
 const cipher=createCipheriv("aes-128-gcm",cek,nonce);
 const encrypted=Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload),Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
 const header=Buffer.alloc(21);salt.copy(header,0);header.writeUInt32BE(4096,16);header[20]=serverPublic.length;
 return Buffer.concat([header,serverPublic,encrypted]);
}
async function sendWebPush(subscription:PushSubscriptionRecord["subscription"],payload:string){
 const body=encryptPush(subscription,payload);
 const response=await fetch(subscription.endpoint,{method:"POST",headers:{
  Authorization:"vapid t="+vapidJwt(subscription.endpoint)+", k="+(process.env.VAPID_PUBLIC_KEY||""),
  "Content-Type":"application/octet-stream","Content-Encoding":"aes128gcm","TTL":"60","Urgency":"high"
 },body});
 return response.status;
}
async function deleteSubscription(id:string){
 const all=await records<PushSubscriptionRecord>(prefix+"/push-subscriptions/");
 const current=all.find(s=>s.id===id);
 if(current)await save(prefix+"/push-subscriptions/"+id+".json",{...current,subscription:{...current.subscription,endpoint:""}},true);
}
async function notifyOwner(car:CarRecord,alert:AlertRecord,origin:string){
 try{
  const subs=await records<PushSubscriptionRecord>(prefix+"/push-subscriptions/");
  const payload=JSON.stringify({title:"I've arrived, sir",body:"هناك تنبيه جديد بخصوص سيارتك.",url:new URL("/s/1?chat="+encodeURIComponent(alert.id),origin).toString()});
  for(const item of subs.filter(s=>same(s.ownerHash,car.ownerHash)&&s.subscription.endpoint.startsWith("https://"))){
   try{const status=await sendWebPush(item.subscription,payload);if(status===404||status===410)await deleteSubscription(item.id);}
   catch(error){console.error("[iavs] push delivery failed:",error instanceof Error?error.message:"unknown");}
  }
 }catch(error){console.error("[iavs] push notification setup failed:",error instanceof Error?error.message:"unknown");}
}
export const getPushConfig:SlotApiHandler=async()=>{
 const key=process.env.VAPID_PUBLIC_KEY||"";
 if(!key)return apiError(503,"push_unavailable","Push notifications are not configured.");
 return apiJson({publicKey:key});
};
export const getPushServiceWorker:SlotApiHandler=async()=>{
 const source=[
  "self.addEventListener('push',function(event){",
  "let data={};try{data=event.data?event.data.json():{}}catch(e){data={body:'New car alert'}}",
  "const title=data.title||\"I've arrived, sir\";",
  "event.waitUntil(self.registration.showNotification(title,{body:data.body||'There is a new alert for your car.',tag:'iavs-'+(data.url||'alert'),data:{url:data.url||'/s/1'}}));",
  "});",
  "self.addEventListener('notificationclick',function(event){event.notification.close();const target=event.notification.data&&event.notification.data.url||'/s/1';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){for(const client of list){if('focus' in client){client.navigate(target);return client.focus()}}return clients.openWindow(target)}));});"
 ].join("\n");
 return new Response(source,{headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-cache","Service-Worker-Allowed":"/s/1"}});
};
export const registerPushSubscription:SlotApiHandler=async(request)=>{
 const key=ownerKey(request);if(key.length<32)return apiError(401,"owner_key_required","Owner key required.");
 let body:any;try{body=await request.json()}catch{return apiError(400,"invalid_json","Invalid request.");}
 const sub=body?.subscription;
 if(!sub||typeof sub.endpoint!=="string"||!sub.endpoint.startsWith("https://")||typeof sub.keys?.p256dh!=="string"||typeof sub.keys?.auth!=="string")return apiError(400,"invalid_subscription","Invalid push subscription.");
 const ownerHash=hash(key),cars=await records<CarRecord>(prefix+"/cars/");
 if(!cars.some(car=>car.active&&same(car.ownerHash,ownerHash)))return apiError(403,"owner_not_found","No cars are linked to this owner key.");
 const id=createHash("sha256").update(sub.endpoint).digest("hex");
 const record:PushSubscriptionRecord={kind:"push-subscription",id,ownerHash,subscription:{endpoint:sub.endpoint,expirationTime:sub.expirationTime??null,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth}},createdAt:new Date().toISOString()};
 await save(prefix+"/push-subscriptions/"+id+".json",record,true);
 return apiJson({ok:true});
};

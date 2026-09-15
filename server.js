/*
 Match Meter V4 — Telegram Mini App backend
 Node 18+. Required env:
 BOT_TOKEN
 OWNER_CHAT_ID
 PORT (optional)
 PUBLIC_URL (used only by setup-webhook.js)
*/
const http=require("http"), https=require("https"), crypto=require("crypto"), fs=require("fs"), path=require("path");
const token=process.env.BOT_TOKEN, owner=process.env.OWNER_CHAT_ID, port=process.env.PORT||3000;
if(!token||!owner) console.warn("WARNING: Set BOT_TOKEN and OWNER_CHAT_ID.");

function tg(method,body){return new Promise((resolve,reject)=>{const d=JSON.stringify(body);const r=https.request({hostname:"api.telegram.org",path:"/bot"+token+"/"+method,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(d)}},x=>{let s="";x.on("data",c=>s+=c);x.on("end",()=>resolve(s))});r.on("error",reject);r.write(d);r.end()})}

// Validate Telegram Web App initData according to Telegram's HMAC rules.
function validateInitData(initData){
 if(!initData||!token)return null;
 const params=new URLSearchParams(initData), hash=params.get("hash"); if(!hash)return null;
 params.delete("hash");
 const dataCheck=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
 const secret=crypto.createHmac("sha256","WebAppData").update(token).digest();
 const expected=crypto.createHmac("sha256",secret).update(dataCheck).digest("hex");
 if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(hash)))return null;
 return Object.fromEntries(params.entries());
}
function sendOwner(p,user){
 const text=`💘 Match Meter V4\n\nCategory: ${p.mode}\nName: ${String(p.name).slice(0,40)}\nTheir name: ${String(p.their_name).slice(0,40)}\nScore: ${Number(p.score)}%\nTelegram user: ${user?.id||"unknown"}`;
 return tg("sendMessage",{chat_id:owner,text});
}
const server=http.createServer(async(req,res)=>{
 if(req.method==="GET" && (req.url==="/"||req.url==="/index.html")){
   const f=fs.readFileSync(path.join(__dirname,"index.html"));res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end(f);
 }
 if(req.method==="POST" && req.url==="/telegram-webhook"){
   let raw="";req.on("data",c=>raw+=c);req.on("end",async()=>{
    try{
      const u=JSON.parse(raw),m=u.message,d=m?.web_app_data?.data;
      if(d){
        const p=JSON.parse(d);
        // sendData is delivered by Telegram, but only accept sane payload values.
        if(!p.name||!p.their_name||!["love","bestfriend","fwb","sex","living","timepass","intimate"].includes(p.mode)||!Number.isInteger(Number(p.score))||p.score<0||p.score>100) throw new Error("Invalid payload");
        await sendOwner(p,m.from);
      }
    }catch(e){console.error(e)}
    res.writeHead(200);res.end("ok");
   });return;
 }
 res.writeHead(404);res.end("Not found");
});
server.listen(port,()=>console.log("Match Meter V4 listening on "+port));

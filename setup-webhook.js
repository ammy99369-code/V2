const https=require("https");
const token=process.env.BOT_TOKEN, url=process.env.PUBLIC_URL;
if(!token||!url) throw new Error("Set BOT_TOKEN and PUBLIC_URL");
const data=JSON.stringify({url:url.replace(/\/$/,"")+"/telegram-webhook"});
const req=https.request({hostname:"api.telegram.org",path:"/bot"+token+"/setWebhook",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data)}},res=>{let s="";res.on("data",c=>s+=c);res.on("end",()=>console.log(s))});
req.on("error",console.error);req.write(data);req.end();

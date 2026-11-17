import QRCode from 'qrcode';
import {unzipSync,strFromU8} from 'fflate';
import html from './static/index.html';
import js from './static/app.js';
import css from './static/style.css';
import sample from './static/sample.csv';
import demo from './static/demo-qr.svg';
const assets={'/':[html,'text/html'],'/app.js':[js,'text/javascript'],'/style.css':[css,'text/css'],'/sample.csv':[sample,'text/csv'],'/demo-qr.svg':[demo,'image/svg+xml']};
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",'Strict-Transport-Security':'max-age=31536000'};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,'0')).join('');
const decode=v=>v.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,c)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[c]??String.fromCodePoint(c[1]==='x'?parseInt(c.slice(2),16):parseInt(c.slice(1),10))));
const texts=xml=>[...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
export function namesFromFile(raw,filename){
 let names=[];
 if(/\.xlsx$/i.test(filename)){
  let total=0;const files=unzipSync(raw,{filter:file=>{total+=file.originalSize;if(total>10000000)throw Error('Максимален разархивиран размер: 10 MB.');return /^xl\/(sharedStrings.xml|worksheets\/sheet[^/]*\.xml)$/.test(file.name)}});
  const shared=files['xl/sharedStrings.xml']?[...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>texts(m[1])):[];
  const sheet=Object.keys(files).filter(n=>/^xl\/worksheets\/sheet.*\.xml$/.test(n)).sort()[0];if(!sheet)throw Error('Липсва лист с имена.');
  for(const row of strFromU8(files[sheet]).matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)){
   for(const cell of row[1].matchAll(/<c\s([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g)){
    if(!/\br="A\d+"/.test(cell[1]))continue;
    const value=cell[2]?.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]||'';
    names.push(/\bt="s"/.test(cell[1])?(shared[Number(value)]||''):/\bt="inlineStr"/.test(cell[1])?texts(cell[2]||''):decode(value));break;
   }
  }
 }else if(/\.(csv|txt)$/i.test(filename)){
  // First column; quoted delimiters and escaped quotes are supported.
  const text=strFromU8(raw).replace(/^\uFEFF/,'');let row=[],value='',quoted=false;
  for(let i=0;i<=text.length;i++){const ch=text[i]??'\n';if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(!quoted&&(ch===','||ch===';')){row.push(value);value=''}else if(!quoted&&(ch==='\n'||ch==='\r')){row.push(value);names.push(row[0]);row=[];value='';if(ch==='\r'&&text[i+1]==='\n')i++}else value+=ch}
 }else throw Error('Избери .xlsx, .csv или .txt файл.');
 names=names.map(n=>n.trim()).filter(Boolean);if(/^(име|имена|name|names|участник)$/i.test(names[0]||''))names.shift();
 if(names.length<3||names.length>150)throw Error('Нужни са между 3 и 150 участници.');
 if(names.some(n=>n.length>100))throw Error('Името е твърде дълго.');
 if(new Set(names.map(n=>n.toLocaleLowerCase('bg'))).size!==names.length)throw Error('Има повтарящи се имена. Добави фамилия или отдел.');return names;
}
function rand(n){const max=Math.floor(4294967296/n)*n;let r;do{r=crypto.getRandomValues(new Uint32Array(1))[0]}while(r>=max);return r%n}
export function assign(ids){let result;do{result=[...ids];for(let i=result.length-1;i>0;i--){const j=rand(i+1);[result[i],result[j]]=[result[j],result[i]]}}while(result.some((x,i)=>x===ids[i]));return result}
async function event(db){await db.prepare('INSERT OR IGNORE INTO event(id,payload,version) VALUES(1,?,0)').bind('[]').run();const row=await db.prepare('SELECT payload,version FROM event WHERE id=1').first();return {people:JSON.parse(row.payload),version:row.version}}
async function save(db,people,version){const r=await db.prepare('UPDATE event SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(people),version).run();if(!r.meta.changes)throw Error('Събитието е променено. Обнови страницата.');}
export default {async fetch(request,env){
 try{
  const url=new URL(request.url),path=url.pathname;
  const admin=!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.ADMIN_EMAIL?.toLowerCase();
  if(request.method==='GET'){
   if(path==='/api/status')return json({configured:true,admin,identityAuth:true});
   if(path==='/api/admin'){
    if(!admin)return json({error:'Влез като администратор.'},401);
    const {people}=await event(env.DB);const seen=await env.DB.prepare('SELECT token FROM claims').all();const opened=new Set(seen.results.map(x=>x.token));
    return json({people:people.map(p=>({id:p.id,name:p.name,token:p.token,revealed:opened.has(p.qr),recipient:people.find(x=>x.id===p.recipient)?.name||null})),drawn:people.some(p=>p.recipient)});
   }
   if(path==='/demo-qr.svg')return new Response(await QRCode.toString(url.origin+'/#demo=1',{type:'svg',margin:4}),{headers:{...headers,'Content-Type':'image/svg+xml'}});
   if(assets[path])return new Response(assets[path][0],{headers:{...headers,'Content-Type':assets[path][1]+'; charset=utf-8'}});
   return json({error:'Няма такава страница.'},404);
  }
  if(request.method!=='POST')return json({error:'Невалиден метод.'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Невалиден произход.'},403);
  if(Number(request.headers.get('Content-Length'))>2000000)return json({error:'Максимален размер: 2 MB.'},413);
  const reader=request.body?.getReader();let chunks=[],size=0;if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();return json({error:'Максимален размер: 2 MB.'},413)}chunks.push(value)}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}const data=JSON.parse(strFromU8(bytes));
  if(['/api/setup','/api/login','/api/logout'].includes(path))return json({error:'Използвай входа с ChatGPT.'},403);
  const {people,version}=await event(env.DB);
  if(path==='/api/qr'){
   const p=people.find(p=>p.token===data.token&&p.recipient);if(!p)return json({error:'Линкът е невалиден или тегленето още не е готово.'},404);
   return json({svg:await QRCode.toString(url.origin+'/#scan='+p.qr,{type:'svg',errorCorrectionLevel:'M',margin:4}),local:false});
  }
  if(path==='/api/claim'||path==='/api/reveal'){
   const p=people.find(p=>p.qr===data.token&&p.recipient);if(!p)return json({error:'QR кодът е невалиден или събитието е приключило.'},404);
   const cookies=Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(x=>x.trim().split('=')));const key='gift_'+p.id;const digest=await hash(cookies[key]||'');
   let claim=await env.DB.prepare('SELECT device FROM claims WHERE token=?').bind(p.qr).first();
   if(claim){if(claim.device!==digest)return json({error:'Този подарък вече е отворен в друг браузър. Свържи се с организатора.'},403);return json({name:p.name,recipient:people.find(x=>x.id===p.recipient).name})}
   if(path==='/api/reveal')return json({error:'Отвори подаръка, за да го запазиш в този браузър.'},409);
   const device=token(),deviceHash=await hash(device);
   await env.DB.prepare('INSERT OR IGNORE INTO claims(token,device) VALUES(?,?)').bind(p.qr,deviceHash).run();
   claim=await env.DB.prepare('SELECT device FROM claims WHERE token=?').bind(p.qr).first();
   if(claim.device!==deviceHash)return json({error:'Подаръкът току-що беше отворен в друг браузър.'},403);
   return json({name:p.name,recipient:people.find(x=>x.id===p.recipient).name},200,{'Set-Cookie':`${key}=${device}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`});
  }
  if(!admin)return json({error:'Влез като администратор.'},401);
  if(path==='/api/import'){
   if(people.some(p=>p.recipient))throw Error('Разпределението е заключено.');
   const raw=Uint8Array.from(atob(data.file),x=>x.charCodeAt(0));const names=namesFromFile(raw,data.filename);
   await save(env.DB,names.map(name=>({id:token().slice(0,24),name,token:token(),qr:token(),recipient:null})),version);
  }else if(path==='/api/draw'){
   if(people.length<3)throw Error('Добави поне 3 участници.');if(people.some(p=>p.recipient))throw Error('Разпределението вече е направено и е заключено.');
   const recipients=assign(people.map(p=>p.id));await save(env.DB,people.map((p,i)=>({...p,recipient:recipients[i]})),version);
  }else if(path==='/api/reset'){
   if(data.confirm!=='НОВО СЪБИТИЕ')throw Error('Напиши НОВО СЪБИТИЕ за потвърждение.');await save(env.DB,[],version);
  }else return json({error:'Непозната операция.'},404);
  return json({ok:true});
 }catch(error){return json({error:error.message||'Възникна грешка.'},400)}
}};

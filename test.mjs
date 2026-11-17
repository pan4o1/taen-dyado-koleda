import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './dist/server/index.js';
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0000_shiny_star_brand.sql','utf8'));const DB={prepare(query){let values=[];return {bind(...v){values=v;return this},async run(){const r=sql.prepare(query).run(...values);return {meta:{changes:r.changes}}},async first(){return sql.prepare(query).get(...values)||null},async all(){return {results:sql.prepare(query).all(...values)}}}}};return {sql,env:{DB,ADMIN_EMAIL:'owner@example.com'}}}
const owner={'oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.com'};
test('Hosted permissions, QR privacy, device claim, reset and draw locking',async()=>{
 const {env,sql}=setup();
 async function call(path,data,who={},cookie=''){const headers={...who,Origin:'https://santa.example',Cookie:cookie};const r=await worker.fetch(new Request('https://santa.example/api/'+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined}),env);return {status:r.status,data:await r.json(),cookie:r.headers.get('Set-Cookie')?.split(';')[0]}}
 assert.equal((await call('admin')).status,401);
 assert.equal((await call('admin',undefined,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'})).status,401);
 const names={filename:'names.csv',file:Buffer.from('Име\nАнна\nБорис\nВера\nГеорги').toString('base64')};
 assert.equal((await call('import',names)).status,401);
 assert.equal((await call('import',names,owner)).status,200);
 const draws=await Promise.all([call('draw',{},owner),call('draw',{},owner)]);assert.equal(draws.filter(x=>x.status===200).length,1);
 const people=(await call('admin',undefined,owner)).data.people;assert.equal(new Set(people.map(p=>p.recipient)).size,4);assert(people.every(p=>p.name!==p.recipient));
 for(const p of people){const qr=await call('qr',{token:p.token});assert.equal(qr.status,200);assert(qr.data.svg.includes('<svg'));assert(!('recipient' in qr.data));assert.equal((await call('claim',{token:p.token})).status,404);
 const stored=JSON.parse(sql.prepare('SELECT payload FROM event').get().payload).find(x=>x.id===p.id);
 const claims=await Promise.all([call('claim',{token:stored.qr}),call('claim',{token:stored.qr})]);assert.equal(claims.filter(x=>x.status===200).length,1);
 const claimed=claims.find(x=>x.status===200);assert.equal(claimed.data.recipient,p.recipient);assert(claimed.cookie);assert.equal((await call('reveal',{token:stored.qr},{},claimed.cookie)).status,200);assert.equal((await call('reveal',{token:stored.qr})).status,403);
 }
 assert.equal((await call('import',names,owner)).status,400);
 assert.equal((await call('reset',{confirm:'wrong'},owner)).status,400);
 assert.equal((await call('reset',{confirm:'НОВО СЪБИТИЕ'},owner)).status,200);
 assert.equal((await call('qr',{token:people[0].token})).status,404);sql.close();
});

const $=id=>document.getElementById(id);let state={},spinning=false,rotation=0;const params=new URLSearchParams(location.hash.slice(1));const invite=params.get('invite'),scan=params.get('scan'),demoScan=params.has('demo');
async function api(path,data){const r=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const result=await r.json();if(!r.ok)throw Error(result.error);return result}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,5000)}
async function refresh(){state=await api('status');if(state.admin){await loadAdmin();if(new URLSearchParams(location.search).has('admin'))login()}}
function login(){if(state.admin){$('experience').hidden=true;$('admin').hidden=false;return}if(state.identityAuth){location.href='/signin-with-chatgpt?return_to='+encodeURIComponent('/?admin=1');return}const setup=!state.configured;$('login-title').textContent=setup?'Създай своя администратор':'Вход в работилницата';$('login-help').textContent=setup?'Избери лична парола от поне 12 знака. Само ти ще виждаш цялото разпределение.':'Въведи администраторската си парола.';$('password').autocomplete=setup?'new-password':'current-password';$('login').showModal()}
$('admin-open').onclick=login;$('close-login').onclick=()=>$('login').close();$('login-form').onsubmit=async e=>{e.preventDefault();try{await api(state.configured?'login':'setup',{password:$('password').value});$('password').value='';$('login-error').textContent='';$('login').close();await refresh();login()}catch(e){$('login-error').textContent=e.message}};
$('logout').onclick=()=>{location.href='/signout-with-chatgpt?return_to=%2F'};
async function loadAdmin(){const d=await api('admin');$('draw').disabled=d.drawn||d.people.length<3;$('file').disabled=d.drawn;$('import-status').textContent=d.people.length?`${d.people.length} участници · ${d.drawn?'разпределението е заключено':'готови за теглене'}`:'Все още няма заредени участници.';$('people').replaceChildren();$('pairs').replaceChildren();$('show-pairs').hidden=!d.drawn;for(const p of d.people){const row=document.createElement('div');row.className='person';const n=document.createElement('span');n.textContent=p.name+(p.revealed?' · отворено':'');row.append(n);if(d.drawn){const b=document.createElement('button');b.className='quiet';b.textContent='Копирай покана ↗';b.onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/#invite='+p.token);toast('Линкът за '+p.name+' е копиран.')}catch{toast('Браузърът не разреши копиране.')}};row.append(b)}$('people').append(row);if(p.recipient){const pair=document.createElement('div');pair.className='pair';pair.textContent=p.name+' → '+p.recipient;$('pairs').append(pair)}}}
$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1400000)throw Error('Избери файл до 1.4 MB.');const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(const x of bytes)text+=String.fromCharCode(x);await api('import',{file:btoa(text),filename:file.name});await loadAdmin();toast('Колегите са добавени.')}catch(e){toast(e.message)}finally{e.target.value=''}};
$('draw').onclick=async()=>{try{await api('draw',{});await loadAdmin();toast('Готово! Раздай личните покани.')}catch(e){toast(e.message)}};$('show-pairs').onclick=()=>{$('pairs').hidden=!$('pairs').hidden;$('show-pairs').textContent=$('pairs').hidden?'Покажи кой на кого подарява':'Скрий разпределението'};$('reset').onclick=async()=>{try{await api('reset',{confirm:$('reset-confirm').value});$('reset-confirm').value='';$('pairs').hidden=true;await loadAdmin();toast('Готово за ново събитие.')}catch(e){toast(e.message)}};
if(invite){$('wheel-label').textContent='ТВОЯТА ЛИЧНА ПОКАНА';$('mode-note').replaceChildren();const t=document.createElement('div');t.textContent='✦ Този линк е само за теб. Завърти колелото и запази получателя си в тайна.';$('mode-note').append(t)}
function showName(result){$('result').replaceChildren();const small=document.createElement('small');small.textContent=result.name+', твоят подарък е за';const name=document.createElement('span');name.textContent=result.recipient;const end=document.createElement('small');end.textContent='Пази тайната. Подари усмивка. ♡';$('result').append(small,name,end);$('result').hidden=false}
if(scan||demoScan){
    $('wheel-label').textContent=demoScan?'ДЕМО ПОДАРЪК':'ТВОЯТА ТАЙНА МИСИЯ';
    $('spin').textContent='Отвори моя подарък ♡';
    $('mode-note').textContent='Първото отваряне запазва подаръка в този браузър. Друг браузър няма да може да види името. Пази QR кода, докато го отвориш.';
    $('wheel-hint').textContent='Отвори на личния си телефон. Запази бисквитките, за да виждаш мисията отново.';
    $('spin').onclick=async()=>{try{showName(demoScan?{name:'Демо',recipient:'Примерен колега'}:await api('claim',{token:scan}));$('spin').textContent='Виж мисията отново ♡'}catch(e){toast(e.message)}};
}else{
    $('wheel-hint').textContent='След завъртането сканирай личния QR код с телефона си.';
    $('spin').onclick=async()=>{if(spinning)return;spinning=true;$('spin').disabled=true;$('result').hidden=true;try{
        const qr=invite?await api('qr',{token:invite}):null;
        rotation+=1800+Math.floor(Math.random()*360);$('wheel').style.transform=`rotate(${rotation}deg)`;
        await new Promise(r=>setTimeout(r,matchMedia('(prefers-reduced-motion: reduce)').matches?100:4600));
        $('result').replaceChildren();const title=document.createElement('small');title.textContent=invite?'Твоят подарък е тайна. Сканирай кода.':'Демо QR код · без истинско разпределение';$('result').append(title);
        const img=document.createElement('img');img.className='gift-qr';img.alt='Личен QR код за отваряне на подаръка';
        img.src=invite?'data:image/svg+xml;base64,'+btoa(qr.svg):'/demo-qr.svg';$('result').append(img);
        const help=document.createElement('small');help.textContent='Името ще се покаже само в браузъра, който пръв отвори подаръка.';$('result').append(help);
        if(qr?.local){const local=document.createElement('small');local.textContent='Локален преглед: сканирането от телефон ще работи след публикуване на достъпен адрес.';$('result').append(local)}
        $('result').hidden=false;$('spin').textContent='Покажи QR кода отново ↗';
    }catch(e){toast(e.message)}finally{spinning=false;$('spin').disabled=false}};
}
refresh().catch(e=>toast(e.message));

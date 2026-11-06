(() => {
  'use strict';
  const KEY = 'objmap.mobile.collector.v1';
  let route = [];
  let completed = {};
  try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); route = Array.isArray(saved.route) ? saved.route : []; completed = saved.completed || {}; } catch {}
  const save = () => localStorage.setItem(KEY, JSON.stringify({route, completed}));
  const style = document.createElement('style');
  style.textContent = `#collector-open{position:fixed;z-index:99999;right:12px;bottom:18px;border:0;border-radius:30px;padding:12px 18px;background:#153e35;color:white;font:600 15px system-ui;box-shadow:0 2px 14px #0007}#collector-panel{position:fixed;z-index:99998;right:0;bottom:0;top:0;width:min(94vw,390px);background:#f7f7f2;color:#1b2926;box-shadow:-3px 0 18px #0007;display:none;font:14px system-ui;overflow:auto;padding:18px;box-sizing:border-box}#collector-panel.open{display:block}#collector-panel button,#collector-panel label{cursor:pointer}#collector-panel button{padding:8px;margin:3px;border:1px solid #b3c1b9;border-radius:8px;background:white;color:#183c32}#collector-panel li{padding:10px 0;border-bottom:1px solid #ddd}#collector-panel small{display:block;color:#57635e}#collector-panel h2{margin-top:8px}#collector-panel .error{color:#a32222}`;
  document.head.appendChild(style);
  const open = document.createElement('button'); open.id='collector-open'; open.textContent='收集路线';
  const panel=document.createElement('section'); panel.id='collector-panel';
  panel.innerHTML=`<button id="collector-close" aria-label="关闭">关闭 ×</button><h2>全收集路线</h2><p>导入路线 JSON，勾选已完成目标。数据保存在当前设备。</p><input type="file" id="collector-file" accept=".json,application/json" style="max-width:100%"><div><button id="collector-export">导出路线及进度</button><button id="collector-reset">清空进度</button></div><p id="collector-count"></p><p class="error" id="collector-error" role="alert"></p><ol id="collector-list"></ol>`;
  document.body.append(open,panel);
  const $ = id => panel.querySelector('#'+id);
  const render=()=>{ const list=$('collector-list'); list.replaceChildren(); $('collector-count').textContent=`已完成 ${route.filter(p=>completed[p.id]).length} / ${route.length}`;
    route.forEach((p,i)=>{const li=document.createElement('li');const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!completed[p.id];cb.addEventListener('change',()=>{completed[p.id]=cb.checked;save();render()});const title=document.createElement('span');title.textContent=` ${i+1}. ${p.name}`;const sub=document.createElement('small');sub.textContent=[p.type,p.region,Number.isFinite(p.x)?`x:${p.x}`:'',Number.isFinite(p.z)?`z:${p.z}`:''].filter(Boolean).join(' · ');li.append(cb,title,sub);list.append(li)})};
  open.addEventListener('click',()=>panel.classList.toggle('open'));
  $('collector-close').addEventListener('click',()=>panel.classList.remove('open'));
  $('collector-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());const points=Array.isArray(data)?data:data.waypoints;if(!Array.isArray(points)||points.length>20000||!points.every(p=>p&&typeof p.id==='string'&&p.id.length>0&&typeof p.name==='string'&&p.name.length>0))throw Error('需要包含 waypoints 数组，每项必须有非空 id 和 name');if(new Set(points.map(p=>p.id)).size!==points.length)throw Error('路线 ID 不得重复');route=points.map(p=>({id:p.id,name:p.name,type:typeof p.type==='string'?p.type:'',region:typeof p.region==='string'?p.region:'',x:Number.isFinite(p.x)?p.x:null,z:Number.isFinite(p.z)?p.z:null}));completed={};$('collector-error').textContent='';save();render()}catch(err){$('collector-error').textContent='导入失败：'+err.message}});
  $('collector-export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'objmap-collector-v1',waypoints:route,completed},null,2)],{type:'application/json'});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download='objmap-collector-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
  $('collector-reset').addEventListener('click',()=>{if(confirm('清空所有勾选进度？')){completed={};save();render()}});
  render();
})();

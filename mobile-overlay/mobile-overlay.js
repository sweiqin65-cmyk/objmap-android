(() => {
  'use strict';
  const KEY = 'objmap.mobile.collector.v2';
  const LEGACY = 'objmap.mobile.collector.v1';
  const MAX_FEATURES = 20000;
  const MAX_BYTES = 15 * 1024 * 1024;
  const safeRead = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const old = safeRead(LEGACY);
  let state = safeRead(KEY) || {features:[], waypoints:Array.isArray(old?.route)?old.route:[], completed:old?.completed || {}, favorites:{}, notes:{}, dark:false, font:15};
  let map = null, L = null, routeLayer = null, markerLayer = null, undo = null, selected = 'all';
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e) { showError('保存失败：设备存储空间可能不足'); } };
  const style = document.createElement('style');
  style.textContent = `#om-open{position:fixed;z-index:99998;bottom:18px;right:12px;background:#174d3e;color:#fff;border:0;border-radius:28px;padding:13px 17px;box-shadow:0 3px 16px #0007;font:600 15px system-ui}#om-panel{position:fixed;z-index:99999;right:0;top:0;bottom:0;width:min(96vw,410px);overflow:auto;box-sizing:border-box;padding:18px 16px 35px;background:#fafaf5;color:#1c2925;box-shadow:-4px 0 25px #0008;display:none;font:var(--om-font,15px) system-ui}#om-panel.open{display:block}#om-panel.dark{background:#182321;color:#eef5f0}#om-panel button,#om-panel select{padding:9px;margin:3px;border:1px solid #9aada3;border-radius:9px;background:#fff;color:#183e32}#om-panel.dark button,#om-panel.dark select{background:#2a3d37;color:white}#om-panel input[type=file]{max-width:100%}#om-panel .tabs{display:flex;flex-wrap:wrap;gap:3px}#om-panel .item{padding:9px 0;border-bottom:1px solid #9b9b9b55}#om-panel .muted{opacity:.7;font-size:.85em}#om-panel .err{color:#d34747}#om-panel .actions{display:flex;flex-wrap:wrap}#om-panel h2{margin:10px 0}#om-panel input[type=checkbox]{width:19px;height:19px;vertical-align:middle}#om-panel .item button{font-size:.83em;padding:5px}#om-panel [hidden]{display:none!important}`;
  document.head.appendChild(style);
  const open = document.createElement('button'); open.id = 'om-open'; open.textContent = '海拉鲁助手';
  const panel = document.createElement('section'); panel.id = 'om-panel'; panel.setAttribute('aria-label','海拉鲁地图助手');
  panel.innerHTML = `<button id="om-close">关闭 ×</button><h2>海拉鲁地图助手 2.0</h2><div class="tabs"><button data-tab="route">路线与收集</button><button data-tab="bug">BUG 实验室</button><button data-tab="settings">设置与备份</button></div><p id="om-status" class="muted"></p><p id="om-error" class="err" role="alert"></p><section id="om-route"><p>导入原版 ObjMap 的 JSON（drawData.features），或包含 waypoints 的收集清单。</p><input id="om-file" type="file" accept=".json,application/json"><div class="actions"><button id="om-export">导出完整备份</button><button id="om-undo">撤销勾选</button><button id="om-reset">清空完成状态</button></div><label>筛选 <select id="om-filter"><option value="all">全部</option><option value="pending">未完成</option><option value="done">已完成</option><option value="fav">已收藏</option></select></label><p id="om-count"></p><div id="om-list"></div></section><section id="om-bug" hidden><h3>BUG 实验室（第一阶段）</h3><p>以下为个人练习记录功能，具体教程、视频和练习点数据将在后续版本补充。</p><label>技巧 <select id="om-tech"><option>风弹（Windbomb）</option><option>BLSS</option><option>BTB</option><option>盾跳</option><option>穿墙</option></select></label><div class="actions"><button id="om-attempt">记录尝试</button><button id="om-success">记录成功</button></div><p id="om-bug-stats"></p><textarea id="om-note" rows="4" style="width:100%;box-sizing:border-box" placeholder="练习心得（自动保存）"></textarea></section><section id="om-settings" hidden><p>地图坐标：<span id="om-coord">点击地图查看</span></p><label><input type="checkbox" id="om-dark"> 深色面板</label><p><label>字体大小 <select id="om-font"><option value="14">小</option><option value="15">中</option><option value="18">大</option></select></label></p><button id="om-restore">从备份文件恢复</button><input id="om-backup" type="file" accept=".json,application/json" hidden><p class="muted">数据存于本机浏览器存储。请定期导出备份；卸载应用可能清除本机数据。</p></section>`;
  document.body.append(open,panel);
  const $ = id => panel.querySelector('#'+id);
  const showError = msg => { $('om-error').textContent = msg; };
  const isCoord = v => Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Math.abs(v[0]) <= 6000 && Math.abs(v[1]) <= 5000;
  const validGeometry = g => { if(!g || !['Point','LineString','MultiLineString'].includes(g.type)) return false; if(g.type==='Point') return isCoord(g.coordinates); if(g.type==='LineString') return Array.isArray(g.coordinates) && g.coordinates.length>=2 && g.coordinates.length<=20000 && g.coordinates.every(isCoord); return Array.isArray(g.coordinates) && g.coordinates.length<=1000 && g.coordinates.every(line=>Array.isArray(line)&&line.length>=2&&line.length<=20000&&line.every(isCoord)); };
  const parseImport = data => {
    const collection = data?.drawData?.features || data?.features;
    if(Array.isArray(collection)) {
      if(collection.length>MAX_FEATURES) throw Error('地图图形数量超过上限');
      const features = collection.filter(f=>f?.type==='Feature' && validGeometry(f.geometry)).map(f=>({type:'Feature',properties:f.properties && typeof f.properties==='object'?f.properties:{},geometry:f.geometry}));
      if(!features.length) throw Error('没有可用的点或路线坐标');
      const points = features.filter(f=>f.geometry.type==='Point').map((f,i)=>({id:'geo-'+i+'-'+f.geometry.coordinates.join(','),name:String(f.properties.title||f.properties.name||f.properties.label||`标记 ${i+1}`).slice(0,150),x:f.geometry.coordinates[0],z:f.geometry.coordinates[1],type:'地图标记'}));
      return {features,waypoints:points};
    }
    const points = Array.isArray(data)?data:data?.waypoints;
    if(!Array.isArray(points)||points.length>MAX_FEATURES||!points.every(p=>p && typeof p.id==='string'&&p.id && typeof p.name==='string'&&p.name)) throw Error('JSON 需要包含 drawData.features 或合法的 waypoints 数组');
    if(new Set(points.map(p=>p.id)).size!==points.length) throw Error('路线 ID 不能重复');
    return {features:[],waypoints:points.map(p=>({id:p.id,name:p.name.slice(0,150),type:String(p.type||''),region:String(p.region||''),x:Number.isFinite(p.x)?p.x:null,z:Number.isFinite(p.z)?p.z:null}))};
  };
  const safeColor = v => typeof v==='string' && (/^#[0-9a-fA-F]{3,8}$/.test(v)||/^[a-zA-Z]{3,20}$/.test(v))?v:'#3388ff';
  const clearMap = () => { if(map && routeLayer) map.removeLayer(routeLayer); if(map && markerLayer) map.removeLayer(markerLayer); routeLayer=null;markerLayer=null; };
  const draw = () => {
    if(!map||!L) return;
    clearMap(); routeLayer=L.layerGroup().addTo(map);markerLayer=L.layerGroup().addTo(map);
    for(const f of state.features||[]) {
      const g=f.geometry,p=f.properties||{},c=safeColor(p.color||p.stroke||p?.style?.color||p?.options?.color);
      const ll = xy => [xy[1],xy[0]];
      if(g.type==='LineString') L.polyline(g.coordinates.map(ll),{color:c,weight:Number.isFinite(p.weight)?Math.max(1,Math.min(12,p.weight)):4,opacity:.9}).addTo(routeLayer);
      if(g.type==='MultiLineString') g.coordinates.forEach(line=>L.polyline(line.map(ll),{color:c,weight:4}).addTo(routeLayer));
      if(g.type==='Point') L.circleMarker(ll(g.coordinates),{radius:5,color:c,fillOpacity:.9}).addTo(markerLayer);
    }
    // 单独的 waypoints 也显示在地图上。
    if(!(state.features||[]).length) for(const p of state.waypoints||[]) if(Number.isFinite(p.x)&&Number.isFinite(p.z)) L.circleMarker([p.z,p.x],{radius:5,color:state.completed[p.id]?'#888':'#00c878'}).addTo(markerLayer);
    $('om-status').textContent=`地图已连接 · 彩色路线 ${(state.features||[]).filter(f=>f.geometry.type!=='Point').length} 条`;
  };
  const connectMap = () => {
    if(window.__objmapMobileMap && window.__objmapMobileLeaflet) {
      map=window.__objmapMobileMap;L=window.__objmapMobileLeaflet;
      map.on('click',e=>{ $('om-coord').textContent=`X: ${e.latlng.lng.toFixed(1)} · Z: ${e.latlng.lat.toFixed(1)}`; });
      draw(); return true;
    } return false;
  };
  window.addEventListener('objmap-mobile-map-ready',()=>{if(!map)connectMap()});
  let tries=0; const wait=setInterval(()=>{if(map||connectMap()||++tries>=40) {clearInterval(wait);if(!map)$('om-status').textContent='地图尚未连接，请重新打开地图页面';}},500);
  const goto = p => {if(!map||!Number.isFinite(p.x)||!Number.isFinite(p.z)){showError('此目标没有有效坐标，或地图尚未加载');return;}panel.classList.remove('open');map.setView([p.z,p.x],Math.max(6,map.getZoom()));};
  const render = () => {
    const pts=state.waypoints||[]; $('om-count').textContent=`已完成 ${pts.filter(p=>state.completed[p.id]).length} / ${pts.length} · 地图图形 ${(state.features||[]).length}`;
    const list=$('om-list');list.replaceChildren();const view=pts.filter(p=>selected==='all'||(selected==='done'&&state.completed[p.id])||(selected==='pending'&&!state.completed[p.id])||(selected==='fav'&&state.favorites?.[p.id]));
    for(const p of view.slice(0,1000)) {
      const row=document.createElement('div');row.className='item';const check=document.createElement('input');check.type='checkbox';check.checked=!!state.completed[p.id];check.addEventListener('change',()=>{undo={id:p.id,was:!!state.completed[p.id]};state.completed[p.id]=check.checked;persist();render();draw()});
      const name=document.createElement('span');name.textContent=' '+p.name+' ';const go=document.createElement('button');go.textContent='定位';go.onclick=()=>goto(p);const fav=document.createElement('button');fav.textContent=state.favorites?.[p.id]?'★ 收藏':'☆ 收藏';fav.onclick=()=>{state.favorites||={};state.favorites[p.id]=!state.favorites[p.id];persist();render()};row.append(check,name,go,fav);list.append(row);
    }
    if(view.length>1000){const p=document.createElement('p');p.textContent=`列表仅展示前 1000 项（共 ${view.length} 项），可使用筛选功能`;list.append(p)}
  };
  const download = (data,name) => {const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)};
  const importFile = async(file,restore=false) => {if(!file)return;try{if(file.size>MAX_BYTES)throw Error('文件超过 15MB 限制');const data=JSON.parse(await file.text());if(restore){if(data.format!=='objmap-mobile-v2'||!data.state||!Array.isArray(data.state.waypoints)||!Array.isArray(data.state.features))throw Error('备份格式不正确');const parsed=data.state.features.length?parseImport({features:data.state.features}):parseImport({waypoints:data.state.waypoints});state={...state,...data.state,...parsed,completed:data.state.completed||{},favorites:data.state.favorites||{},notes:data.state.notes||{}};}else{const parsed=parseImport(data);state={...state,...parsed,completed:{},favorites:{}};}persist();showError('');render();draw();}catch(e){showError('导入失败：'+e.message)}};
  $('om-file').onchange=e=>importFile(e.target.files?.[0]);$('om-backup').onchange=e=>importFile(e.target.files?.[0],true);
  $('om-export').onclick=()=>download({format:'objmap-mobile-v2',state},'objmap-2.0-backup.json');$('om-restore').onclick=()=>$('om-backup').click();
  $('om-reset').onclick=()=>{if(confirm('确认清空所有已完成勾选？')){state.completed={};persist();render();draw()}};
  $('om-undo').onclick=()=>{if(undo){state.completed[undo.id]=undo.was;undo=null;persist();render();draw()}};
  $('om-filter').onchange=e=>{selected=e.target.value;render()};
  $('om-close').onclick=()=>panel.classList.remove('open');open.onclick=()=>panel.classList.toggle('open');
  panel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{for(const k of ['route','bug','settings']) $('om-'+k).hidden=b.dataset.tab!==k;});
  $('om-dark').checked=!!state.dark;$('om-font').value=String(state.font||15);
  const appearance=()=>{panel.classList.toggle('dark',!!state.dark);panel.style.setProperty('--om-font',(state.font||15)+'px')};appearance();
  $('om-dark').onchange=e=>{state.dark=e.target.checked;persist();appearance()};$('om-font').onchange=e=>{state.font=Number(e.target.value);persist();appearance()};
  const getTech=()=> $('om-tech').value;
  const renderBug=()=>{const t=getTech(),r=state.notes?.[t]||{};$('om-bug-stats').textContent=`尝试 ${r.attempts||0} 次 · 成功 ${r.successes||0} 次 · 成功率 ${r.attempts?Math.round(100*(r.successes||0)/r.attempts):0}%`;$('om-note').value=r.text||''};
  $('om-tech').onchange=renderBug;
  const record=success=>{state.notes||={};const t=getTech(),r=state.notes[t]||{};r.attempts=(r.attempts||0)+1;r.successes=(r.successes||0)+(success?1:0);state.notes[t]=r;persist();renderBug()};
  $('om-attempt').onclick=()=>record(false);$('om-success').onclick=()=>record(true);
  $('om-note').oninput=e=>{state.notes||={};const t=getTech();state.notes[t]||={};state.notes[t].text=e.target.value;persist()};
  render();renderBug();
})();

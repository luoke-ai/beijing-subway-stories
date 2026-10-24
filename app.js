// 北京地铁站名故事 · 交互逻辑
(function(){
  const svg = document.getElementById('svg');
  const NS = 'http://www.w3.org/2000/svg';

  // ---------- 渲染 ----------
  // 站点→线路映射
  const stationLines = {};
  LINES.forEach(l => l.stops.forEach(s => {
    (stationLines[s] = stationLines[s] || []).push(l.id);
  }));

  function el(tag, attrs, parent){
    const e = document.createElementNS(NS, tag);
    for(const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }

  // 线路
  const lineGroup = el('g',{id:'lines'});
  LINES.forEach(l=>{
    const pts = l.stops.filter(s=>STATIONS[s]).map(s=>STATIONS[s]);
    if(pts.length<2) return;
    const d = 'M' + pts.map(p=>p.join(',')).join(' L');
    el('path',{d, class:'line-path', stroke:LINE_COLORS[l.id]}, lineGroup);
    // 线路名标签（放在线路中点）
    const mid = pts[Math.floor(pts.length/2)];
    el('text',{x:mid[0], y:mid[1]-10, class:'line-label', fill:LINE_COLORS[l.id]},lineGroup).textContent = LINE_NAMES[l.id];
  });

  // 站点
  const stationGroup = el('g',{id:'stations'});
  const dotMap = {};
  Object.keys(STATIONS).forEach(name=>{
    const [x,y] = STATIONS[name];
    const has = !!STORIES[name];
    const dot = el('circle',{cx:x, cy:y, r: has?5.5:3.5, class:'station-dot'+(has?' has-story':'')}, stationGroup);
    dot.addEventListener('click', ev=>{ ev.stopPropagation(); show(name); });
    dot.addEventListener('mouseenter', ev=>{ if(has) tip(name, ev); });
    dot.addEventListener('mousemove', ev=>{ if(has) tip(name, ev); });
    dot.addEventListener('mouseleave', ()=> tipEl.style.display='none');
    dotMap[name] = dot;
    // 换乘站稍大
    if(stationLines[name] && stationLines[name].length>1) dot.setAttribute('r', has?7:5);
    // 站名标注（仅故事站和换乘站，避免过密）
    if(has || (stationLines[name]&&stationLines[name].length>1)){
      const t = el('text',{x:x+9, y:y+4, class:'station-name'}, stationGroup);
      t.textContent = name;
    }
  });

  // 图例
  const legend = document.getElementById('legend');
  Object.keys(LINE_NAMES).forEach(id=>{
    const s = document.createElement('span');
    s.innerHTML = `<i style="background:${LINE_COLORS[id]}"></i>${LINE_NAMES[id]}`;
    legend.appendChild(s);
  });

  // ---------- 缩放拖拽 ----------
  let vb = {x:0,y:0,w:1400,h:1000};
  function applyVB(){ svg.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`); }
  applyVB();

  let dragging=false, last=null, moved=false;
  svg.addEventListener('mousedown', e=>{ dragging=true; moved=false; last=[e.clientX,e.clientY]; });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const dx=(e.clientX-last[0])*vb.w/svg.clientWidth, dy=(e.clientY-last[1])*vb.h/svg.clientHeight;
    if(Math.abs(e.clientX-last[0])+Math.abs(e.clientY-last[1])>3) moved=true;
    vb.x-=dx; vb.y-=dy; last=[e.clientX,e.clientY]; applyVB();
  });
  window.addEventListener('mouseup', ()=> dragging=false);
  // 触屏
  svg.addEventListener('touchstart', e=>{ if(e.touches.length===1){ dragging=true; last=[e.touches[0].clientX,e.touches[0].clientY]; } },{passive:true});
  svg.addEventListener('touchmove', e=>{
    if(dragging && e.touches.length===1){
      const dx=(e.touches[0].clientX-last[0])*vb.w/svg.clientWidth, dy=(e.touches[0].clientY-last[1])*vb.h/svg.clientHeight;
      vb.x-=dx; vb.y-=dy; last=[e.touches[0].clientX,e.touches[0].clientY]; applyVB();
    }
  },{passive:true});
  svg.addEventListener('touchend', ()=> dragging=false);

  svg.addEventListener('wheel', e=>{
    e.preventDefault();
    const k = e.deltaY>0 ? 1.15 : 0.87;
    const rect = svg.getBoundingClientRect();
    const mx = vb.x + (e.clientX-rect.left)/rect.width*vb.w;
    const my = vb.y + (e.clientY-rect.top)/rect.height*vb.h;
    vb.w*=k; vb.h*=k;
    vb.x = mx-(mx-vb.x)*k; vb.y = my-(my-vb.y)*k;
    applyVB();
  }, {passive:false});

  // ---------- 详情面板 ----------
  const panel=document.getElementById('panel'),
        pLines=document.getElementById('p-lines'),
        pName=document.getElementById('p-name'),
        pEn=document.getElementById('p-en'),
        pBody=document.getElementById('panel-body');

  function show(name){
    const story = STORIES[name];
    pLines.innerHTML = (stationLines[name]||[]).map(id=>
      `<span class="line-chip" style="background:${LINE_COLORS[id]}">${LINE_NAMES[id]}</span>`).join('');
    pName.textContent = name;
    pEn.textContent = story ? '' : '';
    if(story){
      pBody.innerHTML = `<h3>名称由来</h3><p>${story.o}</p><h3>轶事</h3><p>${story.s}</p>`;
    }else{
      pBody.innerHTML = `<div class="placeholder">这个故事还在编写中…</div>`;
    }
    panel.classList.add('open');
    // 移动端也打开
    if(window.innerWidth<=800) panel.classList.add('open');
  }
  document.getElementById('close-btn').addEventListener('click', ()=> panel.classList.remove('open'));
  svg.addEventListener('click', ()=>{ if(!moved) panel.classList.remove('open'); });

  // ---------- 搜索 ----------
  const search=document.getElementById('search'), sug=document.getElementById('suggestions');
  const tipEl=document.getElementById('tip');
  function tip(name, ev){
    const map=document.getElementById('map-wrap').getBoundingClientRect();
    tipEl.textContent = name + '（点击查看故事）';
    tipEl.style.display='block';
    tipEl.style.left=(ev.clientX-map.left+12)+'px';
    tipEl.style.top=(ev.clientY-map.top+12)+'px';
  }
  search.addEventListener('input', ()=>{
    const q=search.value.trim();
    if(!q){ sug.style.display='none'; return; }
    const hits=Object.keys(STATIONS).filter(n=>n.includes(q)).slice(0,8);
    if(!hits.length){ sug.innerHTML='<div class="item">无匹配站点</div>'; sug.style.display='block'; return; }
    sug.innerHTML = hits.map(n=>
      `<div class="item" data-n="${n}">${n}<span class="l">${STORIES[n]?'有故事':'—'}</span></div>`).join('');
    sug.style.display='block';
    [...sug.children].forEach(it=> it.addEventListener('click', ()=>{
      const n=it.getAttribute('data-n'); sug.style.display='none'; search.value=n; show(n);
      // 视图飞到该站
      const [x,y]=STATIONS[n];
      vb.w=400; vb.h=300; vb.x=x-200; vb.y=y-150; applyVB();
    }));
  });
  document.addEventListener('click', e=>{ if(!sug.contains(e.target)&&e.target!==search) sug.style.display='none'; });
})();

// 北京地铁站名故事 · Leaflet 真实地图版
(function(){
  // ---------- WGS-84 -> GCJ-02（高德底图纠偏） ----------
  function wgs2gcj(lat, lng){
    const a = 6378245.0, ee = 0.00669342162296594323;
    function tLat(x, y){
      let r = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
      r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
      r += (20*Math.sin(y*Math.PI) + 40*Math.sin(y/3*Math.PI)) * 2/3;
      r += (160*Math.sin(y/12*Math.PI) + 320*Math.sin(y*Math.PI/30)) * 2/3;
      return r;
    }
    function tLng(x, y){
      let r = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
      r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
      r += (20*Math.sin(x*Math.PI) + 40*Math.sin(x/3*Math.PI)) * 2/3;
      r += (150*Math.sin(x/12*Math.PI) + 300*Math.sin(x/30*Math.PI)) * 2/3;
      return r;
    }
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng];
    let dLat = tLat(lng-105, lat-35), dLng = tLng(lng-105, lat-35);
    const radLat = lat/180*Math.PI;
    let magic = Math.sin(radLat); magic = 1 - ee*magic*magic;
    const sq = Math.sqrt(magic);
    dLat = (dLat*180) / ((a*(1-ee)) / (magic*sq) * Math.PI);
    dLng = (dLng*180) / (a/sq*Math.cos(radLat)*Math.PI);
    return [lat + dLat, lng + dLng];
  }
  const gcjCache = {};
  function G(name){
    if(!STATIONS[name]) return null;
    if(!gcjCache[name]){
      const [la, lo] = STATIONS[name];
      gcjCache[name] = wgs2gcj(la, lo);
    }
    return gcjCache[name];
  }

  // ---------- 地图初始化 ----------
  const map = L.map('map', {zoomControl:false, minZoom:9, maxZoom:17}).setView([39.905, 116.42], 11);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains:['1','2','3','4'], attribution:'© 高德地图 | 站点数据 © Wikidata (CC0)', maxZoom:17
  }).addTo(map);

  // ---------- 站点 -> 线路 ----------
  const stationLines = {};
  LINES.forEach(l => l.stops.forEach(s => {
    (stationLines[s] = stationLines[s] || []).push(l);
  }));
  const storyOf = n => STORIES[n] || STORIES[n.replace(/站$/,'')];

  // ---------- 画线路 ----------
  const lineBounds = {};
  LINES.forEach(l => {
    const pts = l.stops.map(G).filter(Boolean);
    if(pts.length < 2) return;
    L.polyline(pts, {color:l.color, weight:4.5, opacity:.95, className:'subway-line'}).addTo(map);
    lineBounds[l.name] = L.latLngBounds(pts);
  });

  // ---------- 画站点 ----------
  const markers = {};
  Object.keys(STATIONS).forEach(name=>{
    const p = G(name); if(!p) return;
    const story = storyOf(name);
    const isTransfer = (stationLines[name]||[]).length > 1;
    const m = L.circleMarker(p, {
      radius: story ? 6 : (isTransfer ? 4.5 : 3),
      color: story ? '#8a6d00' : '#1b2340',
      weight: story ? 2.5 : 1.5,
      fillColor: story ? '#ffd54a' : (isTransfer ? '#fff' : '#f4f6ff'),
      fillOpacity: 1,
      className:'station-dot'
    }).addTo(map);
    m.on('click', ()=> show(name));
    m.bindTooltip(name.replace(/站$/,''), {permanent: story || isTransfer, direction:'right',
      className:'station-label' + (story ? ' story-label' : ''), offset:[4,0]});
    m.on('mouseover', function(){ if(!story && !isTransfer) this.openTooltip(); });
    markers[name] = m;
  });

  // 缩放时控制标注密度：高缩放级别显示全部
  function refreshLabels(){
    const z = map.getZoom();
    Object.keys(markers).forEach(n=>{
      const t = markers[n].getTooltip(); if(!t) return;
      const keep = storyOf(n) || (stationLines[n]||[]).length>1 || z>=13;
      t.setOpacity && t.setOpacity(keep?1:0);
      const el = t.getElement(); if(el) el.style.display = keep?'':'none';
    });
  }
  map.on('zoomend', refreshLabels);

  // ---------- 图例（可点击缩放到线路） ----------
  const legend = document.getElementById('legend');
  LINES.forEach(l=>{
    const s = document.createElement('span');
    s.innerHTML = `<i style="background:${l.color}"></i>${l.name}`;
    s.addEventListener('click', ()=>{
      if(lineBounds[l.name]) map.fitBounds(lineBounds[l.name].pad(0.15));
    });
    legend.appendChild(s);
  });

  // ---------- 详情面板 ----------
  const panel=document.getElementById('panel'), pLines=document.getElementById('p-lines'),
        pName=document.getElementById('p-name'), pBody=document.getElementById('panel-body');
  let activeMarker = null;
  function show(name){
    const story = storyOf(name);
    pLines.innerHTML = (stationLines[name]||[]).map(l =>
      `<span class="line-chip" style="background:${l.color}">${l.name}</span>`).join('');
    pName.textContent = name.replace(/站$/,'');
    if(story){
      pBody.innerHTML = `<h3>名称由来</h3><p>${story.o}</p><h3>轶事</h3><p>${story.s}</p>`;
    }else{
      pBody.innerHTML = `<div class="placeholder">这个故事还在编写中…</div>`;
    }
    if(activeMarker) activeMarker.setStyle({radius: markers[name]===activeMarker?6:activeMarker.options.radius});
    panel.classList.add('open');
    map.flyTo(G(name), Math.max(map.getZoom(), 13), {duration:.6});
  }
  document.getElementById('close-btn').addEventListener('click', ()=> panel.classList.remove('open'));

  // ---------- 搜索 ----------
  const search=document.getElementById('search'), sug=document.getElementById('suggestions');
  search.addEventListener('input', ()=>{
    const q = search.value.trim();
    if(!q){ sug.style.display='none'; return; }
    const hits = Object.keys(STATIONS).map(n=>({n, d:n.indexOf(q)})).filter(x=>x.d>=0)
      .sort((a,b)=>a.d-b.d || a.n.length-b.n.length).slice(0,8);
    if(!hits.length){ sug.innerHTML='<div class="item" style="cursor:default">无匹配站点</div>'; sug.style.display='block'; return; }
    sug.innerHTML = hits.map(x=>
      `<div class="item" data-n="${x.n}">${x.n.replace(/站$/,'')}<span class="l">${storyOf(x.n)?'有故事':'—'}</span></div>`).join('');
    sug.style.display='block';
    [...sug.querySelectorAll('.item')].forEach(it=> it.addEventListener('click', ()=>{
      sug.style.display='none'; show(it.getAttribute('data-n'));
    }));
  });
  document.addEventListener('click', e=>{ if(!sug.contains(e.target) && e.target!==search) sug.style.display='none'; });

  refreshLabels();
})();

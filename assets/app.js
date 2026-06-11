(function(){
  "use strict";
  const WORKS = window.WORKS, TRACKS = window.TRACKS;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
  const VER = "2"; // 图片缓存版本：替换任何海报/缩略图后 +1（与 index.html 的 ?v 保持一致）
  const IMG = s=>`assets/works/${s}.webp?v=${VER}`;
  const THUMB = s=>`assets/works/thumbs/${s}.webp?v=${VER}`;

  /* ---------- 星空 ---------- */
  (function starfield(){
    const cv = $("#starfield"), ctx = cv.getContext("2d");
    let w,h,stars=[],shooters=[],dpr=Math.min(devicePixelRatio||1,2);
    function resize(){
      w=cv.width=innerWidth*dpr; h=cv.height=innerHeight*dpr;
      cv.style.width=innerWidth+"px"; cv.style.height=innerHeight+"px";
      const count=Math.round(innerWidth*innerHeight/5200);
      stars=Array.from({length:count},()=>({
        x:Math.random()*w, y:Math.random()*h,
        r:(Math.random()*1.5+.3)*dpr,
        a:Math.random(), tw:Math.random()*.02+.004,
        d:Math.random()*.5+.15,
        c:Math.random()<.18?"hsl("+(190+Math.random()*80)+",80%,80%)":"#ffffff"
      }));
    }
    function shoot(){
      if(reduce) return;
      shooters.push({x:Math.random()*w,y:Math.random()*h*.4,len:(Math.random()*200+120)*dpr,
        vx:(Math.random()*6+5)*dpr,vy:(Math.random()*2+1.5)*dpr,life:1});
    }
    let scroll=0; addEventListener("scroll",()=>scroll=scrollY*dpr*.12,{passive:true});
    function tick(){
      ctx.clearRect(0,0,w,h);
      for(const s of stars){
        s.a+=s.tw; const al=.4+Math.abs(Math.sin(s.a))*.6;
        const y=(s.y - scroll*s.d)%h, yy=y<0?y+h:y;
        ctx.globalAlpha=al; ctx.fillStyle=s.c;
        ctx.beginPath(); ctx.arc(s.x,yy,s.r,0,7); ctx.fill();
        if(s.r>1.1){ctx.globalAlpha=al*.25;ctx.beginPath();ctx.arc(s.x,yy,s.r*3,0,7);ctx.fill();}
      }
      ctx.globalAlpha=1;
      for(let i=shooters.length-1;i>=0;i--){
        const m=shooters[i]; m.x+=m.vx;m.y+=m.vy;m.life-=.012;
        const g=ctx.createLinearGradient(m.x,m.y,m.x-m.len*(m.vx/8),m.y-m.len*(m.vy/8));
        g.addColorStop(0,"rgba(180,220,255,"+m.life+")");g.addColorStop(1,"transparent");
        ctx.strokeStyle=g;ctx.lineWidth=2*dpr;ctx.beginPath();ctx.moveTo(m.x,m.y);
        ctx.lineTo(m.x-m.len*(m.vx/8),m.y-m.len*(m.vy/8));ctx.stroke();
        if(m.life<=0||m.x>w)shooters.splice(i,1);
      }
      requestAnimationFrame(tick);
    }
    resize(); addEventListener("resize",resize); tick();
    setInterval(()=>{if(Math.random()<.7)shoot();},2600);
  })();

  /* ---------- 导航滚动态 ---------- */
  const nav=$("#nav");
  addEventListener("scroll",()=>nav.classList.toggle("scrolled",scrollY>40),{passive:true});

  /* ---------- Hero 数字 ---------- */
  (function counters(){
    const els=$$("#heroStats b[data-count]");
    let done=false;
    const run=()=>{els.forEach(el=>{
      const t=+el.dataset.count;let c=0;const step=Math.max(1,Math.round(t/40));
      const iv=setInterval(()=>{c+=step;if(c>=t){c=t;clearInterval(iv);}el.textContent=c;},28);
    });};
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!done){done=true;run();}}),{threshold:.5});
    io.observe($("#heroStats"));
  })();

  /* ---------- Coverflow ---------- */
  const stage=$("#cfStage"), N=WORKS.length;
  const lead=$("#galleryLead"); if(lead) lead.textContent=`滑动、拖拽，或静待星河自转——逐一点亮 ${N} 份黑客松作品。`;
  let cur=0, items=[];
  WORKS.forEach((wk,i)=>{
    const el=document.createElement("div");
    el.className="cf-item"; el.dataset.i=i;
    const tr=TRACKS[wk.track];
    el.style.setProperty("--accent",tr.color);
    el.style.setProperty("--glow",tr.glow);
    el.innerHTML=`<img loading="lazy" src="${THUMB(wk.slug)}" alt="${wk.title}"><span class="cf-shine"></span>`;
    el.addEventListener("click",()=>{ if(i===cur) openLB(i); else go(i); });
    stage.appendChild(el); items.push(el);
  });

  function layout(){
    const cw=stage.clientWidth||innerWidth;
    const spacing=Math.min(cw*0.30,300);
    items.forEach((el,i)=>{
      let off=i-cur; if(off>N/2)off-=N; if(off<-N/2)off+=N;
      const a=Math.abs(off);
      if(a>3.5){ el.style.opacity=0; el.style.pointerEvents="none";
        el.style.transform=`translate(-50%,-50%) translateX(${off*spacing}px) scale(.3)`; return; }
      const x=off*spacing;
      const z=-a*160;
      const rot=off===0?0:(off>0?-42:42);
      const sc=Math.max(.55,1-a*.13);
      el.style.opacity=Math.max(0,1-a*.26);
      el.style.pointerEvents="auto";
      el.style.zIndex=String(200-a*10);
      el.style.transform=`translate(-50%,-50%) translateX(${x}px) translateZ(${z}px) rotateY(${rot}deg) scale(${sc})`;
      el.classList.toggle("active",off===0);
    });
    syncMeta(); syncDots();
  }
  function go(i){ cur=((i%N)+N)%N; layout(); }
  function next(){ go(cur+1); } function prev(){ go(cur-1); }

  /* 元信息 */
  const mTrack=$("#cfTrack"),mTitle=$("#cfTitle"),mEn=$("#cfEn"),mTag=$("#cfTagline"),mAuthor=$("#cfAuthor"),meta=$("#cfMeta");
  function syncMeta(){
    const wk=WORKS[cur],tr=TRACKS[wk.track];
    meta.style.setProperty("--accent",tr.color); meta.style.setProperty("--glow",tr.glow);
    mTrack.textContent=wk.track; mTitle.textContent=wk.title;
    mEn.textContent=wk.en; mTag.textContent="“"+wk.tagline+"”";
    mAuthor.innerHTML=wk.author?`队长 · <b>${wk.author}</b>`:`AI 黑客松 · 参赛作品`;
    [mTitle,mEn,mTag].forEach(e=>{e.style.animation="none";void e.offsetWidth;e.style.animation="rise .6s forwards";});
  }
  /* 圆点 */
  const dotsWrap=$("#cfDots");
  WORKS.forEach((_,i)=>{const d=document.createElement("span");d.className="cf-dot";d.addEventListener("click",()=>go(i));dotsWrap.appendChild(d);});
  const dots=$$(".cf-dot",dotsWrap);
  function syncDots(){dots.forEach((d,i)=>d.classList.toggle("active",i===cur));}

  $("#cfNext").addEventListener("click",next);
  $("#cfPrev").addEventListener("click",prev);

  /* 自动播放 */
  let auto=null; const AUTO=4200;
  function play(){ if(reduce)return; stop(); auto=setInterval(next,AUTO); }
  function stop(){ if(auto){clearInterval(auto);auto=null;} }
  const cfWrap=$("#coverflow");
  cfWrap.addEventListener("mouseenter",stop); cfWrap.addEventListener("mouseleave",play);

  /* 拖拽 / 滑动 */
  let dragX=null,moved=false;
  cfWrap.addEventListener("pointerdown",e=>{dragX=e.clientX;moved=false;stop();});
  addEventListener("pointermove",e=>{
    if(dragX===null)return;
    if(Math.abs(e.clientX-dragX)>60){ (e.clientX<dragX)?next():prev(); dragX=e.clientX; moved=true; }
  });
  addEventListener("pointerup",()=>{dragX=null;play();});
  /* 键盘 */
  addEventListener("keydown",e=>{
    if($("#lightbox").classList.contains("open"))return;
    if(e.key==="ArrowRight")next(); if(e.key==="ArrowLeft")prev();
  });

  layout(); play();
  addEventListener("resize",layout);

  /* ---------- 星座网格 + 筛选 ---------- */
  const grid=$("#starGrid"), filters=$("#filters");
  const trackNames=Object.keys(TRACKS);
  // 全部按钮
  const mkFilter=(label,val,color,glow,count)=>{
    const b=document.createElement("button");
    b.className="filter"; b.dataset.val=val;
    if(color){b.style.setProperty("--c",color);b.style.setProperty("--g",glow);}
    b.innerHTML=`${label}<b>${count}</b>`;
    b.addEventListener("click",()=>applyFilter(val,b));
    filters.appendChild(b); return b;
  };
  const allBtn=mkFilter("全部星河","all","#f5d27a","rgba(245,210,122,.45)",WORKS.length);
  allBtn.classList.add("active");
  trackNames.forEach(t=>{
    const tr=TRACKS[t]; const c=WORKS.filter(w=>w.track===t).length;
    mkFilter(t,t,tr.color,tr.glow,c);
  });

  WORKS.forEach((wk,i)=>{
    const tr=TRACKS[wk.track];
    const card=document.createElement("article");
    card.className="star-card"; card.dataset.track=wk.track; card.dataset.i=i;
    card.style.setProperty("--accent",tr.color); card.style.setProperty("--glow",tr.glow);
    card.style.transitionDelay=(i%12*0.04)+"s";
    card.innerHTML=`
      <div class="sc-img">
        <span class="sc-num">${String(i+1).padStart(2,"0")}</span>
        <span class="sc-track">${wk.track}</span>
        <span class="sc-glint"></span>
        <img loading="lazy" src="${THUMB(wk.slug)}" alt="${wk.title}">
      </div>
      <div class="sc-body">
        <h4>${wk.title}</h4>
        <p>${wk.tagline}</p>
        ${wk.author?`<div class="sc-author">✦ ${wk.author}</div>`:""}
        <div class="sc-stats" data-slug="${wk.slug}" style="display:none">
          <span class="sc-stat sc-like">♥ <b>0</b></span>
          <span class="sc-stat sc-cmt">💬 <b>0</b></span>
        </div>
      </div>`;
    card.addEventListener("click",()=>openLB(i));
    grid.appendChild(card);
  });
  const cards=$$(".star-card");

  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}}),{threshold:.12});
  cards.forEach(c=>io.observe(c));

  function applyFilter(val,btn){
    $$(".filter").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
    cards.forEach(c=>{
      const show=(val==="all"||c.dataset.track===val);
      c.classList.toggle("hide",!show);
    });
  }

  /* ---------- 灯箱 ---------- */
  const lb=$("#lightbox"),lbImg=$("#lbImg"),lbTrack=$("#lbTrack"),lbTitle=$("#lbTitle"),
        lbEn=$("#lbEn"),lbTag=$("#lbTagline"),lbBlurb=$("#lbBlurb"),lbTags=$("#lbTags"),
        lbAuthor=$("#lbAuthor"),lbIndex=$("#lbIndex"),lbQr=$("#lbQr"),lbHighlight=$("#lbHighlight"),lbWechat=$("#lbWechat");
  let lbI=0;
  function openLB(i){ lbI=i; renderLB(); lb.classList.add("open"); lb.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; stop(); }
  function closeLB(){ lb.classList.remove("open"); lb.setAttribute("aria-hidden","true"); document.body.style.overflow=""; play(); }
  function renderLB(){
    const wk=WORKS[lbI],tr=TRACKS[wk.track];
    lb.style.setProperty("--accent",tr.color); lb.style.setProperty("--glow",tr.glow);
    lbImg.src=IMG(wk.slug); lbImg.alt=wk.title;
    lbTrack.textContent=wk.track+" · "+tr.desc;
    lbTitle.textContent=wk.title; lbEn.textContent=wk.en;
    lbTag.textContent="“"+wk.tagline+"”"; lbBlurb.textContent=wk.blurb;
    lbTags.innerHTML=wk.tags.map(t=>`<span>#${t}</span>`).join("");
    lbAuthor.innerHTML=wk.author?`队长 · <b>${wk.author}</b>`:`AI 黑客松 · 参赛作品`;
    if(wk.wechat){
      lbWechat.style.display="flex";
      lbWechat.innerHTML=`<span class="wx-ico">✦</span><span class="wx-label">选手微信</span>`+
        `<span class="wx-id">${wk.wechat}</span><button class="wx-copy" data-wx="${wk.wechat}">复制</button>`;
    } else { lbWechat.style.display="none"; lbWechat.innerHTML=""; }
    lbIndex.textContent=String(lbI+1).padStart(2,"0")+" / "+String(N).padStart(2,"0");
    if(wk.highlight){ lbHighlight.style.display="block"; lbHighlight.textContent=wk.highlight; }
    else { lbHighlight.style.display="none"; lbHighlight.textContent=""; }
    loadEngage(wk.slug);
    if(wk.qr){
      lbQr.style.display="block";
      lbQr.innerHTML=`<div class="lb-qr-card">
        <div class="lb-qr-lead">✦ 作者社群 · 扫码加入 ✦</div>
        <img src="${wk.qr}?v=${VER}" alt="${wk.qrTitle||'群二维码'}">
      </div>`;
    } else { lbQr.style.display="none"; lbQr.innerHTML=""; }
  }
  function lbNext(){lbI=(lbI+1)%N;renderLB();}
  function lbPrev(){lbI=(lbI-1+N)%N;renderLB();}
  $("#lbClose").addEventListener("click",closeLB);
  $("#lbBackdrop").addEventListener("click",closeLB);
  $("#lbNext").addEventListener("click",lbNext);
  $("#lbPrev").addEventListener("click",lbPrev);
  lbWechat.addEventListener("click",e=>{
    const btn=e.target.closest(".wx-copy"); if(!btn) return;
    const id=btn.dataset.wx;
    const done=()=>{ const o=btn.textContent; btn.textContent="已复制 ✓"; setTimeout(()=>btn.textContent=o,1500); };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(id).then(done).catch(()=>fallbackCopy(id,done)); }
    else fallbackCopy(id,done);
  });
  function fallbackCopy(t,cb){ const ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";
    document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(_){ } document.body.removeChild(ta); cb&&cb(); }
  addEventListener("keydown",e=>{
    if(!lb.classList.contains("open"))return;
    if(e.key==="Escape")closeLB();
    if(e.key==="ArrowRight")lbNext();
    if(e.key==="ArrowLeft")lbPrev();
  });

  /* ---------- 点赞 / 评论 ---------- */
  const API = "/api";                 // 同源后端（部署在云服务器 nginx /api 反代）
  const likeBtn=$("#likeBtn"), likeCount=$("#likeCount"), engName=$("#engName"),
        cmtText=$("#cmtText"), cmtSend=$("#cmtSend"), cmtList=$("#cmtList"), cmtTip=$("#cmtTip");
  let engSlug=null, engLiked=false;
  const NK="fx_name";
  engName.value = localStorage.getItem(NK) || "";
  engName.addEventListener("input",()=>{ localStorage.setItem(NK, engName.value.trim()); });
  const getName=()=>engName.value.trim();
  function needName(){ engName.classList.add("need"); engName.focus(); setTip("请先填写昵称~",true); setTimeout(()=>engName.classList.remove("need"),500); }
  function setTip(t,err){ cmtTip.textContent=t||""; cmtTip.classList.toggle("err",!!err); }
  const esc=s=>{const d=document.createElement("div");d.textContent=s;return d.innerHTML;};
  function timeStr(ts){ const d=new Date(ts*1000), p=n=>String(n).padStart(2,"0");
    return `${d.getMonth()+1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }

  function renderEngage(data){
    likeCount.textContent = data.likes||0;
    bumpSummary(data.slug||engSlug, data.likes||0, (data.comments||[]).length);
    engLiked = !!data.liked;
    likeBtn.classList.toggle("liked", engLiked);
    likeBtn.querySelector(".heart").textContent = engLiked ? "♥" : "♡";
    const cs = data.comments||[];
    cmtList.innerHTML = cs.length ? cs.map(c=>`<div class="cmt-item">
        <div class="cmt-head"><span class="cmt-name">${esc(c.name)}</span><span class="cmt-time">${timeStr(c.ts)}</span></div>
        <div class="cmt-text">${esc(c.text)}</div></div>`).join("")
      : `<div class="cmt-empty">还没有评论，来做第一个点亮这颗星的人 ✦</div>`;
  }
  async function loadEngage(slug){
    engSlug=slug;
    likeCount.textContent="·"; cmtList.innerHTML=`<div class="cmt-empty">加载中…</div>`; setTip("");
    likeBtn.classList.remove("liked"); likeBtn.querySelector(".heart").textContent="♡";
    try{
      const u=new URL(API+"/stats", location.href); u.searchParams.set("slug",slug);
      const nm=getName(); if(nm) u.searchParams.set("name",nm);
      const r=await fetch(u, {cache:"no-store"}); if(!r.ok) throw 0;
      const d=await r.json(); if(engSlug!==slug) return; renderEngage(d);
    }catch(_){ if(engSlug===slug){ likeCount.textContent="0";
      cmtList.innerHTML=`<div class="cmt-empty">评论功能请在正式展示站点（云服务器/域名）体验</div>`; } }
  }
  async function post(path, body){
    const r=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok) throw new Error((await r.json().catch(()=>({}))).error||"请求失败"); return r.json();
  }
  likeBtn.addEventListener("click",async()=>{
    if(!getName()) return needName();
    try{ const d=await post("/like",{slug:engSlug,name:getName()});
      engLiked=d.liked; likeCount.textContent=d.likes;
      likeBtn.classList.toggle("liked",d.liked);
      likeBtn.querySelector(".heart").textContent=d.liked?"♥":"♡";
      likeBtn.classList.remove("pop"); void likeBtn.offsetWidth; likeBtn.classList.add("pop");
      setTip(d.liked?"感谢点赞 ✦":"已取消点赞");
    }catch(e){ setTip("操作失败："+e.message,true); }
  });
  async function sendComment(){
    if(!getName()) return needName();
    const t=cmtText.value.trim(); if(!t) return setTip("评论内容不能为空",true);
    cmtSend.disabled=true; setTip("发送中…");
    try{ await post("/comment",{slug:engSlug,name:getName(),text:t});
      cmtText.value=""; setTip("评论成功 ✦"); await loadEngage(engSlug);
    }catch(e){ setTip("发送失败："+e.message,true); } finally{ cmtSend.disabled=false; }
  }
  cmtSend.addEventListener("click",sendComment);
  cmtText.addEventListener("keydown",e=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") sendComment(); });

  /* ---------- 数据沉淀：全站汇总（卡片角标 + 全场总计，自动刷新） ---------- */
  let SUMMARY={};
  const liveTotals=$("#liveTotals");
  function bumpSummary(slug, likes, comments){
    if(!slug) return;
    const s=SUMMARY[slug]||(SUMMARY[slug]={likes:0,comments:0});
    if(likes!=null) s.likes=likes;
    if(comments!=null) s.comments=comments;
    applySummary();
  }
  function applySummary(){
    let tl=0, tc=0;
    $$(".sc-stats").forEach(el=>{
      const s=SUMMARY[el.dataset.slug];
      if(s){ el.querySelector(".sc-like b").textContent=s.likes||0;
             el.querySelector(".sc-cmt b").textContent=s.comments||0;
             el.style.display="flex"; }
    });
    for(const k in SUMMARY){ tl+=SUMMARY[k].likes||0; tc+=SUMMARY[k].comments||0; }
    if(liveTotals){
      liveTotals.innerHTML = (tl||tc)
        ? `✦ 全场已点亮 <b>${tl}</b> 次心动 · 收到 <b>${tc}</b> 条留言 ✦`
        : `✦ 还没有人点亮，快来成为第一个 ✦`;
      liveTotals.style.display="block";
    }
  }
  async function loadSummary(){
    try{
      const r=await fetch(API+"/summary",{cache:"no-store"}); if(!r.ok) throw 0;
      const d=await r.json(); SUMMARY=d.by_slug||{}; applySummary();
    }catch(_){ /* Pages 无后端时静默 */ }
  }
  // 首次加载 + 定时刷新 + 回到前台刷新（这样别人点赞/评论后，大家都能看到变化）
  loadSummary();
  setInterval(loadSummary, 45000);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) loadSummary(); });
})();

(function(){
  var PHOTOS = 18, VIDEOS = 2;
  var PHOTO_NOTES_KEY = 'yeokie:photo-notes:v1';

  /* ── photo notes (per-card) — shared via the DB when configured, else localStorage ── */
  function loadNotes(){ try{ return JSON.parse(localStorage.getItem(PHOTO_NOTES_KEY)||'{}'); }catch(e){ return {}; } }
  function saveNotes(d){ try{ localStorage.setItem(PHOTO_NOTES_KEY,JSON.stringify(d)); }catch(e){} }
  function byId(id){ return document.getElementById(id); }
  var photoNotes = loadNotes();
  var notesDB = null;          // set once the shared DB is ready

  /* paint one card's note area from a note object (or null = empty) */
  function applyNote(idx, saved){
    var te=byId('pnote-text-'+idx), de=byId('pnote-date-'+idx),
        inp=byId('pnote-inp-'+idx), cl=byId('pnote-clear-'+idx);
    if(!te) return;
    if(saved && saved.text){
      te.textContent=saved.text; te.classList.remove('empty');
      de.textContent=saved.date||''; de.classList.toggle('visible', !!saved.date);
      if(document.activeElement!==inp) inp.value=saved.text;   // don't clobber active typing
      cl.hidden=false;
    } else {
      te.textContent='Нет заметки'; te.classList.add('empty');
      de.textContent=''; de.classList.remove('visible');
      if(document.activeElement!==inp) inp.value='';
      cl.hidden=true;
    }
  }

  /* ── build horizontal strip ── */
  var stripEl = document.getElementById('photoStrip');

  for(var i=1; i<=PHOTOS; i++){
    (function(idx){
      var n = String(idx).padStart(2,'0');
      var card = document.createElement('div');
      card.className = 'photo-card';
      card.innerHTML =
        '<div class="photo-card__img-wrap" data-index="'+(idx-1)+'">' +
          '<span class="photo-card__num">'+n+'</span>' +
          '<img src="assets/photos/photo-'+n+'.jpg" alt="Yeokie — кадр '+n+'" loading="lazy">' +
        '</div>' +
        '<div class="photo-card__body">' +
          '<div class="photo-card__comment empty" id="pnote-text-'+idx+'">Нет заметки</div>' +
          '<div class="photo-card__comment-date" id="pnote-date-'+idx+'"></div>' +
          '<div class="photo-card__input-row">' +
            '<textarea class="photo-card__input" id="pnote-inp-'+idx+'" placeholder="Напиши заметку…" rows="2"></textarea>' +
            '<button class="photo-card__save" id="pnote-save-'+idx+'" title="Сохранить">✓</button>' +
          '</div>' +
          '<button class="photo-card__clear" id="pnote-clear-'+idx+'" hidden>Удалить заметку</button>' +
        '</div>';
      stripEl.appendChild(card);

      applyNote(idx, photoNotes[String(idx)] || null);

      byId('pnote-save-'+idx).addEventListener('click', function(){
        var val = byId('pnote-inp-'+idx).value.trim();
        if(!val){ return; }
        var date = new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
        var note = {text:val, date:date, ts:Date.now()};
        photoNotes[String(idx)] = note;
        if(notesDB){ notesDB.save(idx, note).catch(function(e){ console.warn(e); }); }
        else { saveNotes(photoNotes); }
        applyNote(idx, note);
      });

      byId('pnote-clear-'+idx).addEventListener('click', function(){
        delete photoNotes[String(idx)];
        if(notesDB){ notesDB.remove(idx).catch(function(e){ console.warn(e); }); }
        else { saveNotes(photoNotes); }
        applyNote(idx, null);
      });
    })(i);
  }

  /* live sync: when the shared DB is ready, the server becomes the source of truth */
  if(window.YeokieDBReady) window.YeokieDBReady.then(function(api){
    if(!api) return;
    notesDB = api.photoNotes;
    notesDB.subscribe(function(map){
      photoNotes = map || {};
      for(var k=1;k<=PHOTOS;k++){ applyNote(k, photoNotes[String(k)] || null); }
    });
  });

  /* ── scroll reveal for cards ── */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('in'); });
  },{threshold:.08});
  document.querySelectorAll('.photo-card').forEach(function(c){ io.observe(c); });

  /* ── strip arrow nav ── */
  var stripPrev = document.getElementById('stripPrev');
  var stripNext = document.getElementById('stripNext');
  stripNext.addEventListener('click', function(){ stripEl.scrollBy({left:300,behavior:'smooth'}); });
  stripPrev.addEventListener('click', function(){ stripEl.scrollBy({left:-300,behavior:'smooth'}); });
  // Grey out the arrow that has nowhere left to scroll. The strip's resting
  // start isn't 0 — scroll-snap parks it at the first card (= the left padding),
  // so compare against that offset rather than a hard zero.
  function updateStripArrows(){
    var first = stripEl.firstElementChild;
    var startAt = first ? first.offsetLeft : 0;
    var maxScroll = stripEl.scrollWidth - stripEl.clientWidth;
    stripPrev.classList.toggle('is-disabled', stripEl.scrollLeft <= startAt + 4);
    stripNext.classList.toggle('is-disabled', stripEl.scrollLeft >= maxScroll - 4);
  }
  stripEl.addEventListener('scroll', updateStripArrows, {passive:true});
  window.addEventListener('resize', updateStripArrows);
  updateStripArrows();

  /* ── drag scroll ── */
  var dragging=false, dragStartX, dragScrollLeft;
  stripEl.addEventListener('mousedown',function(e){ dragging=true; dragStartX=e.pageX-stripEl.offsetLeft; dragScrollLeft=stripEl.scrollLeft; });
  window.addEventListener('mouseup',function(){ dragging=false; });
  stripEl.addEventListener('mouseleave',function(){ dragging=false; });
  stripEl.addEventListener('mousemove',function(e){ if(!dragging) return; e.preventDefault(); stripEl.scrollLeft=dragScrollLeft-(e.pageX-stripEl.offsetLeft-dragStartX); });

  // ---- build video feed ----
  var feed = document.getElementById('feed');
  var speaker = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
  var muted = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
  var playGlyph = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
  for (var v=1;v<=VIDEOS;v++){
    var m = String(v).padStart(2,'0');
    var card = document.createElement('div');
    card.className='reel paused';
    card.innerHTML =
      '<span class="tag"><span class="live"></span>Reel '+m+'</span>'+
      '<button class="sound" aria-label="Звук">'+muted+'</button>'+
      '<video src="assets/videos/video-'+m+'.mp4" loop muted playsinline preload="auto"></video>'+
      '<div class="reel__play" aria-hidden="true">'+playGlyph+'</div>';
    feed.appendChild(card);
  }

  // ---- play / pause: click a reel to toggle, keep the overlay in sync ----
  feed.querySelectorAll('.reel').forEach(function(card){
    var vid = card.querySelector('video');
    // The overlay only mirrors reality, so it can never drift out of sync.
    vid.addEventListener('play',  function(){ card.classList.remove('paused'); });
    vid.addEventListener('pause', function(){ card.classList.add('paused'); });
    card.addEventListener('click', function(e){
      if(e.target.closest('.sound')) return;   // sound button has its own handler
      if(vid.paused){ card.dataset.userPaused='0'; vid.play().catch(function(){}); }
      else         { card.dataset.userPaused='1'; vid.pause(); }
    });
  });

  // ---- scroll reveal ----
  var io2 = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); } });
  },{threshold:.12});
  document.querySelectorAll('.reel').forEach(function(el){ io2.observe(el); });

  // ---- video autoplay + sound toggle ----
  var vids = feed.querySelectorAll('video');
  var vio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var vid = e.target;
      var vh = window.innerHeight || document.documentElement.clientHeight || 1;
      // Play when the clip is at least half-visible OR fills at least half the screen.
      // The viewport-coverage check handles tall portrait reels that can never reach
      // a high self-ratio on short windows (otherwise they would never autoplay).
      var coversViewport = e.intersectionRect.height / vh;
      // Auto-play the reel in view — unless the viewer deliberately paused it.
      if(e.isIntersecting && (e.intersectionRatio >= .5 || coversViewport >= .5)){
        if(vid.parentElement.dataset.userPaused !== '1'){ vid.play().catch(function(){}); }
      } else { vid.pause(); }   // offscreen: free resources without clearing intent
    });
  },{threshold:[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]});
  vids.forEach(function(vid){
    vio.observe(vid);
    // Guarantee a visible frame even when autoplay is blocked (e.g. on file://
    // pages before the first user gesture): nudging currentTime forces the browser
    // to decode and paint that frame, so an unplayed reel never shows a black box.
    var paintFrame = function(){ if(vid.paused && vid.currentTime < 0.05){ try { vid.currentTime = 0.05; } catch(e){} } };
    if(vid.readyState >= 2){ paintFrame(); } else { vid.addEventListener('loadeddata', paintFrame, {once:true}); }
  });
  // Some browsers refuse muted autoplay until the first interaction (common on
  // file:// pages). Start whichever reel is in view on that first gesture.
  var kickInView = function(){
    feed.querySelectorAll('video').forEach(function(vid){
      if(vid.parentElement.dataset.userPaused === '1') return;
      var r = vid.getBoundingClientRect(), vh = window.innerHeight || 1;
      var visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if(visible / vh >= 0.5 || (r.height && visible / r.height >= 0.5)){ vid.play().catch(function(){}); }
    });
  };
  ['pointerdown','touchstart','keydown','wheel'].forEach(function(ev){
    window.addEventListener(ev, kickInView, {once:true, passive:true});
  });
  feed.querySelectorAll('.sound').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();   // don't trigger the reel's play/pause toggle
      var vid = btn.parentElement.querySelector('video');
      vid.muted = !vid.muted;
      btn.innerHTML = vid.muted ? muted : speaker;
      if(!vid.muted){ btn.parentElement.dataset.userPaused='0'; vid.play().catch(function(){}); }
    });
  });

  // ---- 3-panel gallery viewer ----
  var lb=document.getElementById('lb');
  var lbImg=document.getElementById('lbImg');
  var lbImgL=document.getElementById('lbImgL');
  var lbImgR=document.getElementById('lbImgR');
  var cur=0;

  function srcFor(i){ return 'assets/photos/photo-'+String(((i%PHOTOS)+PHOTOS)%PHOTOS+1).padStart(2,'0')+'.jpg'; }

  function openLb(i){
    cur=((i%PHOTOS)+PHOTOS)%PHOTOS;
    lbImg.src=srcFor(cur); lbImgL.src=srcFor(cur-1); lbImgR.src=srcFor(cur+1);
    lb.classList.add('open'); lb.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }

  window.lbNav = function(dir){ openLb(cur+dir); };

  document.getElementById('lbNext').addEventListener('click',function(){ openLb(cur+1); });
  document.getElementById('lbPrev').addEventListener('click',function(){ openLb(cur-1); });
  lbImg.addEventListener('click',function(){ openLb(cur+1); });

  document.addEventListener('keydown',function(e){
    if(!lb.classList.contains('open')) return;
    if(e.key==='ArrowRight') openLb(cur+1);
    else if(e.key==='ArrowLeft') openLb(cur-1);
  });

  var heroCta = document.querySelector('a[href="#gallery"].btn.primary');
  if(heroCta) heroCta.addEventListener('click',function(e){ e.preventDefault(); openLb(0); });

  stripEl.addEventListener('click',function(e){
    var wrap=e.target.closest('.photo-card__img-wrap');
    if(wrap) openLb(+wrap.dataset.index);
  });

  /* ========== TAB SWITCHING ========== */
  var tabs = document.querySelectorAll('.htab');
  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      var target = btn.dataset.tab;
      tabs.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
      var panel = document.getElementById('tab-'+target);
      if(panel) panel.classList.add('active');
      window.scrollTo(0,0);
    });
  });

  /* ========== HOTBAR SNOW ========== */
  /* Tiny flakes that fall only inside the nav bar (the bar clips its overflow). */
  var snow = document.getElementById('hotbarSnow');
  if(snow && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    var FLAKES = 18;
    for(var s=0; s<FLAKES; s++){
      var f = document.createElement('span');
      f.className = 'snowflake';
      var size = (2 + Math.random()*3.4).toFixed(1);
      f.style.left = (Math.random()*100).toFixed(2) + '%';
      f.style.width = f.style.height = size + 'px';
      f.style.opacity = (0.35 + Math.random()*0.5).toFixed(2);
      f.style.setProperty('--drift', ((Math.random()*2-1)*22).toFixed(1) + 'px');
      f.style.animationDuration = (3 + Math.random()*3.5).toFixed(2) + 's';
      f.style.animationDelay = (-Math.random()*6).toFixed(2) + 's';   // start mid-fall
      snow.appendChild(f);
    }
  }
})();

(function(){
  /* ===== helpers ===== */
  function load(key, fb){
    try{ var raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : fb; }
    catch(e){ return fb; }
  }
  function persist(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ return false; }
  }
  function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
  function el(tag, cls, text){
    var n=document.createElement(tag);
    if(cls) n.className=cls;
    if(text!=null) n.textContent=text;
    return n;
  }
  function plural(n,a,b,c){
    n=Math.abs(n)%100; var d=n%10;
    if(n>10&&n<20) return c;
    if(d>1&&d<5) return b;
    if(d===1) return a;
    return c;
  }
  var toastEl=null, toastT=null;
  function toast(msg){
    if(!toastEl){ toastEl=el('div','toast'); document.body.appendChild(toastEl); }
    toastEl.textContent=msg;
    requestAnimationFrame(function(){ toastEl.classList.add('show'); });
    clearTimeout(toastT);
    toastT=setTimeout(function(){ toastEl.classList.remove('show'); },3200);
  }

  /* ===== появление новых блоков при скролле ===== */
  var revealIO=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('in'); revealIO.unobserve(e.target); }
    });
  },{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(n){ revealIO.observe(n); });

  /* ===== СБОРНИК ===== */
  var COL_KEY='yeokie:collection:v1';
  var colItems=load(COL_KEY,[]);
  var colDB=null;               // set once the shared DB is ready
  var colGrid=document.getElementById('colGrid'),
      colMeta=document.getElementById('colMeta'),
      colEmpty=document.getElementById('colEmpty'),
      dz=document.getElementById('dropzone'),
      fileInput=document.getElementById('fileInput'),
      colFilter='all',
      typeNames={photo:'Фото',video:'Видео',gif:'Гифка'};

  function saveCol(){ return persist(COL_KEY,colItems); }

  function colCard(it){
    var card=el('figure','col-item'), media;
    card.dataset.type=it.type;
    if(it.type==='video'){
      media=document.createElement('video');
      media.src=it.src; media.muted=true; media.loop=true; media.playsInline=true; media.preload='metadata';
      card.addEventListener('pointerenter',function(){ media.play().catch(function(){}); });
      card.addEventListener('pointerleave',function(){ media.pause(); });
    }else{
      media=document.createElement('img');
      media.src=it.src; media.alt=it.name||'Из сборника'; media.loading='lazy';
    }
    var del=el('button','del','✕');
    del.type='button'; del.setAttribute('aria-label','Удалить из сборника');
    del.addEventListener('click',function(){
      if(window.YeokieAccess && !window.YeokieAccess.isEditor()){ toast('Удалять может только владелец'); return; }
      if(colDB){ colDB.remove(it.id).catch(function(e){ console.warn(e); }); toast('Удалено из сборника'); }
      else { colItems=colItems.filter(function(x){ return x.id!==it.id; }); saveCol(); renderCol(); toast('Удалено из сборника'); }
    });
    card.appendChild(media);
    card.appendChild(el('span','badge',typeNames[it.type]||'Файл'));
    card.appendChild(del);
    return card;
  }

  function renderCol(){
    colGrid.innerHTML='';
    var visible=0;
    colItems.forEach(function(it){
      if(colFilter!=='all' && it.type!==colFilter) return;
      var c=colCard(it);
      colGrid.appendChild(c);
      revealIO.observe(c);
      visible++;
    });
    colMeta.textContent=colItems.length
      ? colItems.length+' '+plural(colItems.length,'элемент','элемента','элементов')+(colDB?' · общий для всех':' · хранится в вашем браузере')
      : 'добавляйте фото · видео · гифки · мемы';
    colEmpty.textContent=colItems.length ? 'В этой категории пока ничего нет' : 'Пока пусто — добавьте первый кадр ↑';
    colEmpty.classList.toggle('show',visible===0);
  }

  function fileKind(f){
    if(f.type==='image/gif') return 'gif';
    if(f.type.indexOf('video/')===0) return 'video';
    if(f.type.indexOf('image/')===0) return 'photo';
    return null;
  }

  /* большие фото пережимаем, чтобы уложиться в лимит localStorage (~5 МБ) */
  function shrinkImage(dataURL, cb){
    if(dataURL.length<700000){ cb(dataURL); return; }
    var img=new Image();
    img.onload=function(){
      var MAX=1600, k=Math.min(MAX/img.naturalWidth, MAX/img.naturalHeight, 1);
      var c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(img.naturalWidth*k));
      c.height=Math.max(1,Math.round(img.naturalHeight*k));
      var ctx=c.getContext('2d');
      ctx.fillStyle='#15231C'; ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
      cb(c.toDataURL('image/jpeg',.82));
    };
    img.onerror=function(){ cb(dataURL); };
    img.src=dataURL;
  }

  function addFiles(list){
    if(window.YeokieAccess && !window.YeokieAccess.isEditor()){ toast('Добавлять может только владелец — введите код доступа'); return; }
    Array.prototype.forEach.call(list||[],function(f){
      var kind=fileKind(f);
      if(!kind){ toast('«'+f.name+'» — формат не поддерживается'); return; }
      if(colDB && kind==='video'){
        toast('Видео пока нельзя выложить в общий доступ — нужно файловое хранилище. Фото и гифки работают.');
        return;
      }
      var reader=new FileReader();
      reader.onload=function(){
        var commit=function(src){
          if(colDB){
            if(src.length>900000){
              toast('«'+f.name+'» великоват для общего доступа (лимит ~0.9 МБ на файл).');
              return;
            }
            colDB.add({type:kind,src:src,name:f.name,ts:Date.now()})
              .catch(function(err){ toast('Не удалось загрузить «'+f.name+'»'); console.warn(err); });
          } else {
            colItems.unshift({id:uid(),type:kind,src:src,name:f.name,ts:Date.now()});
            if(saveCol()){ renderCol(); }
            else{
              colItems.shift();
              toast('«'+f.name+'» не поместился: localStorage вмещает ~5 МБ на весь сайт');
            }
          }
        };
        if(kind==='photo') shrinkImage(String(reader.result),commit);
        else commit(String(reader.result));
      };
      reader.readAsDataURL(f);
    });
  }

  dz.addEventListener('click',function(e){ if(e.target!==fileInput) fileInput.click(); });
  dz.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change',function(){ addFiles(fileInput.files); fileInput.value=''; });

  ['dragenter','dragover'].forEach(function(ev){
    dz.addEventListener(ev,function(e){ e.preventDefault(); dz.classList.add('drag'); });
  });
  dz.addEventListener('dragleave',function(e){
    if(!dz.contains(e.relatedTarget)) dz.classList.remove('drag');
  });
  dz.addEventListener('drop',function(e){
    e.preventDefault(); dz.classList.remove('drag');
    addFiles(e.dataTransfer.files);
  });

  document.getElementById('colFilters').addEventListener('click',function(e){
    var b=e.target.closest('.chip'); if(!b) return;
    this.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('active'); });
    b.classList.add('active');
    colFilter=b.dataset.filter;
    renderCol();
  });

  renderCol();

  /* live sync: when the shared DB is ready, the server becomes the source of truth */
  if(window.YeokieDBReady) window.YeokieDBReady.then(function(api){
    if(!api) return;
    colDB=api.collection;
    colItems=[];
    colDB.subscribe(function(arr){ colItems=arr; renderCol(); });
  });

  /* ===== КОММЕНТАРИИ ===== */
  var EMOJIS=['💚','✨','😂','🔥','🥹','🌿'];
  var AVA_COLORS=['#0A5C36','#0F5132','#14452F','#0E6E41','#33A86C'];
  var NAME_KEY='yeokie:guest-name';

  function avaColor(name){
    var h=0;
    for(var i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0;
    return AVA_COLORS[h%AVA_COLORS.length];
  }
  function fmtDate(ts){
    try{
      return new Date(ts).toLocaleString('ru-RU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    }catch(e){ return ''; }
  }

  function initComments(root){
    var section=root.dataset.ckey;
    var key='yeokie:comments:'+section;
    var list=load(key,[]);
    var commentsDB=null;          // set once the shared DB is ready

    var head=el('h3',null,root.dataset.title||'Комментарии');
    var count=el('span','count','');
    head.appendChild(count);

    var form=el('form','c-form'), row=el('div','c-row');
    var name=document.createElement('input');
    name.type='text'; name.placeholder='Ваше имя'; name.maxLength=40;
    name.value=load(NAME_KEY,'');

    var selEmoji='', emo=el('div','c-emoji');
    EMOJIS.forEach(function(em){
      var b=el('button',null,em);
      b.type='button'; b.setAttribute('aria-label','Тег '+em);
      b.addEventListener('click',function(){
        var was=b.classList.contains('sel');
        emo.querySelectorAll('button').forEach(function(x){ x.classList.remove('sel'); });
        selEmoji=was ? '' : em;
        if(!was) b.classList.add('sel');
      });
      emo.appendChild(b);
    });
    row.appendChild(name); row.appendChild(emo);

    var text=document.createElement('textarea');
    text.placeholder='Напишите что-нибудь тёплое…'; text.rows=2; text.maxLength=600;

    var actions=el('div','c-actions');
    var submit=el('button','btn primary small','Отправить');
    submit.type='submit';
    actions.appendChild(submit);

    form.appendChild(row); form.appendChild(text); form.appendChild(actions);

    var listBox=el('div','c-list');
    var empty=el('div','c-empty','Пока тихо — оставьте первый комментарий');

    root.appendChild(head); root.appendChild(form); root.appendChild(listBox); root.appendChild(empty);

    function render(){
      listBox.innerHTML='';
      list.forEach(function(c){
        var item=el('article','c-item');
        var ava=el('div','c-ava',(c.name||'Г').charAt(0).toUpperCase());
        ava.style.background=avaColor(c.name||'Гость');
        var body=el('div','c-body'), h=el('div','c-head');
        h.appendChild(el('span','c-name',c.name));
        if(c.emoji) h.appendChild(el('span','c-tag',c.emoji));
        h.appendChild(el('span','c-date',fmtDate(c.ts)));
        body.appendChild(h);
        body.appendChild(el('p','c-text',c.text));
        var del=el('button','c-del','✕');
        del.type='button'; del.setAttribute('aria-label','Удалить комментарий');
        del.addEventListener('click',function(){
          if(commentsDB){ commentsDB.remove(c.id).catch(function(e){ console.warn(e); }); }
          else { list=list.filter(function(x){ return x.id!==c.id; }); persist(key,list); render(); }
        });
        item.appendChild(ava); item.appendChild(body); item.appendChild(del);
        listBox.appendChild(item);
      });
      count.textContent=list.length
        ? list.length+' '+plural(list.length,'отклик','отклика','откликов')
        : 'пока пусто';
      empty.style.display=list.length ? 'none' : '';
    }

    form.addEventListener('submit',function(e){
      e.preventDefault();
      var t=text.value.trim();
      if(!t){ text.focus(); return; }
      var n=name.value.trim()||'Гость';
      if(name.value.trim()) persist(NAME_KEY,name.value.trim());
      if(commentsDB){
        commentsDB.add({section:section,name:n,emoji:selEmoji,text:t,ts:Date.now()})
          .catch(function(err){ toast('Не удалось отправить комментарий'); console.warn(err); });
      } else {
        list.unshift({id:uid(),name:n,emoji:selEmoji,text:t,ts:Date.now()});
        if(!persist(key,list)){
          list.shift(); toast('Не удалось сохранить — хранилище переполнено');
          return;
        }
        render();
      }
      text.value=''; selEmoji='';
      emo.querySelectorAll('button').forEach(function(x){ x.classList.remove('sel'); });
    });

    render();

    /* live sync: server becomes the source of truth for this section */
    if(window.YeokieDBReady) window.YeokieDBReady.then(function(api){
      if(!api) return;
      commentsDB=api.comments;
      commentsDB.subscribe(section, function(arr){ list=arr; render(); });
    });
  }
  document.querySelectorAll('.comments').forEach(initComments);

  /* ===== МУЗЫКА ===== */
  var MUSIC_KEY='yeokie:music:v1';
  var musicItems = load(MUSIC_KEY, []);
  /* drop the old placeholder tracks that used to ship as defaults */
  var OLD_DEFAULT_IDS = ['default1','default2','default3'];
  if(musicItems.some(function(t){ return OLD_DEFAULT_IDS.indexOf(t.id)!==-1; })){
    musicItems = musicItems.filter(function(t){ return OLD_DEFAULT_IDS.indexOf(t.id)===-1; });
    persist(MUSIC_KEY, musicItems);
  }

  /* real, playable tracks bundled with the site (audio + cover in assets/music) */
  var LIBRARY = [
    { id:'lib-stalevarov', title:'Улица Сталеваров', artist:'Валентин Стрыкало',
      audio:'assets/music/track-01.mp3', cover:'assets/music/cover-01.jpg' }
  ];

  var ICON_PLAY  = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>';

  var musicGrid = document.getElementById('musicGrid');
  var musicForm = document.getElementById('musicForm');
  var musicAddBtn = document.getElementById('musicAddBtn');
  var musicFormCancel = document.getElementById('musicFormCancel');
  var musicFormSave = document.getElementById('musicFormSave');

  function renderMusic(){
    musicGrid.innerHTML='';
    LIBRARY.forEach(function(track){ musicGrid.appendChild(playableCard(track)); });
    musicItems.forEach(function(track){ musicGrid.appendChild(noteCard(track)); });
    markPlayingCards();
  }

  /* card backed by a real audio file → click to play in the Spotify-style bar */
  function playableCard(track){
    var card = document.createElement('div');
    card.className = 'music-card music-card--playable';
    card.dataset.id = track.id;
    card.innerHTML =
      '<div class="music-card__art">'+
        '<img src="'+track.cover+'" alt="" loading="lazy">'+
        '<button class="music-card__play" type="button" aria-label="Слушать">'+ICON_PLAY+'</button>'+
      '</div>'+
      '<div class="music-card__info">'+
        '<div class="music-card__title">'+esc2(track.title)+'</div>'+
        '<div class="music-card__artist">'+esc2(track.artist)+'</div>'+
        (track.vibe ? '<div class="music-card__vibe">'+esc2(track.vibe)+'</div>' : '')+
      '</div>';
    card.addEventListener('click', function(){ togglePlay(track); });
    return card;
  }

  /* user-added note card (no audio) — title/artist/vibe with delete */
  function noteCard(track){
    var card = document.createElement('div');
    card.className = 'music-card';
    card.dataset.id = track.id;
    var emoji = track.emoji || '🎵';
    card.innerHTML =
      '<div class="music-card__art">'+emoji+'</div>'+
      '<div class="music-card__info">'+
        '<div class="music-card__title">'+esc2(track.title)+'</div>'+
        '<div class="music-card__artist">'+esc2(track.artist)+'</div>'+
        (track.vibe ? '<div class="music-card__vibe">'+esc2(track.vibe)+'</div>' : '')+
      '</div>'+
      '<button style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.9rem;opacity:0;transition:opacity .2s;padding:.3rem" class="music-del" data-id="'+track.id+'" title="Удалить">✕</button>';
    card.querySelector('.music-del').addEventListener('click', function(){
      if(window.YeokieAccess && !window.YeokieAccess.isEditor()){ toast('Удалять может только владелец'); return; }
      musicItems = musicItems.filter(function(t){ return t.id !== track.id; });
      persist(MUSIC_KEY, musicItems);
      renderMusic();
    });
    card.addEventListener('mouseenter', function(){ card.querySelector('.music-del').style.opacity='1'; });
    card.addEventListener('mouseleave', function(){ card.querySelector('.music-del').style.opacity='0'; });
    return card;
  }

  function esc2(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  musicAddBtn.addEventListener('click', function(){
    musicForm.classList.add('open');
    document.getElementById('mfTitle').focus();
  });
  musicFormCancel.addEventListener('click', function(){
    musicForm.classList.remove('open');
  });
  musicFormSave.addEventListener('click', function(){
    if(window.YeokieAccess && !window.YeokieAccess.isEditor()){ toast('Добавлять музыку может только владелец'); return; }
    var title = document.getElementById('mfTitle').value.trim();
    var artist = document.getElementById('mfArtist').value.trim();
    if(!title){ document.getElementById('mfTitle').focus(); return; }
    musicItems.push({
      id: uid(),
      title: title,
      artist: artist || '—',
      vibe: document.getElementById('mfVibe').value.trim(),
      emoji: document.getElementById('mfEmoji').value.trim() || '🎵'
    });
    persist(MUSIC_KEY, musicItems);
    renderMusic();
    musicForm.classList.remove('open');
    document.getElementById('mfTitle').value='';
    document.getElementById('mfArtist').value='';
    document.getElementById('mfVibe').value='';
    document.getElementById('mfEmoji').value='';
  });

  /* ===== ПЛЕЕР (в стиле Spotify) ===== */
  var audioEl  = document.getElementById('plAudio');
  var player   = document.getElementById('player');
  var plArt    = document.getElementById('plArt');
  var plTitle  = document.getElementById('plTitle');
  var plArtist = document.getElementById('plArtist');
  var plPlay   = document.getElementById('plPlay');
  var plBar    = document.getElementById('plBar');
  var plFill   = document.getElementById('plFill');
  var plCur    = document.getElementById('plCur');
  var plDur    = document.getElementById('plDur');
  var plClose  = document.getElementById('plClose');
  var curId = null, scrubbing = false;
  plPlay.innerHTML = ICON_PLAY;

  function fmt(s){ s=Math.max(0,Math.floor(s||0)); var m=Math.floor(s/60), x=s%60; return m+':'+(x<10?'0':'')+x; }

  function markPlayingCards(){
    var playing = audioEl && !audioEl.paused;
    musicGrid.querySelectorAll('.music-card--playable').forEach(function(c){
      var on = (c.dataset.id===curId && playing);
      c.classList.toggle('is-playing', on);
      var pb = c.querySelector('.music-card__play');
      if(pb) pb.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    });
  }
  function setPlayUI(playing){
    plPlay.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    plPlay.setAttribute('aria-label', playing ? 'Пауза' : 'Играть');
    markPlayingCards();
  }

  function togglePlay(track){
    if(curId===track.id){
      if(audioEl.paused) audioEl.play().catch(function(){}); else audioEl.pause();
      return;
    }
    curId = track.id;
    audioEl.src = track.audio;
    plArt.src = track.cover || '';
    plTitle.textContent = track.title;
    plArtist.textContent = track.artist;
    plCur.textContent='0:00'; plDur.textContent='0:00'; plFill.style.width='0%';
    player.classList.add('open'); player.setAttribute('aria-hidden','false');
    document.body.classList.add('has-player');
    audioEl.play().catch(function(){});
  }

  plPlay.addEventListener('click', function(e){ e.stopPropagation(); if(audioEl.paused) audioEl.play().catch(function(){}); else audioEl.pause(); });
  plClose.addEventListener('click', function(){
    audioEl.pause();
    player.classList.remove('open'); player.setAttribute('aria-hidden','true');
    document.body.classList.remove('has-player');
  });

  audioEl.addEventListener('play',  function(){ setPlayUI(true); });
  audioEl.addEventListener('pause', function(){ setPlayUI(false); });
  audioEl.addEventListener('ended', function(){ setPlayUI(false); });
  audioEl.addEventListener('loadedmetadata', function(){ plDur.textContent=fmt(audioEl.duration); plBar.setAttribute('aria-valuemax', Math.floor(audioEl.duration||0)); });
  audioEl.addEventListener('timeupdate', function(){ if(!scrubbing) paintSeek(audioEl.currentTime); });

  function paintSeek(t){
    var d = audioEl.duration || 0, pct = d ? Math.min(100, t/d*100) : 0;
    plFill.style.width = pct+'%';
    plCur.textContent = fmt(t);
    plBar.setAttribute('aria-valuenow', Math.floor(t));
  }
  function pctFromEvent(e){
    var r = plBar.getBoundingClientRect();
    var cx = (e.clientX!=null) ? e.clientX : (e.touches&&e.touches[0] ? e.touches[0].clientX : 0);
    return Math.max(0, Math.min(1, (cx - r.left) / r.width));
  }
  plBar.addEventListener('pointerdown', function(e){
    if(!audioEl.src) return;
    scrubbing = true; player.classList.add('scrubbing');
    try{ plBar.setPointerCapture(e.pointerId); }catch(_){}
    paintSeek(pctFromEvent(e)*(audioEl.duration||0));
  });
  plBar.addEventListener('pointermove', function(e){ if(scrubbing) paintSeek(pctFromEvent(e)*(audioEl.duration||0)); });
  function endScrub(e){
    if(!scrubbing) return;
    audioEl.currentTime = pctFromEvent(e)*(audioEl.duration||0);
    scrubbing = false; player.classList.remove('scrubbing');
  }
  plBar.addEventListener('pointerup', endScrub);
  plBar.addEventListener('pointercancel', function(){ scrubbing=false; player.classList.remove('scrubbing'); });
  plBar.addEventListener('keydown', function(e){
    var d = audioEl.duration || 0; if(!d && e.key!==' '&&e.key!=='Enter') return;
    if(e.key==='ArrowRight'){ e.preventDefault(); audioEl.currentTime=Math.min(d,audioEl.currentTime+5); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); audioEl.currentTime=Math.max(0,audioEl.currentTime-5); }
    else if(e.key===' '||e.key==='Enter'){ e.preventDefault(); if(audioEl.paused) audioEl.play().catch(function(){}); else audioEl.pause(); }
  });

  renderMusic();

  /* ===== СВИДАНИЕ ===== */
  var btnYes=document.getElementById('btnYes'),
      btnNo=document.getElementById('btnNo'),
      ask=document.getElementById('dateAsk'),
      answer=document.getElementById('dateAnswer'),
      dateMsgForm=document.getElementById('dateMsgForm'),
      dateMsgInput=document.getElementById('dateMsgInput'),
      dateMsgSend=document.getElementById('dateMsgSend'),
      dodges=0, lastDodge=0, surrendered=false, accepted=false;

  function moveNo(){
    var pad=20, w=btnNo.offsetWidth, h=btnNo.offsetHeight,
        yr=btnYes.getBoundingClientRect(), x, y, tries=0;
    do{
      x=pad+Math.random()*Math.max(1,window.innerWidth-w-pad*2);
      y=pad+Math.random()*Math.max(1,window.innerHeight-h-pad*2);
      tries++;
    }while(tries<20 && x<yr.right+60 && x+w>yr.left-60 && y<yr.bottom+60 && y+h>yr.top-60);
    btnNo.classList.add('flee');
    btnNo.style.left=x+'px';
    btnNo.style.top=y+'px';
  }

  function dodge(){
    if(surrendered||accepted) return;
    var now=performance.now();
    if(now-lastDodge<120) return;   /* touchstart+pointerenter не считаем дважды */
    lastDodge=now;
    dodges++;
    if(dodges>=9){
      surrendered=true;
      btnNo.classList.remove('flee','ghost','btn');
      btnNo.classList.add('choc');
      btnNo.style.position='';
      btnNo.style.left='';
      btnNo.style.top='';
      btnNo.textContent='Тоже да, но другого цвета';
      return;
    }
    if(dodges>=6) btnNo.textContent='Сдаюсь 😅';
    else if(dodges>=3) btnNo.textContent='Ну пожалуйста...';
    btnYes.style.setProperty('--grow',Math.min(1+dodges*.09,1.8).toFixed(2));
    moveNo();
  }

  /* Telegram relay — a tiny Cloudflare Worker holds the bot token (never in this
     public code). Empty URL = disabled, so nothing is sent until it's set. */
  var NOTIFY_URL = 'https://misty-truth-dc9b.nuralisky12.workers.dev/';
  function notifyTelegram(text){
    if(!NOTIFY_URL) return Promise.resolve(false);
    return fetch(NOTIFY_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: text })
    }).then(function(r){ return r.ok; }).catch(function(){ return false; });
  }

  /* song that auto-plays on «Да» — a hidden video element, so only its audio is
     heard. Plays once (no loop). */
  var dateSong = null;
  function playDateSong(){
    try{
      if(!dateSong){
        dateSong = document.createElement('video');
        dateSong.src = 'assets/music/date-song.mp4';
        dateSong.loop = false;   // играет один раз, без повтора
        dateSong.playsInline = true;
        dateSong.setAttribute('aria-hidden','true');
        dateSong.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(dateSong);
      }
      if(audioEl && !audioEl.paused){ audioEl.pause(); }   // don't overlap the music player
      dateSong.currentTime = 0;
      dateSong.play().catch(function(){});
    }catch(e){}
  }

  function accept(which){
    if(accepted) return;
    accepted=true;
    ask.classList.add('gone');
    answer.hidden=false;
    startHearts();
    playDateSong();
    /* let me know she said yes — once per device, so reloads don't re-ping */
    try{
      if(!localStorage.getItem('yeokie:date-yes')){
        notifyTelegram('💚 Она ответила ДА на свидание! ('+(which||'Да')+')\n'+new Date().toLocaleString('ru-RU'))
          .then(function(ok){ if(ok){ try{ localStorage.setItem('yeokie:date-yes','1'); }catch(e){} } });
      }
    }catch(e){}
    setTimeout(function(){ if(dateMsgInput) dateMsgInput.focus(); }, 450);
  }

  /* her message → straight to my Telegram */
  if(dateMsgForm){
    dateMsgForm.addEventListener('submit', function(e){
      e.preventDefault();
      var msg = dateMsgInput.value.trim();
      if(!msg){ dateMsgInput.focus(); return; }
      dateMsgSend.disabled = true;
      notifyTelegram('✍️ Сообщение от неё:\n\n«'+msg+'»').then(function(){
        dateMsgInput.disabled = true;
        dateMsgSend.textContent = 'Отправлено 💚';
        dateMsgSend.classList.add('is-sent');
      });
    });
  }

  btnNo.addEventListener('pointerenter',dodge);
  btnNo.addEventListener('touchstart',function(e){
    if(!surrendered){ e.preventDefault(); dodge(); }
  },{passive:false});
  btnNo.addEventListener('click',function(){ surrendered ? accept('Тоже да, но другого цвета') : dodge(); });
  btnYes.addEventListener('click',function(){ accept('Да, конечно'); });

  /* сердечки на canvas */
  var cv=document.getElementById('heartsCanvas'), hctx=null, parts=[], heartsOn=false;
  var HEART_COLORS=['#33A86C','#0A5C36','#0E6E41','#7FD3A4','#BFE8CF','#7B3F00','#A0522D','#6B2F00','#C4732A','#8B4513'];

  function sizeCanvas(){
    var d=window.devicePixelRatio||1;
    cv.width=Math.round(window.innerWidth*d);
    cv.height=Math.round(window.innerHeight*d);
    hctx.setTransform(d,0,0,d,0,0);
  }
  function spawnHeart(y){
    parts.push({
      bx:Math.random()*window.innerWidth,
      y:(y!=null ? y : window.innerHeight+30+Math.random()*60),
      vy:.7+Math.random()*1.5,
      amp:14+Math.random()*34,
      ph:Math.random()*Math.PI*2,
      sw:.01+Math.random()*.025,
      s:10+Math.random()*20,
      rot:(Math.random()-.5)*.6,
      vr:(Math.random()-.5)*.02,
      col:HEART_COLORS[Math.random()*HEART_COLORS.length|0],
      a:.45+Math.random()*.55
    });
  }
  function drawHeart(x,y,s,rot,col,alpha){
    var topY=-s*.2;
    hctx.save();
    hctx.translate(x,y); hctx.rotate(rot);
    hctx.globalAlpha=alpha; hctx.fillStyle=col;
    hctx.beginPath();
    hctx.moveTo(0,topY);
    hctx.bezierCurveTo(0,-s*.5,-s*.5,-s*.5,-s*.5,topY);
    hctx.bezierCurveTo(-s*.5,s*.1,0,s*.3,0,s*.5);
    hctx.bezierCurveTo(0,s*.3,s*.5,s*.1,s*.5,topY);
    hctx.bezierCurveTo(s*.5,-s*.5,0,-s*.5,0,topY);
    hctx.fill();
    hctx.restore();
  }
  function tick(){
    if(!heartsOn) return;
    hctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    if(parts.length<80 && Math.random()<.22) spawnHeart();
    for(var i=parts.length-1;i>=0;i--){
      var p=parts[i];
      p.y-=p.vy; p.ph+=p.sw; p.rot+=p.vr;
      var fade=Math.max(0,Math.min(1,p.y/(window.innerHeight*.35)));
      drawHeart(p.bx+Math.sin(p.ph)*p.amp,p.y,p.s,p.rot,p.col,p.a*fade);
      if(p.y<-40) parts.splice(i,1);
    }
    requestAnimationFrame(tick);
  }
  function startHearts(){
    if(heartsOn) return;
    hctx=cv.getContext('2d');
    sizeCanvas();
    window.addEventListener('resize',sizeCanvas);
    cv.style.display='block';
    for(var i=0;i<55;i++) spawnHeart(window.innerHeight*(.35+Math.random()*.9));
    heartsOn=true;
    requestAnimationFrame(tick);
  }
})();

/* NOBODY IS SAFE · book.js
   The booking desk: a full-screen step form opened from any [data-book]
   element. One shared file for every page; per-page paths come from
   window.NIS_BASE ({listings, books}) set before this script loads. */
(function(){
  'use strict';
  var CFG=window.NIS_BASE||{listings:'listings.json',books:''};
  var NIS_FORMS={endpoint:'',scheduler:''};
  var STEP_LABELS=['Step 1 of 4 · The file','Step 2 of 4 · You','Step 3 of 4 · The situation','Step 4 of 4 · The record'];
  var FIX_ITEMS=[
    "My map. I'm invisible where my customers search.",
    'My website. Slow, template-built, or both.',
    'My monthly report does not match this file.',
    'Walk me through my listing, row by row.'
  ];
  var NOTE_ALL='Type at least two letters. 953 listings on file across three agencies.';
  var NOTE_SCOPED='Type at least two letters.';
  var NOHIT='No match on that. Try fewer words, just the city, or the website address.';
  var NOTE_FINAL='The booking desk opens at nobodyissafe.com, the desk\'s permanent address. The files are public now.';
  var NOTE_FAIL='That did not go through. Try again, or come back; the desk is not going anywhere.';
  var NOTE_DONE='On the record. The desk reads every submission.';
  var overlay=null,opener=null,keyHandler=null;
  var DATA=null,dataPromise=null;
  var state={step:1,base:null,picked:null,notFiled:false,scope:null};

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/^ +| +$/g,'')}
  function trim(s){return String(s||'').replace(/^\s+|\s+$/g,'')}
  function debounce(fn){var t;return function(){var c=this,a=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(c,a)},120)}}
  function reduced(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}

  function loadData(){
    if(dataPromise)return dataPromise;
    dataPromise=fetch(CFG.listings).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
      DATA={agencies:d.agencies,rows:d.rows,idx:d.rows.map(function(r){
        var ag=d.agencies[r[0]]||{name:'',code:''};
        return {r:r,h:norm(r[1]+' '+r[2]+' '+r[3]+' '+r[4]+' '+ag.name+' '+ag.code)};
      })};
      return DATA;
    }).catch(function(){DATA=null;return null});
    return dataPromise;
  }
  function agMeta(slug){return (DATA&&DATA.agencies&&DATA.agencies[slug])||null}
  function rowMeta(row){
    var ag=(DATA&&DATA.agencies[row[0]])||{name:'',code:''};
    return {slug:row[0],code:ag.code,agname:ag.name,name:row[1],loc:row[2]?row[2]+', '+row[3]:row[3],key:row[4]};
  }
  function findRow(slug,key){
    if(!DATA)return null;
    for(var i=0;i<DATA.rows.length;i++){
      var r=DATA.rows[i];
      if(r[4]===key&&(!slug||r[0]===slug))return r;
    }
    return null;
  }
  function matchRows(q,slug){
    var toks=norm(q).split(' ').filter(Boolean);
    if(!toks.length||!DATA)return[];
    var out=[];
    for(var i=0;i<DATA.idx.length;i++){
      if(slug&&DATA.idx[i].r[0]!==slug)continue;
      var ok=true;
      for(var j=0;j<toks.length;j++){if(DATA.idx[i].h.indexOf(toks[j])<0){ok=false;break}}
      if(ok)out.push(DATA.idx[i].r);
    }
    return out;
  }

  var BKCSS=[
    '.bk-overlay *{box-sizing:border-box;margin:0;padding:0}',
    '.bk-lock{overflow:hidden}',
    ".bk-overlay{--paper:#f4eede;--paper2:#ece4cf;--manila:#eadcb4;--ink:#171310;--ink-soft:rgba(23,19,16,.72);--ink-faint:rgba(23,19,16,.14);--red:#c9040f;--red-deep:#a20309;--red-bright:#e8212c;--serif:Georgia,'Times New Roman',Times,serif;--head:'Arial Narrow','Franklin Gothic Medium','Helvetica Neue',Arial,sans-serif;--fat:'Arial Black','Helvetica Neue',Arial,sans-serif;--mono:Consolas,'Courier New',monospace;box-sizing:border-box;position:fixed;inset:0;z-index:90;background:var(--ink);border-top:8px solid var(--red);overflow-y:auto;color:var(--paper);-webkit-overflow-scrolling:touch;font-family:var(--serif);font-size:16px;line-height:1.5}",
    '.bk-overlay[hidden]{display:none}',
    '@media (prefers-reduced-motion:no-preference){.bk-overlay{animation:bk-fade .25s ease}}',
    '@keyframes bk-fade{from{opacity:0}to{opacity:1}}',
    '.bk-in{max-width:980px;margin:0 auto;padding:clamp(18px,3vw,40px) clamp(16px,4vw,64px) clamp(48px,6vw,88px)}',
    '.bk-bar{display:flex;justify-content:space-between;align-items:baseline;gap:.4em 1.6em;flex-wrap:wrap;font-family:var(--mono);font-size:clamp(.56rem,.8vw,.7rem);letter-spacing:.22em;text-transform:uppercase;color:rgba(244,238,222,.72);border-bottom:2px solid rgba(244,238,222,.35);padding-bottom:.9em}',
    '.bk-close{background:none;border:2px solid rgba(244,238,222,.3);color:var(--paper);font-family:var(--mono);font-size:inherit;letter-spacing:inherit;text-transform:uppercase;padding:.5em .9em;cursor:pointer}',
    '.bk-close:hover{border-color:var(--red-bright);color:#fff}',
    '.bk-title{font-family:var(--fat);font-weight:900;text-transform:uppercase;line-height:.88;letter-spacing:-.015em;font-size:clamp(1.9rem,4.6vw,3.8rem);color:var(--paper);margin:.5em 0 .4em;text-wrap:balance}',
    '.bk-overlay .docket{font-family:var(--mono);font-size:clamp(.6rem,.9vw,.74rem);letter-spacing:.18em;text-transform:uppercase;border-top:2px solid currentColor;border-bottom:2px solid currentColor;padding:.55em 0;display:flex;flex-wrap:wrap;gap:.4em 1.8em}',
    '.bk-steps{color:var(--paper);margin:1em 0 1.4em}',
    '.bk-step[hidden],.bk-overlay #bk-s4-main[hidden],.bk-overlay #bk-result[hidden]{display:none}',
    ".bk-h3{font-family:var(--head);font-weight:900;text-transform:uppercase;font-size:clamp(1.15rem,1.7vw,1.55rem);margin:1em 0 .6em;color:var(--paper)}",
    '.bk-h3:focus{outline:none}',
    '.bk-card{position:relative;background:var(--manila);background-image:radial-gradient(rgba(23,19,16,.05) 1px,transparent 1.2px);background-size:5px 5px;border:3px solid var(--ink);box-shadow:0 10px 26px rgba(0,0,0,.4);padding:clamp(16px,2.2vw,26px) clamp(16px,2.2vw,26px) clamp(16px,2.2vw,26px) calc(clamp(16px,2.2vw,26px) + 8px);color:var(--ink);margin:1.1em 0}',
    ".bk-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--red)}",
    '.bk-card .ftag{display:inline-block;background:var(--red);color:#fff;padding:.25em .55em;font-weight:700;font-family:var(--mono);font-size:clamp(.6rem,.85vw,.72rem);letter-spacing:.14em;text-transform:uppercase}',
    '.bk-card-name{font-family:var(--fat);font-weight:900;text-transform:uppercase;font-size:clamp(1.25rem,2.2vw,1.9rem);line-height:.95;margin:.5em 0 .25em;overflow-wrap:break-word}',
    '.bk-card-loc{font-family:var(--mono);font-size:clamp(.6rem,.85vw,.72rem);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft)}',
    '.bk-card-line{font-style:italic;font-size:clamp(.92rem,1.25vw,1.05rem);margin-top:.8em;max-width:62ch}',
    '.bk-linkbtn{background:none;border:0;padding:0;font-family:var(--mono);font-size:clamp(.6rem,.85vw,.72rem);letter-spacing:.14em;text-transform:uppercase;color:var(--red-bright);text-decoration:underline;cursor:pointer;margin-top:1em;display:inline-block;text-align:left}',
    '.bk-card .bk-linkbtn{color:var(--red-deep)}',
    '.bk-checks{display:flex;flex-direction:column;gap:.7em;margin-top:.4em}',
    '.bk-check{display:flex;gap:.8em;align-items:baseline;font-family:var(--mono);font-size:clamp(.64rem,.95vw,.8rem);letter-spacing:.12em;text-transform:uppercase;color:rgba(244,238,222,.85);cursor:pointer;border:2px solid rgba(244,238,222,.25);padding:.8em .9em}',
    '.bk-check:hover{border-color:rgba(244,238,222,.6)}',
    '.bk-check input{accent-color:var(--red);width:1.05em;height:1.05em;flex:none;cursor:pointer}',
    '.bk-nav{display:flex;align-items:center;gap:1.2em 1.8em;margin-top:1.5em;flex-wrap:wrap}',
    '.bk-nav .cta{margin-top:0}',
    '.bk-back{background:none;border:0;padding:0;font-family:var(--mono);font-size:clamp(.62rem,.9vw,.76rem);letter-spacing:.16em;text-transform:uppercase;color:rgba(244,238,222,.62);cursor:pointer;text-decoration:underline}',
    '.bk-back:hover{color:var(--paper)}',
    '.bk-sum{margin-top:1.1em;border-top:2px solid rgba(244,238,222,.35)}',
    '.bk-sum-row{display:flex;gap:.5em 1.6em;flex-wrap:wrap;padding:.8em 2px;border-bottom:1px solid rgba(244,238,222,.16);font-family:var(--mono);font-size:clamp(.62rem,.9vw,.78rem);letter-spacing:.14em;text-transform:uppercase}',
    '.bk-sum-row .k{color:var(--red-bright);font-weight:700;flex:none;min-width:8em}',
    '.bk-sum-row .v{color:rgba(244,238,222,.85);min-width:0;overflow-wrap:anywhere}',
    '.bk-overlay .cta{display:inline-block;background:var(--red);color:#fff;font-family:var(--fat);font-weight:900;text-transform:uppercase;letter-spacing:.05em;font-size:clamp(.9rem,1.3vw,1.1rem);padding:.75em 1.4em;text-decoration:none;box-shadow:4px 4px 0 var(--paper);margin-top:1.1em;transition:transform .15s,box-shadow .15s;border:0;cursor:pointer}',
    '.bk-overlay .cta:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--paper)}',
    '.bk-overlay .nis-form{margin-top:1.4em;display:flex;flex-direction:column;gap:1em}',
    '.bk-overlay .nis-form label{font-family:var(--mono);font-size:clamp(.58rem,.8vw,.7rem);letter-spacing:.2em;text-transform:uppercase;color:rgba(244,238,222,.72);display:block;margin-bottom:.5em}',
    '.bk-overlay .nis-form input,.bk-overlay .nis-form textarea{width:100%;background:rgba(244,238,222,.06);border:2px solid rgba(244,238,222,.3);color:var(--paper);font-family:var(--serif);font-size:clamp(.95rem,1.2vw,1.05rem);padding:.65em .8em;border-radius:0}',
    '.bk-overlay .nis-form input:focus,.bk-overlay .nis-form textarea:focus{outline:none;border-color:var(--red-bright)}',
    '.bk-overlay .nis-form textarea{min-height:7em;resize:vertical}',
    '.bk-overlay .form-note{font-family:var(--mono);font-size:clamp(.56rem,.78vw,.66rem);letter-spacing:.14em;text-transform:uppercase;color:rgba(244,238,222,.45);line-height:1.8;margin-top:.4em}',
    '.bk-overlay .finder-input{font-size:clamp(1.05rem,1.7vw,1.45rem);padding:.75em .9em}',
    '.bk-overlay .finder-rows{margin-top:1em;border-top:2px solid rgba(244,238,222,.35)}',
    '.bk-overlay .finder-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5em 1.2em;padding:.8em 2px;border-bottom:1px solid rgba(244,238,222,.16);font-family:var(--mono);font-size:clamp(.62rem,.9vw,.78rem);letter-spacing:.14em;text-transform:uppercase;color:rgba(244,238,222,.85);text-decoration:none;cursor:pointer}',
    '.bk-overlay button.finder-row{background:none;border:0;border-bottom:1px solid rgba(244,238,222,.16);width:100%;text-align:left}',
    '.bk-overlay .finder-row:hover{color:#fff;background:rgba(244,238,222,.06)}',
    '.bk-overlay .finder-row .ftag{background:var(--red);color:#fff;padding:.25em .55em;font-weight:700}',
    '.bk-overlay .finder-row .floc{color:rgba(244,238,222,.55)}',
    '.bk-overlay .finder-row .fgo{margin-left:auto;color:var(--red-bright);font-weight:700;white-space:nowrap}',
    '.bk-overlay .finder-note{font-family:var(--mono);font-size:clamp(.56rem,.78vw,.66rem);letter-spacing:.14em;text-transform:uppercase;color:rgba(244,238,222,.45);line-height:1.8;margin-top:.4em}',
    '.bk-overlay .finder-note a{color:var(--red-bright)}',
    '.bk-overlay .finder-picked{display:inline-flex;gap:.8em;align-items:baseline;border:2px solid var(--red-bright);padding:.55em .8em;font-family:var(--mono);font-size:clamp(.6rem,.85vw,.72rem);letter-spacing:.14em;text-transform:uppercase;color:var(--paper);margin-top:.6em}',
    '.bk-overlay .finder-picked[hidden]{display:none}',
    '.bk-overlay .finder-picked .fx{background:none;border:0;padding:0;font-family:inherit;font-size:inherit;letter-spacing:inherit;color:var(--red-bright);cursor:pointer;font-weight:700}',
    '.bk-overlay .finder-row:focus-visible{outline:2px solid var(--red-bright);outline-offset:2px}',
    '.bk-overlay .finder-picked .fx:focus-visible{outline:2px solid var(--red-bright);outline-offset:2px}',
    '.bk-overlay .form-note.bk-hot{color:var(--red-bright)}',
    '.bk-overlay :focus-visible{outline:2px solid var(--red-bright);outline-offset:2px}',
    '.bk-h3:focus-visible{outline:none}'
  ].join('\n');
  function ensureStyle(){
    if(document.getElementById('bk-style'))return;
    var st=document.createElement('style');
    st.id='bk-style';
    st.textContent=BKCSS;
    document.head.appendChild(st);
  }

  function build(){
    if(overlay)return;
    ensureStyle();
    var el=document.createElement('div');
    el.className='bk-overlay';
    el.id='bk-overlay';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    el.setAttribute('aria-label','Book the consultation');
    el.hidden=true;
    el.innerHTML=[
      '<div class="bk-in">',
      '<div class="bk-bar"><span>The booking desk · Intake B-01</span><button type="button" class="bk-close" id="bk-close" aria-label="Close the booking form">Close &#10005;</button></div>',
      '<h2 class="bk-title">Book the consultation.</h2>',
      '<div class="docket bk-steps"><span id="bk-step-label" aria-live="polite">'+esc(STEP_LABELS[0])+'</span></div>',
      '<div class="bk-step" id="bk-s1"><h3 class="bk-h3" tabindex="-1">Which file is this about?</h3><div id="bk-s1-ctx"></div>',
      '<div class="bk-nav"><button class="cta" type="button" id="bk-next1">Next</button></div></div>',
      '<div class="bk-step" id="bk-s2" hidden><h3 class="bk-h3" tabindex="-1">Who is booking?</h3>',
      '<div class="nis-form">',
      '<div><label for="bkp-name">Your name</label><input id="bkp-name" type="text" autocomplete="name"></div>',
      '<div><label for="bkp-business">Business name</label><input id="bkp-business" type="text" autocomplete="organization"></div>',
      '<div><label for="bkp-email">Email</label><input id="bkp-email" type="email" autocomplete="email"></div>',
      '<div><label for="bkp-phone">Phone</label><input id="bkp-phone" type="tel" autocomplete="tel"></div>',
      '<p class="finder-note" id="bkp-s2-note" hidden>The desk needs at least a name and an email.</p>',
      '</div>',
      '<div class="bk-nav"><button type="button" class="bk-back" data-back="1">Back</button><button class="cta" type="button" id="bk-next2">Next</button></div></div>',
      '<div class="bk-step" id="bk-s3" hidden><h3 class="bk-h3" tabindex="-1">What are we fixing?</h3>',
      '<div class="bk-checks" id="bk-checks"></div>',
      '<div class="nis-form"><div><label for="bkp-words">In your own words (optional)</label><textarea id="bkp-words"></textarea></div></div>',
      '<div class="bk-nav"><button type="button" class="bk-back" data-back="2">Back</button><button class="cta" type="button" id="bk-next3">Next</button></div></div>',
      '<div class="bk-step" id="bk-s4" hidden><div id="bk-s4-main"><h3 class="bk-h3" tabindex="-1">Read it back.</h3>',
      '<div class="bk-sum" id="bk-sum"></div>',
      '<div id="bk-sched"></div>',
      '<p class="form-note" id="bkp-final-note">'+esc(NOTE_FINAL)+'</p>',
      '<div class="bk-nav"><button type="button" class="bk-back" data-back="3">Back</button><button class="cta" type="button" id="bk-bookit">Book it</button></div></div>',
      '<div id="bk-result" hidden></div></div>',
      '</div>'
    ].join('');
    document.body.appendChild(el);
    overlay=el;
    var checks=el.querySelector('#bk-checks');
    var ch='';
    for(var i=0;i<FIX_ITEMS.length;i++){
      ch+='<label class="bk-check"><input type="checkbox" value="'+esc(FIX_ITEMS[i])+'"><span>'+esc(FIX_ITEMS[i])+'</span></label>';
    }
    checks.innerHTML=ch;
    el.querySelector('#bk-close').addEventListener('click',close);
    el.querySelector('#bk-next1').addEventListener('click',function(){go(2)});
    el.querySelector('#bk-next2').addEventListener('click',function(){
      var n=trim(el.querySelector('#bkp-name').value);
      var m=trim(el.querySelector('#bkp-email').value);
      var note=el.querySelector('#bkp-s2-note');
      if(!n||!m){note.hidden=false;el.querySelector(n?'#bkp-email':'#bkp-name').focus();return}
      note.hidden=true;go(3);
    });
    el.querySelector('#bk-next3').addEventListener('click',function(){go(4)});
    var backs=el.querySelectorAll('.bk-back');
    for(var b=0;b<backs.length;b++){
      backs[b].addEventListener('click',function(e){go(parseInt(e.currentTarget.getAttribute('data-back'),10))});
    }
    el.querySelector('#bk-bookit').addEventListener('click',function(){
      var note=el.querySelector('#bkp-final-note');
      if(typeof NIS_FORMS.endpoint==='string'&&NIS_FORMS.endpoint){
        var btn=this;
        if(btn.disabled)return;
        var picked=[];
        var boxes=overlay.querySelectorAll('#bk-checks input');
        for(var bi=0;bi<boxes.length;bi++){if(boxes[bi].checked)picked.push(boxes[bi].value)}
        var eff=state.picked||(state.base&&state.base.type==='listing'?state.base.meta:null);
        var agency=(eff&&eff.slug)||(state.base&&state.base.type==='agency'?state.base.slug:'')||'';
        btn.disabled=true;
        fetch(NIS_FORMS.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          form:'booking',agency:agency,listing:(eff&&eff.key)||'',
          name:val('bkp-name'),business:val('bkp-business'),email:val('bkp-email'),phone:val('bkp-phone'),
          fixing:picked,notes:val('bkp-words'),page:location.href
        })}).then(function(r){
          btn.disabled=false;
          if(r.ok){bkDone()}else{bkFail(note)}
        },function(){
          btn.disabled=false;
          bkFail(note);
        });
        return;
      }
      note.classList.add('bk-hot');
      note.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});
      setTimeout(function(){note.classList.remove('bk-hot')},1400);
    });
  }

  function bkDone(){
    var main=overlay.querySelector('#bk-s4-main'),res=overlay.querySelector('#bk-result');
    main.hidden=true;
    res.innerHTML='<p class="bk-card-line" style="font-style:italic;margin-top:1.2em">'+esc(NOTE_DONE)+'</p>'+
      '<div class="bk-nav"><button type="button" class="cta" id="bk-res-close">Close</button></div>';
    res.hidden=false;
    res.querySelector('#bk-res-close').addEventListener('click',close);
    res.querySelector('#bk-res-close').focus();
  }
  function bkFail(note){
    note.textContent=NOTE_FAIL;
    note.classList.add('bk-hot');
    note.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});
    setTimeout(function(){note.classList.remove('bk-hot')},2600);
  }

  function go(n){
    state.step=n;
    for(var i=1;i<=4;i++){overlay.querySelector('#bk-s'+i).hidden=(i!==n)}
    overlay.querySelector('#bk-step-label').textContent=STEP_LABELS[n-1];
    if(n===4)renderSum();
    var h=overlay.querySelector('#bk-s'+n+' .bk-h3');
    if(h)h.focus();
  }

  function cardHTML(m,isAgency){
    if(isAgency){
      return '<div class="bk-card"><span class="ftag">CASE '+esc(m.code)+'</span><div class="bk-card-name">'+esc(m.agname)+'</div><p class="bk-card-line">The file in focus. Pick your listing inside it (optional):</p></div>';
    }
    return '<div class="bk-card"><span class="ftag">CASE '+esc(m.code)+'</span><div class="bk-card-name">'+esc(m.name)+'</div><div class="bk-card-loc">'+esc(m.loc)+' · '+esc(m.agname)+'</div><p class="bk-card-line">This consultation is about this listing.</p><button type="button" class="bk-linkbtn" id="bk-swap">Different business? Search the files instead.</button></div>';
  }
  function finderHTML(scoped){
    return [
      '<div class="nis-form" role="search">',
      '<div><label for="bkp-q">Search the files'+(scoped?'':' (optional)')+'</label><input class="finder-input" id="bkp-q" type="search" autocomplete="off"></div>',
      '<div class="finder-rows" id="bkp-rows" aria-live="polite"></div>',
      '<div class="finder-picked" id="bkp-picked" hidden><span id="bkp-picked-txt"></span><button type="button" class="fx" id="bkp-clear" aria-label="Clear the selected record">&times;</button></div>',
      '<p class="finder-note" id="bkp-note">'+(scoped?NOTE_SCOPED:NOTE_ALL)+'</p>',
      '</div>'
    ].join('');
  }
  function wireFinder(scoped){
    var q=overlay.querySelector('#bkp-q'),rows=overlay.querySelector('#bkp-rows'),
        chip=overlay.querySelector('#bkp-picked'),chipTxt=overlay.querySelector('#bkp-picked-txt'),
        clearBtn=overlay.querySelector('#bkp-clear'),note=overlay.querySelector('#bkp-note');
    var idleNote=scoped?NOTE_SCOPED:NOTE_ALL;
    q.addEventListener('input',debounce(function(){
      var v=trim(q.value);
      if(v.length<2){rows.innerHTML='';note.textContent=idleNote;return}
      loadData().then(function(){
        if(!DATA){rows.innerHTML='';return}
        var m=matchRows(v,scoped?state.scope:null);
        if(!m.length){rows.innerHTML='<span class="finder-row" style="cursor:default">'+NOHIT+'</span>';return}
        var html='';
        for(var i=0;i<Math.min(m.length,14);i++){
          var mm=rowMeta(m[i]);
          var floc=mm.loc?mm.loc+' · '+mm.agname:mm.agname;
          html+='<button type="button" class="finder-row" data-i="'+DATA.rows.indexOf(m[i])+'"><span class="ftag">'+esc(mm.code)+'</span><span>'+esc(mm.name)+'</span><span class="floc">'+esc(floc)+'</span><span class="fgo">Pick this record &rarr;</span></button>';
        }
        if(m.length>14){html+='<span class="finder-row" style="cursor:default">+ '+(m.length-14)+' more. Keep typing.</span>'}
        rows.innerHTML=html;
      });
    }));
    rows.addEventListener('click',function(e){
      var b=e.target.closest?e.target.closest('button.finder-row'):null;
      if(!b)return;
      var row=DATA&&DATA.rows[parseInt(b.getAttribute('data-i'),10)];
      if(!row)return;
      var mm=rowMeta(row);
      state.picked=mm;state.notFiled=false;
      chipTxt.textContent=mm.code+' · '+mm.name+(mm.loc?' · '+mm.loc:'');
      chip.hidden=false;rows.innerHTML='';q.value='';
    });
    clearBtn.addEventListener('click',function(){
      state.picked=null;chip.hidden=true;chipTxt.textContent='';q.focus();
    });
  }
  function renderStep1(){
    var box=overlay.querySelector('#bk-s1-ctx');
    var b=state.base;
    if(b&&b.type==='listing'){
      box.innerHTML=cardHTML(b.meta,false);
      box.querySelector('#bk-swap').addEventListener('click',function(){
        state.base=null;state.scope=null;state.picked=null;renderStep1();
        var q=overlay.querySelector('#bkp-q');if(q)q.focus();
      });
    }else if(b&&b.type==='agency'){
      state.scope=b.slug;
      box.innerHTML=cardHTML({code:b.code,agname:b.agname},true)+finderHTML(true);
      wireFinder(true);
    }else{
      state.scope=null;
      box.innerHTML=finderHTML(false)+'<button type="button" class="bk-linkbtn" id="bk-notfiled">My business is not in a file yet.</button>';
      wireFinder(false);
      box.querySelector('#bk-notfiled').addEventListener('click',function(){
        state.notFiled=true;state.picked=null;go(2);
      });
    }
  }

  function val(id){return trim(overlay.querySelector('#'+id).value)}
  function renderSum(){
    var sumEl=overlay.querySelector('#bk-sum');
    var fileTxt;
    var eff=state.picked||(state.base&&state.base.type==='listing'?state.base.meta:null);
    if(eff){fileTxt='CASE '+eff.code+' · '+eff.name+(eff.loc?' · '+eff.loc:'')}
    else if(state.base&&state.base.type==='agency'){fileTxt='CASE '+state.base.code+' · '+state.base.agname}
    else if(state.notFiled){fileTxt='Not in a file yet'}
    else{fileTxt='Not specified'}
    var name=val('bkp-name'),biz=val('bkp-business'),email=val('bkp-email'),phone=val('bkp-phone');
    var picked=[];
    var cbs=overlay.querySelectorAll('#bk-checks input');
    for(var i=0;i<cbs.length;i++){if(cbs[i].checked)picked.push(cbs[i].value)}
    function row(k,v){return '<div class="bk-sum-row"><span class="k">'+esc(k)+'</span><span class="v">'+esc(v)+'</span></div>'}
    sumEl.innerHTML=
      row('The file',fileTxt)+
      row('Booking',name+(biz?' · '+biz:''))+
      row('Reach',email+(phone?' · '+phone:''))+
      row('Fixing',picked.length?picked.join(' · '):'Not specified');
    var sched=overlay.querySelector('#bk-sched');
    if(sched){
      sched.innerHTML=(typeof NIS_FORMS.scheduler==='string'&&NIS_FORMS.scheduler)?'<a class="cta" target="_blank" rel="noopener" href="'+esc(NIS_FORMS.scheduler)+'">Pick a time</a>':'';
    }
  }

  function open(req){
    NIS_FORMS=window.NIS_FORMS||{endpoint:'',scheduler:''};
    build();
    state={step:1,base:null,picked:null,notFiled:false,scope:null};
    var ids=['bkp-name','bkp-business','bkp-email','bkp-phone','bkp-words'];
    for(var i=0;i<ids.length;i++){var f=overlay.querySelector('#'+ids[i]);if(f)f.value=''}
    var cbs=overlay.querySelectorAll('#bk-checks input');
    for(var j=0;j<cbs.length;j++){cbs[j].checked=false}
    overlay.querySelector('#bkp-s2-note').hidden=true;
    overlay.querySelector('#bk-s1-ctx').innerHTML='';
    var s4m=overlay.querySelector('#bk-s4-main');
    if(s4m)s4m.hidden=false;
    var s4r=overlay.querySelector('#bk-result');
    if(s4r){s4r.hidden=true;s4r.innerHTML=''}
    var fn=overlay.querySelector('#bkp-final-note');
    if(fn){fn.textContent=NOTE_FINAL}
    overlay.hidden=false;
    document.documentElement.classList.add('bk-lock');
    document.body.classList.add('bk-lock');
    keyHandler=function(e){
      if(e.key==='Escape'){e.preventDefault();close();return}
      if(e.key!=='Tab')return;
      var f=overlay.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      var vis=[];
      for(var i=0;i<f.length;i++){
        if(f[i].disabled)continue;
        if(f[i].offsetParent===null)continue;
        vis.push(f[i]);
      }
      if(!vis.length)return;
      var first=vis[0],last=vis[vis.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      else if(!overlay.contains(document.activeElement)){e.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',keyHandler,true);
    go(1);
    if(req&&(req.listing||req.agency)){
      loadData().then(function(){
        if(DATA&&req.listing){
          var row=findRow(req.agency||null,req.listing);
          if(row){state.base={type:'listing',meta:rowMeta(row)}}
          else if(req.agency&&agMeta(req.agency)){var a=agMeta(req.agency);state.base={type:'agency',slug:req.agency,code:a.code,agname:a.name}}
        }else if(DATA&&req.agency&&agMeta(req.agency)){
          var ag=agMeta(req.agency);
          state.base={type:'agency',slug:req.agency,code:ag.code,agname:ag.name};
        }
        if(state.step===1)renderStep1();
      });
    }else{
      renderStep1();
    }
    overlay.querySelector('#bk-close').focus();
  }
  function close(){
    if(!overlay||overlay.hidden)return;
    overlay.hidden=true;
    document.documentElement.classList.remove('bk-lock');
    document.body.classList.remove('bk-lock');
    if(keyHandler){document.removeEventListener('keydown',keyHandler,true);keyHandler=null}
    if(opener&&opener.focus){opener.focus()}
    opener=null;
  }

  document.addEventListener('click',function(e){
    var el=e.target.closest?e.target.closest('[data-book]'):null;
    if(!el)return;
    e.preventDefault();
    opener=el;
    open({agency:el.getAttribute('data-agency'),listing:el.getAttribute('data-listing')});
  });

  function autoOpen(){
    if(location.hash!=='#book')return;
    var qs=null;
    try{qs=new URLSearchParams(location.search)}catch(err){}
    var agency=qs?qs.get('agency'):null,listing=qs?qs.get('listing'):null;
    var isContact=!!document.querySelector('#book form');
    if(isContact&&!agency&&!listing)return;
    opener=null;
    open({agency:agency,listing:listing});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',autoOpen)}
  else{autoOpen()}
})();

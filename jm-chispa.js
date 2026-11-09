/**
 * JM&CHISPA — asistente del blog Conocimiento · v1.0
 * Web estática: GitHub Pages. Sin claves ni credenciales en el navegador.
 * Añadir al final del index.html: <script src="jm-chispa.js" defer></script>
 */
(() => {
  'use strict';
  if (document.getElementById('jmch-root')) return;
  const BLOG = 'https://josr957.github.io/Conocimiento/';
  const AVATAR = new URL('jm-chispa-avatar.jpg', document.currentScript?.src || document.baseURI || BLOG).href;
  const articlesFiles = [new URL('articulos.json', BLOG).href, new URL('ARTICULOS.json', BLOG).href];
  const $ = (s, root=document) => root.querySelector(s);
  const htmlEsc = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const clean = s => String(s ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/\s+/g, ' ').trim();
  const norm = s => String(s ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const textFrom = x => typeof x === 'string' ? x : typeof x === 'number' ? String(x) : Array.isArray(x) ? x.map(textFrom).join(' ') : x && typeof x === 'object' ? (x.rendered ?? x.raw ?? x.text ?? x.contenido ?? '') : '';
  const field = (o, keys) => { if (!o || typeof o !== 'object') return ''; const obj = Object.fromEntries(Object.entries(o).map(([k,v]) => [norm(k),v])); for (const k of keys) {const v = obj[norm(k)]; if (v !== undefined && v !== null && v !== '') return textFrom(v);} return ''; };
  const safeURL = s => {try { const u=new URL(s, BLOG); return u.protocol==='https:' ? u.href : ''; }catch {return '';}};
  const storageKey = 'JMCH_conocimiento_borrador_v1';
  let docs = [], lastError = '', loaded = false, loading = false, query = '', currentTab = 'chat', recognition = null, speaking = false;
  let history = [];

  const style = document.createElement('style');
  style.id='jmch-css';
  style.textContent = `
    #jmch-root, #jmch-root * {box-sizing:border-box; font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;}
    #jmch-root {position:fixed;z-index:2147482000;bottom:20px;right:22px;color:#eee9f7;text-align:left;line-height:1.45;font-size:14px;}
    #jmch-root button,#jmch-root input,#jmch-root textarea {font:inherit;}
    #jmch-root button {cursor:pointer;}
    #jmch-root .jmch-launch {display:flex;align-items:center;gap:9px;border:1px solid rgba(255,204,88,.65);box-shadow:0 10px 36px rgba(0,0,0,.32),0 0 18px rgba(253,183,29,.3);background:linear-gradient(120deg,#211d35,#342249);border-radius:999px;padding:8px 17px 8px 8px;color:#fff;font-weight:750;letter-spacing:.1px;}
    #jmch-root .jmch-launch img {width:45px;height:45px;object-fit:cover;object-position:23% 13%;border:2px solid #ffcf55;border-radius:50%;}
    #jmch-root .jmch-launch strong {color:#ffd264;}
    #jmch-root .jmch-panel {position:fixed;bottom:90px;right:24px;width:min(470px,calc(100vw - 24px));height:min(725px,calc(100dvh - 105px));max-height:calc(100vh - 105px);background:#18172b;box-shadow:0 22px 70px #0008,0 0 0 1px #e6ad4f66;border:1px solid #574363;border-radius:21px;display:flex;flex-direction:column;overflow:hidden;isolation:isolate;}
    #jmch-root .jmch-hide{display:none!important;}
    #jmch-root .jmch-header {display:flex;gap:12px;align-items:center;padding:12px 16px;background:linear-gradient(122deg,#27223d,#43294c 60%,#6b393f);border-bottom:1px solid #75546a;flex-shrink:0;}
    #jmch-root .jmch-head-avatar {width:54px;height:54px;flex:none;border:2px solid #ffc95c;border-radius:15px;object-fit:cover;object-position:center 28%;box-shadow:0 0 15px #ffbb3e66;}
    #jmch-root .jmch-headline{flex:1;min-width:0;}
    #jmch-root .jmch-headline strong{display:block;color:#ffe098;font-size:17px;line-height:1.15;}
    #jmch-root .jmch-headline small{display:block;color:#dbc9dd;font-size:11px;line-height:1.3;margin-top:3px;}
    #jmch-root .jmch-close{background:#ffffff10;color:#fff;border:1px solid #8d7d97;border-radius:50%;font-size:23px;width:33px;height:33px;line-height:1;}
    #jmch-root .jmch-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:7px 9px 0;gap:4px;border-bottom:1px solid #393249;flex-shrink:0;}
    #jmch-root .jmch-tab{border:0;border-radius:9px 9px 0 0;background:transparent;color:#bbb5cf;padding:10px 1px;font-size:12px;font-weight:650;}
    #jmch-root .jmch-tab[aria-selected=true]{background:#39314c;color:#ffd98d;box-shadow:inset 0 -2px #ffd16c;}
    #jmch-root .jmch-view{display:flex;flex:1;flex-direction:column;min-height:0;}
    #jmch-root .jmch-pane{overflow:auto;flex:1;min-height:0;padding:14px;scrollbar-color:#69556e #1f1d30;}
    #jmch-root .jmch-bubble{max-width:95%;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #554664;border-radius:13px 13px 13px 4px;background:#302943;padding:11px 13px;margin:0 0 11px;color:#f8f0fd;}
    #jmch-root .jmch-bubble.jmch-user{margin-left:auto;border-color:#756746;border-radius:13px 13px 4px 13px;background:#443a39;color:#fff1d3;}
    #jmch-root .jmch-who{display:block;color:#e6bc64;font-size:10px;font-weight:800;letter-spacing:.6px;margin:0 0 5px;}
    #jmch-root .jmch-msg-links{margin-top:9px;display:flex;flex-wrap:wrap;gap:5px;}
    #jmch-root .jmch-reference{background:#463c51;border:1px solid #8c727c;color:#ffe1a0;border-radius:8px;padding:6px 9px;text-align:left;font-size:11px;max-width:100%;white-space:normal;}
    #jmch-root .jmch-bottom{flex-shrink:0;background:#242037;border-top:1px solid #49405c;padding:10px 12px 12px;}
    #jmch-root .jmch-voice{display:flex;gap:6px;align-items:center;margin-bottom:7px;font-size:11px;color:#c1bbd0;}
    #jmch-root .jmch-voice input{accent-color:#efb94f;}
    #jmch-root .jmch-entry{display:flex;gap:7px;align-items:flex-end;}
    #jmch-root textarea,#jmch-root input[type=text]{background:#fff;color:#242237;border:1px solid #a9a3b4;border-radius:10px;padding:10px;outline-offset:2px;width:100%;}
    #jmch-root textarea{resize:vertical;min-height:45px;max-height:145px;}
    #jmch-root .jmch-entry textarea{flex:1;height:46px;resize:none;font-size:13px;}
    #jmch-root .jmch-goldbtn{border:1px solid #d3a045;background:linear-gradient(135deg,#f7cf69,#d7952b);border-radius:10px;color:#221b2e;padding:9px 12px;font-weight:800;}
    #jmch-root .jmch-mic{border:1px solid #997654;background:#383146;border-radius:10px;color:#ffd18b;width:42px;height:46px;font-size:21px;}
    #jmch-root .jmch-mic.jmch-listening {background:#943b4b;color:white;animation:jmch-pulse .9s infinite alternate;}
    @keyframes jmch-pulse {from{box-shadow:0 0 0 #ffab4f00}to{box-shadow:0 0 0 5px #ffab4f30}}
    #jmch-root .jmch-muted{font-size:11px;color:#beb8c8;line-height:1.45;margin:5px 0;}
    #jmch-root .jmch-tag{border:1px solid #66576c;border-radius:999px;color:#e2c78d;display:inline-block;font-size:11px;padding:3px 8px;margin:0 5px 6px 0;}
    #jmch-root .jmch-toolbar{display:flex;gap:7px;margin:0 0 12px;align-items:center;flex-wrap:wrap;}
    #jmch-root .jmch-item{padding:11px;margin:9px 0;border-radius:13px;border:1px solid #4d445b;background:#282638;}
    #jmch-root .jmch-item strong{display:block;color:#f6d494;font-size:13px;}
    #jmch-root .jmch-item p{color:#d1cbd8;margin:7px 0;font-size:12px;line-height:1.45;}
    #jmch-root .jmch-item button{border:1px solid #b99b69;background:transparent;color:#f7d28b;border-radius:7px;padding:6px 9px;margin:4px 5px 0 0;font-size:11px;}
    #jmch-root .jmch-smallbtn{border:1px solid #a18763;background:#352c3b;color:#f6d392;border-radius:8px;padding:8px 10px;font-size:12px;}
    #jmch-root .jmch-card{background:#29243a;border:1px solid #5b5069;border-radius:14px;padding:13px;margin:10px 0;}
    #jmch-root .jmch-card h3{color:#f6d18b;margin:0 0 8px;font-size:15px;}
    #jmch-root .jmch-card p{margin:7px 0;color:#e0d9e9;}
    #jmch-root .jmch-fieldlabel{display:block;color:#dfd8e9;font-size:12px;font-weight:700;margin:14px 0 5px;}
    #jmch-root .jmch-edit{flex:1;min-height:190px;}
    #jmch-root .jmch-status{border-top:1px solid #3e344d;padding:5px 12px 7px;background:#211e30;color:#cabfd0;font-size:10px;flex-shrink:0;}
    #jmch-root a{color:#ffda94;}
    #jmch-root .jmch-headlink{color:#f6cf81;text-decoration:underline;}
    #jmch-root .jmch-visually-hidden{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
    @media(max-width:600px){#jmch-root{bottom:12px;right:12px;}#jmch-root .jmch-panel{right:9px;bottom:78px;width:calc(100vw - 18px);height:calc(100dvh - 95px);border-radius:16px;}#jmch-root .jmch-launch{padding-right:12px;}#jmch-root .jmch-head-avatar{width:43px;height:43px;}}
    @media(prefers-reduced-motion:reduce){#jmch-root *{animation:none!important;transition:none!important;}}
  `;
  document.head.appendChild(style);

  const host=document.createElement('div'); host.id='jmch-root';
  host.innerHTML=`
    <button type="button" class="jmch-launch" id="jmch-launch" aria-label="Abrir a Chispa, asistente de Conocimiento" aria-expanded="false"><img src="${htmlEsc(AVATAR)}" alt="Avatar JM y Chispa"><span>Habla con <strong>Chispa</strong> ✨</span></button>
    <section class="jmch-panel jmch-hide" id="jmch-panel" role="dialog" aria-label="Asistente JM y Chispa" aria-modal="false">
      <div class="jmch-header"><img class="jmch-head-avatar" src="${htmlEsc(AVATAR)}" alt="JM y Chispa, nuestro avatar"><div class="jmch-headline"><strong>JM & CHISPA</strong><small>Tu asistente en Conocimiento · voz y biblioteca</small></div><button class="jmch-close" id="jmch-close" type="button" title="Cerrar" aria-label="Cerrar">×</button></div>
      <div class="jmch-tabs" role="tablist" aria-label="Funciones de Chispa">
       <button class="jmch-tab" role="tab" aria-selected="true" data-tab="chat">💬 Conversar</button><button class="jmch-tab" role="tab" aria-selected="false" data-tab="search">🔎 Artículos</button><button class="jmch-tab" role="tab" aria-selected="false" data-tab="editor">✍️ Taller</button><button class="jmch-tab" role="tab" aria-selected="false" data-tab="help">❔ Ayuda</button>
      </div>
      <div class="jmch-view" id="jmch-view-chat">
        <div class="jmch-pane" id="jmch-messages" aria-live="polite"></div>
        <div class="jmch-bottom"><div class="jmch-voice"><label><input type="checkbox" id="jmch-auto-voice"> Escuchar las respuestas</label><span id="jmch-voice-status" style="margin-left:auto" aria-live="polite">🎙 Listo</span></div>
          <div class="jmch-entry"><button class="jmch-mic" id="jmch-mic" type="button" title="Hablar con Chispa" aria-label="Activar micrófono">🎙</button><textarea id="jmch-question" placeholder="Pregúntame por un tema o un artículo…" aria-label="Tu pregunta"></textarea><button class="jmch-goldbtn" id="jmch-send" type="button" title="Enviar pregunta">➤</button></div>
        </div>
      </div>
      <div class="jmch-view jmch-hide" id="jmch-view-search"><div class="jmch-pane"><div class="jmch-toolbar"><input id="jmch-search" type="text" placeholder="Buscar en nuestros artículos…" aria-label="Buscar artículos"><button type="button" class="jmch-goldbtn" id="jmch-search-btn">Buscar</button></div><p class="jmch-muted" id="jmch-search-meta">Cargando biblioteca pública…</p><div id="jmch-results"></div></div></div>
      <div class="jmch-view jmch-hide" id="jmch-view-editor"><div class="jmch-pane"><div class="jmch-card"><h3>✍️ Taller editorial JM&CHISPA</h3><p>Prepara aquí el borrador de un artículo. Se guarda <strong>solo en este navegador</strong>; no modifica el blog ni publica nada automáticamente.</p></div><label class="jmch-fieldlabel" for="jmch-title">Título del artículo</label><input type="text" id="jmch-title" placeholder="Título de nuestra investigación"><label class="jmch-fieldlabel" for="jmch-content">Contenido / ideas</label><textarea class="jmch-edit" id="jmch-content" rows="10" placeholder="Escribe o pega aquí las ideas o el artículo…"></textarea><div class="jmch-toolbar" style="margin-top:12px"><button class="jmch-goldbtn" id="jmch-save" type="button">Guardar borrador</button><button class="jmch-smallbtn" id="jmch-export" type="button">Descargar .md</button><button class="jmch-smallbtn" id="jmch-copy" type="button">Copiar</button></div><p class="jmch-muted" id="jmch-editor-msg">Ningún borrador se envía a GitHub hasta que tú decidas publicarlo.</p><p><a class="jmch-headlink" href="https://github.com/josr957/Conocimiento" target="_blank" rel="noopener noreferrer">Abrir la administración del blog en GitHub</a></p></div></div>
      <div class="jmch-view jmch-hide" id="jmch-view-help"><div class="jmch-pane"><div class="jmch-card"><h3>☀️ ¿Quién es Chispa?</h3><p>La silueta dorada del avatar de JM&CHISPA. Estoy aquí para ayudarte a descubrir los artículos del blog y preparar nuevos contenidos.</p></div><div class="jmch-card"><h3>🎙 ¿Cómo hablo?</h3><p>Pulsa el micrófono. El navegador te pedirá permiso. Habla en español; se transcribirá tu pregunta y se enviará. Si activas «Escuchar las respuestas», el navegador leerá el texto en voz alta.</p></div><div class="jmch-card"><h3>🔎 ¿Qué puedo contestar?</h3><p>Esta versión consulta y busca títulos, resúmenes y contenidos presentes en el índice público del blog. <strong>No dispone todavía de un motor generativo externo</strong>; no inventa explicaciones ni respuestas de IA.</p></div><div class="jmch-card"><h3>🔐 ¿Quién puede gestionar el blog?</h3><p>Los visitantes solo pueden consultar. El Taller guarda borradores en su propio navegador. Publicar o editar el repositorio exige acceder a GitHub como administrador. Nunca se introducen contraseñas o claves de GitHub en esta página pública.</p></div><div class="jmch-card"><h3>💻 Tecnología</h3><p>HTML + CSS + JavaScript, alojados en GitHub Pages. Para incorporar más adelante inteligencia generativa a todos los visitantes se necesitará un servicio seguro de IA independiente del alojamiento estático.</p></div></div></div>
      <div class="jmch-status" id="jmch-status" role="status">Conocimiento · consultas públicas · sin cambios automáticos</div>
    </section>`;
  document.body.appendChild(host);
  const root = host;
  const setStatus = msg => {$('#jmch-status',root).textContent=msg;};

  async function loadArticles() {
    if(loaded) return;
    if(loading) { while(loading) await new Promise(resolve=>setTimeout(resolve,75)); return; }
    loading = true; lastError='';
    $('#jmch-search-meta',root).textContent='Consultando el índice público…';
    for (const u of articlesFiles) {
      try {
        const r = await fetch(u,{cache:'no-store'});
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        const data=await r.json();
        let collection = Array.isArray(data) ? data : null;
        if(!collection && data && typeof data==='object') {
          const names=['articulos','ARTICULOS','articles','posts','entradas','items','publicaciones','data','datos'];
          for(const n of names){if(Array.isArray(data[n])){collection=data[n];break;}}
          if(!collection){for(const v of Object.values(data)){if(Array.isArray(v)){collection=v;break;}}}
        }
        if(!Array.isArray(collection)) throw new Error('Formato JSON no reconocido');
        docs=collection.map((item,i) => {
          if(typeof item === 'string') item={titulo:item};
          if(!item || typeof item !== 'object') return null;
          let title=clean(field(item,['titulo','título','title','nombre','nombre_articulo','encabezado']));
          let content=clean(field(item,['contenido','content','texto','cuerpo','articulo','artículo','html','body','desarrollo','descripcion','descripción']));
          let summary=clean(field(item,['resumen','extracto','excerpt','summary','subtitulo','subtítulo'])) || content.slice(0,350);
          let date=clean(field(item,['fecha','date','fecha_publicacion','published']));
          let url=safeURL(field(item,['url','link','enlace','href','pdf']));
          return {id:i,title:title||`Artículo ${i+1}`,content,summary,date,url,haystack:norm(`${title} ${summary} ${content.slice(0,25000)}`)};
        }).filter(Boolean);
        loaded=true; loading=false;
        $('#jmch-search-meta',root).textContent=`Biblioteca conectada: ${docs.length} artículos · ${u.split('/').pop()}`;
        setStatus(`${docs.length} publicaciones cargadas · catálogo público`);
        showResults(query);
        return;
      }catch(e){lastError=String(e.message||e);}
    }
    loading=false;
    $('#jmch-search-meta',root).textContent='No se ha podido leer el catálogo público. Comprueba la conexión y el nombre de articulos.json.';
    setStatus('Biblioteca no disponible: '+lastError);
  }

  function searchDocs(q, limit=30){
    const terms=norm(q).split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>1);
    if(!terms.length)return docs.slice(0,limit);
    return docs.map(d=>{
      const title=norm(d.title);const summary=norm(d.summary);
      const score=terms.reduce((total,t)=>total+(title.includes(t)?8:0)+(summary.includes(t)?3:0)+(d.haystack.includes(t)?1:0),0);
      return {d,score,ok:terms.every(t=>d.haystack.includes(t))};
    }).filter(o=>o.ok).sort((a,b)=>b.score-a.score).slice(0,limit).map(o=>o.d);
  }

  function resultCard(doc){
    const node=document.createElement('article');node.className='jmch-item';
    const strong=document.createElement('strong');strong.textContent=doc.title;node.append(strong);
    if(doc.date){const date=document.createElement('span');date.className='jmch-tag';date.textContent=doc.date.slice(0,32);node.append(date);}
    if(doc.summary){const p=document.createElement('p');p.textContent=doc.summary.slice(0,500)+(doc.summary.length>500?'…':'');node.append(p);}
    if(doc.url){const btn=document.createElement('button');btn.textContent='Abrir publicación ↗';btn.onclick=()=>window.open(doc.url,'_blank','noopener,noreferrer');node.append(btn);}
    const copy=document.createElement('button');copy.textContent='Copiar título';copy.onclick=()=>copyText(doc.title);node.append(copy);
    const detail=document.createElement('button');detail.textContent='Ver extracto';detail.onclick=()=>{const excerpt=doc.content||doc.summary||'Este índice no contiene el texto completo.';const p=document.createElement('p');p.textContent=excerpt.slice(0,4500)+(excerpt.length>4500?'…':'');p.style.whiteSpace='pre-wrap';detail.after(p);detail.remove();};node.append(detail);
    return node;
  }
  function showResults(q=''){
    query=q;
    const target=$('#jmch-results',root);target.replaceChildren();
    if(!loaded){const p=document.createElement('p');p.textContent=loading?'Cargando artículos…':'No se ha cargado el índice.';target.append(p);return;}
    const result=searchDocs(q,30);$('#jmch-search-meta',root).textContent=q?`${result.length} resultados mostrados para «${q}» (máx. 30)`:`Biblioteca conectada: ${docs.length} artículos · 30 primeros`;
    if(!result.length){const p=document.createElement('p');p.className='jmch-muted';p.textContent='No encuentro coincidencias exactas. Prueba con una palabra clave más corta.';target.append(p);}
    for(const item of result)target.append(resultCard(item));
  }
  function newMsg(role,text,sources=[]){
    const wrap=document.createElement('div');wrap.className='jmch-bubble'+(role==='user'?' jmch-user':'');
    const who=document.createElement('span');who.className='jmch-who';who.textContent=role==='user'?'TU PREGUNTA':'✦ CHISPA';wrap.append(who);
    const txt=document.createElement('span');txt.textContent=text;wrap.append(txt);
    if(sources.length){const links=document.createElement('div');links.className='jmch-msg-links';sources.slice(0,4).forEach(d=>{const btn=document.createElement('button');btn.className='jmch-reference';btn.textContent='📖 '+d.title.slice(0,62);btn.onclick=()=>{selectTab('search');$('#jmch-search',root).value=d.title;showResults(d.title);};links.append(btn);});wrap.append(links);}
    $('#jmch-messages',root).append(wrap);$('#jmch-messages',root).scrollTop=$('#jmch-messages',root).scrollHeight;
  }
  function botAnswer(question){
    const q=norm(question).trim();
    if(/\b(hola|buenos dias|buenas tardes|buenas noches)\b/.test(q))return {reply:'¡Hola! Soy Chispa, la silueta dorada de JM&CHISPA. Pregúntame por temas y artículos de nuestro blog. También puedes entrar en «Artículos» o «Taller».'};
    if(/\b(cuantos|cuantas|numero|total)\b/.test(q)&&/articul|publicacion|entrada/.test(q))return {reply:`Ahora mismo he podido cargar ${docs.length} artículos del índice público de Conocimiento.`};
    if(/\b(que puedes hacer|como funcionas|ayuda)\b/.test(q))return {reply:'Puedo buscar artículos en el catálogo público, mostrar sus extractos, reconocer tu voz si el navegador lo permite y leer las respuestas. En el Taller puedes escribir y exportar borradores. Para conversar con una IA generativa necesitaremos conectar un motor seguro.'};
    if(!loaded)return {reply:'No he podido cargar el catálogo del blog. Puedes probar de nuevo en la pestaña «Artículos». Aún no tengo un motor generativo conectado.'};
    const noise=new Set(['dime','hablame','explicame','sobre','acerca','para','quiero','saber','busca','buscar','encuentra','tienes','tenemos','hay','cuáles','cuales','algun','alguna','articulo','articulos','publicacion','publicaciones','del','de','las','los','una','uno','que','por','en','como','el','la','un','es','me','puedes','chispa','conocimiento','nuestro','blog','cuentame','toda','todo','informacion','relacionado','relacionada']);
    let terms=norm(question).split(/[^\p{L}\p{N}]+/u).filter(s=>s.length>2&&!noise.has(s));
    if(!terms.length)return {reply:`Tengo ${docs.length} referencias disponibles. Dime un tema específico, por ejemplo «historia», «economía» o «astronomía», y buscaré artículos.`};
    let hits=searchDocs(terms.join(' '),6);
    if(!hits.length && terms.length>1){hits=searchDocs(terms.sort((a,b)=>b.length-a.length)[0],6);}
    if(!hits.length)return {reply:`No encuentro artículos coincidentes con «${terms.join(' ')}» en el catálogo. Prueba otra expresión o usa la pestaña «Artículos». No voy a inventarme resultados.`};
    const lines=hits.map((d,i)=>`${i+1}. ${d.title}${d.summary?' — '+d.summary.slice(0,135).replace(/\s+/g,' ')+'…':''}`);
    return {reply:`He localizado ${hits.length} ${hits.length===1?'publicación relacionada':'publicaciones relacionadas'} con tu pregunta:\n\n${lines.join('\n\n')}\n\nEstos son extractos del índice del blog, no una explicación generada por IA. Pulsa las referencias para consultarlas.`,sources:hits};
  }
  function speak(t){
    if(!('speechSynthesis' in window)){setStatus('Tu navegador no dispone de voz de lectura.');return;}
    window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t.slice(0,4200));u.lang='es-ES';u.rate=.98;
    const vs=speechSynthesis.getVoices();u.voice=vs.find(v=>v.lang.toLowerCase()==='es-es')||vs.find(v=>v.lang.toLowerCase().startsWith('es'))||null;
    u.onstart=()=>{$('#jmch-voice-status',root).textContent='🔊 Hablando';};u.onend=()=>{$('#jmch-voice-status',root).textContent='🎙 Listo';};u.onerror=()=>{$('#jmch-voice-status',root).textContent='Voz no disponible';};window.speechSynthesis.speak(u);
  }
  async function send(){const input=$('#jmch-question',root);const val=input.value.trim();if(!val)return;input.value='';newMsg('user',val);if(!loaded)await loadArticles();const answer=botAnswer(val);newMsg('assistant',answer.reply,answer.sources||[]);if($('#jmch-auto-voice',root).checked)speak(answer.reply);}
  function startMic(){
    const Recognizer=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognizer){setStatus('Micrófono de dictado no disponible. Prueba Chrome o Edge.');return;}
    if(recognition){recognition.stop();return;}
    const rec=new Recognizer();recognition=rec;rec.lang='es-ES';rec.continuous=false;rec.interimResults=true;
    let finalText='';let gotFinal=false;
    rec.onstart=()=>{$('#jmch-mic',root).classList.add('jmch-listening');$('#jmch-voice-status',root).textContent='🔴 Escuchando';};
    rec.onresult=e=>{let temp='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal){finalText+=t+' ';gotFinal=true;}else temp+=t;}$('#jmch-question',root).value=finalText+temp;};
    rec.onerror=e=>{if(e.error!=='no-speech'&&e.error!=='aborted')setStatus('El micrófono ha devuelto: '+e.error);};
    rec.onend=()=>{recognition=null;$('#jmch-mic',root).classList.remove('jmch-listening');$('#jmch-voice-status',root).textContent='🎙 Listo';if(gotFinal&&$('#jmch-question',root).value.trim())send();};
    try{rec.start();}catch(e){recognition=null;setStatus('No se pudo iniciar el micrófono.');}
  }
  function selectTab(tab){currentTab=tab;for(const t of ['chat','search','editor','help']){$('#jmch-view-'+t,root).classList.toggle('jmch-hide',t!==tab);}root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab?'true':'false'));if(tab==='search')loadArticles();}
  function copyText(text){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>setStatus('Texto copiado.')).catch(()=>setStatus('No se pudo copiar; selecciona el texto manualmente.'));else setStatus('Tu navegador no permite copiar automáticamente.');}
  function exportDraft(){const title=$('#jmch-title',root).value.trim(),content=$('#jmch-content',root).value.trim();if(!title&&!content){$('#jmch-editor-msg',root).textContent='No hay contenido que exportar.';return;}const blob=new Blob([`# ${title||'Borrador sin título'}\n\n${content}\n`],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='jm-chispa-borrador-'+new Date().toISOString().slice(0,10)+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);setStatus('Borrador descargado en tu ordenador.');}

  $('#jmch-launch',root).onclick=()=>{const panel=$('#jmch-panel',root);const opening=panel.classList.contains('jmch-hide');panel.classList.toggle('jmch-hide',!opening);$('#jmch-launch',root).setAttribute('aria-expanded',String(opening));if(opening){loadArticles();$('#jmch-question',root).focus();}};
  $('#jmch-close',root).onclick=()=>{$('#jmch-panel',root).classList.add('jmch-hide');$('#jmch-launch',root).setAttribute('aria-expanded','false');window.speechSynthesis?.cancel();};
  for(const b of root.querySelectorAll('[data-tab]')) b.onclick=()=>selectTab(b.dataset.tab);
  $('#jmch-send',root).onclick=send;$('#jmch-mic',root).onclick=startMic;
  $('#jmch-question',root).addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
  $('#jmch-search-btn',root).onclick=()=>showResults($('#jmch-search',root).value.trim());
  $('#jmch-search',root).addEventListener('keydown',e=>{if(e.key==='Enter')showResults(e.target.value.trim());});
  $('#jmch-save',root).onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify({title:$('#jmch-title',root).value,content:$('#jmch-content',root).value,date:new Date().toISOString()}));$('#jmch-editor-msg',root).textContent='Borrador guardado en este navegador. No está publicado en GitHub.';}catch{$('#jmch-editor-msg',root).textContent='El navegador impidió guardar. Utiliza Descargar .md.';}};
  $('#jmch-export',root).onclick=exportDraft;
  $('#jmch-copy',root).onclick=()=>copyText($('#jmch-title',root).value+'\n\n'+$('#jmch-content',root).value);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#jmch-panel',root).classList.contains('jmch-hide'))$('#jmch-close',root).click();});
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved){$('#jmch-title',root).value=saved.title||'';$('#jmch-content',root).value=saved.content||'';}}catch{}
  newMsg('assistant','¡Hola! Soy Chispa, la silueta dorada de JM&CHISPA. Puedes preguntarme por nuestros artículos de Conocimiento, hablar por el micrófono o preparar un borrador en el Taller.\n\n¿Sobre qué tema investigamos hoy?');
  // No almacenar mensajes ni enviar datos de visitantes a un tercero; búsquedas se ejecutan en el navegador.
})();

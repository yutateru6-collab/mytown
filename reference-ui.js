/* Reference-accurate MYTOWN home. Static watercolor art is the supplied mockup;
 * live civic cards below it use synchronized official data. */
(function () {
  const topSrc = `data:image/avif;base64,${window.REF_TOP_B64 || ''}`;

  function e(v=''){ return typeof esc === 'function' ? esc(v) : String(v); }
  function featured(){ return Array.isArray(state.data?.featured) ? state.data.featured[0] || null : null; }
  function council(){ return state.data?.council || null; }
  function bulletin(){ return state.data?.bulletin?.currentIssue || null; }
  function glossary(){ const a=state.politics?.glossary||[]; return a.find(x=>x.formal==='補正予算')||a[0]||null; }

  function topVisual(){
    return `<section class="ref-top" aria-labelledby="ref-home-title">
      <img class="ref-top-image" src="${topSrc}" alt="" decoding="async" fetchpriority="high">
      <h1 id="ref-home-title" class="ref-sr-only">Our City 直方市</h1>
      <button class="ref-hit ref-hit-notify" type="button" data-v2-nav="notifications" aria-label="お知らせ"></button>
      <button class="ref-hit ref-hit-profile" type="button" data-v2-nav="menu" aria-label="マイページ"></button>
      <button class="ref-hit ref-hit-proposal" type="button" data-ref-action="proposal" aria-label="提案する"></button>
      <button class="ref-hit ref-hit-vote" type="button" data-ref-action="vote" aria-label="投票する"></button>
      <button class="ref-hit ref-hit-opinions" type="button" data-ref-action="opinions" aria-label="意見をみる"></button>
      <button class="ref-hit ref-hit-progress" type="button" data-ref-action="progress" aria-label="進みぐあい"></button>
    </section>`;
  }

  function dashboardCard({cls='',label='',title='',body='',meta='',action='',actionLabel='くわしく見る'}){
    return `<article class="ref-live-card ${cls}">
      <div class="ref-live-label">${e(label)}</div>
      <h2>${e(title)}</h2>
      ${body ? `<p>${e(body)}</p>` : ''}
      ${meta ? `<small>${e(meta)}</small>` : ''}
      ${action ? `<button type="button" data-ref-action="${e(action)}">${e(actionLabel)} <b aria-hidden="true">›</b></button>` : ''}
    </article>`;
  }

  function liveDashboard(){
    const f=featured(), c=council(), b=bulletin(), g=glossary();
    const latest=Array.isArray(state.data?.latest) ? state.data.latest.slice(0,2) : [];
    const latestText=latest.map(x=>x.title).filter(Boolean).join(' / ') || '直方市公式サイトの新着情報を確認しています。';
    return `<section class="ref-live-area" aria-label="今日の直方">
      <div class="ref-live-grid">
        ${dashboardCard({cls:'pink',label:'注目の情報',title:f?.title||'直方市の新しい情報',body:f?.summary||'公式情報を同期して表示します。',meta:f?.status||'',action:'featured',actionLabel:'くわしく見る'})}
        ${dashboardCard({cls:'green',label:'次回の会議',title:c?.nextDateLabel||c?.title||'市議会日程を確認中',body:c?.nextSummary||c?.summary||'直方市議会の公式日程を確認しています。',meta:c?.status||'公式日程ベース',action:'council',actionLabel:'くわしく見る'})}
        ${dashboardCard({cls:'blue',label:'みんなに関係する新着',title:'直方市公式サイトから',body:latestText,action:'notifications',actionLabel:'新着をもっと見る'})}
        ${dashboardCard({cls:'yellow',label:'￥ 予算の状況',title:'数値データを整理中',body:'予算・決算は公式資料と照合できた数字だけ表示します。',meta:'確認できない金額は表示しません',action:'money',actionLabel:'予算を見る'})}
        <article class="ref-live-card lavender">
          <div class="ref-live-label">進みぐあい</div><h2>暮らし → 行政 → 議会 → 実行</h2>
          <div class="ref-live-progress"><i></i><i></i><i></i><i></i></div>
          <p>何がどこまで進んだか、確認できる一次資料からたどります。</p>
          <button type="button" data-ref-action="progress">進みぐあいを見る <b>›</b></button>
        </article>
        <article class="ref-live-card mint ref-guide-live">
          <div class="ref-live-label">はじめての方へ</div><h2>一緒にまちを<br>良くしていきましょう！</h2>
          <div class="ref-guide-art" aria-hidden="true"><img src="${topSrc}" alt=""></div>
          <p>${e(g ? `${g.formal}って何？` : '市役所の言葉ってむずかしい？')}</p>
          <button type="button" data-ref-action="glossary">使い方・ことばを見る <b>›</b></button>
        </article>
      </div>
      <article class="ref-bulletin-live">
        <div><span>市報のおがた</span><h2>${e(b?.title||'最新号を確認中')}</h2><p>最新号とページごとの見出しを公式情報から確認できます。</p></div>
        <button type="button" data-ref-action="bulletin">市報を読む <b>›</b></button>
      </article>
      <p class="ref-disclaimer">MYTOWNは非公式アプリです。重要な手続き・期限・選挙情報はリンク先の直方市公式情報も確認してください。</p>
    </section>`;
  }

  function home(){
    return `<section class="page ref-home-page">${topVisual()}${state.loading ? '<div class="ref-loading">直方市の公式情報を読み込んでいます…</div>' : liveDashboard()}</section>`;
  }

  function openFeatured(){ const f=featured(); if(!f) return; state.selectedId=f.id; state.detailSection=null; state.view='detail'; render(); }
  function act(a){
    if(a==='proposal') return typeof v2HandleAction==='function' ? v2HandleAction('ask') : goTab('ask');
    if(a==='vote'){ state.politicsSection='elections'; return typeof v2SetRoute==='function' ? v2SetRoute({tab:'politics',page:null,hash:'#politics'}) : goTab('politics'); }
    if(a==='opinions') return typeof v2HandleNav==='function' ? v2HandleNav('search') : goTab('discover');
    if(a==='progress'||a==='council'){ state.politicsSection='home'; return typeof v2SetRoute==='function' ? v2SetRoute({tab:'politics',page:null,hash:'#politics'}) : goTab('politics'); }
    if(a==='featured') return openFeatured();
    if(a==='money') return typeof v2HandleAction==='function' ? v2HandleAction('money') : null;
    if(a==='glossary') return typeof v2HandleAction==='function' ? v2HandleAction('glossary') : null;
    if(a==='notifications') return typeof v2HandleNav==='function' ? v2HandleNav('notifications') : null;
    if(a==='bulletin'){ const b=bulletin(); const u=b?.sourceUrl||state.data?.bulletin?.archiveUrl; if(u) window.open(u,'_blank','noopener,noreferrer'); }
  }

  const base=render;
  render=function(){
    if(state.view==='tab' && state.tab==='today' && !state.v2Page){ main.innerHTML=home(); window.scrollTo({top:0,behavior:'auto'}); if(typeof v2SyncNav==='function') v2SyncNav(); return; }
    return base();
  };

  document.addEventListener('click',ev=>{ const b=ev.target.closest('[data-ref-action]'); if(!b) return; ev.preventDefault(); act(b.dataset.refAction); });
  render();
})();

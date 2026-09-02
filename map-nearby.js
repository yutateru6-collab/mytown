/* MYTOWN nearby map — MapLibre + OpenFreeMap, only for verified coordinates. */
"use strict";

(() => {
  const MAPLIBRE_VERSION = "5.24.0";
  const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
  const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
  const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

  // Coordinates are added only after the address and map position have been checked.
  // Central Community Center: 直方市津田町7-20
  // Nogata City Gymnasium: 直方市大字直方674-25
  const VERIFIED_LOCATION_POINTS = Object.freeze([
    Object.freeze({ pattern: /津田町7(?:番|番地)?20号?/, lng: 130.7301452, lat: 33.7465915 }),
    Object.freeze({ pattern: /(?:大字)?直方674-25/, lng: 130.7253475, lat: 33.7410836 }),
  ]);

  let mapLibrePromise = null;
  let activeMap = null;

  function normalizedLocation(value = "") {
    return String(value || "").normalize("NFKC").replace(/\s+/g, "");
  }

  function mapPointForItem(item = {}) {
    const location = String(item.location || "").trim();
    if (!location) return null;
    const normalized = normalizedLocation(location);
    const verified = VERIFIED_LOCATION_POINTS.find((point) => point.pattern.test(normalized));
    if (!verified) return null;
    return {
      id: item.id || "",
      title: item.title || "場所が確認できる情報",
      category: item.category || "直方市情報",
      location,
      lng: verified.lng,
      lat: verified.lat,
    };
  }

  function currentMapPoints() {
    return (state.data?.featured || []).map(mapPointForItem).filter(Boolean);
  }

  function markerIcon(category = "") {
    if (/学校|教育/.test(category)) return "🏫";
    if (/健康|スポーツ/.test(category)) return "🏃";
    if (/観光|イベント/.test(category)) return "🎪";
    if (/交通|バス/.test(category)) return "🚌";
    if (/工事|道路/.test(category)) return "🚧";
    return "📍";
  }

  function googleMapsUrl(location) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  }

  function popupHtml(point) {
    return `<div class="mytown-map-popup">
      <small>${esc(point.category)}</small>
      <h3>${esc(point.title)}</h3>
      <p>${esc(point.location)}</p>
      <div class="mytown-map-popup-actions">
        ${point.id ? `<button type="button" data-real-id="${esc(point.id)}">内容を見る</button>` : ""}
        <a href="${esc(googleMapsUrl(point.location))}" target="_blank" rel="noopener noreferrer">Googleマップで開く <span aria-hidden="true">↗</span></a>
      </div>
    </div>`;
  }

  function ensureMapLibre() {
    if (window.maplibregl?.Map) return Promise.resolve(window.maplibregl);
    if (mapLibrePromise) return mapLibrePromise;

    if (!document.querySelector('link[data-mytown-maplibre="css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MAPLIBRE_CSS;
      link.dataset.mytownMaplibre = "css";
      document.head.appendChild(link);
    }

    mapLibrePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-mytown-maplibre="js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.maplibregl), { once: true });
        existing.addEventListener("error", () => reject(new Error("MapLibre load failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = MAPLIBRE_JS;
      script.async = true;
      script.dataset.mytownMaplibre = "js";
      script.addEventListener("load", () => resolve(window.maplibregl), { once: true });
      script.addEventListener("error", () => reject(new Error("MapLibre load failed")), { once: true });
      document.head.appendChild(script);
    });

    return mapLibrePromise;
  }

  function destroyNearbyMap() {
    if (!activeMap) return;
    try {
      activeMap.remove();
    } catch (error) {
      console.warn("Nearby map cleanup failed", error);
    }
    activeMap = null;
  }

  async function initNearbyMap() {
    const container = document.querySelector("#mytown-nearby-map");
    if (!container) return;
    const points = currentMapPoints();
    if (!points.length) return;

    try {
      const maplibregl = await ensureMapLibre();
      if (!maplibregl?.Map || !container.isConnected || state.tab !== "nearby" || state.view !== "tab") return;

      container.innerHTML = "";
      activeMap = new maplibregl.Map({
        container,
        style: OPENFREEMAP_STYLE,
        center: [points[0].lng, points[0].lat],
        zoom: points.length === 1 ? 15 : 13.5,
        minZoom: 10,
        maxZoom: 18,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });

      activeMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      const bounds = new maplibregl.LngLatBounds();
      points.forEach((point) => {
        bounds.extend([point.lng, point.lat]);
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "mytown-map-marker";
        marker.setAttribute("aria-label", `${point.title}を地図で見る`);
        marker.innerHTML = `<span aria-hidden="true">${markerIcon(point.category)}</span>`;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: "290px" }).setHTML(popupHtml(point));
        new maplibregl.Marker({ element: marker, anchor: "bottom" })
          .setLngLat([point.lng, point.lat])
          .setPopup(popup)
          .addTo(activeMap);
      });

      if (points.length > 1) {
        activeMap.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 0 });
      }
    } catch (error) {
      console.warn("Nearby map load failed", error);
      if (container.isConnected) {
        container.innerHTML = `<div class="mytown-map-fallback"><strong>地図を読み込めませんでした</strong><span>下の一覧から場所を確認できます。</span></div>`;
      }
    }
  }

  function mapCardMarkup() {
    const points = currentMapPoints();
    return `<div class="mytown-map-card">
      <div class="mytown-map-head">
        <div><p>地図で見る</p><h2>場所が分かる情報</h2></div>
        <span>${points.length}件</span>
      </div>
      ${points.length
        ? `<div id="mytown-nearby-map" class="mytown-nearby-map" role="region" aria-label="直方市の場所が確認できる情報を表示した地図"><div class="mytown-map-loading">地図を読み込んでいます…</div></div><p class="mytown-map-note">ピンは、住所と位置を確認できた情報だけ表示しています。ピンを押すと内容とGoogleマップへのリンクを確認できます。</p>`
        : `<div class="mytown-map-empty"><strong>地図に表示できる情報はまだありません</strong><span>住所と位置を確認できた情報から追加します。</span></div>`}
    </div>`;
  }

  const baseNearbyViewForMap = nearbyView;
  nearbyView = function nearbyViewWithRealMap() {
    const html = baseNearbyViewForMap();
    const placeholder = `<div class="card info-card"><h2>地図は準備中</h2><p>場所を正確に確認できた情報から、今後地図に追加します。現在は一覧で確認できます。</p></div>`;
    return html.includes(placeholder) ? html.replace(placeholder, mapCardMarkup()) : html;
  };

  const baseRenderForNearbyMap = render;
  render = function renderWithNearbyMap() {
    destroyNearbyMap();
    const result = baseRenderForNearbyMap();
    if (state.tab === "nearby" && state.view === "tab") {
      requestAnimationFrame(() => initNearbyMap());
    }
    return result;
  };

  render();
})();
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

import type { HikeWaypoint } from './api';
import type { Coordinate } from './theme';

export type LeafletMapLayer = 'Standard' | 'Terrain' | 'Satellite';
type NamedPoint = Coordinate & { name: string };

type LeafletMapProps = {
  layer: LeafletMapLayer;
  me: Coordinate | null;
  path: Coordinate[];
  route: Coordinate[];
  destination: NamedPoint | null;
  waypoints: HikeWaypoint[];
  follow: boolean;
  fit: boolean;
  recenter: number;
};

const HTML = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
    .leaflet-control-zoom { display: none !important; }
    .leaflet-control-attribution { font-size: 9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function () {
      const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([0, 0], 2);
      const layers = {
        Standard: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18, attribution: 'Tiles &copy; Esri'
        }),
        Terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18, attribution: 'Tiles &copy; Esri'
        }),
        Satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18, attribution: 'Tiles &copy; Esri'
        })
      };
      Object.keys(layers).forEach(name => {
        layers[name].on('tileerror', event => {
          const url = event.tile && event.tile.src ? event.tile.src : event.url || 'unknown tile URL';
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage('Tile failed to load: ' + url);
          }
        });
      });
      let activeLayer = null;
      let hasCenteredOnLocation = false;
      let previousDestination = null;
      const overlays = L.layerGroup().addTo(map);
      const sameDestination = (a, b) => a && b &&
        a.latitude === b.latitude && a.longitude === b.longitude && a.name === b.name;

      window.update = function (state) {
        const nextLayer = layers[state.layer] || layers.Standard;
        if (activeLayer !== nextLayer) {
          if (activeLayer) map.removeLayer(activeLayer);
          activeLayer = nextLayer;
          activeLayer.addTo(map);
        }

        overlays.clearLayers();
        if (state.path.length > 0) {
          L.polyline(state.path.map(point => [point.latitude, point.longitude]), {
            color: '#2478E5', weight: 6, lineCap: 'round', lineJoin: 'round'
          }).addTo(overlays);
        }
        if (state.route.length > 0) {
          L.polyline(state.route.map(point => [point.latitude, point.longitude]), {
            color: '#E0603A', weight: 5, lineCap: 'round', lineJoin: 'round'
          }).addTo(overlays);
        }
        if (state.me) {
          L.circleMarker([state.me.latitude, state.me.longitude], {
            radius: 8, color: '#ffffff', weight: 3, fillColor: '#2478E5', fillOpacity: 1
          }).addTo(overlays);
        }
        if (state.destination) {
          const point = state.destination;
          const popup = document.createElement('span');
          popup.textContent = point.name;
          L.circleMarker([point.latitude, point.longitude], {
            radius: 8, color: '#ffffff', weight: 2, fillColor: '#E0603A', fillOpacity: 1
          }).bindPopup(popup).addTo(overlays);
        }
        state.waypoints.forEach(point => {
          const popup = document.createElement('span');
          popup.textContent = point.name;
          L.circleMarker([point.latitude, point.longitude], {
            radius: 7, color: '#ffffff', weight: 2, fillColor: '#1F3D2B', fillOpacity: 1
          }).bindPopup(popup).addTo(overlays);
        });

        if (state.me && !hasCenteredOnLocation) {
          hasCenteredOnLocation = true;
          map.setView([state.me.latitude, state.me.longitude], 17);
        } else if (state.me && state.recenter !== window.lastRecenter) {
          map.setView([state.me.latitude, state.me.longitude], Math.max(map.getZoom(), 17));
        } else if (state.me && state.follow) {
          map.panTo([state.me.latitude, state.me.longitude], { animate: true, duration: 0.3 });
        }
        window.lastRecenter = state.recenter;

        if (state.fit && state.path.length >= 2 && !window.wasFit) {
          const bounds = L.latLngBounds(state.path.map(point => [point.latitude, point.longitude]));
          map.fitBounds(bounds, { padding: [36, 36] });
        }
        window.wasFit = state.fit;

        if (state.destination && !sameDestination(state.destination, previousDestination) && !state.follow && !state.fit) {
          map.setView([state.destination.latitude, state.destination.longitude], 14);
        }
        previousDestination = state.destination;
      };
    })();
  </script>
</body>
</html>`;

export default function LeafletMap({
  layer,
  me,
  path,
  route,
  destination,
  waypoints,
  follow,
  fit,
  recenter,
}: LeafletMapProps) {
  const [loaded, setLoaded] = useState(false);
  const webViewRef = useRef<WebView | null>(null);
  const state = useMemo(
    () => ({ layer, me, path, route, destination, waypoints, follow, fit, recenter }),
    [destination, fit, follow, layer, me, path, recenter, route, waypoints]
  );

  useEffect(() => {
    if (!loaded) return;
    const serialized = JSON.stringify(state).replace(/</g, '\\u003c');
    const script = `window.update && window.update(${serialized}); true;`;
    webViewRef.current?.injectJavaScript(script);
  }, [loaded, state]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: HTML, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onLoadEnd={() => setLoaded(true)}
        onMessage={(event) => console.warn(event.nativeEvent.data)}
        onError={(event) => console.error('Leaflet map WebView failed:', event.nativeEvent)}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  webView: { flex: 1, backgroundColor: 'transparent' },
});

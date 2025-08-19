/**
 * 地圖服務模組
 * 處理所有地圖相關的操作
 */

import { Config } from './config.js';
import { Utils } from './utils.js';

export class MapService {
    constructor() {
        this.maps = new Map(); // 儲存地圖實例
        this.markerLayers = new Map(); // 儲存標記圖層
    }
    
    /**
     * 渲染主要結果地圖
     */
    renderMainResultMap(cityData, mapContainerDiv, debugInfoDiv) {
        console.log("[MapService] 渲染主要結果地圖");
        
        const mapId = 'mainResult';
        this.clearMap(mapId);
        
        if (cityData.isUniverseTheme) {
            return this.renderUniverseTheme(mapContainerDiv, debugInfoDiv);
        }
        
        return this.renderCityMap(cityData, mapContainerDiv, debugInfoDiv, mapId);
    }
    
    /**
     * 渲染城市地圖
     */
    renderCityMap(cityData, mapContainerDiv, debugInfoDiv, mapId) {
        const { selectedCity } = cityData;
        const lat = parseFloat(selectedCity.lat);
        const lng = parseFloat(selectedCity.lng);
        
        if (isNaN(lat) || isNaN(lng)) {
            console.error("[MapService] 無效的經緯度座標");
            return null;
        }
        
        // 清空容器
        mapContainerDiv.innerHTML = "";
        mapContainerDiv.classList.remove('universe-message');
        
        // 創建地圖
        const map = L.map(mapContainerDiv, {
            center: [lat, lng],
            zoom: Config.MAP_CONFIG.defaultZoom,
            maxZoom: Config.MAP_CONFIG.maxZoom
        });
        
        // 添加圖層
        L.tileLayer(Config.MAP_CONFIG.tileLayerUrl, {
            attribution: Config.MAP_CONFIG.attribution
        }).addTo(map);
        
        // 添加標記
        const marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup(`${selectedCity.name}, ${selectedCity.countryName}`);
        
        // 儲存地圖實例
        this.maps.set(mapId, map);
        
        // 更新除錯信息
        this.updateDebugInfo(debugInfoDiv, cityData);
        
        console.log(`[MapService] 地圖渲染完成: ${selectedCity.name}`);
        return map;
    }
    
    /**
     * 渲染宇宙主題
     */
    renderUniverseTheme(mapContainerDiv, debugInfoDiv) {
        console.log("[MapService] 渲染宇宙主題");
        
        mapContainerDiv.innerHTML = `
            <div class="universe-message" style="
                background: linear-gradient(45deg, #000428, #004e92, #000428);
                color: white;
                padding: 40px 20px;
                text-align: center;
                border-radius: 15px;
                box-shadow: 0 0 30px rgba(0, 68, 146, 0.3);
                min-height: 200px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                position: relative;
                overflow: hidden;
            ">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                           background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"20\" cy=\"20\" r=\"1\" fill=\"white\" opacity=\"0.8\"/><circle cx=\"80\" cy=\"40\" r=\"0.5\" fill=\"white\" opacity=\"0.6\"/><circle cx=\"40\" cy=\"70\" r=\"0.8\" fill=\"white\" opacity=\"0.9\"/><circle cx=\"70\" cy=\"80\" r=\"0.3\" fill=\"white\" opacity=\"0.4\"/><circle cx=\"90\" cy=\"20\" r=\"0.6\" fill=\"white\" opacity=\"0.7\"/></svg>') repeat;
                           animation: stars 20s linear infinite;"></div>
                <h2 style="margin: 0 0 15px 0; font-size: 1.8em; color: #87CEEB;">🌌 歡迎來到宇宙深處</h2>
                <p style="margin: 0; font-size: 1.1em; line-height: 1.6; color: #E0E0E0;">
                    在這個特殊的時刻，您的意識飄向了未知的星域...<br>
                    這裡沒有地球的地理座標，只有無盡的可能性。
                </p>
                <style>
                    @keyframes stars {
                        from { transform: translateY(0); }
                        to { transform: translateY(-100px); }
                    }
                </style>
            </div>
        `;
        
        mapContainerDiv.classList.add('universe-message');
        
        if (debugInfoDiv) {
            debugInfoDiv.innerHTML = `
                <div style="color: #87CEEB; font-style: italic;">
                    🚀 宇宙探索模式 - 座標：∞, ∞<br>
                    時區：宇宙標準時間 (CST - Cosmic Standard Time)
                </div>
            `;
        }
        
        return null;
    }
    
    /**
     * 渲染歷史地圖
     */
    renderHistoryMap(points, mapContainerDiv, debugInfoDiv, mapTitle = "歷史軌跡") {
        console.log(`[MapService] 渲染歷史地圖: ${points.length} 個點`);
        
        const mapId = 'history';
        this.clearMap(mapId);
        
        if (!points || points.length === 0) {
            mapContainerDiv.innerHTML = "<p>沒有歷史記錄可顯示</p>";
            return null;
        }
        
        // 清空容器
        mapContainerDiv.innerHTML = "";
        
        // 創建地圖
        const validPoints = points.filter(point => 
            typeof point.lat === 'number' && 
            typeof point.lon === 'number' && 
            isFinite(point.lat) && 
            isFinite(point.lon)
        );
        
        if (validPoints.length === 0) {
            mapContainerDiv.innerHTML = "<p>沒有有效的地理座標</p>";
            return null;
        }
        
        // 計算邊界
        const bounds = this.calculateBounds(validPoints);
        
        // 創建地圖
        const map = L.map(mapContainerDiv);
        
        // 添加圖層
        L.tileLayer(Config.MAP_CONFIG.tileLayerUrl, {
            attribution: Config.MAP_CONFIG.attribution
        }).addTo(map);
        
        // 創建標記圖層組
        const markerLayerGroup = L.layerGroup().addTo(map);
        
        // 添加標記和路線
        this.addHistoryMarkersAndRoute(validPoints, map, markerLayerGroup);
        
        // 調整視圖
        if (validPoints.length === 1) {
            map.setView([validPoints[0].lat, validPoints[0].lon], 10);
        } else {
            map.fitBounds(bounds, { padding: [10, 10] });
        }
        
        // 儲存實例
        this.maps.set(mapId, map);
        this.markerLayers.set(mapId, markerLayerGroup);
        
        // 更新除錯信息
        if (debugInfoDiv) {
            debugInfoDiv.innerHTML = `
                <strong>${mapTitle}</strong><br>
                顯示 ${validPoints.length} 個有效位置<br>
                <small>點擊標記查看詳細信息 | 拖拽地圖探索</small>
            `;
        }
        
        return map;
    }
    
    /**
     * 渲染全域地圖
     */
    renderGlobalMap(points, mapContainerDiv, debugInfoDiv, mapTitle = "全域地圖") {
        console.log(`[MapService] 渲染全域地圖: ${points.length} 個點`);
        
        const mapId = 'global';
        this.clearMap(mapId);
        
        if (!points || points.length === 0) {
            mapContainerDiv.innerHTML = "<p>今日暫無全域記錄</p>";
            return null;
        }
        
        // 清空容器
        mapContainerDiv.innerHTML = "";
        
        // 過濾有效點
        const validPoints = points.filter(point => 
            typeof point.lat === 'number' && 
            typeof point.lon === 'number' && 
            isFinite(point.lat) && 
            isFinite(point.lon) &&
            point.lat !== 0 && point.lon !== 0 // 排除宇宙主題的 0,0 座標
        );
        
        if (validPoints.length === 0) {
            mapContainerDiv.innerHTML = "<p>今日暫無有效的地理記錄</p>";
            return null;
        }
        
        // 創建地圖
        const map = L.map(mapContainerDiv, {
            center: [20, 0], // 世界中心
            zoom: 2,
            maxZoom: Config.MAP_CONFIG.maxZoom
        });
        
        // 添加圖層
        L.tileLayer(Config.MAP_CONFIG.tileLayerUrl, {
            attribution: Config.MAP_CONFIG.attribution
        }).addTo(map);
        
        // 創建標記圖層組
        const markerLayerGroup = L.layerGroup().addTo(map);
        
        // 添加聚合標記
        this.addClusteredMarkers(validPoints, markerLayerGroup);
        
        // 調整視圖以包含所有點
        if (validPoints.length > 1) {
            const bounds = this.calculateBounds(validPoints);
            map.fitBounds(bounds, { padding: [20, 20] });
        }
        
        // 儲存實例
        this.maps.set(mapId, map);
        this.markerLayers.set(mapId, markerLayerGroup);
        
        // 更新除錯信息
        if (debugInfoDiv) {
            const uniqueCities = new Set(validPoints.map(p => `${p.city}, ${p.country}`)).size;
            debugInfoDiv.innerHTML = `
                <strong>${mapTitle}</strong><br>
                顯示 ${validPoints.length} 筆記錄，${uniqueCities} 個不同城市<br>
                <small>點擊標記查看詳細信息</small>
            `;
        }
        
        return map;
    }
    
    /**
     * 添加歷史標記和路線
     */
    addHistoryMarkersAndRoute(points, map, markerLayerGroup) {
        // 按時間排序
        const sortedPoints = [...points].sort((a, b) => a.timestamp - b.timestamp);
        
        // 添加路線
        if (sortedPoints.length > 1) {
            const routePoints = sortedPoints.map(point => [point.lat, point.lon]);
            L.polyline(routePoints, {
                color: '#3388ff',
                weight: 3,
                opacity: 0.7
            }).addTo(markerLayerGroup);
        }
        
        // 添加標記
        sortedPoints.forEach((point, index) => {
            const isFirst = index === 0;
            const isLast = index === sortedPoints.length - 1;
            
            let markerColor = '#3388ff';
            let markerIcon = '📍';
            
            if (isFirst) {
                markerColor = '#28a745';
                markerIcon = '🏁';
            } else if (isLast) {
                markerColor = '#dc3545';
                markerIcon = '🎯';
            }
            
            const marker = L.marker([point.lat, point.lon], {
                icon: L.divIcon({
                    html: `<div style="background-color: ${markerColor}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 12px;">${markerIcon}</div>`,
                    className: 'custom-marker',
                    iconSize: [30, 30]
                })
            }).addTo(markerLayerGroup);
            
            // 添加彈出視窗
            const popupContent = `
                <strong>${point.city_zh || point.city}, ${point.country_zh || point.country}</strong><br>
                時間: ${point.time}<br>
                ${point.story ? `<em>${point.story.substring(0, 100)}...</em>` : ''}
            `;
            
            marker.bindPopup(popupContent);
        });
    }
    
    /**
     * 添加聚合標記
     */
    addClusteredMarkers(points, markerLayerGroup) {
        // 按城市分組
        const cityGroups = {};
        
        points.forEach(point => {
            const cityKey = `${point.city}_${point.country}`;
            if (!cityGroups[cityKey]) {
                cityGroups[cityKey] = {
                    city: point.city,
                    country: point.country,
                    city_zh: point.city_zh,
                    country_zh: point.country_zh,
                    lat: point.lat,
                    lon: point.lon,
                    count: 0,
                    users: new Set()
                };
            }
            cityGroups[cityKey].count++;
            cityGroups[cityKey].users.add(point.userDisplayName || '匿名用戶');
        });
        
        // 為每個城市添加標記
        Object.values(cityGroups).forEach(group => {
            const marker = L.marker([group.lat, group.lon], {
                icon: L.divIcon({
                    html: `<div style="background-color: #007bff; color: white; border-radius: 50%; width: ${Math.min(40, 20 + group.count * 2)}px; height: ${Math.min(40, 20 + group.count * 2)}px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">${group.count}</div>`,
                    className: 'cluster-marker',
                    iconSize: [Math.min(40, 20 + group.count * 2), Math.min(40, 20 + group.count * 2)]
                })
            }).addTo(markerLayerGroup);
            
            const popupContent = `
                <strong>${group.city_zh || group.city}, ${group.country_zh || group.country}</strong><br>
                訪問次數: ${group.count}<br>
                訪問用戶: ${Array.from(group.users).join(', ')}
            `;
            
            marker.bindPopup(popupContent);
        });
    }
    
    /**
     * 計算邊界
     */
    calculateBounds(points) {
        const lats = points.map(p => p.lat);
        const lons = points.map(p => p.lon);
        
        return [
            [Math.min(...lats), Math.min(...lons)],
            [Math.max(...lats), Math.max(...lons)]
        ];
    }
    
    /**
     * 清除地圖
     */
    clearMap(mapId) {
        if (this.maps.has(mapId)) {
            this.maps.get(mapId).remove();
            this.maps.delete(mapId);
        }
        
        if (this.markerLayers.has(mapId)) {
            this.markerLayers.delete(mapId);
        }
    }
    
    /**
     * 更新除錯信息
     */
    updateDebugInfo(debugInfoDiv, cityData) {
        if (!debugInfoDiv) return;
        
        const { selectedCity, requestBody, userLocalDate, latitudeDescription } = cityData;
        
        // 防護性檢查，避免 undefined 錯誤
        const recordedAt = userLocalDate ? userLocalDate.toLocaleString('zh-TW') : '未知時間';
        const latStr = Utils.formatNumber(selectedCity?.lat);
        const lngStr = Utils.formatNumber(selectedCity?.lng);
        const utcOffsetStr = Utils.formatNumber(requestBody?.targetUTCOffset);
        
        debugInfoDiv.innerHTML = `
            (記錄於: ${recordedAt})<br>
            (目標城市緯度: ${latStr}°, 經度: ${lngStr}°)<br>
            (目標 UTC 偏移: ${utcOffsetStr}, 時區: ${selectedCity?.timezone?.timeZoneId || '未知'})<br>
            (緯度偏好: ${latitudeDescription || '未知偏好'})
        `;
    }
    
    /**
     * 清理所有地圖
     */
    cleanup() {
        this.maps.forEach(map => map.remove());
        this.maps.clear();
        this.markerLayers.clear();
    }
}

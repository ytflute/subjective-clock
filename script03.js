document.addEventListener('DOMContentLoaded', async () => {
    // 從 window 中獲取 Firebase SDK 函數
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, setDoc, getDoc, limit, 
        setLogLevel
    } = window.firebaseSDK;

    // DOM 元素獲取
    const findCityButton = document.getElementById('findCityButton');
    const resultTextDiv = document.getElementById('resultText');
    const countryFlagImg = document.getElementById('countryFlag');
    const mapContainerDiv = document.getElementById('mapContainer'); 
    const debugInfoSmall = document.getElementById('debugInfo');

    const userNameInput = document.getElementById('userName');
    const setUserNameButton = document.getElementById('setUserNameButton');
    const currentUserIdSpan = document.getElementById('currentUserId'); 
    const currentUserDisplayNameSpan = document.getElementById('currentUserDisplayName');
    
    const historyListUl = document.getElementById('historyList');
    const historyMapContainerDiv = document.getElementById('historyMapContainer'); 
    const historyDebugInfoSmall = document.getElementById('historyDebugInfo');
    const refreshHistoryButton = document.getElementById('refreshHistoryButton');

    const globalDateInput = document.getElementById('globalDate');
    const refreshGlobalMapButton = document.getElementById('refreshGlobalMapButton');
    const globalTodayMapContainerDiv = document.getElementById('globalTodayMapContainer'); 
    const globalTodayDebugInfoSmall = document.getElementById('globalTodayDebugInfo');

    // 全域變數
    let citiesData = [];
    let db, auth;
    let currentDataIdentifier = null; 
    let rawUserDisplayName = ""; 
    let clockLeafletMap = null; 
    let globalLeafletMap = null; 
    let globalMarkerLayerGroup = null; 
    let historyLeafletMap = null;
    let historyMarkerLayerGroup = null;

    // Firebase 設定
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id-worldclock-history'; 
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    const firebaseConfig = {
      apiKey: "AIzaSyC5-AKkFhx9olWx57bdB985IwZA9DpH66o", 
      authDomain: "subjective-clock.firebaseapp.com",
      projectId: "subjective-clock",
      storageBucket: "subjective-clock.appspot.com", 
      messagingSenderId: "452566766153",
      appId: "1:452566766153:web:522312f3ed5c81403f2598", 
      measurementId: "G-QZ6440LZEM" 
    };
    
    console.log("DOM 已載入。開始初始化 Firebase...");

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) { 
        console.error("Firebase 設定不完整!");
        alert("Firebase 設定不完整，應用程式無法初始化 Firebase。");
        currentUserIdSpan.textContent = "Firebase 設定錯誤";
        return; 
    }

    try {
        setLogLevel('debug'); 
        const app = initializeApp(firebaseConfig); 
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase 初始化成功。App ID (用於路徑前綴):", appId, "Project ID (來自設定):", firebaseConfig.projectId);
    } catch (e) {
        console.error("Firebase 初始化失敗:", e);
        currentUserIdSpan.textContent = "Firebase 初始化失敗";
        alert("Firebase 初始化失敗，部分功能可能無法使用。");
        return; 
    }

    if (globalDateInput) {
        globalDateInput.valueAsDate = new Date();
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Firebase 會話已認證 (Auth UID):", user.uid, "匿名:", user.isAnonymous);
            const lastUsedName = localStorage.getItem('worldClockUserName');
            if (lastUsedName && !currentDataIdentifier) { 
                console.log("從 localStorage 恢復上次使用的名稱:", lastUsedName);
                userNameInput.value = lastUsedName;
                await setOrLoadUserName(lastUsedName, false); 
            } else if (currentDataIdentifier) {
                if (citiesData.length > 0) {
                    console.log("Firebase 已認證且 currentDataIdentifier 已設定，啟用 findCityButton (如果城市數據已載入)。");
                    findCityButton.disabled = false;
                }
            }
            // *** 修改點：頁面首次載入時，如果分頁是 active，則載入其內容 ***
            // 這個邏輯移到 openTab 中，確保在分頁確實可見後才執行
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const activeTabId = activeTab.id;
                if (activeTabId === 'HistoryTab' && currentDataIdentifier) {
                    loadHistory();
                } else if (activeTabId === 'GlobalTodayMapTab') {
                    loadGlobalTodayMap();
                }
            }

        } else {
            console.log("Firebase 會話未認證，嘗試登入...");
            currentUserIdSpan.textContent = "認證中..."; 
            findCityButton.disabled = true; 
            if (initialAuthToken) {
                console.log("嘗試使用 initialAuthToken 登入...");
                signInWithCustomToken(auth, initialAuthToken)
                    .catch((error) => {
                        console.error("使用 initialAuthToken 登入失敗, 嘗試匿名登入:", error.code, error.message);
                        signInAnonymously(auth).catch(anonError => {
                            console.error("匿名登入失敗:", anonError);
                            currentUserIdSpan.textContent = "認證失敗";
                            alert("Firebase 認證失敗，無法儲存歷史記錄。");
                        });
                    });
            } else {
                 console.log("未提供 initialAuthToken, 嘗試匿名登入...");
                 signInAnonymously(auth).catch(error => {
                    console.error("匿名登入失敗:", error);
                    currentUserIdSpan.textContent = "認證失敗";
                    alert("Firebase 認證失敗，無法儲存歷史記錄。");
                });
            }
        }
    });
    
    function sanitizeNameToFirestoreId(name) { /* ... (與前一版本相同) ... */ }
    async function setOrLoadUserName(name, showAlert = true) { /* ... (與前一版本相同) ... */ }
    setUserNameButton.addEventListener('click', async () => { /* ... (與前一版本相同) ... */ });
    async function displayLastRecordForCurrentUser() { /* ... (與前一版本相同，確保日誌清晰) ... */ }
    fetch('cities_data.json').then(/* ... */).catch(/* ... */);
    findCityButton.addEventListener('click', async () => { /* ... (與前一版本相同) ... */ });
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }
    function parseOffsetString(offsetStr) { /* ... (與前一版本相同) ... */ }
    function getCityUTCOffsetHours(ianaTimeZone) { /* ... (與前一版本相同) ... */ }
    const timezoneOffsetCache = new Map();
    function clearPreviousResults() { /* ... (與前一版本相同) ... */ }
    async function findMatchingCity() { /* ... (與前一版本相同，確保是 async) ... */ }
    async function saveHistoryRecord(recordData) { /* ... (與前一版本相同) ... */ }
    async function saveToGlobalDailyRecord(recordData) { /* ... (與前一版本相同) ... */ }

    async function loadHistory() {
        console.log("[loadHistory] 函數被呼叫。currentDataIdentifier:", currentDataIdentifier);
        if (!currentDataIdentifier) { 
            historyListUl.innerHTML = '<li>請先設定你的顯示名稱以查看歷史記錄。</li>';
            if (historyLeafletMap) {
                historyLeafletMap.remove(); 
                historyLeafletMap = null;   
            }
            historyMapContainerDiv.innerHTML = '<p>設定名稱後，此處將顯示您的個人歷史地圖。</p>'; 
            return;
        }
        historyListUl.innerHTML = '<li>載入歷史記錄中...</li>';
        if (!historyLeafletMap) { 
            historyMapContainerDiv.innerHTML = '<p>載入個人歷史地圖中...</p>';
        } else if (historyMarkerLayerGroup) {
            historyMarkerLayerGroup.clearLayers(); 
        }
        historyDebugInfoSmall.textContent = "";

        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        const q = query(historyCollectionRef, orderBy("recordedAt", "desc")); 

        try {
            const querySnapshot = await getDocs(q);
            historyListUl.innerHTML = ''; 
            const historyPoints = []; 

            if (querySnapshot.empty) {
                historyListUl.innerHTML = '<li>尚無歷史記錄。</li>';
                renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history'); 
                return;
            }

            querySnapshot.forEach((doc) => {
                const record = doc.data();
                const li = document.createElement('li');
                const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '日期未知';
                
                const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

                li.innerHTML = `<span class="date">${recordDate}</span> - 
                                當地時間: <span class="time">${record.localTime || '未知'}</span> - 
                                同步於: <span class="location">${cityDisplay || '未知城市'}, ${countryDisplay || '未知國家'}</span>`;
                historyListUl.appendChild(li);

                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    historyPoints.push({ 
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${recordDate} @ ${cityDisplay}, ${countryDisplay}` 
                    });
                } else if (record.city !== "未知星球Unknown Planet") { 
                    console.warn("跳過個人歷史記錄中經緯度無效的點:", record);
                }
            });
            renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history');
        } catch (e) {
            console.error("讀取歷史記錄失敗:", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
            historyMapContainerDiv.innerHTML = '<p>讀取歷史記錄時發生錯誤。</p>'; 
            historyDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    async function loadGlobalTodayMap() {
        console.log("[loadGlobalTodayMap] 函數被呼叫。");
        if (!auth.currentUser) { 
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>Firebase 認證中，請稍候...</p>';
            return;
        }
        
        const selectedDateValue = globalDateInput.value; 
        if (!selectedDateValue) {
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>請先選擇一個日期。</p>';
            return;
        }
        
        if (!globalLeafletMap) {
            globalTodayMapContainerDiv.innerHTML = '<p>載入今日眾人地圖中...</p>';
        } else if (globalMarkerLayerGroup) {
             globalMarkerLayerGroup.clearLayers(); 
        }

        globalTodayDebugInfoSmall.textContent = `查詢日期: ${selectedDateValue}`;
        console.log(`[loadGlobalTodayMap] 查詢日期: ${selectedDateValue}`);

        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        const q = query(globalCollectionRef, where("recordedDateString", "==", selectedDateValue));

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[loadGlobalTodayMap] Firestore 查詢完成。找到 ${querySnapshot.size} 筆記錄。`);
            const globalPoints = []; 

            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    const record = doc.data();
                    if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                        typeof record.longitude === 'number' && isFinite(record.longitude)) {
                        
                        const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                        const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;
                        const userDisplay = record.userDisplayName || record.dataIdentifier || "匿名";

                        globalPoints.push({
                            lat: record.latitude,
                            lon: record.longitude,
                            title: `${userDisplay} @ ${cityDisplay}, ${countryDisplay}` 
                        });
                    } else {
                        console.warn("跳過全域記錄中經緯度無效的點 (或宇宙記錄):", record);
                    }
                });
            }
            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, `日期 ${selectedDateValue} 的眾人甦醒地圖`, 'global');

        } catch (e) {
            console.error("讀取全域每日記錄失敗:", e);
            globalTodayMapContainerDiv.innerHTML = '<p>讀取全域地圖資料失敗。</p>'; 
            globalTodayDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    function renderPointsOnMap(points, mapDivElement, debugDivElement, mapTitle = "地圖", mapType = 'global') { 
        console.log(`[renderPointsOnMap] 準備渲染地圖: "${mapTitle}", 點數量: ${points ? points.length : 0}, 地圖類型: ${mapType}`);
        
        let currentMapInstance;
        let currentMarkerLayerGroup;

        if (mapType === 'global') {
            currentMapInstance = globalLeafletMap;
            currentMarkerLayerGroup = globalMarkerLayerGroup;
        } else if (mapType === 'history') {
            currentMapInstance = historyLeafletMap;
            currentMarkerLayerGroup = historyMarkerLayerGroup;
        } else {
            console.error("未知的地圖類型:", mapType);
            return;
        }

        // 初始化地圖（如果尚未初始化）
        if (!currentMapInstance) {
            console.log(`[renderPointsOnMap] 初始化新的 Leaflet 地圖實例到 ${mapDivElement.id}`);
            mapDivElement.innerHTML = ''; 
            currentMapInstance = L.map(mapDivElement).setView([20, 0], 2); 
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd', maxZoom: 18, minZoom: 2   
            }).addTo(currentMapInstance);
            currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance); 

            if (mapType === 'global') {
                globalLeafletMap = currentMapInstance;
                globalMarkerLayerGroup = currentMarkerLayerGroup;
            } else if (mapType === 'history') {
                historyLeafletMap = currentMapInstance;
                historyMarkerLayerGroup = currentMarkerLayerGroup;
            }
        } else {
            console.log(`[renderPointsOnMap] 清除 ${mapDivElement.id} 上的舊標記。`);
            if (currentMarkerLayerGroup) {
                currentMarkerLayerGroup.clearLayers();
            } else { 
                 currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);
                 if (mapType === 'global') globalMarkerLayerGroup = currentMarkerLayerGroup;
                 else if (mapType === 'history') historyMarkerLayerGroup = currentMarkerLayerGroup;
            }
            // *** 修改點：確保地圖容器在 Leaflet 操作前是正確的 ***
            if (mapDivElement.innerHTML.includes("<p>")) { // 如果容器被文字佔據
                 mapDivElement.innerHTML = ''; // 清空文字
            }
            // 確保 Leaflet 地圖的 DOM 元素仍在 mapDivElement 中
            if (currentMapInstance.getContainer().parentNode !== mapDivElement) {
                 mapDivElement.appendChild(currentMapInstance.getContainer());
            }
            currentMapInstance.invalidateSize(); 
        }
        
        if (!points || points.length === 0) {
            if (currentMarkerLayerGroup) currentMarkerLayerGroup.clearLayers(); 
            console.log("[renderPointsOnMap] 沒有點可以渲染，在地圖容器內顯示提示。");
            mapDivElement.innerHTML = `<p style="text-align:center; padding-top: 20px;">${mapTitle}：尚無有效座標點可顯示。</p>`;
            if(debugDivElement) debugDivElement.textContent = `${mapTitle}：尚無有效座標點可顯示。`;
            return;
        }
        
        // 如果之前因為沒有點而設定了 innerHTML，現在需要清空它，以便 Leaflet 正確渲染
        if (mapDivElement.children.length > 0 && mapDivElement.children[0].tagName === 'P') {
            mapDivElement.innerHTML = '';
            // 如果清空了，可能需要重新附加地圖容器，或者確保地圖實例仍然關聯
            // 實際上，更好的做法是 Leaflet 初始化後，就不再用 innerHTML 修改 mapDivElement
        }


        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        let validPointsForBboxCount = 0;

        points.forEach(point => {
            if (typeof point.lat === 'number' && isFinite(point.lat) && typeof point.lon === 'number' && isFinite(point.lon)) {
                const marker = L.circleMarker([point.lat, point.lon], {
                    color: 'red', fillColor: '#f03', fillOpacity: 0.7, radius: 6 
                }).addTo(currentMarkerLayerGroup);
                if (point.title) {
                    marker.bindTooltip(point.title);
                }
                minLat = Math.min(minLat, point.lat);
                maxLat = Math.max(maxLat, point.lat);
                minLon = Math.min(minLon, point.lon);
                maxLon = Math.max(maxLon, point.lon);
                validPointsForBboxCount++;
            }
        });

        if (validPointsForBboxCount > 0) {
            const latDiff = maxLat - minLat;
            const lonDiff = maxLon - minLon;
            const defaultMargin = 1.0; 
            const latMargin = latDiff < 0.1 ? defaultMargin : latDiff * 0.2 + 0.1; 
            const lonMargin = lonDiff < 0.1 ? defaultMargin : lonDiff * 0.2 + 0.1; 

            let south = Math.max(-85, minLat - latMargin); 
            let west = Math.max(-180, minLon - lonMargin);
            let north = Math.min(85, maxLat + latMargin);
            let east = Math.min(180, maxLon + lonMargin);
            
            if (west >= east) { 
                const centerLon = validPointsForBboxCount === 1 ? minLon : (minLon + maxLon) / 2; 
                west = centerLon - defaultMargin / 2; 
                east = centerLon + defaultMargin / 2;
            }
            if (south >= north) { 
                const centerLat = validPointsForBboxCount === 1 ? minLat : (minLat + maxLat) / 2; 
                south = centerLat - defaultMargin / 2;
                north = centerLat + defaultMargin / 2;
            }
            west = Math.max(-180, Math.min(west, 179.9999)); 
            east = Math.min(180, Math.max(east, west + 0.0001)); 
            south = Math.max(-85, Math.min(south, 84.9999));   
            north = Math.min(85, Math.max(north, south + 0.0001));  

            console.log(`[renderPointsOnMap] (${mapTitle}) 計算出的 BBOX:`, `${west},${south},${east},${north}`);
            currentMapInstance.fitBounds([[south, west], [north, east]], {padding: [20,20]}); 
        } else if (currentMapInstance) { 
             currentMapInstance.setView([20, 0], 2); 
        }

        if(debugDivElement) debugDivElement.textContent = `${mapTitle} - 顯示 ${validPointsForBboxCount} 個有效位置。`;
    }

    window.openTab = function(evt, tabName, triggeredBySetName = false) {
        console.log(`[openTab] 切換到分頁: ${tabName}, 事件觸發: ${!!evt}, 設定名稱觸發: ${triggeredBySetName}`);
        let i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tab-button");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].classList.remove("active"); 
        }
        const currentTabDiv = document.getElementById(tabName);
        if (currentTabDiv) {
            currentTabDiv.style.display = "block";
             console.log(`[openTab] ${tabName} 設為 display: block`);
        } else {
            console.warn(`[openTab] 找不到 ID 為 ${tabName} 的分頁內容元素。`);
        }
        
        const targetButtonId = `tabButton-${tabName}`; 
        const targetButton = document.getElementById(targetButtonId);
        if (targetButton) {
            targetButton.classList.add("active");
        } else if (evt && evt.currentTarget) { 
             evt.currentTarget.classList.add("active");
        }

        // *** 修改點：確保在分頁內容變為可見後，再嘗試 invalidateSize 和載入資料 ***
        setTimeout(() => {
            if (tabName === 'HistoryTab') {
                // 確保地圖容器可見再操作
                if (historyMapContainerDiv.offsetParent !== null) {
                    if (historyLeafletMap) {
                        console.log("[openTab] HistoryTab is visible, invalidating map size.");
                        historyLeafletMap.invalidateSize();
                    }
                    // 只有在不是由 setUserName 觸發，且使用者已登入並設定了名稱時才載入歷史
                    if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) {
                        console.log("[openTab] 呼叫 loadHistory for HistoryTab.");
                        loadHistory();
                    }
                } else {
                     console.log("[openTab] HistoryTab 容器不可見，延遲載入/invalidate。");
                }
            } else if (tabName === 'GlobalTodayMapTab') {
                 // 確保地圖容器可見再操作
                if (globalTodayMapContainerDiv.offsetParent !== null) {
                    if (globalLeafletMap) {
                        console.log("[openTab] GlobalTodayMapTab is visible, invalidating map size.");
                        globalLeafletMap.invalidateSize();
                    }
                    // 只有在不是由 setUserName 觸發，且使用者已登入時才載入全域地圖
                    if (auth.currentUser && !triggeredBySetName) {
                         if (globalDateInput && !globalDateInput.value) { 
                            globalDateInput.valueAsDate = new Date();
                        }
                        console.log("[openTab] 呼叫 loadGlobalTodayMap for GlobalTodayMapTab.");
                        loadGlobalTodayMap();
                    }
                } else {
                    console.log("[openTab] GlobalTodayMapTab 容器不可見，延遲載入/invalidate。");
                }
            }
        }, 50); // 稍微增加延遲，給 DOM 更多反應時間
    }
});

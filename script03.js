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
                    findCityButton.disabled = false;
                }
                // 頁面載入時，如果分頁是活動的，則載入
                if (document.getElementById('HistoryTab').classList.contains('active')) {
                     loadHistory(); 
                }
                if (document.getElementById('GlobalTodayMapTab') && document.getElementById('GlobalTodayMapTab').classList.contains('active')) {
                    loadGlobalTodayMap();
                }
            } else if (document.getElementById('GlobalTodayMapTab') && document.getElementById('GlobalTodayMapTab').classList.contains('active')) {
                // 即使沒有 currentDataIdentifier，也嘗試載入全域地圖（它不依賴使用者名稱）
                loadGlobalTodayMap();
            }
        } else {
            console.log("Firebase 會話未認證，嘗試登入...");
            currentUserIdSpan.textContent = "認證中..."; 
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
    async function displayLastRecordForCurrentUser() { /* ... (與前一版本相同) ... */ }
    fetch('cities_data.json').then(/* ... */).catch(/* ... */);
    findCityButton.addEventListener('click', findMatchingCity);
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }
    function parseOffsetString(offsetStr) { /* ... (與前一版本相同) ... */ }
    function getCityUTCOffsetHours(ianaTimeZone) { /* ... (與前一版本相同) ... */ }
    const timezoneOffsetCache = new Map();
    function clearPreviousResults() { /* ... (與前一版本相同) ... */ }
    async function findMatchingCity() { /* ... (與前一版本相同) ... */ }
    async function saveHistoryRecord(recordData) { /* ... (與前一版本相同) ... */ }
    async function saveToGlobalDailyRecord(recordData) { /* ... (與前一版本相同) ... */ }

    async function loadHistory() {
        if (!currentDataIdentifier) { 
            historyListUl.innerHTML = '<li>請先設定你的顯示名稱以查看歷史記錄。</li>';
            if (historyLeafletMap) { // 如果地圖已初始化，清空標記並顯示提示
                if(historyMarkerLayerGroup) historyMarkerLayerGroup.clearLayers();
                historyMapContainerDiv.innerHTML = '<p>設定名稱後，此處將顯示您的個人歷史地圖。</p>'; 
            } else { // 如果地圖未初始化，直接設定提示
                historyMapContainerDiv.innerHTML = '<p>設定名稱後，此處將顯示您的個人歷史地圖。</p>'; 
            }
            return;
        }
        historyListUl.innerHTML = '<li>載入歷史記錄中...</li>';
        // *** 修改點：不要用 innerHTML 清空地圖容器，除非地圖未初始化 ***
        // historyMapContainerDiv.innerHTML = '<p>載入個人歷史地圖中...</p>'; 
        if (!historyLeafletMap) { // 只有在 Leaflet 地圖還沒建立時才設定 "載入中"
            historyMapContainerDiv.innerHTML = '<p>載入個人歷史地圖中...</p>';
        }
        historyDebugInfoSmall.textContent = "";

        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        const q = query(historyCollectionRef, orderBy("recordedAt", "desc")); 

        try {
            const querySnapshot = await getDocs(q);
            historyListUl.innerHTML = ''; 
            if (querySnapshot.empty) {
                historyListUl.innerHTML = '<li>尚無歷史記錄。</li>';
                // *** 修改點：如果地圖已初始化，清空標記並顯示提示 ***
                if (historyLeafletMap) {
                    if(historyMarkerLayerGroup) historyMarkerLayerGroup.clearLayers();
                    historyMapContainerDiv.innerHTML = '<p>尚無歷史記錄可顯示於地圖。</p>';
                } else {
                     historyMapContainerDiv.innerHTML = '<p>尚無歷史記錄可顯示於地圖。</p>';
                }
                return;
            }

            const historyPoints = []; 
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
        if (!auth.currentUser) { 
            // *** 修改點：不要用 innerHTML 清空地圖容器 ***
            // globalTodayMapContainerDiv.innerHTML = '<p>Firebase 認證中，請稍候...</p>';
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>Firebase 認證中，請稍候...</p>';
            return;
        }
        
        const selectedDateValue = globalDateInput.value; 
        if (!selectedDateValue) {
            // *** 修改點：不要用 innerHTML 清空地圖容器 ***
            // globalTodayMapContainerDiv.innerHTML = '<p>請先選擇一個日期。</p>';
             if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>請先選擇一個日期。</p>';
            return;
        }
        
        // *** 修改點：不要用 innerHTML 清空地圖容器 ***
        // globalTodayMapContainerDiv.innerHTML = '<p>載入今日眾人地圖中...</p>';
        if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>載入今日眾人地圖中...</p>';
        else if (globalMarkerLayerGroup) globalMarkerLayerGroup.clearLayers(); // 如果地圖已存在，先清除標記

        globalTodayDebugInfoSmall.textContent = `查詢日期: ${selectedDateValue}`;
        console.log(`[loadGlobalTodayMap] 查詢日期: ${selectedDateValue}`);

        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        const q = query(globalCollectionRef, where("recordedDateString", "==", selectedDateValue));

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[loadGlobalTodayMap] Firestore 查詢完成。找到 ${querySnapshot.size} 筆記錄。`);
            
            const globalPoints = []; // 移到這裡，確保每次查詢都重新收集
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
            // 即使 querySnapshot 為空，也要呼叫 renderPointsOnMap 來顯示 "無記錄"
            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, `日期 ${selectedDateValue} 的眾人甦醒地圖`, 'global');

        } catch (e) {
            console.error("讀取全域每日記錄失敗:", e);
            globalTodayMapContainerDiv.innerHTML = '<p>讀取全域地圖資料失敗。</p>'; // 出錯時可以清空
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
            mapDivElement.innerHTML = ''; // 確保容器在初始化前是空的
            currentMapInstance = L.map(mapDivElement).setView([20, 0], 2); 
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd', maxZoom: 18, minZoom: 2   
            }).addTo(currentMapInstance);
            currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance); 

            // 更新全域的地圖實例和圖層組引用
            if (mapType === 'global') {
                globalLeafletMap = currentMapInstance;
                globalMarkerLayerGroup = currentMarkerLayerGroup;
            } else if (mapType === 'history') {
                historyLeafletMap = currentMapInstance;
                historyMarkerLayerGroup = currentMarkerLayerGroup;
            }
        } else {
            // 如果地圖已存在，先清除舊的標記
            console.log(`[renderPointsOnMap] 清除 ${mapDivElement.id} 上的舊標記。`);
            if (currentMarkerLayerGroup) {
                currentMarkerLayerGroup.clearLayers();
            } else { // 以防萬一 marker group 未初始化
                 currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);
                 if (mapType === 'global') globalMarkerLayerGroup = currentMarkerLayerGroup;
                 else if (mapType === 'history') historyMarkerLayerGroup = currentMarkerLayerGroup;
            }
            // 確保地圖容器沒有被意外清空
            if (currentMapInstance.getContainer().parentNode !== mapDivElement) {
                 mapDivElement.innerHTML = ''; 
                 mapDivElement.appendChild(currentMapInstance.getContainer());
            }
            currentMapInstance.invalidateSize(); // 確保地圖尺寸正確
        }
        
        // 處理標記點
        if (!points || points.length === 0) {
            mapDivElement.innerHTML = `<p>${mapTitle}：尚無有效座標點可顯示。</p>`; // 在地圖容器內顯示提示
            if(debugDivElement) debugDivElement.textContent = "";
            console.log("[renderPointsOnMap] 沒有點可以渲染。");
            return;
        }
        
        // 如果 mapDivElement 之前被設為 <p>...</p>，Leaflet 可能會出錯，確保在添加標記前它是 Leaflet 容器
        // 這一檢查可能多餘，因為如果 !currentMapInstance，innerHTML 已被清空
        if (mapDivElement.children.length > 0 && !(mapDivElement.children[0].classList && mapDivElement.children[0].classList.contains('leaflet-map-pane'))) {
             mapDivElement.innerHTML = ''; // 如果裡面不是 Leaflet 結構，清空它
             // 這可能意味著地圖需要重新初始化，但上面的邏輯應該已經處理了
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

    // renderHistoryMap 函數現在將使用通用的 renderPointsOnMap
    // function renderHistoryMap(points) { // 這是舊的，已被取代
    //     console.log("renderHistoryMap 被呼叫，但地圖功能已移除。Points:", points);
    //     historyMapContainerDiv.innerHTML = "<p>地圖軌跡顯示功能已暫時移除。</p>"; 
    //     return; 
    // }

    window.openTab = function(evt, tabName, triggeredBySetName = false) {
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
        }
        
        const targetButtonId = `tabButton-${tabName}`; 
        const targetButton = document.getElementById(targetButtonId);
        if (targetButton) {
            targetButton.classList.add("active");
        } else if (evt && evt.currentTarget) { 
             evt.currentTarget.classList.add("active");
        }

        // *** 修改點：確保在切換到分頁時，如果地圖容器可見且地圖已初始化，則呼叫 invalidateSize ***
        // *** 並確保在正確的時機呼叫 loadHistory 或 loadGlobalTodayMap ***
        if (tabName === 'HistoryTab') {
            if (historyLeafletMap && historyMapContainerDiv.offsetParent !== null) { // 檢查容器是否可見
                console.log("[openTab] HistoryTab is visible, invalidating map size.");
                historyLeafletMap.invalidateSize();
            }
            if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) {
                loadHistory(); // loadHistory 內部會呼叫 renderPointsOnMap('history')
            }
        } else if (tabName === 'GlobalTodayMapTab') {
            if (globalLeafletMap && globalTodayMapContainerDiv.offsetParent !== null) { // 檢查容器是否可見
                console.log("[openTab] GlobalTodayMapTab is visible, invalidating map size.");
                globalLeafletMap.invalidateSize();
            }
            if (auth.currentUser && !triggeredBySetName) { // Global map 不依賴 currentDataIdentifier
                 if (globalDateInput && !globalDateInput.value) { 
                    globalDateInput.valueAsDate = new Date();
                }
                loadGlobalTodayMap(); // loadGlobalTodayMap 內部會呼叫 renderPointsOnMap('global')
            }
        }
    }
});

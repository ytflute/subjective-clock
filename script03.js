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
            // 頁面首次載入時，如果對應分頁是 active，則載入其內容
            if (document.getElementById('HistoryTab').classList.contains('active') && currentDataIdentifier) {
                 loadHistory(); 
            }
            if (document.getElementById('GlobalTodayMapTab') && document.getElementById('GlobalTodayMapTab').classList.contains('active')) {
                loadGlobalTodayMap();
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
    
    function sanitizeNameToFirestoreId(name) {
        if (!name || typeof name !== 'string') return null; 
        let sanitized = name.toLowerCase().trim();
        sanitized = sanitized.replace(/\s+/g, '_'); 
        sanitized = sanitized.replace(/[^a-z0-9_.-]/g, ''); 
        if (sanitized === "." || sanitized === "..") {
            sanitized = `name_${sanitized.replace(/\./g, '')}`; 
        }
        if (sanitized.startsWith("__") && sanitized.endsWith("__") && sanitized.length > 4) {
             sanitized = `name${sanitized.substring(2, sanitized.length - 2)}`;
        } else if (sanitized.startsWith("__")) {
             sanitized = `name${sanitized.substring(2)}`;
        } else if (sanitized.endsWith("__")) {
             sanitized = `name${sanitized.substring(0, sanitized.length - 2)}`;
        }
        return sanitized.substring(0, 100) || null; 
    }

    async function setOrLoadUserName(name, showAlert = true) {
        console.log("[setOrLoadUserName] 接收到名稱:", name, "showAlert:", showAlert);
        const newDisplayNameRaw = name.trim();
        if (!newDisplayNameRaw) {
            if (showAlert) alert("顯示名稱不能為空。");
            return false; 
        }
        const sanitizedName = sanitizeNameToFirestoreId(newDisplayNameRaw);
        if (!sanitizedName) {
            if (showAlert) alert("處理後的名稱無效（可能包含不允許的字元或過短），請嘗試其他名稱。");
            return false; 
        }

        currentDataIdentifier = sanitizedName;
        rawUserDisplayName = newDisplayNameRaw; 
        currentUserIdSpan.textContent = currentDataIdentifier; 
        currentUserDisplayNameSpan.textContent = rawUserDisplayName; 
        userNameInput.value = rawUserDisplayName; 
        localStorage.setItem('worldClockUserName', rawUserDisplayName); 

        console.log("[setOrLoadUserName] 使用者資料識別碼已設定為:", currentDataIdentifier);
        if (showAlert) alert(`名稱已設定為 "${rawUserDisplayName}"。你的歷史記錄將以此名稱關聯。`);

        if (citiesData.length > 0 && auth.currentUser && currentDataIdentifier) { 
            console.log("[setOrLoadUserName] 所有條件滿足，啟用 findCityButton。");
            findCityButton.disabled = false;
        } else {
            console.log("[setOrLoadUserName] 條件不滿足，findCityButton 保持禁用。Cities loaded:", citiesData.length > 0, "Auth current user:", !!auth.currentUser, "Data ID set:", !!currentDataIdentifier);
            findCityButton.disabled = true;
        }

        console.log("[setOrLoadUserName] 準備切換到時鐘分頁並顯示最後記錄。");
        openTab(null, 'ClockTab', true); 
        await displayLastRecordForCurrentUser();

        // 設定名稱後，如果歷史分頁是活動的，則重新載入該名稱的歷史
        // 這段邏輯在 openTab 中處理會更好，避免重複載入
        // if (document.getElementById('HistoryTab').classList.contains('active')) {
        //     console.log("[setOrLoadUserName] 歷史分頁為活動狀態，重新載入歷史。");
        //     loadHistory(); 
        // }
        return true; 
    }

    setUserNameButton.addEventListener('click', async () => {
        console.log("「設定/更新名稱」按鈕被點擊。");
        await setOrLoadUserName(userNameInput.value.trim());
    });

    async function displayLastRecordForCurrentUser() { /* ... (與前一版本相同) ... */ }
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
    async function findMatchingCity() { /* ... (與前一版本相同) ... */ }
    async function saveHistoryRecord(recordData) { /* ... (與前一版本相同) ... */ }
    async function saveToGlobalDailyRecord(recordData) { /* ... (與前一版本相同) ... */ }

    async function loadHistory() {
        if (!currentDataIdentifier) { 
            historyListUl.innerHTML = '<li>請先設定你的顯示名稱以查看歷史記錄。</li>';
            if (historyLeafletMap) {
                historyLeafletMap.remove(); // 移除舊的地圖實例
                historyLeafletMap = null;   // 重置實例變數
            }
            historyMapContainerDiv.innerHTML = '<p>設定名稱後，此處將顯示您的個人歷史地圖。</p>'; 
            return;
        }
        historyListUl.innerHTML = '<li>載入歷史記錄中...</li>';
        // *** 修改點：只有在 Leaflet 地圖還沒建立時才設定 "載入中" ***
        if (!historyLeafletMap) { 
            historyMapContainerDiv.innerHTML = '<p>載入個人歷史地圖中...</p>';
        } else if (historyMarkerLayerGroup) {
            historyMarkerLayerGroup.clearLayers(); // 如果地圖已存在，先清除標記
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
                renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history'); // 傳遞空陣列以顯示 "無資料"
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
        if (!auth.currentUser) { 
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>Firebase 認證中，請稍候...</p>';
            return;
        }
        
        const selectedDateValue = globalDateInput.value; 
        if (!selectedDateValue) {
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>請先選擇一個日期。</p>';
            return;
        }
        
        if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>載入今日眾人地圖中...</p>';
        else if (globalMarkerLayerGroup) globalMarkerLayerGroup.clearLayers(); 

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
            mapDivElement.innerHTML = ''; // 清空 "載入中" 或 "無資料" 訊息
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
            // 如果地圖已存在，先清除舊的標記
            console.log(`[renderPointsOnMap] 清除 ${mapDivElement.id} 上的舊標記。`);
            if (currentMarkerLayerGroup) {
                currentMarkerLayerGroup.clearLayers();
            } else { 
                 currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);
                 if (mapType === 'global') globalMarkerLayerGroup = currentMarkerLayerGroup;
                 else if (mapType === 'history') historyMarkerLayerGroup = currentMarkerLayerGroup;
            }
            // *** 修改點：確保在重用時，如果容器被innerHTML修改過，Leaflet能重新正確渲染 ***
            // 實際上，如果我們不在 loadHistory/loadGlobalTodayMap 中用 innerHTML 清空，這裡可能就不需要
            if (currentMapInstance.getContainer().innerHTML.includes("<p>")) { // 簡易判斷容器是否被文字佔據
                 mapDivElement.innerHTML = ''; // 清空文字
                 mapDivElement.appendChild(currentMapInstance.getContainer()); // 重新附加地圖 DOM
            }
            currentMapInstance.invalidateSize(); 
        }
        
        if (!points || points.length === 0) {
            // *** 修改點：如果地圖已初始化，不要用 innerHTML 覆蓋它 ***
            // mapDivElement.innerHTML = `<p>${mapTitle}：尚無有效座標點可顯示。</p>`; 
            if (currentMarkerLayerGroup) currentMarkerLayerGroup.clearLayers(); // 清除標記
            console.log("[renderPointsOnMap] 沒有點可以渲染，在地圖上顯示提示。");
            // 可以在地圖上添加一個 L.control 來顯示訊息，或者使用外部元素
            // 為了簡單，我們暫時不在地圖內部顯示 "無資料"，而是在 debugDivElement
            if(debugDivElement) debugDivElement.textContent = `${mapTitle}：尚無有效座標點可顯示。`;
            else console.warn("Debug element not provided for no-points message.");
            return;
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

        // 使用 setTimeout 確保 DOM 更新後再執行地圖相關操作
        setTimeout(() => {
            if (tabName === 'HistoryTab') {
                if (historyLeafletMap && historyMapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] HistoryTab is visible, invalidating map size.");
                    historyLeafletMap.invalidateSize();
                }
                // 只有在不是由 setUserName 觸發，且使用者已登入並設定了名稱時才載入歷史
                if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) {
                    console.log("[openTab] 呼叫 loadHistory for HistoryTab.");
                    loadHistory();
                }
            } else if (tabName === 'GlobalTodayMapTab') {
                if (globalLeafletMap && globalTodayMapContainerDiv.offsetParent !== null) {
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
            }
        }, 0); 
    }
});

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

    // 檢查並啟用 "開始這一天" 按鈕的函數
    function checkAndEnableFindCityButton() {
        if (citiesData.length > 0 && auth.currentUser && currentDataIdentifier) {
            console.log("[checkAndEnableFindCityButton] 所有條件滿足，啟用 findCityButton。");
            findCityButton.disabled = false;
        } else {
            console.log("[checkAndEnableFindCityButton] 條件不滿足，findCityButton 保持禁用。Cities loaded:", citiesData.length > 0, "Auth current user:", !!auth.currentUser, "Data ID set:", !!currentDataIdentifier);
            findCityButton.disabled = true;
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Firebase 會話已認證 (Auth UID):", user.uid, "匿名:", user.isAnonymous);
            const lastUsedName = localStorage.getItem('worldClockUserName');
            
            if (lastUsedName && !currentDataIdentifier) { 
                console.log("從 localStorage 恢復上次使用的名稱:", lastUsedName);
                userNameInput.value = lastUsedName;
                await setOrLoadUserName(lastUsedName, false); 
            } else { // currentDataIdentifier 可能已設定，或者 localStorage 中沒有名稱
                 checkAndEnableFindCityButton(); // 確保在認證後檢查按鈕狀態
            }
            
            // 頁面首次載入時，如果對應分頁是 active，則載入其內容
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const activeTabId = activeTab.id;
                console.log("頁面載入時，活動分頁是:", activeTabId);
                // 使用 setTimeout 確保 DOM 渲染完成
                setTimeout(() => {
                    if (activeTabId === 'HistoryTab' && currentDataIdentifier) {
                        if (historyMapContainerDiv.offsetParent !== null && historyLeafletMap) historyLeafletMap.invalidateSize();
                        loadHistory(); 
                    } else if (activeTabId === 'GlobalTodayMapTab') {
                        if (globalTodayMapContainerDiv.offsetParent !== null && globalLeafletMap) globalLeafletMap.invalidateSize();
                        loadGlobalTodayMap();
                    }
                    // ClockTab 的 displayLastRecordForCurrentUser 由 setOrLoadUserName 處理
                }, 50);
            }

        } else {
            console.log("Firebase 會話未認證，嘗試登入...");
            currentDataIdentifier = null; 
            rawUserDisplayName = "";
            currentUserIdSpan.textContent = "認證中..."; 
            currentUserDisplayNameSpan.textContent = "未設定";
            userNameInput.value = "";
            findCityButton.disabled = true; 
            clearPreviousResults(); 

            if (initialAuthToken) {
                console.log("嘗試使用 initialAuthToken 登入...");
                signInWithCustomToken(auth, initialAuthToken)
                    .catch((error) => {
                        console.error("使用 initialAuthToken 登入失敗, 嘗試匿名登入:", error.code, error.message);
                        signInAnonymously(auth).catch(anonError => {
                            console.error("匿名登入失敗:", anonError);
                            currentUserIdSpan.textContent = "認證失敗";
                        });
                    });
            } else {
                 console.log("未提供 initialAuthToken, 嘗試匿名登入...");
                 signInAnonymously(auth).catch(error => {
                    console.error("匿名登入失敗:", error);
                    currentUserIdSpan.textContent = "認證失敗";
                });
            }
        }
    });
    
    function sanitizeNameToFirestoreId(name) { /* ... (與你提供的版本相同) ... */ }

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
        localStorage.setItem('worldClockUserName_just_set', 'true'); // 標記剛設定完

        console.log("[setOrLoadUserName] 使用者資料識別碼已設定為:", currentDataIdentifier);
        if (showAlert) alert(`名稱已設定為 "${rawUserDisplayName}"。你的歷史記錄將以此名稱關聯。`);

        checkAndEnableFindCityButton(); // *** 修改點：統一呼叫檢查函數 ***

        console.log("[setOrLoadUserName] 準備切換到時鐘分頁並顯示最後記錄。");
        openTab(null, 'ClockTab', true); 
        await displayLastRecordForCurrentUser();
        
        // 清除標記，以便 onAuthStateChanged 中的邏輯不會再次錯誤地觸發 displayLastRecord
        localStorage.removeItem('worldClockUserName_just_set'); 
        return true; 
    }

    setUserNameButton.addEventListener('click', async () => {
        console.log("「設定/更新名稱」按鈕被點擊。");
        await setOrLoadUserName(userNameInput.value.trim());
    });

    async function displayLastRecordForCurrentUser() { /* ... (與你提供的版本相同) ... */ }
    
    fetch('cities_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            citiesData = data;
            console.log("城市數據已載入", citiesData.length, "筆");
            checkAndEnableFindCityButton(); // *** 修改點：統一呼叫檢查函數 ***
        })
        .catch(e => {
            console.error("無法載入城市數據:", e);
            resultTextDiv.innerHTML = "錯誤：無法載入城市數據。";
            findCityButton.disabled = true;
        });

    findCityButton.addEventListener('click', async () => { 
        console.log("「開始這一天」按鈕被點擊。");
        await findMatchingCity(); 
    });
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }

    function parseOffsetString(offsetStr) { /* ... (與你提供的版本相同) ... */ }
    function getCityUTCOffsetHours(ianaTimeZone) { /* ... (與你提供的版本相同) ... */ }
    const timezoneOffsetCache = new Map();
    function clearPreviousResults() { /* ... (與你提供的版本相同，確保 clockLeafletMap 被正確處理) ... */ }
    async function findMatchingCity() { /* ... (與你提供的版本相同，確保是 async) ... */ }
    async function saveHistoryRecord(recordData) { /* ... (與你提供的版本相同) ... */ }
    async function saveToGlobalDailyRecord(recordData) { /* ... (與你提供的版本相同) ... */ }

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
        // *** 修改點：只有在 Leaflet 地圖還沒建立時才設定 "載入中" 到地圖容器 ***
        if (!historyLeafletMap) { 
            historyMapContainerDiv.innerHTML = '<p>載入個人歷史地圖中...</p>';
        } else if (historyMarkerLayerGroup) { // 如果地圖已存在，先清除標記
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
                // 即使沒有點，也呼叫 renderPointsOnMap 來處理地圖的 "無資料" 狀態
                renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history'); 
                return;
            }

            querySnapshot.forEach((doc) => { /* ... (與你提供的版本相同，確保 historyPoints.push 正確) ... */ });
            renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history');
        } catch (e) {
            console.error("讀取歷史記錄失敗:", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
            // *** 修改點：出錯時，如果地圖已初始化，不要用 innerHTML 覆蓋 ***
            if (!historyLeafletMap) historyMapContainerDiv.innerHTML = '<p>讀取歷史記錄時發生錯誤。</p>'; 
            else if (historyMarkerLayerGroup) historyMarkerLayerGroup.clearLayers();
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
                querySnapshot.forEach((doc) => { /* ... (與你提供的版本相同) ... */ });
            }
            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, `日期 ${selectedDateValue} 的眾人甦醒地圖`, 'global');

        } catch (e) {
            console.error("讀取全域每日記錄失敗:", e);
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>讀取全域地圖資料失敗。</p>'; 
            else if (globalMarkerLayerGroup) globalMarkerLayerGroup.clearLayers();
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
            // *** 確保地圖容器的 DOM 結構是 Leaflet 控制的 ***
            if (mapDivElement.firstChild && mapDivElement.firstChild.nodeType === Node.TEXT_NODE && mapDivElement.firstChild.textContent.includes("載入")) {
                 mapDivElement.innerHTML = ''; // 清除 "載入中" 文字，如果它覆蓋了地圖
                 mapDivElement.appendChild(currentMapInstance.getContainer()); // 重新附加地圖 DOM
            } else if (mapDivElement.innerHTML.includes("<p>") && !mapDivElement.querySelector('.leaflet-map-pane')) {
                 mapDivElement.innerHTML = ''; 
                 mapDivElement.appendChild(currentMapInstance.getContainer());
            }
            currentMapInstance.invalidateSize(); 
        }
        
        if (!points || points.length === 0) {
            if (currentMarkerLayerGroup) currentMarkerLayerGroup.clearLayers(); 
            console.log("[renderPointsOnMap] 沒有點可以渲染。");
            // 在地圖容器外部的 debugDivElement 顯示提示
            if(debugDivElement) debugDivElement.textContent = `${mapTitle}：尚無有效座標點可顯示。`;
            // 如果地圖已初始化，但沒有點，可以將地圖重置到一個預設視圖
            if (currentMapInstance) currentMapInstance.setView([20,0], 2);
            return;
        }
        
        // ... (renderPointsOnMap 的其餘部分與你提供的版本相同) ...
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
            return; // 如果找不到分頁內容，則不繼續執行
        }
        
        const targetButtonId = `tabButton-${tabName}`; 
        const targetButton = document.getElementById(targetButtonId);
        if (targetButton) {
            targetButton.classList.add("active");
        } else if (evt && evt.currentTarget) { 
             evt.currentTarget.classList.add("active");
        }

        // 使用 setTimeout 確保 DOM 更新 (display:block) 後再執行地圖相關操作
        setTimeout(() => {
            console.log(`[openTab setTimeout] 處理分頁: ${tabName}`);
            if (tabName === 'ClockTab') {
                if (clockLeafletMap && mapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] ClockTab is visible, invalidating map size.");
                    clockLeafletMap.invalidateSize();
                }
                // 通常 ClockTab 的內容由 displayLastRecordForCurrentUser 或 findMatchingCity 更新
                // 如果 triggeredBySetName 為 true，則 displayLastRecordForCurrentUser 已被呼叫
                if (!triggeredBySetName && currentDataIdentifier && auth.currentUser) {
                    // 如果需要，可以在這裡重新顯示最後記錄，但要小心重複呼叫
                    // displayLastRecordForCurrentUser(); 
                }
            } else if (tabName === 'HistoryTab') {
                if (historyMapContainerDiv.offsetParent !== null) { // 檢查容器是否實際可見
                    if (historyLeafletMap) {
                        console.log("[openTab] HistoryTab is visible, invalidating map size.");
                        historyLeafletMap.invalidateSize();
                    }
                    if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) {
                        console.log("[openTab] 呼叫 loadHistory for HistoryTab.");
                        loadHistory();
                    } else if (!currentDataIdentifier && auth.currentUser) {
                        historyListUl.innerHTML = '<li>請先設定你的顯示名稱以查看歷史記錄。</li>';
                        if(historyLeafletMap) { historyLeafletMap.remove(); historyLeafletMap = null; }
                        historyMapContainerDiv.innerHTML = '<p>請先設定名稱。</p>';
                    }
                } else {
                     console.log("[openTab] HistoryTab 容器不可見，將在下次可見時處理。");
                }
            } else if (tabName === 'GlobalTodayMapTab') {
                if (globalTodayMapContainerDiv.offsetParent !== null) { // 檢查容器是否實際可見
                    if (globalLeafletMap) {
                        console.log("[openTab] GlobalTodayMapTab is visible, invalidating map size.");
                        globalLeafletMap.invalidateSize();
                    }
                    if (auth.currentUser && !triggeredBySetName) { 
                         if (globalDateInput && !globalDateInput.value) { 
                            globalDateInput.valueAsDate = new Date();
                        }
                        console.log("[openTab] 呼叫 loadGlobalTodayMap for GlobalTodayMapTab.");
                        loadGlobalTodayMap();
                    }
                } else {
                    console.log("[openTab] GlobalTodayMapTab 容器不可見，將在下次可見時處理。");
                }
            }
        }, 50); // 稍微增加延遲，給 DOM 更多反應時間，確保 display:block 已生效
    }
});

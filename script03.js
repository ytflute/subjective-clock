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
                // 如果 currentDataIdentifier 已有值 (例如，使用者剛設定完名稱)，則確保按鈕狀態正確
                if (citiesData.length > 0) {
                    console.log("Firebase 已認證且 currentDataIdentifier 已設定，啟用 findCityButton (如果城市數據已載入)。");
                    findCityButton.disabled = false;
                }
                if (document.getElementById('HistoryTab').classList.contains('active')) {
                     loadHistory(); 
                }
            }
            // 檢查 GlobalTodayMapTab 是否活動並載入
            if (document.getElementById('GlobalTodayMapTab') && document.getElementById('GlobalTodayMapTab').classList.contains('active')) {
                loadGlobalTodayMap();
            }
        } else {
            console.log("Firebase 會話未認證，嘗試登入...");
            currentUserIdSpan.textContent = "認證中..."; 
            findCityButton.disabled = true; // 確保在未認證時禁用
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

        // *** 修改點：檢查所有條件以啟用按鈕 ***
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

        if (document.getElementById('HistoryTab').classList.contains('active')) {
            console.log("[setOrLoadUserName] 歷史分頁為活動狀態，重新載入歷史。");
            loadHistory(); 
        }
        return true; 
    }

    setUserNameButton.addEventListener('click', async () => {
        console.log("「設定/更新名稱」按鈕被點擊。");
        await setOrLoadUserName(userNameInput.value.trim());
    });

    async function displayLastRecordForCurrentUser() { /* ... (與前一版本相同，但確保日誌清晰) ... */ }

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
            if (citiesData.length === 0) {
                resultTextDiv.innerHTML = "提示：載入的城市數據為空。";
                findCityButton.disabled = true;
            } else if (currentDataIdentifier && auth.currentUser) { 
                console.log("城市數據已載入且使用者已設定名稱並認證，啟用 findCityButton。");
                findCityButton.disabled = false;
            } else {
                console.log("城市數據已載入，但使用者名稱未設定或未認證，findCityButton 保持禁用。");
            }
        })
        .catch(e => {
            console.error("無法載入城市數據:", e);
            resultTextDiv.innerHTML = "錯誤：無法載入城市數據。";
            findCityButton.disabled = true;
        });

    findCityButton.addEventListener('click', async () => { // *** 修改點：將 findMatchingCity 設為 async ***
        console.log("「開始這一天」按鈕被點擊。");
        await findMatchingCity(); // *** 修改點：確保呼叫的是 async 版本的 findMatchingCity ***
    });
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }

    function parseOffsetString(offsetStr) { /* ... (與前一版本相同) ... */ }
    function getCityUTCOffsetHours(ianaTimeZone) { /* ... (與前一版本相同) ... */ }
    const timezoneOffsetCache = new Map();
    function clearPreviousResults() { /* ... (與前一版本相同) ... */ }
    
    // *** 修改點：確保 findMatchingCity 是 async 函數，因為它內部有 await ***
    async function findMatchingCity() { 
        clearPreviousResults();
        console.log("--- 開始尋找匹配城市 ---");

        if (!currentDataIdentifier) { 
            alert("請先設定你的顯示名稱。");
            console.log("findMatchingCity 中斷：currentDataIdentifier 未設定。");
            return;
        }
        if (!auth.currentUser) { 
            alert("Firebase 會話未就緒，請稍候或刷新頁面。");
            console.log("findMatchingCity 中斷：Firebase 會話未就緒。");
            return;
        }
        if (citiesData.length === 0) {
            resultTextDiv.innerHTML = "錯誤：城市數據未載入或為空。";
            console.log("findMatchingCity 中斷：城市數據未載入。");
            return;
        }
        console.log("findMatchingCity 條件檢查通過，繼續執行...");

        // ... (findMatchingCity 函數的其餘部分與你提供的版本相同，包含儲存記錄的 await 呼叫) ...
        // ... 請確保將你提供的 findMatchingCity 完整內容複製到這裡 ...
        // 以下是 findMatchingCity 的核心邏輯，確保它與你之前的版本一致，特別是 await 的使用
        const userLocalDate = new Date();
        const userLocalHours = userLocalDate.getHours();
        const userLocalMinutes = userLocalDate.getMinutes();
        const userTimezoneOffsetMinutes = userLocalDate.getTimezoneOffset();
        const userUTCOffsetHours = -userTimezoneOffsetMinutes / 60;

        let adjustedUserLocalHours = userLocalHours;
        let adjustedUserLocalMinutes = Math.round(userLocalMinutes / 15) * 15;

        if (adjustedUserLocalMinutes === 60) {
            adjustedUserLocalMinutes = 0;
            adjustedUserLocalHours = (adjustedUserLocalHours + 1) % 24;
        }
        const userLocalHoursDecimalForTarget = adjustedUserLocalHours + adjustedUserLocalMinutes / 60;
        const targetUTCOffsetHours = 8 - userLocalHoursDecimalForTarget + userUTCOffsetHours;
        const targetLatitude = 90 - (userLocalMinutes / 59) * 180; 

        const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

        console.log(`用戶實際時間: ${userTimeFormatted} (UTC${userUTCOffsetHours >= 0 ? '+' : ''}${userUTCOffsetHours.toFixed(2)})`);
        console.log(`用於計算目標偏移的調整後用戶時間: ${adjustedUserLocalHours}:${adjustedUserLocalMinutes < 10 ? '0' : ''}${adjustedUserLocalMinutes}`);
        console.log(`尋找目標 UTC 偏移 (targetUTCOffsetHours): ${targetUTCOffsetHours.toFixed(2)} (即 UTC ${targetUTCOffsetHours >= 0 ? '+' : ''}${targetUTCOffsetHours.toFixed(2)})`);
        console.log(`目標匹配範圍 (UTC): ${(targetUTCOffsetHours - 0.5).toFixed(2)} 至 ${(targetUTCOffsetHours + 0.5).toFixed(2)}`);
        console.log(`目標緯度 (targetLatitude): ${targetLatitude.toFixed(2)}`);

        let candidateCities = [];
        console.log("開始遍歷城市數據進行匹配..."); 
        for (const city of citiesData) {
            if (!city || !city.timezone || 
                typeof city.latitude !== 'number' || !isFinite(city.latitude) || 
                typeof city.longitude !== 'number' || !isFinite(city.longitude) || 
                !city.country_iso_code) {
                console.warn("跳過格式不正確或缺少必要資訊 (timezone, latitude, longitude, country_iso_code) 的城市數據:", city);
                continue;
            }

            let cityUTCOffset;
            if (timezoneOffsetCache.has(city.timezone)) {
                cityUTCOffset = timezoneOffsetCache.get(city.timezone);
            } else {
                cityUTCOffset = getCityUTCOffsetHours(city.timezone);
                if (isFinite(cityUTCOffset)) { 
                    timezoneOffsetCache.set(city.timezone, cityUTCOffset);
                }
            }
            if (!isFinite(cityUTCOffset)) continue; 

            if (Math.abs(cityUTCOffset - targetUTCOffsetHours) <= 0.5) { 
                console.log(`  符合條件! 城市: ${city.city}, 國家: ${city.country}, 時區: ${city.timezone}, 計算偏移: ${cityUTCOffset.toFixed(2)}`);
                candidateCities.push(city);
            }
        }
        console.log("城市數據遍歷完成。候選城市數量:", candidateCities.length); 


        if (candidateCities.length === 0) {
            resultTextDiv.innerHTML = `今天的你，在當地 <strong>${userTimeFormatted}</strong> 開啟了這一天，<br>但是很抱歉，你已經脫離地球了，與非地球生物共同開啟了新的一天。`;
            mapContainerDiv.innerHTML = "<p>浩瀚宇宙，無從定位...</p>"; 
            countryFlagImg.style.display = 'none'; 
            debugInfoSmall.innerHTML = `(嘗試尋找的目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)})`;

            const universeRecord = {
                dataIdentifier: currentDataIdentifier, 
                userDisplayName: rawUserDisplayName, 
                recordedAt: serverTimestamp(),
                localTime: userTimeFormatted,
                city: "未知星球Unknown Planet", 
                country: "宇宙Universe",       
                city_zh: "未知星球",
                country_zh: "宇宙",
                country_iso_code: "universe_code", 
                latitude: null, 
                longitude: null,
                targetUTCOffset: targetUTCOffsetHours,
                matchedCityUTCOffset: null, 
                recordedDateString: userLocalDate.toISOString().split('T')[0]
            };
            await saveHistoryRecord(universeRecord);
            await saveToGlobalDailyRecord(universeRecord);
            return; 
        }

        let bestMatchCity = null;
        let minLatDiff = Infinity;
        for (const city of candidateCities) {
            const latDiff = Math.abs(city.latitude - targetLatitude); 
            if (latDiff < minLatDiff) {
                minLatDiff = latDiff;
                bestMatchCity = city;
            }
        }

        if (bestMatchCity) { 
            const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone);
            const finalCityName = bestMatchCity.city_zh && bestMatchCity.city_zh !== bestMatchCity.city ? `${bestMatchCity.city_zh} (${bestMatchCity.city})` : bestMatchCity.city;
            const finalCountryName = bestMatchCity.country_zh && bestMatchCity.country_zh !== bestMatchCity.country ? `${bestMatchCity.country_zh} (${bestMatchCity.country})` : bestMatchCity.country;
            
            resultTextDiv.innerHTML = `今天的你，<br>跟<strong>${finalCityName} (${finalCountryName})</strong> 的人，<br>共同開啟了新的一天！`;

            if (bestMatchCity.country_iso_code) {
                countryFlagImg.src = `https://flagcdn.com/w40/${bestMatchCity.country_iso_code.toLowerCase()}.png`;
                countryFlagImg.alt = `${finalCountryName} 國旗`;
                countryFlagImg.style.display = 'inline-block';
            }

            if (clockLeafletMap) {
                clockLeafletMap.remove();
                clockLeafletMap = null;
            }
            mapContainerDiv.innerHTML = ''; 

            if (typeof bestMatchCity.latitude === 'number' && isFinite(bestMatchCity.latitude) && 
                typeof bestMatchCity.longitude === 'number' && isFinite(bestMatchCity.longitude)) { 
                
                clockLeafletMap = L.map(mapContainerDiv).setView([bestMatchCity.latitude, bestMatchCity.longitude], 7);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd', maxZoom: 19
                }).addTo(clockLeafletMap);
                L.circleMarker([bestMatchCity.latitude, bestMatchCity.longitude], {
                    color: 'red', fillColor: '#f03', fillOpacity: 0.8, radius: 8
                }).addTo(clockLeafletMap).bindPopup(`<b>${finalCityName}</b><br>${finalCountryName}`).openPopup();
            } else {
                 mapContainerDiv.innerHTML = "<p>無法顯示地圖，城市座標資訊不完整或無效。</p>";
            }
            
            const debugLat = typeof bestMatchCity.latitude === 'number' && isFinite(bestMatchCity.latitude) ? bestMatchCity.latitude.toFixed(2) : 'N/A';
            const debugLon = typeof bestMatchCity.longitude === 'number' && isFinite(bestMatchCity.longitude) ? bestMatchCity.longitude.toFixed(2) : 'N/A';
            const debugTargetLat = typeof targetLatitude === 'number' && isFinite(targetLatitude) ? targetLatitude.toFixed(2) : 'N/A';
            const debugMinLatDiff = typeof minLatDiff === 'number' && isFinite(minLatDiff) ? minLatDiff.toFixed(2) : 'N/A';
            const debugTargetOffset = typeof targetUTCOffsetHours === 'number' && isFinite(targetUTCOffsetHours) ? targetUTCOffsetHours.toFixed(2) : 'N/A';
            const debugActualOffset = !isFinite(cityActualUTCOffset) ? 'N/A' : cityActualUTCOffset.toFixed(2);

            debugInfoSmall.innerHTML = `(目標城市緯度: ${debugLat}°, 計算目標緯度: ${debugTargetLat}°, 緯度差: ${debugMinLatDiff}°)<br>(目標 UTC 偏移: ${debugTargetOffset}, 城市實際 UTC 偏移: ${debugActualOffset}, 時區: ${bestMatchCity.timezone})`;

            const recordData = {
                dataIdentifier: currentDataIdentifier, 
                userDisplayName: rawUserDisplayName, 
                recordedAt: serverTimestamp(), 
                localTime: userTimeFormatted, 
                city: bestMatchCity.city,
                country: bestMatchCity.country,
                city_zh: bestMatchCity.city_zh || "",
                country_zh: bestMatchCity.country_zh || "",
                country_iso_code: bestMatchCity.country_iso_code.toLowerCase(),
                latitude: bestMatchCity.latitude, 
                longitude: bestMatchCity.longitude, 
                targetUTCOffset: targetUTCOffsetHours,
                matchedCityUTCOffset: !isFinite(cityActualUTCOffset) ? null : cityActualUTCOffset,
                recordedDateString: userLocalDate.toISOString().split('T')[0] 
            };
            await saveHistoryRecord(recordData);
            await saveToGlobalDailyRecord(recordData); 

        } 
        console.log("--- 尋找匹配城市結束 ---");
    }


    async function saveHistoryRecord(recordData) { /* ... (與前一版本相同) ... */ }
    async function saveToGlobalDailyRecord(recordData) { /* ... (與前一版本相同) ... */ }
    async function loadHistory() { /* ... (與前一版本相同) ... */ }
    async function loadGlobalTodayMap() { /* ... (與前一版本相同) ... */ }
    function renderPointsOnMap(points, mapDivElement, debugDivElement, mapTitle = "地圖", mapType = 'global') { /* ... (與前一版本相同) ... */ }
    function renderHistoryMap(points) { /* ... (與前一版本相同) ... */ }
    window.openTab = function(evt, tabName, triggeredBySetName = false) { /* ... (與前一版本相同) ... */ }
});

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
        // globalDateInput.valueAsDate = new Date(); // 舊的方式，可能會導致問題

        // 新的方式：直接設定 .value 為本地日期的 YYYY-MM-DD 字串
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // getMonth() 是 0-indexed
        const day = today.getDate().toString().padStart(2, '0');
        const localTodayDateString = `<span class="math-inline">\{year\}\-</span>{month}-${day}`;
    
        globalDateInput.value = localTodayDateString;
        console.log("頁面初始載入，globalDateInput.value 設為:", globalDateInput.value);
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

async function displayLastRecordForCurrentUser() {
    console.log("[displayLastRecordForCurrentUser] 函數被呼叫。currentDataIdentifier:", currentDataIdentifier);
    clearPreviousResults(); // 這個函數會清除 mapContainerDiv 的內容並移除 'universe-message' class

    if (!currentDataIdentifier) {
        console.log("[displayLastRecordForCurrentUser] currentDataIdentifier 為空，返回。");
        resultTextDiv.innerHTML = `<p>請先在上方設定您的顯示名稱。</p>`;
        // mapContainerDiv 已經由 clearPreviousResults() 清理
        return;
    }
    if (!auth.currentUser) {
        console.log("[displayLastRecordForCurrentUser] Firebase 使用者未認證，返回。");
        resultTextDiv.innerHTML = `<p>Firebase 認證中，請稍候...</p>`;
        // mapContainerDiv 已經由 clearPreviousResults() 清理
        return;
    }

    console.log(`[displayLastRecordForCurrentUser] 嘗試為識別碼 "${currentDataIdentifier}" 獲取最後記錄...`);
    const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
    const q = query(historyCollectionRef, orderBy("recordedAt", "desc"), limit(1));

    try {
        const querySnapshot = await getDocs(q);
        console.log("[displayLastRecordForCurrentUser] Firestore 查詢完成。Snapshot is empty:", querySnapshot.empty);

        if (!querySnapshot.empty) {
            const lastRecord = querySnapshot.docs[0].data();
            console.log("[displayLastRecordForCurrentUser] 找到最後一筆記錄:", JSON.parse(JSON.stringify(lastRecord)));

            const userTimeFormatted = lastRecord.localTime || "未知時間";
            const cityActualUTCOffset = (typeof lastRecord.matchedCityUTCOffset === 'number' && isFinite(lastRecord.matchedCityUTCOffset))
                                        ? lastRecord.matchedCityUTCOffset
                                        : null;

            const finalCityName = lastRecord.city_zh && lastRecord.city_zh !== lastRecord.city ? `${lastRecord.city_zh} (${lastRecord.city})` : lastRecord.city;
            const finalCountryName = lastRecord.country_zh && lastRecord.country_zh !== lastRecord.country ? `${lastRecord.country_zh} (${lastRecord.country})` : lastRecord.country;

            // ★★★ 新增：檢查並組合儲存的問候語和小知識 ★★★
            let greetingHTML = "";
            let triviaHTML = "";

            if (lastRecord.greeting) { // 檢查 greeting 是否存在
                greetingHTML = `<p style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">${lastRecord.greeting}</p>`;
            }
            if (lastRecord.trivia) { // 檢查 trivia 是否存在
                triviaHTML = `<p style="margin-bottom: 15px; font-style: italic;">${lastRecord.trivia}</p>`;
            }
            // ★★★ 新增結束 ★★★

            let mainMessageHTML;
            // 判斷宇宙情況，使用英文鍵名進行比較，並兼容您之前可能使用的中文鍵名
            const isUniverse = (lastRecord.country === "Universe" && lastRecord.city === "Unknown Planet") ||
                               (lastRecord.country === "宇宙Universe" && lastRecord.city === "未知星球Unknown Planet");

            if (isUniverse) {
                mainMessageHTML = `<p>這是 ${rawUserDisplayName} 於 <strong>${userTimeFormatted}</strong> 的最後一筆記錄，<br>當時你已脫離地球，與<strong>${finalCityName} (${finalCountryName})</strong>的非地球生物共同開啟了新的一天！</p>`;
            } else {
                mainMessageHTML = `<p>這是 ${rawUserDisplayName} 於 <strong>${userTimeFormatted}</strong> 的最後一筆記錄，<br>當時與 <strong>${finalCityName} (${finalCountryName})</strong> 的人同步，<br>開啟了新的一天！</p>`;
            }

            resultTextDiv.innerHTML = `${greetingHTML}${triviaHTML}${mainMessageHTML}`; // ★ 更新：顯示包含問候語和小知識的訊息


            if (lastRecord.country_iso_code && lastRecord.country_iso_code !== 'universe_code') {
                countryFlagImg.src = `https://flagcdn.com/w40/${lastRecord.country_iso_code.toLowerCase()}.png`;
                countryFlagImg.alt = `${finalCountryName} 國旗`;
                countryFlagImg.style.display = 'inline-block';
            } else {
                countryFlagImg.style.display = 'none';
            }
            
            // --- 開始處理 mapContainerDiv 的顯示與樣式 ---
            // 移除舊的地圖實例 (如果存在)
            if (clockLeafletMap) {
                clockLeafletMap.remove();
                clockLeafletMap = null;
            }
            // 清空 mapContainerDiv 的內容
            mapContainerDiv.innerHTML = '';
            // 預設移除 universe-message class (雖然 clearPreviousResults 也做了，但這裡再次確保)
            mapContainerDiv.classList.remove('universe-message'); 

            if (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude) && 
                typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) {
                
                // 顯示地圖 (此時不應有 universe-message class)
                clockLeafletMap = L.map(mapContainerDiv).setView([lastRecord.latitude, lastRecord.longitude], 7);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd', maxZoom: 19
                }).addTo(clockLeafletMap);
                L.circleMarker([lastRecord.latitude, lastRecord.longitude], {
                    color: 'red', fillColor: '#f03', fillOpacity: 0.8, radius: 8
                }).addTo(clockLeafletMap).bindPopup(`<b>${finalCityName}</b><br>${finalCountryName}`).openPopup();

            } else if (lastRecord.city === "未知星球Unknown Planet") {
                // 顯示宇宙訊息
                mapContainerDiv.classList.add('universe-message'); // ★ 套用宇宙樣式
                mapContainerDiv.innerHTML = "<p>浩瀚宇宙，無從定位...</p>";
            } else {
                // 顯示「無法顯示地圖」的訊息 (此時不應有 universe-message class)
                mapContainerDiv.innerHTML = "<p>無法顯示地圖，此記錄座標資訊不完整或無效。</p>";
            }
            // --- mapContainerDiv 處理結束 ---
            
            const recordedAtDate = lastRecord.recordedAt && lastRecord.recordedAt.toDate ? lastRecord.recordedAt.toDate().toLocaleString('zh-TW') : '未知記錄時間';
            const targetUTCOffsetStr = (typeof lastRecord.targetUTCOffset === 'number' && isFinite(lastRecord.targetUTCOffset)) ? lastRecord.targetUTCOffset.toFixed(2) : 'N/A';
            const latitudeStr = (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude)) ? lastRecord.latitude.toFixed(2) : 'N/A';
            const longitudeStr = (typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) ? lastRecord.longitude.toFixed(2) : 'N/A';

            debugInfoSmall.innerHTML = `(記錄於: ${recordedAtDate})<br>(目標城市緯度: ${latitudeStr}°, 經度: ${longitudeStr}°)<br>(目標 UTC 偏移: ${targetUTCOffsetStr}, 城市實際 UTC 偏移: ${cityActualUTCOffset !== null ? cityActualUTCOffset.toFixed(2) : 'N/A'}, 時区: ${lastRecord.timezone || '未知'})`;
        } else {
            // 沒有歷史記錄的情況
            resultTextDiv.innerHTML = `<p>歡迎，${rawUserDisplayName}！此名稱尚無歷史記錄。</p>`;
            // mapContainerDiv 和 debugInfoSmall 已經由 clearPreviousResults() 清理
            console.log("[displayLastRecordForCurrentUser] 此識別碼尚無歷史記錄。");
        }
    } catch (e) {
        console.error("[displayLastRecordForCurrentUser] 讀取最後一筆記錄失敗:", e);
        resultTextDiv.innerHTML = "<p>讀取最後記錄失敗。</p>";
        // mapContainerDiv 和 debugInfoSmall 已經由 clearPreviousResults() 清理
    }
}

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
                findCityButton.disabled = false;
            }
        })
        .catch(e => {
            console.error("無法載入城市數據:", e);
            resultTextDiv.innerHTML = "錯誤：無法載入城市數據。";
            findCityButton.disabled = true;
        });

    findCityButton.addEventListener('click', findMatchingCity);
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }

    function parseOffsetString(offsetStr) { 
        if (!offsetStr || typeof offsetStr !== 'string') return NaN;
        const cleaned = offsetStr.replace('GMT', '').replace('UTC', '').trim();
        const signMatch = cleaned.match(/^([+-])/);
        const sign = signMatch ? (signMatch[1] === '+' ? 1 : -1) : 1;
        const numericPart = signMatch ? cleaned.substring(1) : cleaned;
        const parts = numericPart.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
        if (isNaN(hours) || isNaN(minutes)) return NaN;
        return sign * (hours + minutes / 60);
    }

    function getCityUTCOffsetHours(ianaTimeZone) { 
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en', {
                timeZone: ianaTimeZone,
                timeZoneName: 'longOffset',
            });
            const parts = formatter.formatToParts(now);
            let offsetStringVal = "";
            for (const part of parts) {
                if (part.type === 'timeZoneName' || part.type === 'unknown' || part.type === 'literal') {
                    if ((part.value.startsWith('GMT') || part.value.startsWith('UTC')) && (part.value.includes('+') || part.value.includes('-'))) {
                        offsetStringVal = part.value;
                        break;
                    }
                }
            }
            if (!offsetStringVal) {
                const formattedDateString = formatter.format(now);
                const match = formattedDateString.match(/(GMT|UTC)([+-]\d{1,2}(:\d{2})?)/);
                if (match && match[0]) {
                    offsetStringVal = match[0];
                }
            }
            if (offsetStringVal) {
                return parseOffsetString(offsetStringVal);
            } else {
                console.warn("無法從 Intl.DateTimeFormat 獲取時區偏移字串:", ianaTimeZone, "Parts:", parts);
                return NaN;
            }
        } catch (e) {
            console.error("獲取時區偏移時發生錯誤:", ianaTimeZone, e);
            return NaN;
        }
    }

    const timezoneOffsetCache = new Map();

    function clearPreviousResults() { 
        resultTextDiv.innerHTML = "";
        countryFlagImg.src = "";
        countryFlagImg.alt = "國家國旗";
        countryFlagImg.style.display = 'none';
        if (clockLeafletMap) { 
            clockLeafletMap.remove();
            clockLeafletMap = null;
        }
        mapContainerDiv.innerHTML = "";
        mapContainerDiv.classList.remove('universe-message'); // ★ 新增：移除宇宙訊息樣式
        debugInfoSmall.innerHTML = "";
    }

async function findMatchingCity() {
    clearPreviousResults(); // 呼叫這個函數來清理之前的結果
    const resultTextDiv = document.getElementById('resultText'); // 確保獲取了 resultTextDiv

    // 設定初始/載入訊息
    if (resultTextDiv) {
        resultTextDiv.innerHTML = '<p>正在連接平行時空，尋找你的蹤跡並獲取今日的特別訊息...</p>';
    }
    
    console.log("--- 開始尋找匹配城市 ---");

    if (!currentDataIdentifier) {
        alert("請先設定你的顯示名稱。");
        if (resultTextDiv) resultTextDiv.innerHTML = '<p>請先設定名稱才能開啟時空之旅。</p>';
        return;
    }
    if (!auth.currentUser) {
        alert("Firebase 會話未就緒，請稍候或刷新頁面。");
        if (resultTextDiv) resultTextDiv.innerHTML = '<p>Firebase 認證中，時空通道暫未開啟。</p>';
        return;
    }
    if (citiesData.length === 0) {
        if(resultTextDiv) resultTextDiv.innerHTML = "<p>錯誤：城市數據未載入或為空。</p>";
        return;
    }

    const userLocalDate = new Date();
    const year = userLocalDate.getFullYear();
    const month = (userLocalDate.getMonth() + 1).toString().padStart(2, '0');
    const day = userLocalDate.getDate().toString().padStart(2, '0');
    const localDateStringForRecord = `${year}-${month}-${day}`;
    const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });


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

    console.log(`用戶實際時間: ${userTimeFormatted} (UTC${userUTCOffsetHours >= 0 ? '+' : ''}${userUTCOffsetHours.toFixed(2)})`);
    console.log(`用戶本地日期字串 (將用於記錄): ${localDateStringForRecord}`);
    
    let candidateCities = [];
    for (const city of citiesData) {
        if (!city || !city.timezone ||
            typeof city.latitude !== 'number' || !isFinite(city.latitude) ||
            typeof city.longitude !== 'number' || !isFinite(city.longitude) ||
            !city.country_iso_code) {
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
            candidateCities.push(city);
        }
    }

    
    if (candidateCities.length === 0) { // 宇宙情況
        const cityForAPI = "Unknown Planet"; // 特殊值給 API
        const countryForAPI = "Universe";    // 特殊值給 API
        const finalCityName = "未知星球";    // 用於顯示的中文
        const finalCountryName = "宇宙";      // 用於顯示的中文

        if(resultTextDiv) {
            resultTextDiv.innerHTML = `<p>正在為您連接到 ${finalCityName} (${finalCountryName}) 並獲取今日的特別訊息... 請稍候...</p>`;
        }

        try {
            const response = await fetch('/api/generateStory', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: cityForAPI,      
                    country: countryForAPI,  
                    userName: rawUserDisplayName || "星際探險家", 
                    language: "Traditional Chinese"         
                }),
            });

            let greeting = ""; 
            let trivia = "";   

            if (response.ok) {
                const data = await response.json();
                greeting = data.greeting || `(來自 ${finalCountryName} 的神秘問候未能捕獲)`;
                trivia = data.trivia || `(關於 ${finalCityName} 的宇宙奧秘暫時無法揭露)`;
            } else {
                const errText = await response.text(); 
                console.error("API 呼叫失敗 (宇宙情況):", response.status, errText.substring(0, 500));
                greeting = `(問候語傳輸失敗，錯誤碼: ${response.status})`;
                trivia = `(宇宙知識獲取失敗，錯誤碼: ${response.status})`;
            }

            const greetingHTML = `<p style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">${greeting}</p>`;
            const triviaHTML = `<p style="margin-bottom: 15px; font-style: italic;">${trivia}</p>`;
            const mainAwakeningMessage = `<p>今天的你，在當地 <strong>${userTimeFormatted}</strong> 開啟了這一天，<br>但是很抱歉，你已經脫離地球了，與<strong>${finalCityName} (${finalCountryName})</strong>的非地球生物共同開啟了新的一天！</p>`;
            
            if (resultTextDiv) {
                resultTextDiv.innerHTML = `${greetingHTML}${triviaHTML}${mainAwakeningMessage}`;
            }

        } catch (error) {
            console.error("獲取宇宙問候語/小知識時發生錯誤:", error);
            if (resultTextDiv) {
                resultTextDiv.innerHTML = `<p>(獲取宇宙額外資訊時發生錯誤)<br>今天的你，在當地 <strong>${userTimeFormatted}</strong> 開啟了這一天，<br>但是很抱歉，你已經脫離地球了，與<strong>未知星球 (宇宙)</strong>的非地球生物共同開啟了新的一天！</p>`;
            }
        }
        
        // --- 繼續顯示宇宙情況的 UI (地圖、無國旗等) ---
        if (clockLeafletMap) { clockLeafletMap.remove(); clockLeafletMap = null; }
        mapContainerDiv.innerHTML = '';
        mapContainerDiv.classList.add('universe-message');
        mapContainerDiv.innerHTML = "<p>浩瀚宇宙，無從定位...</p>";
        countryFlagImg.style.display = 'none';
        debugInfoSmall.innerHTML = `(嘗試尋找的目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)})`;

        const universeRecord = { /* ... (與之前相同，確保 city, country 使用英文鍵) ... */
            dataIdentifier: currentDataIdentifier,
            userDisplayName: rawUserDisplayName,
            recordedAt: serverTimestamp(),
            localTime: userTimeFormatted,
            city: "Unknown Planet", 
            country: "Universe",   
            city_zh: "未知星球",     
            country_zh: "宇宙",       
            country_iso_code: "universe_code",
            latitude: null, longitude: null,
            targetUTCOffset: targetUTCOffsetHours,
            matchedCityUTCOffset: null,
            recordedDateString: localDateStringForRecord 
        };
        await saveHistoryRecord(universeRecord);
        await saveToGlobalDailyRecord(universeRecord);
        console.log("--- 尋找匹配城市結束 (宇宙情況，已請求故事) ---");
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
        
        if(resultTextDiv) {
            resultTextDiv.innerHTML = `<p>正在為您連接到 ${finalCityName} (${finalCountryName}) 並獲取今日的特別訊息... 請稍候...</p>`;
        }

        try {
            const response = await fetch('/api/generateStory', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: bestMatchCity.city,      
                    country: bestMatchCity.country,  
                    userName: rawUserDisplayName || "探險家", 
                    language: "Traditional Chinese"         
                }),
            });

            let greeting = ""; 
            let trivia = "";   

            if (response.ok) {
                const data = await response.json();
                greeting = data.greeting || `(無法獲取 ${finalCountryName} 的問候語)`;
                trivia = data.trivia || `(無法獲取 ${finalCityName} 的小知識)`;
            } else {
                const errText = await response.text(); 
                console.error("API 呼叫失敗:", response.status, errText.substring(0, 500));
                greeting = `(獲取問候語失敗，錯誤碼: ${response.status})`;
                trivia = `(獲取小知識失敗，錯誤碼: ${response.status})`;
            }

            const greetingHTML = `<p style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">${greeting}</p>`;
            const triviaHTML = `<p style="margin-bottom: 15px; font-style: italic;">${trivia}</p>`;
            const mainAwakeningMessage = `<p>當時與 <strong>${finalCityName} (${finalCountryName})</strong> 的人同步，<br>開啟了新的一天！</p>`;
            
            if (resultTextDiv) {
                resultTextDiv.innerHTML = `${greetingHTML}${triviaHTML}${mainAwakeningMessage}`;
            }

        } catch (error) {
            console.error("獲取問候語/小知識時發生錯誤:", error);
            if (resultTextDiv) {
                // 如果 API 呼叫失敗，仍然顯示基本的「開啟新的一天」訊息
                resultTextDiv.innerHTML = `<p>(獲取額外資訊時發生錯誤)<br>當時與 <strong>${finalCityName} (${finalCountryName})</strong> 的人同步，<br>開啟了新的一天！</p>`;
            }
        }

        // --- 繼續顯示國旗、地圖等 ---
        if (bestMatchCity.country_iso_code) {
            countryFlagImg.src = `https://flagcdn.com/w40/${bestMatchCity.country_iso_code.toLowerCase()}.png`;
            countryFlagImg.alt = `${finalCountryName} 國旗`;
            countryFlagImg.style.display = 'inline-block';
        }

        if (clockLeafletMap) { clockLeafletMap.remove(); clockLeafletMap = null; }
        mapContainerDiv.innerHTML = '';
        mapContainerDiv.classList.remove('universe-message');

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

        debugInfoSmall.innerHTML = `(目標城市緯度: ${debugLat}°, 計算目標緯度: ${debugTargetLat}°, 緯度差: ${debugMinLatDiff}°)<br>(目標 UTC 偏移: ${debugTargetOffset}, 城市實際 UTC 偏移: ${debugActualOffset}, 時區: ${bestMatchCity.timezone || '未知'})`;
        
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
        recordedDateString: localDateStringForRecord,
        greeting: greetingFromAPI, // ★★★ 這裡是否正確使用了從 API 獲取的值？ ★★★
        trivia: triviaFromAPI      // ★★★ 這裡是否正確使用了從 API 獲取的值？ ★★★
};
        await saveHistoryRecord(recordData);
        await saveToGlobalDailyRecord(recordData);
        console.log("--- 尋找匹配城市結束 (找到城市) ---");
    }
}

    async function saveHistoryRecord(recordData) {
        if (!currentDataIdentifier) { 
            console.warn("無法儲存歷史記錄：使用者名稱未設定。");
            return;
        }
        if (recordData.city !== "未知星球Unknown Planet" && 
            (typeof recordData.latitude !== 'number' || !isFinite(recordData.latitude) || 
             typeof recordData.longitude !== 'number' || !isFinite(recordData.longitude))) {
            console.error("無法儲存地球歷史記錄：經緯度無效。", recordData);
            return;
        }
        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        try {
            const docRef = await addDoc(historyCollectionRef, recordData);
            console.log("個人歷史記錄已儲存，文件 ID:", docRef.id);
        } catch (e) {
            console.error("儲存個人歷史記錄到 Firestore 失敗:", e);
        }
    }

    async function saveToGlobalDailyRecord(recordData) {
        if (!auth.currentUser) { 
            console.warn("無法儲存全域記錄：Firebase 會話未就緒。");
            return;
        }
        const globalRecord = {
            dataIdentifier: recordData.dataIdentifier, 
            userDisplayName: recordData.userDisplayName, 
            recordedAt: recordData.recordedAt, 
            recordedDateString: recordData.recordedDateString, 
            city: recordData.city,
            country: recordData.country,
            city_zh: recordData.city_zh,
            country_zh: recordData.country_zh,
            country_iso_code: recordData.country_iso_code,
            latitude: recordData.latitude, 
            longitude: recordData.longitude, 
        };
        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        try {
            const docRef = await addDoc(globalCollectionRef, globalRecord);
            console.log("全域每日記錄已儲存，文件 ID:", docRef.id);
        } catch (e) {
            console.error("儲存全域每日記錄到 Firestore 失敗:", e);
        }
    }

async function loadHistory() {
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
    const q_history = query(historyCollectionRef, orderBy("recordedAt", "desc"));

    try {
        const querySnapshot = await getDocs(q_history);
        historyListUl.innerHTML = ''; 
        const historyPoints = []; 

        if (querySnapshot.empty) {
            historyListUl.innerHTML = '<li>尚無歷史記錄。</li>';
            renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history'); 
            return;
        }

        querySnapshot.forEach((doc) => {
            const record = doc.data();
            const docId = doc.id; // 獲取文件ID，方便之後可能需要的操作
            const li = document.createElement('li');

            const recordDate = record.recordedAt && record.recordedAt.toDate 
                ? record.recordedAt.toDate().toLocaleString('zh-TW', { 
                    year: 'numeric', month: 'numeric', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                  }) 
                : '日期未知';
            
            const userLocalTime = record.localTime || '時間未知'; // 獲取使用者記錄時的本地時間

            const cityDisplay = record.city_zh && record.city_zh !== record.city 
                ? `${record.city_zh} (${record.city})` 
                : record.city;
            const countryDisplay = record.country_zh && record.country_zh !== record.country 
                ? `${record.country_zh} (${record.country})` 
                : record.country;

            // ★★★ 修改顯示內容 ★★★
            let recordInfoHTML = `<span class="date">${recordDate}</span> - 
                                  <span class="time">${userLocalTime}</span> - 
                                  甦醒於: <span class="location">${cityDisplay || '未知城市'}, ${countryDisplay || '未知國家'}</span>`;
            
            // 建立「甦醒日誌」連結
            if (record.greeting && record.trivia) {
                const logLink = document.createElement('a');
                logLink.href = "#"; // 避免頁面跳轉
                logLink.textContent = "甦醒日誌";
                logLink.style.marginLeft = "10px"; // 加點間距
                logLink.style.color = "#007bff";    // 連結顏色
                logLink.style.textDecoration = "underline";
                logLink.addEventListener('click', (e) => {
                    e.preventDefault(); // 阻止連結的預設行為
                    // ★★★ 彈出視窗顯示 greeting 和 trivia ★★★
                    const greetingText = record.greeting || "無問候語記錄。";
                    const triviaText = record.trivia || "無小知識記錄。";
                    // 使用 \n 換行
                    alert(`--- 甦醒日誌 ---\n\n${greetingText}\n\n${triviaText}`); 
                });
                
                // 將資訊和連結加入 li 元素
                // 為了能讓連結在右邊，我們可以把 recordInfoHTML 包在一個 span 裡
                const infoSpan = document.createElement('span');
                infoSpan.innerHTML = recordInfoHTML;
                infoSpan.style.flexGrow = "1"; // 讓資訊部分佔據多餘空間

                li.appendChild(infoSpan);
                li.appendChild(logLink);
            } else {
                // 如果沒有 greeting 或 trivia，只顯示基本資訊
                li.innerHTML = recordInfoHTML;
            }
            // ★★★ 修改結束 ★★★
            
            historyListUl.appendChild(li);

            if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                typeof record.longitude === 'number' && isFinite(record.longitude)) {
                historyPoints.push({ 
                    lat: record.latitude,
                    lon: record.longitude,
                    title: `${recordDate} @ ${cityDisplay}, ${countryDisplay}` 
                });
            } else if (record.city !== "Unknown Planet" && record.city !== "未知星球Unknown Planet") { 
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
            // 舊的邏輯:
            // if (auth.currentUser && !triggeredBySetName) {
            //     if (globalDateInput && !globalDateInput.value) { 
            //         globalDateInput.valueAsDate = new Date(); 
            //     }
            //     console.log("[openTab] 呼叫 loadGlobalTodayMap for GlobalTodayMapTab.");
            //     loadGlobalTodayMap();
            // }

            // ★★★ 新的邏輯：強制將日期設為當天 ★★★
               if (auth.currentUser && !triggeredBySetName) {
                    if (globalDateInput) { // 確保日期輸入框存在
                    console.log("[openTab] GlobalTodayMapTab: 強制重設日期為今天。");
                    globalDateInput.valueAsDate = new Date(); // 強制將日期選擇器設為當前日期
                }
                console.log("[openTab] 呼叫 loadGlobalTodayMap for GlobalTodayMapTab (日期已重設為今天).");
                loadGlobalTodayMap(); // 然後載入地圖資料
            }
        }
    }, 0);
    }
});

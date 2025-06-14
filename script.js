// 只保留 DOMContentLoaded 監聽器用於 UI 前置作業（如必要）
// 主要邏輯全部移到 firebaseReady 事件

// 1. 先移除 DOMContentLoaded 裡一開始的 window.firebaseSDK 解構
// 2. 將主程式碼全部搬到 firebaseReady 裡

// 保留全域變數宣告（如 let clockLeafletMap = null; 等）
// 移除不再需要的變數
// let citiesData = [];
// const timezoneOffsetCache = new Map();
let db, auth;
let currentDataIdentifier = null;
let rawUserDisplayName = "";
let clockLeafletMap = null;
let globalLeafletMap = null;
let globalMarkerLayerGroup = null;
let historyLeafletMap = null;
let historyMarkerLayerGroup = null;
let currentGroupName = "";
let initialLoadHandled = false;
// currentMood 變數已移除，改用時間分鐘數決定緯度偏好

window.addEventListener('firebaseReady', async (event) => {
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, setDoc, getDoc, limit, updateDoc,
        setLogLevel
    } = window.firebaseSDK;

    // 將原本 DOMContentLoaded 裡的主程式碼（變數、事件、初始化等）全部搬進來
    // 例如：
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
    const groupNameInput = document.getElementById('groupName');
    const currentGroupNameSpan = document.getElementById('currentGroupName');
    const groupFilterSelect = document.getElementById('groupFilter');
    const todayMoodSelect = document.getElementById('todayMood');

    // 全域變數
    // 移除不再需要的變數
    // let citiesData = [];
    let db, auth;
    let currentDataIdentifier = null;
    let rawUserDisplayName = "";
    let clockLeafletMap = null;
    let globalLeafletMap = null;
    let globalMarkerLayerGroup = null;
    let historyLeafletMap = null;
    let historyMarkerLayerGroup = null;

    // 基於時間分鐘數計算目標緯度的函數
    function calculateTargetLatitudeFromTime() {
        const now = new Date();
        const minutes = now.getMinutes(); // 0-59
        
        // 線性映射：0分=北緯90度，30分≈赤道0度，59分=南緯90度
        // 公式：targetLatitude = 90 - (minutes * 180 / 59)
        const targetLatitude = 90 - (minutes * 180 / 59);
        
        console.log(`時間: ${minutes}分 -> 目標緯度: ${targetLatitude.toFixed(2)}度`);
        
        return targetLatitude;
    }
    
    // 緯度偏好描述
    function getLatitudePreferenceDescription(targetLatitude) {
        // 如果是數值，顯示具體緯度
        if (typeof targetLatitude === 'number') {
            let direction, region;
            
            if (targetLatitude > 0) {
                direction = '北緯';
            } else if (targetLatitude < 0) {
                direction = '南緯';
            } else {
                direction = '赤道';
            }
            
            // 地理區域描述
            const absLat = Math.abs(targetLatitude);
            if (absLat >= 66.5) {
                region = '極地';
            } else if (absLat >= 50) {
                region = '高緯度';
            } else if (absLat >= 30) {
                region = '中緯度';
            } else if (absLat >= 10) {
                region = '低緯度';
            } else {
                region = '熱帶';
            }
            
            if (targetLatitude === 0) {
                return '赤道地區 (0°)';
            } else {
                return `目標${direction}${Math.abs(targetLatitude).toFixed(1)}° (${region}地區)`;
            }
        }
        
        // 舊格式兼容性（如果還有的話）
        if (typeof targetLatitude === 'string') {
            if (targetLatitude.includes('-')) {
                const [category, hemisphere] = targetLatitude.split('-');
                const hemisphereText = hemisphere === 'north' ? '北半球' : '南半球';
                
                const categoryDescriptions = {
                    'high': '高緯度地區',
                    'mid-high': '中高緯度地區',
                    'mid': '中緯度地區',
                    'low': '低緯度地區'
                };
                
                const categoryText = categoryDescriptions[category] || '中緯度地區';
                return `${hemisphereText}${categoryText}`;
            }
            
            const descriptions = {
                'high': '高緯度地區 (最北)',
                'mid-high': '中高緯度地區',
                'mid': '中緯度地區',
                'low': '低緯度地區 (較南)'
            };
            return descriptions[targetLatitude] || '中緯度地區';
        }
        
        return '中緯度地區';
    }

    // 翻譯來源文字轉換函數
    function getTranslationSourceText(source) {
        const sourceTexts = {
            'chatgpt': 'ChatGPT 智能翻譯',
            'chatgpt-fallback': 'ChatGPT 備用翻譯',
            'fallback': '預設翻譯',
            'geonames': 'GeoNames 原始'
        };
        return sourceTexts[source] || source;
    }

    // Firebase 設定
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id-worldclock-history';
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    // 等待 Firebase 配置載入
    async function waitForFirebaseConfig() {
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            if (window.firebaseConfig) {
                return window.firebaseConfig;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        throw new Error('無法載入 Firebase 配置');
    }

    try {
        console.log("等待 Firebase 配置載入...");
        const firebaseConfig = await waitForFirebaseConfig();

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            throw new Error("Firebase 設定不完整!");
    }

        console.log("Firebase 配置已載入，開始初始化...");
        setLogLevel('debug');
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase 初始化成功。App ID:", appId, "Project ID:", firebaseConfig.projectId);

        // 初始化成功後不再需要載入城市數據，改為啟用按鈕
        // await loadCitiesData();

    } catch (e) {
        console.error("Firebase 初始化失敗:", e);
        currentUserIdSpan.textContent = "Firebase 初始化失敗";
        alert("Firebase 初始化失敗，部分功能可能無法使用。");
        return;
    }

    // 移除城市數據載入邏輯
    // async function loadCitiesData() {
    //     try {
    //         const response = await fetch('cities_data.json');
    //         if (!response.ok) {
    //             throw new Error(`HTTP error! status: ${response.status}`);
    //         }
    //         citiesData = await response.json();
    //         console.log("城市數據已載入", citiesData.length, "筆");
    //         if (citiesData.length === 0) {
    //             resultTextDiv.innerHTML = "提示：載入的城市數據為空。";
    //             findCityButton.disabled = true;
    //         } else if (currentDataIdentifier && auth.currentUser) {
    //             findCityButton.disabled = false;
    //         }
    //     } catch (e) {
    //         console.error("無法載入城市數據:", e);
    //         resultTextDiv.innerHTML = "錯誤：無法載入城市數據。";
    //         findCityButton.disabled = true;
    //     }
    // }

    async function fetchStoryFromAPI(city, country, countryCode) {
    console.log(`[fetchStoryFromAPI] Calling backend /api/generateStory for City: ${city}, Country: ${country}, Country Code: ${countryCode}`);

    try {
        const response = await fetch('/api/generateStory', { // 呼叫您 Vercel 部署的 API 路徑
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                city: city,
                country: country
            }),
        });

        if (!response.ok) {
            // 如果 API 返回 HTTP 錯誤狀態 (例如 4xx, 5xx)
            const errorData = await response.json().catch(() => ({ error: "無法解析 API 錯誤回應" })); // 嘗試解析錯誤詳情
            console.error(`API Error from /api/generateStory: ${response.status} ${response.statusText}`, errorData);
            // 返回一個包含錯誤訊息的物件，讓調用者可以處理
            return {
                greeting: `(系統提示：問候語獲取失敗 - ${response.status})`,
                story: `系統提示：關於 ${city}, ${country} 的故事獲取失敗，請稍後再試。錯誤: ${errorData.error || response.statusText}`
            };
        }

        const data = await response.json(); // 解析來自後端 API 的 JSON 回應
        console.log("[fetchStoryFromAPI] Received data from backend:", data);

        // 驗證後端回傳的資料結構是否符合預期 (greeting 和 story)
        if (data && typeof data.greeting === 'string' && typeof data.story === 'string') {
            return {
                greeting: data.greeting,
                story: data.story
            };
        } else if (data && typeof data.greeting === 'string' && typeof data.trivia === 'string') {
            // 向後兼容：如果回傳 trivia 而不是 story
            return {
                greeting: data.greeting,
                story: data.trivia
            };
        } else {
            console.warn("[fetchStoryFromAPI] Backend response format unexpected:", data);
            return {
                greeting: "(系統提示：收到的問候語格式有誤)",
                story: `關於 ${city}, ${country} 的故事正在整理中，請稍後查看！(回應格式問題)`
            };
        }

    } catch (error) {
        console.error("Error calling /api/generateStory from frontend:", error);
        // 網路錯誤或其他前端 fetch 相關的錯誤
        return {
            greeting: "(系統提示：網路錯誤，無法獲取問候語)",
            story: `獲取 ${city}, ${country} 的故事時發生網路連線問題，請檢查您的網路並重試。`
        };
    }
}


    if (globalDateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const localTodayDateString = `${year}-${month}-${day}`;
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
                // 移除對 citiesData 的檢查，直接啟用按鈕
                console.log("Firebase 已認證且 currentDataIdentifier 已設定，啟用 findCityButton。");
                findCityButton.disabled = false;
            }
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

    function generateSafeId(originalName) {
        // 對中文名稱進行 MD5 雜湊（使用簡單的字串轉換方式模擬）
        let hash = 0;
        for (let i = 0; i < originalName.length; i++) {
            const char = originalName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        // 確保 hash 是正數
        hash = Math.abs(hash);
        
        // 如果原始名稱含有英文或數字，將其保留
        const safeChars = originalName.replace(/[^a-zA-Z0-9]/g, '');
        // 如果沒有英文或數字，使用 'user' 作為前綴
        const prefix = safeChars.length > 0 ? safeChars : 'user';
        // 使用雜湊值而不是時間戳
        return `${prefix}_${hash}`;
    }

    function sanitizeNameToFirestoreId(name) {
        if (!name || typeof name !== 'string') return null;
        
        // 檢查名稱是否只包含空白字符
        if (!name.trim()) return null;
        
        // 如果名稱中包含中文字符，使用雜湊函數生成固定的識別碼
        if (/[\u4e00-\u9fa5]/.test(name)) {
            return generateSafeId(name);
        }
        
        // 對於非中文名稱，保持原有的處理邏輯
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
        
        return sanitized.substring(0, 100) || generateSafeId(name);
    }

    async function setOrLoadUserName(name, showAlert = true) {
        console.log("[setOrLoadUserName] 接收到名稱:", name, "showAlert:", showAlert);
        const newDisplayNameRaw = name.trim();
        const newGroupName = groupNameInput.value.trim();
        
        if (!newDisplayNameRaw) {
            if (showAlert) alert("顯示名稱不能為空。");
            return false;
        }

        // 檢查是否是相同的名稱和組別
        if (newDisplayNameRaw === rawUserDisplayName && newGroupName === currentGroupName) {
            console.log("[setOrLoadUserName] 名稱和組別都相同，保持現有識別碼:", currentDataIdentifier);
            if (showAlert) alert(`名稱和組別未變更，仍然是 "${rawUserDisplayName}"`);
            return true;
        }

        // 生成安全的識別碼
        const sanitizedName = sanitizeNameToFirestoreId(newDisplayNameRaw);
        if (!sanitizedName) {
            if (showAlert) alert("處理後的名稱無效（可能為空或過短），請嘗試其他名稱。");
            return false;
        }

        console.log("[setOrLoadUserName] 原始名稱:", newDisplayNameRaw);
        console.log("[setOrLoadUserName] 生成的安全識別碼:", sanitizedName);
        console.log("[setOrLoadUserName] 組別名稱:", newGroupName);

        // 設置全域變數
        currentDataIdentifier = sanitizedName;
        rawUserDisplayName = newDisplayNameRaw;  // 保存原始名稱，包含中文
        currentGroupName = newGroupName;  // 保存組別名稱

        // 更新 UI
        currentUserIdSpan.textContent = rawUserDisplayName;  // 顯示原始名稱
        currentUserDisplayNameSpan.textContent = rawUserDisplayName;  // 顯示原始名稱
        userNameInput.value = rawUserDisplayName;  // 保持輸入框顯示原始名稱
        currentGroupNameSpan.textContent = currentGroupName ? `(${currentGroupName})` : '';
        localStorage.setItem('worldClockUserName', rawUserDisplayName);
        localStorage.setItem('worldClockGroupName', currentGroupName);

        console.log("[setOrLoadUserName] 使用者資料識別碼已設定為:", currentDataIdentifier);
        console.log("[setOrLoadUserName] 顯示名稱設定為:", rawUserDisplayName);
        console.log("[setOrLoadUserName] 組別名稱設定為:", currentGroupName);

        if (showAlert) alert(`名稱已設定為 "${rawUserDisplayName}"${currentGroupName ? `，組別為 "${currentGroupName}"` : ''}。開啟這一天或是看看最後你甦醒的城市在哪裡？`);

        // 更新組別選擇下拉選單
        await updateGroupFilter();

        // 移除對 citiesData 的檢查，直接根據認證狀態啟用按鈕
        if (auth.currentUser && currentDataIdentifier) {
            console.log("[setOrLoadUserName] 所有條件滿足，啟用 findCityButton。");
            findCityButton.disabled = false;
        } else {
            console.log("[setOrLoadUserName] 條件不滿足，findCityButton 保持禁用。Auth current user:", !!auth.currentUser, "Data ID set:", !!currentDataIdentifier);
            findCityButton.disabled = true;
        }

        console.log("[setOrLoadUserName] 準備切換到時鐘分頁並顯示最後記錄。");
        openTab(null, 'ClockTab', true);
        await displayLastRecordForCurrentUser();
        return true;
    }

    async function updateGroupFilter() {
        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        try {
            const querySnapshot = await getDocs(globalCollectionRef);
            const groups = new Set(['all']);
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.groupName) {
                    groups.add(data.groupName);
                }
            });

            groupFilterSelect.innerHTML = '';
            groupFilterSelect.appendChild(new Option('所有人', 'all'));
            Array.from(groups)
                .filter(group => group !== 'all')
                .sort()
                .forEach(group => {
                    groupFilterSelect.appendChild(new Option(group, group));
                });

            // 如果當前使用者有組別，預設選擇該組別
            if (currentGroupName && groups.has(currentGroupName)) {
                groupFilterSelect.value = currentGroupName;
            }
        } catch (error) {
            console.error("更新組別過濾器失敗:", error);
        }
    }

    // 設定名稱按鈕的事件處理
    setUserNameButton.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log("「設定/更新名稱」按鈕被點擊。");
        await setOrLoadUserName(userNameInput.value.trim());
    });

    // 添加觸控事件支援
    setUserNameButton.addEventListener('touchstart', async (e) => {
        e.preventDefault();
        console.log("「設定/更新名稱」按鈕被觸控。");
        await setOrLoadUserName(userNameInput.value.trim());
    }, { passive: false });

    // 防止觸控時的滾動
    setUserNameButton.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });

    // 防止觸控結束時的點擊事件
    setUserNameButton.addEventListener('touchend', (e) => {
        e.preventDefault();
    }, { passive: false });

    // 添加 CSS 樣式以改善手機上的按鈕體驗
    const buttonStyle = document.createElement('style');
    buttonStyle.textContent = `
        #setUserNameButton {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            cursor: pointer;
            min-height: 44px;
            padding: 8px 16px;
            border-radius: 4px;
            border: 1px solid #ccc;
            background-color: #a6a08f;
            color: white;
            transition: background-color 0.2s;
        }
        #setUserNameButton:active {
            background-color: #827d6f;
        }
        @media (hover: hover) {
            #setUserNameButton:hover {
                background-color: #827d6f;
            }
        }
    `;
    document.head.appendChild(buttonStyle);

    async function displayLastRecordForCurrentUser() {
        console.log("[displayLastRecordForCurrentUser] 函數被呼叫。currentDataIdentifier:", currentDataIdentifier);
        clearPreviousResults();

        if (!currentDataIdentifier) {
            console.log("[displayLastRecordForCurrentUser] currentDataIdentifier 為空，返回。");
            resultTextDiv.innerHTML = `<p>請先在上方設定您的顯示名稱。</p>`;
            return;
        }
        if (!auth.currentUser) {
            console.log("[displayLastRecordForCurrentUser] Firebase 使用者未認證，返回。");
            resultTextDiv.innerHTML = `<p>Firebase 認證中，請稍候...</p>`;
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

                const greetingText = lastRecord.greeting || ""; 
                const storyText = lastRecord.story || "上次甦醒時的特別記事未記錄。";

                let mainMessage = "";
                if (lastRecord.country === "Universe" || (lastRecord.country_zh === "宇宙" && lastRecord.city_zh === "未知星球")) {
                     mainMessage = `${rawUserDisplayName}已脫離地球，<br>與<strong>${finalCityName} (${finalCountryName})</strong>非地球生物共同開啟了新的一天！`;
                } else {
                     mainMessage = `${rawUserDisplayName} 於<strong>${finalCityName} (${finalCountryName})</strong>甦醒。`;
                }
                resultTextDiv.innerHTML = `
                    <p style="font-weight: bold; font-size: 1.1em;">${greetingText}</p>
                    <p>${mainMessage}</p>
                    <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyText}</p>
                `;

                if (lastRecord.country_iso_code && lastRecord.country_iso_code !== 'universe_code') {
                    countryFlagImg.src = `https://flagcdn.com/w40/${lastRecord.country_iso_code.toLowerCase()}.png`;
                    countryFlagImg.alt = `${finalCountryName} 國旗`;
                    countryFlagImg.style.display = 'inline-block';
                } else {
                    countryFlagImg.style.display = 'none';
                }

                if (clockLeafletMap) {
                    clockLeafletMap.remove();
                    clockLeafletMap = null;
                }
                mapContainerDiv.innerHTML = '';
                mapContainerDiv.classList.remove('universe-message');

                if (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude) &&
                    typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) {
                    clockLeafletMap = L.map(mapContainerDiv).setView([lastRecord.latitude, lastRecord.longitude], 7);
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                        subdomains: 'abcd', maxZoom: 19
                    }).addTo(clockLeafletMap);
                    L.circleMarker([lastRecord.latitude, lastRecord.longitude], {
                        color: 'red', fillColor: '#f03', fillOpacity: 0.8, radius: 8
                    }).addTo(clockLeafletMap).bindPopup(`<b>${finalCityName}</b><br>${finalCountryName}`).openPopup();
                } else if (lastRecord.city === "Unknown Planet" || lastRecord.city_zh === "未知星球") {
                    mapContainerDiv.classList.add('universe-message');
                    mapContainerDiv.innerHTML = "<p>浩瀚宇宙，無從定位...</p>";
                } else {
                    mapContainerDiv.innerHTML = "<p>無法顯示地圖，此記錄座標資訊不完整或無效。</p>";
                }

                // 添加早餐圖片顯示區域
                // 先清除已存在的早餐圖片容器，防止重複顯示
                const existingBreakfastContainers = document.querySelectorAll('#breakfastImageContainer');
                existingBreakfastContainers.forEach(container => container.remove());
                
                const breakfastContainer = document.createElement('div');
                breakfastContainer.id = 'breakfastImageContainer';
                breakfastContainer.style.marginTop = '20px';
                breakfastContainer.style.textAlign = 'center';

                if (lastRecord.imageUrl) {
                    breakfastContainer.innerHTML = `
                        <div class="postcard-image-container">
                            <img src="${lastRecord.imageUrl}" alt="${finalCityName}的早餐" style="max-width: 100%; border-radius: 8px;">
                            <p style="font-size: 0.9em; color: #555;"><em>${finalCityName}的早餐</em></p>
                        </div>
                    `;
                } else {
                    breakfastContainer.innerHTML = '<p style="color: #999;"><em>此記錄沒有早餐圖片。</em></p>';
                }

                // 將早餐圖片容器插入到地圖和 debugInfo 之間
                debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);

                const recordedAtDate = lastRecord.recordedAt && lastRecord.recordedAt.toDate ? lastRecord.recordedAt.toDate().toLocaleString('zh-TW') : '未知記錄時間';
                const targetUTCOffsetStr = (typeof lastRecord.targetUTCOffset === 'number' && isFinite(lastRecord.targetUTCOffset)) ? lastRecord.targetUTCOffset.toFixed(2) : 'N/A';
                const latitudeStr = (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude)) ? lastRecord.latitude.toFixed(2) : 'N/A';
                const longitudeStr = (typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) ? lastRecord.longitude.toFixed(2) : 'N/A';

                //debugInfoSmall.innerHTML = `(記錄於: ${recordedAtDate})<br>(目標城市緯度: ${latitudeStr}°, 經度: ${longitudeStr}°)<br>(目標 UTC 偏移: ${targetUTCOffsetStr}, 城市實際 UTC 偏移: ${cityActualUTCOffset !== null ? cityActualUTCOffset.toFixed(2) : 'N/A'}, 時區: ${lastRecord.timezone || '未知'})`;
            } else {
                resultTextDiv.innerHTML = `<p>歡迎，${rawUserDisplayName}！此名稱尚無歷史記錄。</p><p>按下「我在哪裡甦醒？」按鈕，開始您的主觀時間之旅吧！</p>`;
                console.log("[displayLastRecordForCurrentUser] 此識別碼尚無歷史記錄。");
            }
        } catch (e) {
            console.error("[displayLastRecordForCurrentUser] 讀取最後一筆記錄失敗:", e);
            resultTextDiv.innerHTML = "<p>讀取最後記錄失敗。</p>";
        }
    }

    async function findMatchingCity() {
        clearPreviousResults();
        console.log("--- 開始使用 GeoNames API 尋找匹配城市 ---");
        findCityButton.disabled = true; // 防止重複點擊
        resultTextDiv.innerHTML = "<p>正在定位你的甦醒座標，請稍候...</p>";

        // 檢查並更新最新的用戶名稱和組名
        const currentUserName = userNameInput.value.trim();
        const currentGroupNameValue = groupNameInput.value.trim();
        
        if (!currentUserName) {
            alert("請先輸入你的顯示名稱。");
            findCityButton.disabled = false;
            return;
        }

        // 更新全域變數為最新值
        rawUserDisplayName = currentUserName;
        currentGroupName = currentGroupNameValue;
        
        // 更新顯示
        currentUserIdSpan.textContent = rawUserDisplayName;
        currentUserDisplayNameSpan.textContent = rawUserDisplayName;
        if (currentGroupName) {
            currentGroupNameSpan.textContent = `[${currentGroupName}]`;
        } else {
            currentGroupNameSpan.textContent = '';
        }
        
        console.log(`[findMatchingCity] 使用最新資料 - 名稱: ${rawUserDisplayName}, 組名: ${currentGroupName || '無'}`)
        
        // 如果用戶名稱改變了，需要重新設定currentDataIdentifier
        const newDataIdentifier = sanitizeNameToFirestoreId(rawUserDisplayName);
        if (currentDataIdentifier !== newDataIdentifier) {
            currentDataIdentifier = newDataIdentifier;
            console.log("[findMatchingCity] 用戶名稱已變更，更新識別碼為:", currentDataIdentifier);
        }

        if (!auth.currentUser) {
            alert("Firebase 會話未就緒，請稍候或刷新頁面。");
            findCityButton.disabled = false;
            return;
        }

        try {
            // 首先獲取用戶的城市訪問統計
            console.log("獲取用戶城市訪問統計...");
            const cityVisitStats = await getUserCityVisitStats();

            // 獲取用戶當前的本地時間
            const userLocalDate = new Date();
            
            // 計算用戶的 UTC 時間
            const userUTCHours = userLocalDate.getUTCHours();
            const userUTCMinutes = userLocalDate.getUTCMinutes();
            const userUTCTime = userUTCHours + userUTCMinutes / 60;

            // 目標時間是當地時間早上 8:00
            const targetLocalHour = 8;
            
            // 計算需要的UTC偏移：要讓當地時間是8點，需要多少偏移
            // 如果現在UTC是7點，那麼UTC+1的地方當地時間就是8點
            let requiredUTCOffset = targetLocalHour - userUTCTime;
            
            // 調整到 -12 到 +14 的有效時區範圍內（考慮跨日情況）
            while (requiredUTCOffset > 14) {
                requiredUTCOffset -= 24;
            }
            while (requiredUTCOffset < -12) {
                requiredUTCOffset += 24;
            }

            // 基於當前時間的分鐘數計算緯度偏好
            const targetLatitude = calculateTargetLatitudeFromTime();
            const latitudeDescription = getLatitudePreferenceDescription(targetLatitude);

            console.log(`尋找 UTC${requiredUTCOffset >= 0 ? '+' : ''}${requiredUTCOffset.toFixed(2)} 的地方 (當地時間 ${targetLocalHour}:00)`);
            console.log(`按下時間分鐘數: ${userLocalDate.getMinutes()}, 目標緯度: ${targetLatitude.toFixed(2)}° (${latitudeDescription})`);

            // 調用我們的新 API 來尋找城市
            const response = await fetch('/api/find-city-geonames', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetUTCOffset: requiredUTCOffset,
                    targetLatitude: targetLatitude, // 傳遞目標緯度
                    timeMinutes: userLocalDate.getMinutes(), // 傳遞分鐘數用於記錄
                    userCityVisitStats: cityVisitStats, // 傳遞用戶城市訪問統計
                    userLocalTime: userLocalDate.toLocaleTimeString('en-US', { hour12: false }), // 傳遞用戶當地時間
                    latitude: userLocalDate.getTimezoneOffset() ? -userLocalDate.getTimezoneOffset() / 60 : 0, // 傳遞用戶當地緯度
                    longitude: 0 // 傳遞用戶當地經度
                })
            });

            if (!response.ok) {
                throw new Error(`API 調用失敗: ${response.status}`);
            }

            const apiResult = await response.json();
            console.log("從 GeoNames API 收到的結果:", apiResult);

            // 檢查是否是宇宙情況
            if (apiResult.isUniverseCase) {
                const apiResponse = await fetchStoryFromAPI("未知星球", "宇宙", "UNIVERSE_CODE");
                const greetingFromAPI = apiResponse.greeting;
                const storyFromAPI = apiResponse.story;

                resultTextDiv.innerHTML = `
                    <p style="font-weight: bold; font-size: 1.1em;">${greetingFromAPI}</p>
                    <p>今天的你，在當地 <strong>${userLocalDate.toLocaleTimeString()}</strong> 開啟了這一天，<br>但是很抱歉，你已經脫離地球了，與非地球生物共同開啟了新的一天。</p>
                    <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyFromAPI}</p>
                `;

                if (clockLeafletMap) {
                    clockLeafletMap.remove();
                    clockLeafletMap = null;
                }
                mapContainerDiv.innerHTML = '';
                mapContainerDiv.classList.add('universe-message');
                mapContainerDiv.innerHTML = "<p>浩瀚宇宙，無從定位...</p>";
                countryFlagImg.style.display = 'none';

                // 創建早餐圖片容器
                const breakfastContainer = document.createElement('div');
                breakfastContainer.id = 'breakfastImageContainer';
                breakfastContainer.style.marginTop = '20px';
                breakfastContainer.style.textAlign = 'center';
                breakfastContainer.innerHTML = '<p style="color: #007bff;"><i>正在為你準備來自宇宙深處的神秘早餐......</i></p>';
                
                // 將早餐圖片容器插入到地圖和 debugInfo 之間
                //debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);
                //debugInfoSmall.innerHTML = `(目標 UTC 偏移: ${requiredUTCOffset.toFixed(2)})`;

                // 先保存宇宙記錄（不包含圖片）
                // 使用本地日期而不是UTC日期
                const year = userLocalDate.getFullYear();
                const month = (userLocalDate.getMonth() + 1).toString().padStart(2, '0');
                const day = userLocalDate.getDate().toString().padStart(2, '0');
                const userLocalDateString = `${year}-${month}-${day}`;

                const universeRecord = {
                    dataIdentifier: currentDataIdentifier,
                    userDisplayName: rawUserDisplayName,
                    recordedAt: serverTimestamp(),
                    localTime: userLocalDate.toLocaleTimeString(),
                    city: "Unknown Planet",
                    country: "Universe",
                    city_zh: "未知星球",
                    country_zh: "宇宙",
                    country_iso_code: "universe_code",
                    latitude: null,
                    longitude: null,
                    targetUTCOffset: requiredUTCOffset,
                    matchedCityUTCOffset: null,
                    recordedDateString: userLocalDateString,
                    greeting: greetingFromAPI,
                    story: storyFromAPI,
                    imageUrl: null, // 初始設為 null，生成成功後更新
                    timezone: "Cosmic/Unknown",
                    isUniverseTheme: true,
                    timeMinutes: userLocalDate.getMinutes(),
                    latitudePreference: targetLatitude,
                    latitudeDescription: latitudeDescription
                };

                // 先保存記錄
                const savedUniverseDocId = await saveHistoryRecord(universeRecord);
                await saveToGlobalDailyRecord(universeRecord);

                // 然後生成早餐圖片，使用特殊的宇宙主題提示
                try {
                    // 獲取 Firebase Auth token
                    const idToken = await auth.currentUser.getIdToken();
                    
                    const imageResponse = await fetch('/api/generateImage', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({ 
                            city: "未知星球",
                            country: "宇宙",
                            isUniverseTheme: true
                        })
                    });

                    if (!imageResponse.ok) throw new Error(await imageResponse.text());
                    const imageData = await imageResponse.json();

                    if (imageData.imageUrl) {
                        breakfastContainer.innerHTML = `
                            <div class="postcard-image-container">
                                <img src="${imageData.imageUrl}" alt="宇宙早餐" style="max-width: 100%; border-radius: 8px;">
                                <p style="font-size: 0.9em; color: #555;"><em>今日的星際早餐</em></p>
                            </div>
                        `;
                        console.log("宇宙早餐圖片生成成功，URL:", imageData.imageUrl);
                        
                        // 將圖片 URL 更新到已保存的宇宙記錄中
                        if (savedUniverseDocId) {
                            try {
                                const historyDocRef = doc(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`, savedUniverseDocId);
                                await updateDoc(historyDocRef, {
                                    imageUrl: imageData.imageUrl
                                });
                                console.log("宇宙早餐圖片 URL 已更新到記錄中");
                            } catch (updateError) {
                                console.error("更新宇宙記錄中的圖片 URL 失敗:", updateError);
                            }
                        }
                    } else {
                        breakfastContainer.innerHTML = `<p style="color: #888;">星際早餐圖片生成中，請稍後查看歷史記錄！</p>`;
                    }
                } catch (error) {
                    console.error("生成早餐圖片失敗:", error);
                    breakfastContainer.innerHTML = `<p style="color: #888;">星際早餐圖片暫時無法顯示，但您的甦醒記錄已保存！</p>`;
                }

                console.log("--- 尋找匹配城市結束 (宇宙情況) ---");
                findCityButton.disabled = false;
                return;
            }

            // 處理正常的城市結果
            // 如果 API 返回的是一個陣列（多個匹配城市），使用智能選擇
            let bestMatchCity;
            if (Array.isArray(apiResult) && apiResult.length > 1) {
                console.log(`發現 ${apiResult.length} 個匹配的城市，使用訪問統計進行智能選擇...`);
                bestMatchCity = selectCityWithVisitHistory(apiResult, cityVisitStats);
            } else if (Array.isArray(apiResult) && apiResult.length === 1) {
                bestMatchCity = apiResult[0];
            } else {
                // 如果不是陣列，假設是單一城市結果
                bestMatchCity = apiResult;
            }

            if (!bestMatchCity) {
                throw new Error("無法從 API 結果中選擇合適的城市");
            }

            // 保留英文城市和國家名稱
            const englishCityName = bestMatchCity.city;
            const englishCountryName = bestMatchCity.country;
            
            // 檢查是否需要 ChatGPT 翻譯
            let finalCityName = englishCityName;
            let finalCountryName = englishCountryName;
            
            // 如果沒有中文翻譯，使用 ChatGPT 翻譯
            if (!bestMatchCity.city_zh || bestMatchCity.city_zh === englishCityName || 
                !bestMatchCity.country_zh || bestMatchCity.country_zh === englishCountryName) {
                
                try {
                    console.log("缺少中文翻譯，調用 ChatGPT 翻譯...");
                    const translationResponse = await fetch('/api/translate-location', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            city: englishCityName,
                            country: englishCountryName
                        })
                    });
                    
                    if (translationResponse.ok) {
                        const translationData = await translationResponse.json();
                        if (translationData.city_zh) bestMatchCity.city_zh = translationData.city_zh;
                        if (translationData.country_zh) bestMatchCity.country_zh = translationData.country_zh;
                        console.log("ChatGPT 翻譯成功:", translationData);
                    }
                } catch (error) {
                    console.error("ChatGPT 翻譯失敗:", error);
                }
            }
            
            // 格式化顯示名稱：English (中文)
            finalCityName = bestMatchCity.city_zh && bestMatchCity.city_zh !== englishCityName ? 
                `${englishCityName} (${bestMatchCity.city_zh})` : englishCityName;
            finalCountryName = bestMatchCity.country_zh && bestMatchCity.country_zh !== englishCountryName ? 
                `${englishCountryName} (${bestMatchCity.country_zh})` : englishCountryName;

            const apiResponse = await fetchStoryFromAPI(englishCityName, englishCountryName, bestMatchCity.country_iso_code);
            const greetingFromAPI = apiResponse.greeting;
            const storyFromAPI = apiResponse.story;

            // 顯示緯度資訊
            const latitudeInfo = bestMatchCity.latitude ? 
                `緯度 ${Math.abs(bestMatchCity.latitude).toFixed(1)}°${bestMatchCity.latitude >= 0 ? 'N' : 'S'}` : '';
            const latitudeCategory = bestMatchCity.latitudeCategory || '';
            
            resultTextDiv.innerHTML = `
                <p style="font-weight: bold; font-size: 1.1em;">${greetingFromAPI}</p>
                <p>今天的你在<strong>${finalCityName}, ${finalCountryName}</strong>甦醒！</p>
                ${latitudeInfo ? `<p style="font-size: 0.9em; color: #666;">位於${latitudeInfo}${latitudeCategory ? ` (${latitudeCategory})` : ''}</p>` : ''}
                <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyFromAPI}</p>
                ${bestMatchCity.source === 'predefined' ? '<p style="font-size: 0.8em; color: #888;"><em>※ 使用預設城市資料</em></p>' : ''}
            `;

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
            mapContainerDiv.classList.remove('universe-message');

            if (typeof bestMatchCity.latitude === 'number' && isFinite(bestMatchCity.latitude) &&
                typeof bestMatchCity.longitude === 'number' && isFinite(bestMatchCity.longitude)) {
                
                clockLeafletMap = L.map(mapContainerDiv, {
                    scrollWheelZoom: false,
                    doubleClickZoom: false
                }).setView([bestMatchCity.latitude, bestMatchCity.longitude], 10);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(clockLeafletMap);

                L.marker([bestMatchCity.latitude, bestMatchCity.longitude])
                    .addTo(clockLeafletMap)
                    .bindPopup(finalCityName)
                    .openPopup();
            }

            // 創建早餐圖片容器
            const breakfastContainer = document.createElement('div');
            breakfastContainer.id = 'breakfastImageContainer';
            breakfastContainer.style.marginTop = '20px';
            breakfastContainer.style.textAlign = 'center';
            breakfastContainer.innerHTML = '<p style="color: #007bff;"><i>正在為你準備當地特色早餐......</i></p>';
            
            debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);

            const recordedAtDate = userLocalDate.toLocaleString();
            const latitudeStr = bestMatchCity.latitude.toFixed(5);
            const longitudeStr = bestMatchCity.longitude.toFixed(5);
            const targetUTCOffsetStr = requiredUTCOffset >= 0 ? `+${requiredUTCOffset.toFixed(2)}` : requiredUTCOffset.toFixed(2);
            const cityActualUTCOffset = bestMatchCity.timezoneOffset;

            //debugInfoSmall.innerHTML = `(記錄於: ${recordedAtDate})<br>(目標 UTC 偏移: ${targetUTCOffsetStr}, 城市實際 UTC 偏移: ${cityActualUTCOffset !== null ? cityActualUTCOffset.toFixed(2) : 'N/A'}, 時區: ${bestMatchCity.timezone || '未知'})`;

            // 先保存基本記錄（不包含圖片）
            // 使用本地日期而不是UTC日期
            const year = userLocalDate.getFullYear();
            const month = (userLocalDate.getMonth() + 1).toString().padStart(2, '0');
            const day = userLocalDate.getDate().toString().padStart(2, '0');
            const userLocalDateString = `${year}-${month}-${day}`;

            const historyRecord = {
                dataIdentifier: currentDataIdentifier,
                userDisplayName: rawUserDisplayName,
                recordedAt: serverTimestamp(),
                localTime: userLocalDate.toLocaleTimeString(),
                city: englishCityName,
                country: englishCountryName,
                city_zh: bestMatchCity.city_zh || "",
                country_zh: bestMatchCity.country_zh || "",
                country_iso_code: bestMatchCity.country_iso_code,
                latitude: bestMatchCity.latitude,
                longitude: bestMatchCity.longitude,
                targetUTCOffset: requiredUTCOffset,
                matchedCityUTCOffset: cityActualUTCOffset,
                recordedDateString: userLocalDateString,
                greeting: greetingFromAPI,
                story: storyFromAPI,
                imageUrl: null, // 初始設為 null，生成成功後更新
                timezone: bestMatchCity.timezone,
                source: bestMatchCity.source || 'geonames',
                translationSource: bestMatchCity.translationSource || 'geonames',
                timeMinutes: userLocalDate.getMinutes(),
                latitudePreference: targetLatitude,
                latitudeDescription: latitudeDescription,
                latitudeCategory: bestMatchCity.latitudeCategory || ''
            };

            // 先保存記錄
            const savedDocId = await saveHistoryRecord(historyRecord);
            await saveToGlobalDailyRecord(historyRecord);

            // 然後嘗試生成早餐圖片
            try {
                // 獲取 Firebase Auth token
                const idToken = await auth.currentUser.getIdToken();
                
                const imageResponse = await fetch('/api/generateImage', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ 
                        city: englishCityName,
                        country: englishCountryName
                    })
                });

                if (!imageResponse.ok) throw new Error(await imageResponse.text());
                const imageData = await imageResponse.json();

                if (imageData.imageUrl) {
                    breakfastContainer.innerHTML = `
                        <div class="postcard-image-container">
                            <img src="${imageData.imageUrl}" alt="${englishCityName}早餐" style="max-width: 100%; border-radius: 8px;">
                            <p style="font-size: 0.9em; color: #555;"><em>今日的${englishCityName}早餐</em></p>
                        </div>
                    `;

                    // 更新記錄中的圖片 URL
                    console.log("早餐圖片生成成功，URL:", imageData.imageUrl);
                    
                    // 將圖片 URL 更新到已保存的記錄中
                    if (savedDocId) {
                        try {
                            const historyDocRef = doc(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`, savedDocId);
                            await updateDoc(historyDocRef, {
                                imageUrl: imageData.imageUrl
                            });
                            console.log("早餐圖片 URL 已更新到記錄中");
                        } catch (updateError) {
                            console.error("更新記錄中的圖片 URL 失敗:", updateError);
                        }
                    }
                } else {
                    breakfastContainer.innerHTML = `<p style="color: #888;">今日早餐圖片生成中，請稍後查看歷史記錄！</p>`;
                }
            } catch (error) {
                console.error("生成早餐圖片失敗:", error);
                breakfastContainer.innerHTML = `<p style="color: #888;">今日早餐圖片暫時無法顯示，但您的甦醒記錄已保存！</p>`;
            }

            console.log("--- 使用 GeoNames API 尋找匹配城市結束 ---");

        } catch (error) {
            console.error("使用 GeoNames API 尋找城市時發生錯誤:", error);
            resultTextDiv.innerHTML = `<p style="color: red;">抱歉，使用 GeoNames API 尋找城市時發生錯誤：${error.message}</p>`;
        } finally {
            findCityButton.disabled = false;
        }
    }

    findCityButton.addEventListener('click', findMatchingCity);
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }

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
        mapContainerDiv.classList.remove('universe-message');
        debugInfoSmall.innerHTML = "";

        // 清除所有已存在的早餐圖片容器
        const existingBreakfastContainers = document.querySelectorAll('#breakfastImageContainer');
        existingBreakfastContainers.forEach(container => container.remove());
    }

    async function saveHistoryRecord(recordData) {
        if (!currentDataIdentifier) {
            console.warn("無法儲存歷史記錄：使用者名稱未設定。");
            return;
        }
        // 確保記錄數據包含所有必要欄位
        recordData.greeting = recordData.greeting || "";
        recordData.story = recordData.story || "";
        recordData.imageUrl = recordData.imageUrl || null;
        recordData.groupName = currentGroupName || "";  // 添加組別資訊

        if (recordData.city !== "Unknown Planet" && recordData.city_zh !== "未知星球" &&
            (typeof recordData.latitude !== 'number' || !isFinite(recordData.latitude) ||
             typeof recordData.longitude !== 'number' || !isFinite(recordData.longitude))) {
            console.error("無法儲存地球歷史記錄：經緯度無效。", recordData);
            return;
        }
        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        try {
            const docRef = await addDoc(historyCollectionRef, recordData);
            console.log("個人歷史記錄已儲存，文件 ID:", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("儲存個人歷史記錄到 Firestore 失敗:", e);
            return null;
        }
    }

    async function saveToGlobalDailyRecord(recordData) {
        if (!auth.currentUser) {
            console.warn("無法儲存全域記錄：Firebase 會話未就緒。");
            return;
        }

        // 使用傳入記錄中的原始日期，而不是重新創建
        const originalDateString = recordData.recordedDateString;

        console.log(`[saveToGlobalDailyRecord] 使用原始記錄日期: ${originalDateString}`);

        const globalRecord = {
            dataIdentifier: recordData.dataIdentifier,
            userDisplayName: recordData.userDisplayName,
            groupName: currentGroupName || "",  // 添加組別資訊
            recordedAt: recordData.recordedAt,
            recordedDateString: originalDateString,
            city: recordData.city,
            country: recordData.country,
            city_zh: recordData.city_zh,
            country_zh: recordData.country_zh,
            country_iso_code: recordData.country_iso_code,
            latitude: recordData.latitude,
            longitude: recordData.longitude,
            timezone: recordData.timezone || "Unknown"
        };

        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        try {
            const docRef = await addDoc(globalCollectionRef, globalRecord);
            console.log(`[saveToGlobalDailyRecord] 全域每日記錄已儲存，文件 ID: ${docRef.id}`);
            await updateGroupFilter();  // 更新組別選擇下拉選單
        } catch (e) {
            console.error("[saveToGlobalDailyRecord] 儲存全域每日記錄到 Firestore 失敗:", e);
        }
    }

    // 新增：獲取用戶的城市訪問統計
    async function getUserCityVisitStats() {
        if (!currentDataIdentifier || !auth.currentUser) {
            console.log("[getUserCityVisitStats] 用戶未設定或未認證，返回空統計");
            return {};
        }

        try {
            const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
            const querySnapshot = await getDocs(historyCollectionRef);
            const cityVisitCount = {};

            querySnapshot.forEach((doc) => {
                const record = doc.data();
                // 使用城市英文名作為唯一標識
                const cityKey = record.city;
                if (cityKey && cityKey !== "Unknown Planet") {
                    cityVisitCount[cityKey] = (cityVisitCount[cityKey] || 0) + 1;
                }
            });

            console.log("[getUserCityVisitStats] 城市訪問統計:", cityVisitCount);
            return cityVisitCount;
        } catch (error) {
            console.error("[getUserCityVisitStats] 獲取城市訪問統計失敗:", error);
            return {};
        }
    }

    // 新增：根據訪問歷史智能選擇城市
    function selectCityWithVisitHistory(matchingCities, cityVisitStats) {
        if (matchingCities.length === 0) {
            return null;
        }

        if (matchingCities.length === 1) {
            return matchingCities[0];
        }

        // 為每個城市添加訪問次數信息
        const citiesWithStats = matchingCities.map(city => ({
            ...city,
            visitCount: cityVisitStats[city.city] || 0
        }));

        // 找出訪問次數最少的次數
        const minVisitCount = Math.min(...citiesWithStats.map(city => city.visitCount));
        
        // 篩選出訪問次數最少的城市
        const leastVisitedCities = citiesWithStats.filter(city => city.visitCount === minVisitCount);

        console.log(`[selectCityWithVisitHistory] 找到 ${matchingCities.length} 個符合條件的城市`);
        console.log(`[selectCityWithVisitHistory] 最少訪問次數: ${minVisitCount}, 符合的城市數量: ${leastVisitedCities.length}`);

        // 在訪問次數最少的城市中隨機選擇
        const randomIndex = Math.floor(Math.random() * leastVisitedCities.length);
        const selectedCity = leastVisitedCities[randomIndex];

        console.log(`[selectCityWithVisitHistory] 選擇城市: ${selectedCity.city}, 訪問次數: ${selectedCity.visitCount}`);
        return selectedCity;
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

        const selectedGroup = groupFilterSelect.value;
        console.log(`[loadGlobalTodayMap] 開始載入日期 ${selectedDateValue} 的全域地圖，組別: ${selectedGroup}`);

        if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>載入今日眾人地圖中...</p>';
        else if (globalMarkerLayerGroup) globalMarkerLayerGroup.clearLayers();

        globalTodayDebugInfoSmall.textContent = `查詢日期: ${selectedDateValue}${selectedGroup !== 'all' ? `, 組別: ${selectedGroup}` : ''}`;

        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        let q = query(globalCollectionRef, where("recordedDateString", "==", selectedDateValue));
        
        if (selectedGroup !== 'all') {
            q = query(q, where("groupName", "==", selectedGroup));
        }

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[loadGlobalTodayMap] 查詢完成，找到 ${querySnapshot.size} 筆記錄`);
            const globalPoints = [];

            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    const record = doc.data();
                    console.log(`[loadGlobalTodayMap] 處理記錄:`, record);

                    if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                        typeof record.longitude === 'number' && isFinite(record.longitude)) {

                        const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                        const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;
                        const userDisplay = record.userDisplayName || record.dataIdentifier || "匿名";
                        const groupInfo = record.groupName ? ` [${record.groupName}]` : '';

                        globalPoints.push({
                            lat: record.latitude,
                            lon: record.longitude,
                            title: `${userDisplay}${groupInfo} @ ${cityDisplay}, ${countryDisplay}`
                        });
                    }
                });
            }

            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, 
                `日期 ${selectedDateValue} 的${selectedGroup !== 'all' ? `${selectedGroup}組別` : '眾人'}甦醒地圖`, 'global');

        } catch (e) {
            console.error("[loadGlobalTodayMap] 讀取全域每日記錄失敗:", e);
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
        }

        console.log(`[renderPointsOnMap] 清除 ${mapDivElement.id} 上的舊標記。`);
        if (currentMarkerLayerGroup) {
            currentMarkerLayerGroup.clearLayers();
        } else {
            currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);
            if (mapType === 'global') globalMarkerLayerGroup = currentMarkerLayerGroup;
            else if (mapType === 'history') historyMarkerLayerGroup = currentMarkerLayerGroup;
        }
        if (currentMapInstance.getContainer().innerHTML.includes("<p>")) {
            mapDivElement.innerHTML = '';
            mapDivElement.appendChild(currentMapInstance.getContainer());
        }
        currentMapInstance.invalidateSize();

        if (!points || points.length === 0) {
            if (currentMarkerLayerGroup) currentMarkerLayerGroup.clearLayers();
            console.log("[renderPointsOnMap] 沒有點可以渲染，在地圖上顯示提示。");
            if(debugDivElement) debugDivElement.textContent = `${mapTitle}：尚無有效座標點可顯示。`;
            else console.warn("Debug element not provided for no-points message.");
            // 如果地圖已初始化，但無數據，則重置視圖到一個通用位置
            if (currentMapInstance) {
                currentMapInstance.setView([20, 0], 2);
            }
            return;
        }

        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        let validPointsForBboxCount = 0;

        // 創建一個 Map 來存儲相同位置的點
        const locationMap = new Map();

        // 首先將所有點按位置分組
        points.forEach(point => {
            if (typeof point.lat === 'number' && isFinite(point.lat) && 
                typeof point.lon === 'number' && isFinite(point.lon)) {
                
                // 使用位置作為鍵（精確到小數點後 4 位）
                const locationKey = `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`;
                
                if (!locationMap.has(locationKey)) {
                    locationMap.set(locationKey, {
                        lat: point.lat,
                        lon: point.lon,
                        titles: []
                    });
                }
                
                // 將此點的標題添加到該位置的列表中
                locationMap.get(locationKey).titles.push(point.title);
                
                // 更新邊界框
                minLat = Math.min(minLat, point.lat);
                maxLat = Math.max(maxLat, point.lat);
                minLon = Math.min(minLon, point.lon);
                maxLon = Math.max(maxLon, point.lon);
                validPointsForBboxCount++;
            }
        });

        // 為每個唯一位置創建標記
        locationMap.forEach(location => {
            const marker = L.circleMarker([location.lat, location.lon], {
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.7,
                radius: location.titles.length > 1 ? 8 : 6  // 如果有多人，標記稍大一些
            }).addTo(currentMarkerLayerGroup);

            if (location.titles.length > 0) {
                // 創建包含所有人名字的工具提示
                const tooltipContent = location.titles.join('<br>');
                marker.bindTooltip(tooltipContent, {
                    permanent: false,
                    direction: 'top',
                    className: 'custom-tooltip'
                });

                // 只有在 history 分頁才允許 marker 點擊彈出日誌
                if (mapType === 'history' && location.titles.length === 1) {
                    // 這裡可以根據需要加 showHistoryLogModal 事件
                    // 但 global 分頁完全不加任何點擊事件
                }
                // 如果有多人的標記，global/history 都只顯示 tooltip，不彈窗
            }
        });

        // 如果是歷史軌跡地圖，添加路線
        if (mapType === 'history' && points.length > 1) {
            // 按時間戳排序點位
            const sortedPoints = [...points].sort((a, b) => a.timestamp - b.timestamp);
            
            // 創建路線點陣列
            const routePoints = sortedPoints.map(point => [point.lat, point.lon]);
            
            // 繪製虛線路線
            L.polyline(routePoints, {
                color: '#e81010a0', // 紅
                weight: 3,
                opacity: 0.6,
                dashArray: '10, 10'
            }).addTo(currentMarkerLayerGroup);
            
            // 在路線中間添加箭頭標記
            for (let i = 0; i < routePoints.length - 1; i++) {
                const start = L.latLng(routePoints[i][0], routePoints[i][1]);
                const end = L.latLng(routePoints[i + 1][0], routePoints[i + 1][1]);
                
                // 計算箭頭位置（在線段的70%處）
                const arrowLat = start.lat + (end.lat - start.lat) * 0.7;
                const arrowLng = start.lng + (end.lng - start.lng) * 0.7;
                
                // 添加箭頭標記
                L.circleMarker([arrowLat, arrowLng], {
                    color: '#e81010a0',
                    fillColor: '#e81010a0',
                    fillOpacity: 0.8,
                    radius: 6
                }).addTo(currentMarkerLayerGroup);
            }
        }

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

            console.log(`[renderPointsOnMap] (${mapTitle}) 計算出的 BBOX:, ${west},${south},${east},${north}`);
            currentMapInstance.fitBounds([[south, west], [north, east]], {padding: [20,20]});
        } else if (currentMapInstance) {
            currentMapInstance.setView([20, 0], 2);
        }

        if(debugDivElement) debugDivElement.textContent = `${mapTitle} - 顯示 ${validPointsForBboxCount} 個有效位置。`;
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

        console.log("[loadHistory] 準備載入歷史記錄，使用識別碼:", currentDataIdentifier);
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
            console.log("[loadHistory] 查詢結果:", querySnapshot.size, "筆記錄");
            historyListUl.innerHTML = '';
            const historyPoints = [];

            if (querySnapshot.empty) {
                historyListUl.innerHTML = '<li>尚無歷史記錄。</li>';
                renderHistoryMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`);
                return;
            }

            // 獲取用戶城市訪問統計
            const cityVisitStats = await getUserCityVisitStats();
            console.log("[loadHistory] 城市訪問統計:", cityVisitStats);

            // 收集所有記錄並按時間排序（用於計算訪問順序）
            const allRecords = [];
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                record.docId = doc.id;
                allRecords.push(record);
            });
            
            // 按時間順序排序（從舊到新）
            allRecords.sort((a, b) => {
                const timeA = a.recordedAt && a.recordedAt.toMillis ? a.recordedAt.toMillis() : 0;
                const timeB = b.recordedAt && b.recordedAt.toMillis ? b.recordedAt.toMillis() : 0;
                return timeA - timeB;
            });

            // 重新按時間倒序排列用於顯示（最新的在上面）
            allRecords.reverse();

            // 收集所有有效的歷史記錄點
            const markerMap = new Map(); // 用於存儲標記的引用
            
            allRecords.forEach((record, index) => {
                console.log("[loadHistory] 處理記錄:", record);
                const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '日期未知';

                const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

                // 計算城市訪問次數（當前記錄在該城市的第幾次訪問）
                const cityName = record.city;
                let cityVisitNumber = 1;
                if (cityName && cityName !== "Unknown Planet") {
                    // 找到按時間順序排列的所有記錄中，當前記錄是該城市的第幾次訪問
                    const allRecordsByTime = [...allRecords].reverse(); // 恢復時間順序（從舊到新）
                    const currentRecordTime = record.recordedAt && record.recordedAt.toMillis ? record.recordedAt.toMillis() : 0;
                    
                    cityVisitNumber = allRecordsByTime.filter(r => 
                        r.city === cityName && 
                        r.recordedAt && r.recordedAt.toMillis && 
                        r.recordedAt.toMillis() <= currentRecordTime
                    ).length;
                }

                // 心情資訊顯示
                const moodDisplay = record.moodEmoji && record.moodName ? `${record.moodEmoji} ${record.moodName}` : (record.moodName || '');

                // 城市訪問次數顯示（只有重複訪問才顯示）
                const visitInfo = cityVisitNumber > 1 ? `<br><span class="visit-info" style="color: #007bff; font-size: 0.8em;">第 ${cityVisitNumber} 次拜訪這座城市</span>` : '';

                const li = document.createElement('li');
                li.innerHTML = `<span class="date">${recordDate}</span> -  
                                甦醒於: <span class="location">${cityDisplay || '未知城市'}, ${countryDisplay || '未知國家'}</span>
                                ${visitInfo}
                                ${moodDisplay ? `<br><span class="mood-info" style="color: ${record.moodColor || '#666'}; font-size: 0.8em;">心情: ${moodDisplay}</span>` : ''}`;
                
                const detailsButton = document.createElement('button');
                detailsButton.textContent = '查看日誌';
                detailsButton.className = 'history-log-button';

                // 替換原本的 onclick 事件處理
                const handleButtonClick = (e) => {
                    e.preventDefault();  // 防止預設行為
                    e.stopPropagation(); // 防止事件冒泡
                    showHistoryLogModal(record); // 開啟日誌彈窗
                    console.log("查看日誌按鈕被點擊，記錄:", record);
                };

                // 添加多個事件監聽器
                detailsButton.addEventListener('click', handleButtonClick);
                detailsButton.addEventListener('touchstart', handleButtonClick, { passive: false });
                detailsButton.addEventListener('touchend', (e) => {
                    e.preventDefault();  // 防止觸控結束時的點擊事件
                }, { passive: false });

                // 防止觸控時的滾動
                detailsButton.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                }, { passive: false });

                li.appendChild(detailsButton);

                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    
                    // 為列表項添加懸停效果的類
                    li.classList.add('hoverable-history-item');
                    
                    // 存儲對應的座標信息，用於後續與地圖標記關聯
                    li.dataset.lat = record.latitude;
                    li.dataset.lon = record.longitude;
                    li.dataset.timestamp = record.recordedAt.toMillis();

                    historyPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${recordDate} @ ${cityDisplay}, ${countryDisplay}`,
                        timestamp: record.recordedAt.toMillis(),
                        listItem: li // 保存對列表項的引用
                    });
                }

                historyListUl.appendChild(li);
            });

            // 按時間順序排序點位（從舊到新）
            historyPoints.sort((a, b) => a.timestamp - b.timestamp);

            // 渲染歷史軌跡地圖
            renderHistoryMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`);

        } catch (e) {
            console.error("讀取歷史記錄失敗:", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
            historyMapContainerDiv.innerHTML = '<p>讀取歷史記錄時發生錯誤。</p>';
            historyDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    // 專門為歷史軌跡設計的地圖渲染函數
    function renderHistoryMap(points, mapDivElement, debugDivElement, mapTitle = "歷史軌跡") {
        console.log(`[renderHistoryMap] 準備渲染歷史軌跡地圖: "${mapTitle}", 點數量: ${points ? points.length : 0}`);

        let currentMapInstance = historyLeafletMap;
        let currentMarkerLayerGroup = historyMarkerLayerGroup;

        if (!currentMapInstance) {
            console.log(`[renderHistoryMap] 初始化新的 Leaflet 地圖實例`);
            mapDivElement.innerHTML = '';
            currentMapInstance = L.map(mapDivElement).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd', maxZoom: 18, minZoom: 2
            }).addTo(currentMapInstance);
            currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);

            historyLeafletMap = currentMapInstance;
            historyMarkerLayerGroup = currentMarkerLayerGroup;
        }

        console.log(`[renderHistoryMap] 清除舊標記`);
        if (currentMarkerLayerGroup) {
            currentMarkerLayerGroup.clearLayers();
        } else {
            currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);
            historyMarkerLayerGroup = currentMarkerLayerGroup;
        }

        currentMapInstance.invalidateSize();

        if (!points || points.length === 0) {
            if (currentMarkerLayerGroup) currentMarkerLayerGroup.clearLayers();
            console.log("[renderHistoryMap] 沒有點可以渲染");
            if(debugDivElement) debugDivElement.textContent = `${mapTitle}：尚無有效座標點可顯示。`;
            if (currentMapInstance) {
                currentMapInstance.setView([20, 0], 2);
            }
            return;
        }

        // 統計每個位置的訪問次數
        const locationVisitCount = new Map();
        points.forEach(point => {
            const locationKey = `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`;
            locationVisitCount.set(locationKey, (locationVisitCount.get(locationKey) || 0) + 1);
        });

        // 創建標記
        const markers = [];
        points.forEach((point, index) => {
            const isLatest = index === points.length - 1; // 最後一筆記錄
            const wakeUpNumber = index + 1; // 甦醒次數（從1開始）
            const locationKey = `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`;
            const visitCount = locationVisitCount.get(locationKey);
            
            // 根據是否為最新記錄設定顏色
            const markerColor = isLatest ? '#e74c3c' : '#f1c40f'; // 紅色 : 黃色
            const markerFillColor = isLatest ? '#e74c3c' : '#f1c40f';
            
            // 根據訪問次數調整大小
            const baseRadius = 8;
            const radius = visitCount > 1 ? baseRadius + 2 : baseRadius;
            
            const marker = L.circleMarker([point.lat, point.lon], {
                color: markerColor,
                fillColor: markerFillColor,
                fillOpacity: 0.8,
                radius: radius,
                weight: 2
            }).addTo(currentMarkerLayerGroup);

            // 創建彈出內容，包含順序數字
            const popupContent = `
                <div style="text-align: center; min-width: 200px;">
                    <h4 style="margin: 5px 0; color: ${markerColor};">第 ${wakeUpNumber} 次甦醒</h4>
                    <p style="margin: 3px 0;"><strong>${point.title}</strong></p>
                    ${visitCount > 1 ? `<p style="margin: 3px 0; font-size: 0.9em; color: #666;">此位置共訪問 ${visitCount} 次</p>` : ''}
                    ${isLatest ? '<p style="margin: 3px 0; font-size: 0.9em; color: #e74c3c;"><strong>最新記錄</strong></p>' : ''}
                </div>
            `;

            marker.bindPopup(popupContent);
            
            // 儲存標記引用，用於列表點擊
            markers.push({
                marker: marker,
                listItem: point.listItem,
                wakeUpNumber: wakeUpNumber
            });

            // 為列表項目添加點擊事件
            if (point.listItem) {
                point.listItem.style.cursor = 'pointer';
                point.listItem.addEventListener('click', () => {
                    // 飛到對應位置並開啟彈窗
                    currentMapInstance.flyTo([point.lat, point.lon], 12, {
                        animate: true,
                        duration: 1
                    });
                    setTimeout(() => {
                        marker.openPopup();
                    }, 1000);
                });

                // 添加懸停效果
                point.listItem.addEventListener('mouseenter', () => {
                    point.listItem.style.backgroundColor = '#f0f8ff';
                    marker.setStyle({
                        radius: radius + 2,
                        weight: 4
                    });
                });

                point.listItem.addEventListener('mouseleave', () => {
                    point.listItem.style.backgroundColor = '';
                    marker.setStyle({
                        radius: radius,
                        weight: 2
                    });
                });
            }
        });

        // 繪製路線（黃色虛線）
        if (points.length > 1) {
            const routePoints = points.map(point => [point.lat, point.lon]);
            
            L.polyline(routePoints, {
                color: '#f1c40f', // 黃色
                weight: 3,
                opacity: 0.7,
                dashArray: '10, 10'
            }).addTo(currentMarkerLayerGroup);
            
            // 在路線中間添加方向箭頭
            for (let i = 0; i < routePoints.length - 1; i++) {
                const start = L.latLng(routePoints[i][0], routePoints[i][1]);
                const end = L.latLng(routePoints[i + 1][0], routePoints[i + 1][1]);
                
                // 計算箭頭位置（在線段的70%處）
                const arrowLat = start.lat + (end.lat - start.lat) * 0.7;
                const arrowLng = start.lng + (end.lng - start.lng) * 0.7;
                
                // 添加小箭頭標記
                L.circleMarker([arrowLat, arrowLng], {
                    color: '#f39c12',
                    fillColor: '#f39c12',
                    fillOpacity: 0.8,
                    radius: 4,
                    weight: 1
                }).addTo(currentMarkerLayerGroup);
            }
        }

        // 調整地圖視野以包含所有點
        if (points.length > 0) {
            const latlngs = points.map(point => [point.lat, point.lon]);
            const bounds = L.latLngBounds(latlngs);
            currentMapInstance.fitBounds(bounds, {padding: [20, 20]});
        }

        if(debugDivElement) {
            debugDivElement.textContent = `${mapTitle} - 顯示 ${points.length} 個甦醒位置，${locationVisitCount.size} 個不同地點。`;
        }
    }

    window.openTab = function(evt, tabName, isInitialLoad = false) {
        console.log(`[openTab] 切換到分頁: ${tabName}, 事件觸發: ${!!evt}, 初始載入: ${isInitialLoad}`);
        
        // 如果是觸控事件，阻止預設行為
        if (evt && evt.type === 'touchstart') {
            evt.preventDefault();
        }

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

        setTimeout(() => {
            if (tabName === 'HistoryTab') {
                if (historyLeafletMap && historyMapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] HistoryTab is visible, invalidating map size.");
                    historyLeafletMap.invalidateSize();
                }
                if (currentDataIdentifier && auth.currentUser && !isInitialLoad) {
                    console.log("[openTab] 呼叫 loadHistory for HistoryTab.");
                    loadHistory();
                }
            } else if (tabName === 'GlobalTodayMapTab') {
                if (globalLeafletMap && globalTodayMapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] GlobalTodayMapTab is visible, invalidating map size.");
                    globalLeafletMap.invalidateSize();
                }
                if (auth.currentUser && !isInitialLoad) {
                    if (globalDateInput) {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = (today.getMonth() + 1).toString().padStart(2, '0');
                        const day = today.getDate().toString().padStart(2, '0');
                        globalDateInput.value = `${year}-${month}-${day}`;
                        console.log("[openTab] GlobalTodayMapTab: 日期已重設為今天:", globalDateInput.value);
                    }
                    console.log("[openTab] 呼叫 loadGlobalTodayMap for GlobalTodayMapTab (日期已重設為今天).");
                    loadGlobalTodayMap();
                }
            } else if (tabName === 'ClockTab') {
                if (clockLeafletMap && mapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] ClockTab is visible, invalidating map size.");
                    clockLeafletMap.invalidateSize();
                }
                if (currentDataIdentifier && auth.currentUser && !isInitialLoad && !initialLoadHandled) {
                    console.log("[openTab] 手動切換到 ClockTab，準備顯示最後記錄。");
                    initialLoadHandled = true;
                    displayLastRecordForCurrentUser();
                }
            }
        }, 0);
    }

    // 重寫分頁按鈕的事件處理
    function initializeTabButtons() {
        console.log("初始化分頁按鈕...");
        const tabButtons = document.getElementsByClassName('tab-button');
        
        // 先移除所有現有的事件監聽器
        Array.from(tabButtons).forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });

        // 重新添加事件監聽器
        Array.from(document.getElementsByClassName('tab-button')).forEach(button => {
            const tabName = button.getAttribute('data-tab');
            if (!tabName) return;

            // 統一處理函數
            const handleTabClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openTab(e, tabName);
            };

            button.addEventListener('click', handleTabClick);
            button.addEventListener('touchstart', handleTabClick, { passive: false });
        });
    }

    // 實現查看日誌彈窗功能
    async function showHistoryLogModal(record) {
        const modal = document.getElementById('historyLogModal');
        const modalContent = document.getElementById('historyLogModalContent');
        const modalTitle = document.getElementById('modalTitle');
        const closeButton = document.getElementById('historyLogModalClose');
        const footerButton = document.getElementById('closeModalFooterButton');
        
        if (!modal || !modalContent || !modalTitle) {
            console.error('找不到彈窗元素，無法顯示日誌');
            return;
        }
        
        // 先顯示載入中的狀態
        modalContent.innerHTML = '<div style="text-align: center; padding: 20px;">載入中...</div>';
        modal.style.display = 'block';
        modal.classList.add('show');
        
        try {
            // 計算甦醒次數
            const wakeUpNumber = await calculateWakeUpNumber(record);
            
            // 計算城市訪問次數
            const cityVisitNumber = await calculateCityVisitNumber(record);
            
            // 設定彈窗標題
            modalTitle.textContent = `第 ${wakeUpNumber} 次的甦醒日誌`;
            
            // 準備城市和國家顯示名稱
            const cityDisplay = record.city_zh && record.city_zh !== record.city ? 
                `${record.city_zh} (${record.city})` : record.city;
            const countryDisplay = record.country_zh && record.country_zh !== record.country ? 
                `${record.country_zh} (${record.country})` : record.country;
            
            // 準備心情顯示
            const moodDisplay = record.moodEmoji && record.moodName ? 
                `${record.moodEmoji} ${record.moodName}` : '';
            
            // 創建詳細內容
            let contentHTML = `
                <div class="log-detail" style="text-align: left;">
                    <h3>基本資訊</h3>
                    <p><strong>記錄時間：</strong>${record.recordedAt.toDate().toLocaleString('zh-TW')}</p>
                    <p><strong>甦醒地點：</strong>${cityDisplay}, ${countryDisplay}</p>
                    ${cityVisitNumber > 1 ? `<p><strong>城市訪問：</strong>這是你第 ${cityVisitNumber} 次拜訪這座城市</p>` : ''}
                    ${record.timezone ? `<p><strong>時區：</strong>${record.timezone}</p>` : ''}
                    ${moodDisplay ? `<p><strong>當日心情：</strong><span style="color: ${record.moodColor || '#666'}">${moodDisplay}</span></p>` : ''}
                    ${record.groupName ? `<p><strong>組別：</strong>${record.groupName}</p>` : ''}
                </div>
            `;
            
            // 如果有早餐圖片，優先顯示
            if (record.imageUrl) {
                contentHTML += `
                    <div class="log-detail" style="text-align: left;">
                        <h3>今日早餐</h3>
                        <div style="text-align: center; margin: 10px 0;">
                            <img src="${record.imageUrl}" alt="早餐圖片" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        </div>
                    </div>
                `;
            }
            
            // 如果有故事內容，顯示故事
            if (record.story) {
                contentHTML += `
                    <div class="log-detail" style="text-align: left;">
                        <h3>今日故事</h3>
                        <div class="story-content">${record.story}</div>
                    </div>
                `;
            }
            
            // 座標資訊
            if (record.latitude && record.longitude) {
                contentHTML += `
                    <div class="log-detail" style="text-align: left;">
                        <h3>座標資訊</h3>
                        <p><strong>緯度：</strong>${record.latitude.toFixed(6)}</p>
                        <p><strong>經度：</strong>${record.longitude.toFixed(6)}</p>
                    </div>
                `;
            }
            
            modalContent.innerHTML = contentHTML;
        } catch (error) {
            console.error('計算甦醒次數失敗:', error);
            modalContent.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">載入日誌資訊失敗</div>';
        }
        
        // 設定關閉事件
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        };
        
        // 移除舊的事件監聽器並添加新的
        if (closeButton) {
            closeButton.replaceWith(closeButton.cloneNode(true));
            document.getElementById('historyLogModalClose').addEventListener('click', closeModal);
        }
        
        if (footerButton) {
            footerButton.replaceWith(footerButton.cloneNode(true));
            document.getElementById('closeModalFooterButton').addEventListener('click', closeModal);
        }
        
        // 點擊背景關閉彈窗
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // ESC 鍵關閉彈窗
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 計算甦醒次數的函數
    async function calculateWakeUpNumber(targetRecord) {
        if (!currentDataIdentifier) {
            return 1; // 如果沒有用戶識別碼，返回 1
        }

        try {
            const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
            const q = query(historyCollectionRef, orderBy("recordedAt", "asc"));
            const querySnapshot = await getDocs(q);

            let wakeUpCount = 0;
            const targetTimestamp = targetRecord.recordedAt.toMillis();
            
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                const recordTimestamp = record.recordedAt.toMillis();
                
                // 如果記錄時間早於或等於目標記錄，計數加一
                if (recordTimestamp <= targetTimestamp) {
                    wakeUpCount++;
                }
            });

            return wakeUpCount;
        } catch (error) {
            console.error('計算甦醒次數時發生錯誤:', error);
            return 1; // 出錯時返回 1
        }
    }

    // 計算特定城市訪問次數的函數
    async function calculateCityVisitNumber(targetRecord) {
        if (!currentDataIdentifier) {
            return 1; // 如果沒有用戶識別碼，返回 1
        }

        try {
            const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
            const q = query(historyCollectionRef, orderBy("recordedAt", "asc"));
            const querySnapshot = await getDocs(q);

            let cityVisitCount = 0;
            const targetTimestamp = targetRecord.recordedAt.toMillis();
            const targetCity = targetRecord.city;
            
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                const recordTimestamp = record.recordedAt.toMillis();
                
                // 如果是同一個城市且記錄時間早於或等於目標記錄，計數加一
                if (record.city === targetCity && recordTimestamp <= targetTimestamp) {
                    cityVisitCount++;
                }
            });

            return cityVisitCount;
        } catch (error) {
            console.error('計算城市訪問次數時發生錯誤:', error);
            return 1; // 出錯時返回 1
        }
    }

    // 初始化組別過濾器監聽器
    function initializeGroupFilter() {
        if (groupFilterSelect) {
            groupFilterSelect.addEventListener('change', () => {
                console.log('組別過濾器變更，重新載入眾人地圖');
                loadGlobalTodayMap();
            });
        }
    }

    // 確保在 DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeTabButtons();
            initializeGroupFilter();
        });
    } else {
        initializeTabButtons();
        initializeGroupFilter();
    }

    // 修改分頁按鈕的樣式
    const tabButtonStyle = document.createElement('style');
    tabButtonStyle.textContent = `
        .tabs {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            position: relative;
            z-index: 2;
            background: #fff;
            padding: 0 4px;
        }
        .tab-button {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            cursor: pointer;
            min-height: 48px;
            padding: 12px 16px;
            margin: 0 4px;
            border: none;
            background-color: transparent;
            border-radius: 4px;
            transition: all 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
            position: relative;
            z-index: 2;
            display: inline-block;
            text-align: center;
            transform: translateZ(0);
            will-change: transform;
            -webkit-touch-callout: none;
            -webkit-appearance: none;
            appearance: none;
            flex: 1;
            max-width: 33.33%;
        }
        .tab-button.active {
            border-bottom: 2px solid #e8af10;
            color: #d6a70b;
            font-weight: bold;
        }
        .tab-button:active {
            background-color: rgba(232, 175, 16, 0.1);
            transform: scale(0.98);
        }
        @media (hover: hover) {
            .tab-button:hover {
                background-color: rgba(232, 175, 16, 0.1);
            }
        }
        @media (max-width: 768px) {
            .tabs {
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
                -ms-overflow-style: none;
                overflow-x: auto;
                white-space: nowrap;
                padding: 0 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                background: #fff;
                z-index: 1000;
            }
            .tab-button {
                flex: 1;
                text-align: center;
                margin: 0 2px;
                font-size: 14px;
                padding: 12px 8px;
                min-width: 60px;
                min-height: 48px;
                touch-action: manipulation;
                position: relative;
                z-index: 1001;
            }
            .tabs::-webkit-scrollbar {
                display: none;
            }
            .tab-content {
                position: relative;
                z-index: 1;
            }
        }
    `;
    document.head.appendChild(tabButtonStyle);

    // 添加缺失的 CSS 樣式
    const style = document.createElement('style');
    style.textContent = `
        .hoverable-history-item {
            transition: background-color 0.3s ease;
            padding: 8px;  /* 增加點擊區域 */
            border-radius: 4px;
            position: relative;
            -webkit-tap-highlight-color: transparent;
            touch-action: pan-y pinch-zoom;  /* 明確允許垂直滾動和縮放 */
            cursor: pointer;
        }
        .hoverable-history-item:hover,
        .hoverable-history-item.active {
            background-color: rgba(255, 215, 0, 0.2);  /* 黃色高亮 */
            border-left: 4px solid #FFD700;
        }
        .hoverable-history-item.active {
            box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
        }
        .history-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .history-table th, .history-table td {
            border: 1px solid #e0e0e0;
            padding: 12px 10px;
            text-align: left;
            font-size: 14px;
        }
        .history-table th {
            background: #f8f9fa;
            color: #495057;
            font-weight: bold;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .history-table tr:nth-child(even) {
            background: #fafafa;
        }
        .history-table tr.hoverable-history-item:hover {
            background: rgba(255, 215, 0, 0.1);
        }
        .history-log-button {
            padding: 6px 12px;
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            min-width: 80px;
            min-height: 32px;
            white-space: nowrap;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            transition: background-color 0.2s;
        }
        .history-log-button:hover, .history-log-button:active {
            background-color: #5a6268;
        }
        /* 地圖彈窗樣式 */
        .leaflet-popup-content-wrapper {
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .leaflet-popup-content {
            margin: 12px 16px;
            line-height: 1.4;
        }
        .leaflet-popup-content h4 {
            margin: 0 0 8px 0;
            font-size: 16px;
        }
        .leaflet-popup-content p {
            margin: 4px 0;
            font-size: 14px;
        }
        @media (hover: none) {
            .hoverable-history-item:hover {
                background-color: transparent;
                border-left: none;
            }
            .hoverable-history-item {
                margin: 2px 0;  /* 增加項目間距，便於觸控 */
            }
            .history-log-button {
                padding: 8px 16px;
                font-size: 14px;
                min-height: 44px;
            }
        }
        @media (max-width: 768px) {
            .history-table th, .history-table td {
                padding: 8px 6px;
                font-size: 12px;
            }
            .history-table td:last-child {
                width: 100px;
            }
        }
    `;
    document.head.appendChild(style);

    // 初始載入時，嘗試設定一個預設的使用者名稱 (如果 localStorage 中有)
    // 或者，直接觸發 ClockTab 的顯示 (如果已經有用戶名)
    const initialUserName = localStorage.getItem('worldClockUserName');
    const initialGroupName = localStorage.getItem('worldClockGroupName');

    if (initialUserName) {
        userNameInput.value = initialUserName;
        // 等待 auth 狀態變更處理
    } else {
        openTab(null, 'ClockTab', true);  // 添加第三個參數表示這是初始載入
    }

    // 恢復組別設定
    if (initialGroupName) {
        groupNameInput.value = initialGroupName;
        currentGroupName = initialGroupName;
        currentGroupNameSpan.textContent = `(${initialGroupName})`;
    }
    
    // 確保在首次載入時，如果 ClockTab 是預設活動的，則嘗試顯示最後記錄
    if (document.getElementById('ClockTab') && document.getElementById('ClockTab').style.display !== 'none' && !initialAuthToken) {
        // 等待 auth 狀態
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Unsubscribe after first call
            if (user && currentDataIdentifier && !initialLoadHandled) {
                console.log("[onAuthStateChanged] 初始載入，顯示最後記錄");
                initialLoadHandled = true;
                await displayLastRecordForCurrentUser();
            } else if (!currentDataIdentifier) {
                resultTextDiv.innerHTML = `<p>歡迎！請在上方設定您的顯示名稱以開始使用。</p>`;
            }
        });
    }
});

// 確保在 DOM 載入完成後初始化分頁按鈕
document.addEventListener('DOMContentLoaded', function() {
    // 重寫分頁按鈕的事件處理
    function initializeTabButtons() {
        console.log("初始化分頁按鈕...");
        const tabButtons = document.getElementsByClassName('tab-button');
        
        // 先移除所有現有的事件監聽器
        Array.from(tabButtons).forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });

        // 重新添加事件監聽器
        Array.from(document.getElementsByClassName('tab-button')).forEach(button => {
            const tabName = button.getAttribute('data-tab');
            if (!tabName) return;

            // 統一處理函數
            const handleTabClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.openTab === 'function') {
                    window.openTab(e, tabName);
                }
            };

            button.addEventListener('click', handleTabClick);
            button.addEventListener('touchstart', handleTabClick, { passive: false });
        });
    }

    initializeTabButtons();
});
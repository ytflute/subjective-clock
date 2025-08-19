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
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // 檢查是否在7:50-8:10特例時間段
        if ((hours === 7 && minutes >= 50) || (hours === 8 && minutes <= 10)) {
            console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 特例時間段，將使用用戶當地位置`);
            return 'local'; // 返回特殊標記，表示使用用戶當地位置
        }
        
        // 修正後的線性映射：避免極地問題
        // 0分=北緯70度，30分≈赤道0度，59分=南緯70度
        // 公式：targetLatitude = 70 - (minutes * 140 / 59)
        const targetLatitude = 70 - (minutes * 140 / 59);
        
        console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 目標緯度: ${targetLatitude.toFixed(2)}度 (避免極地)`);
        
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
    // 設置為全域變數，供其他函數使用
    window.appId = appId;
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
        const response = await fetch('/api/generateStory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                city: city,
                country: country,
                countryCode: countryCode
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "無法解析 API 錯誤回應" }));
            console.error(`API Error from /api/generateStory: ${response.status} ${response.statusText}`, errorData);
            return {
                greeting: `(系統提示：問候語獲取失敗 - ${response.status})`,
                story: `系統提示：關於 ${city}, ${country} 的故事獲取失敗，請稍後再試。錯誤: ${errorData.error || response.statusText}`
            };
        }

        const data = await response.json();
        console.log("[fetchStoryFromAPI] Received data from backend:", data);

        if (data && typeof data.greeting === 'string' && typeof data.story === 'string') {
            return {
                greeting: data.greeting,
                story: data.story
            };
        } else if (data && typeof data.greeting === 'string' && typeof data.trivia === 'string') {
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

                // 添加早餐區域（按鈕或圖片）
                // 先清除已存在的早餐容器，防止重複顯示
                const existingBreakfastContainers = document.querySelectorAll('#breakfastImageContainer');
                existingBreakfastContainers.forEach(container => container.remove());
                
                // 顯示HTML中的早餐按鈕容器（如果有早餐圖片則隱藏按鈕，直接顯示圖片）
                const breakfastButtonContainer = document.getElementById('breakfastButtonContainer');
                
                console.log(`[displayLastRecordForCurrentUser] 檢查早餐圖片: ${lastRecord.imageUrl ? '有' : '無'}`);
                
                if (lastRecord.imageUrl) {
                    // 如果已有早餐圖片，隱藏按鈕並創建圖片容器
                    console.log(`[displayLastRecordForCurrentUser] 顯示早餐圖片: ${lastRecord.imageUrl}`);
                    if (breakfastButtonContainer) {
                        breakfastButtonContainer.style.display = 'none';
                    }
                    
                    const breakfastContainer = document.createElement('div');
                    breakfastContainer.id = 'breakfastImageContainer';
                    breakfastContainer.style.marginTop = '20px';
                    breakfastContainer.style.textAlign = 'center';
                    
                    const recordId = querySnapshot.docs[0].id; // 獲取記錄ID
                    const displayName = lastRecord.city === "Unknown Planet" || lastRecord.city_zh === "未知星球" ? 
                        "星際早餐" : `${finalCityName}的早餐`;
                    
                    breakfastContainer.innerHTML = `
                        <div class="postcard-image-container">
                            <img src="${lastRecord.imageUrl}" alt="${displayName}" style="max-width: 100%; border-radius: 8px;" 
                                 onerror="handleImageLoadError(this, '${recordId}', '${currentDataIdentifier}', '${finalCityName}')">
                            <p style="font-size: 0.9em; color: #555;"><em>今日的${displayName}</em></p>
                        </div>
                    `;
                    
                    // 將早餐圖片容器插入到地圖和 debugInfo 之間
                    debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);
                    console.log(`[displayLastRecordForCurrentUser] 早餐圖片容器已插入DOM`);
                } else {
                    // 如果沒有早餐圖片，顯示早餐按鈕
                    console.log(`[displayLastRecordForCurrentUser] 顯示早餐按鈕`);
                    if (breakfastButtonContainer) {
                        breakfastButtonContainer.style.display = 'block';
                        // 設置按鈕點擊事件
                        setupBreakfastButton(lastRecord, finalCityName, finalCountryName, querySnapshot.docs[0].id);
                    }
                }

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
            
            let requestBody = {
                targetUTCOffset: requiredUTCOffset,
                timeMinutes: userLocalDate.getMinutes(),
                userCityVisitStats: cityVisitStats,
                userLocalTime: userLocalDate.toLocaleTimeString('en-US', { hour12: false })
            };
            
            // 初始化 latitudeDescription 變數
            let latitudeDescription;
            
            // 檢查是否為特例時間段
            if (targetLatitude === 'local') {
                console.log("特例時間段 (7:50-8:10)，正在獲取用戶地理位置...");
                resultTextDiv.innerHTML = "<p>正在獲取您的地理位置...</p>";
                
                // 為特例時間段設定 latitudeDescription
                latitudeDescription = "當地位置 (7:50-8:10特例時間段)";
                
                try {
                    const position = await new Promise((resolve, reject) => {
                        if (!navigator.geolocation) {
                            reject(new Error('瀏覽器不支持地理定位'));
                            return;
                        }
                        
                        navigator.geolocation.getCurrentPosition(
                            resolve,
                            reject,
                            {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 60000
                            }
                        );
                    });
                    
                    const userLatitude = position.coords.latitude;
                    const userLongitude = position.coords.longitude;
                    
                    console.log(`用戶位置：緯度 ${userLatitude.toFixed(4)}°, 經度 ${userLongitude.toFixed(4)}°`);
                    
                    // 設定為使用用戶當地位置
                    requestBody.useLocalPosition = true;
                    requestBody.userLatitude = userLatitude;
                    requestBody.userLongitude = userLongitude;
                    
                    resultTextDiv.innerHTML = "<p>已獲取地理位置，正在尋找當地城市...</p>";
                    
                } catch (error) {
                    console.error('獲取地理位置失敗:', error);
                    alert('無法獲取地理位置，請檢查瀏覽器設定或網絡連接。將使用備用方案。');
                    
                    // 備用方案：使用UTC偏移推測位置
                    requestBody.targetLatitude = 0; // 赤道附近
                    requestBody.useLocalPosition = false;
                    
                    findCityButton.disabled = false;
                    return;
                }
            } else {
                // 正常時間段：使用計算的緯度
                latitudeDescription = getLatitudePreferenceDescription(targetLatitude);
                console.log(`尋找 UTC${requiredUTCOffset >= 0 ? '+' : ''}${requiredUTCOffset.toFixed(2)} 的地方 (當地時間 ${targetLocalHour}:00)`);
                console.log(`按下時間分鐘數: ${userLocalDate.getMinutes()}, 目標緯度: ${targetLatitude.toFixed(2)}° (${latitudeDescription})`);
                
                requestBody.targetLatitude = targetLatitude;
                requestBody.useLocalPosition = false;
            }

            // 調用我們的新 API 來尋找城市
            const response = await fetch('/api/find-city-geonames', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
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

                // 顯示早餐按鈕（宇宙主題）
                const breakfastButtonContainer = document.getElementById('breakfastButtonContainer');
                if (breakfastButtonContainer) {
                    breakfastButtonContainer.style.display = 'block';
                    // 修改按鈕文字為宇宙主題
                    const breakfastBtn = document.getElementById('generateBreakfastBtn');
                    if (breakfastBtn) {
                        breakfastBtn.innerHTML = '🌌 我想吃宇宙早餐';
                        breakfastBtn.nextElementSibling.innerHTML = '<em>探索來自星際的神秘早餐</em>';
                    }
                }
                debugInfoSmall.innerHTML = `(目標 UTC 偏移: ${requiredUTCOffset.toFixed(2)})`;

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

                // 設置宇宙早餐按鈕點擊事件
                setupBreakfastButton({
                    city: "Unknown Planet",
                    country: "Universe",
                    city_zh: "未知星球",
                    country_zh: "宇宙",
                    isUniverseTheme: true
                }, "未知星球", "宇宙", savedUniverseDocId);

                console.log("--- 尋找匹配城市結束 (宇宙情況) ---");
                findCityButton.disabled = false;
                return;
            }

            // 處理正常的城市結果
            // 檢查 API 返回格式，如果有 success 和 city 欄位，取出 city 資料
            let cityData;
            if (apiResult.success && apiResult.city) {
                cityData = apiResult.city;
            } else if (apiResult.city) {
                cityData = apiResult.city;
            } else {
                cityData = apiResult;
            }

            // 如果 API 返回的是一個陣列（多個匹配城市），使用智能選擇
            let bestMatchCity;
            if (Array.isArray(cityData) && cityData.length > 1) {
                console.log(`發現 ${cityData.length} 個匹配的城市，使用訪問統計進行智能選擇...`);
                bestMatchCity = selectCityWithVisitHistory(cityData, cityVisitStats);
            } else if (Array.isArray(cityData) && cityData.length === 1) {
                bestMatchCity = cityData[0];
            } else {
                // 如果不是陣列，假設是單一城市結果
                bestMatchCity = cityData;
            }

            if (!bestMatchCity) {
                throw new Error("無法從 API 結果中選擇合適的城市");
            }

            // 確保所有必要的屬性都存在
            if (!bestMatchCity.city && !bestMatchCity.name) {
                throw new Error("城市資料缺少名稱");
            }

            // 保留英文城市和國家名稱
            const englishCityName = bestMatchCity.name || bestMatchCity.city;
            const englishCountryName = bestMatchCity.country || 'Unknown';
            const countryCode = bestMatchCity.country_iso_code || bestMatchCity.countryCode || '';
            
            // 檢查並記錄原始經緯度資料
            console.log('完整的 bestMatchCity 資料:', bestMatchCity);
            console.log('原始經緯度資料:', {
                latitude: bestMatchCity.latitude,
                longitude: bestMatchCity.longitude,
                lat: bestMatchCity.lat,
                lng: bestMatchCity.lng
            });
            
            // 確保經緯度是有效的數字
            let latitude = null;
            let longitude = null;
            
            // 嘗試從不同屬性獲取經緯度 - 優先使用 lat/lng
            if (bestMatchCity.lat !== undefined && bestMatchCity.lat !== null && bestMatchCity.lat !== '') {
                const parsedLat = parseFloat(bestMatchCity.lat);
                if (!isNaN(parsedLat) && isFinite(parsedLat)) {
                    latitude = parsedLat;
                }
            } else if (bestMatchCity.latitude !== undefined && bestMatchCity.latitude !== null && bestMatchCity.latitude !== '') {
                const parsedLat = parseFloat(bestMatchCity.latitude);
                if (!isNaN(parsedLat) && isFinite(parsedLat)) {
                    latitude = parsedLat;
                }
            }
            
            if (bestMatchCity.lng !== undefined && bestMatchCity.lng !== null && bestMatchCity.lng !== '') {
                const parsedLng = parseFloat(bestMatchCity.lng);
                if (!isNaN(parsedLng) && isFinite(parsedLng)) {
                    longitude = parsedLng;
                }
            } else if (bestMatchCity.longitude !== undefined && bestMatchCity.longitude !== null && bestMatchCity.longitude !== '') {
                const parsedLng = parseFloat(bestMatchCity.longitude);
                if (!isNaN(parsedLng) && isFinite(parsedLng)) {
                    longitude = parsedLng;
                }
            }
            
            console.log('解析後的經緯度:', { latitude, longitude });
            
            // 檢查經緯度是否有效
            if (latitude === null || longitude === null || 
                isNaN(latitude) || isNaN(longitude) || 
                !isFinite(latitude) || !isFinite(longitude)) {
                console.error('經緯度解析失敗:', {
                    originalLatitude: bestMatchCity.lat || bestMatchCity.latitude,
                    originalLongitude: bestMatchCity.lng || bestMatchCity.longitude,
                    parsedLatitude: latitude,
                    parsedLongitude: longitude,
                    fullCityData: bestMatchCity
                });
                throw new Error("經緯度資料無效：無法解析為有效數字");
            }
            
            if (latitude < -90 || latitude > 90) {
                console.error('緯度超出範圍:', latitude);
                throw new Error(`緯度超出有效範圍：${latitude}`);
            }
            
            if (longitude < -180 || longitude > 180) {
                console.error('經度超出範圍:', longitude);
                throw new Error(`經度超出有效範圍：${longitude}`);
            }

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
                            country: englishCountryName,
                            countryCode: countryCode
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

            const apiResponse = await fetchStoryFromAPI(englishCityName, englishCountryName, countryCode);
            const greetingFromAPI = apiResponse.greeting;
            const storyFromAPI = apiResponse.story;

            // 顯示緯度資訊
            const latitudeInfo = latitude ? 
                `緯度 ${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}` : '';
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

            // 顯示地圖
            if (clockLeafletMap) {
                clockLeafletMap.remove();
            }

            // 再次確認經緯度有效性，防止傳入 null 值給 Leaflet
            if (latitude === null || longitude === null || 
                isNaN(latitude) || isNaN(longitude) || 
                latitude < -90 || latitude > 90 || 
                longitude < -180 || longitude > 180) {
                console.error('地圖初始化失敗：經緯度無效', { latitude, longitude });
                mapContainerDiv.innerHTML = '<p style="color: red;">無法顯示地圖：經緯度資料無效</p>';
            } else {
                try {
                    clockLeafletMap = L.map(mapContainerDiv, {
                        scrollWheelZoom: false,
                        doubleClickZoom: false
                    }).setView([latitude, longitude], 10);

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap contributors'
                    }).addTo(clockLeafletMap);

                    L.marker([latitude, longitude])
                        .addTo(clockLeafletMap)
                        .bindPopup(finalCityName)
                        .openPopup();
                } catch (mapError) {
                    console.error('地圖初始化錯誤:', mapError);
                    mapContainerDiv.innerHTML = '<p style="color: red;">地圖載入失敗</p>';
                }
            }

            // 從bestMatchCity獲取中文城市和國家名稱（提前定義，以便後續使用）
            const chineseCityName = bestMatchCity.city_zh || englishCityName;
            const chineseCountryName = bestMatchCity.country_zh || englishCountryName;

            // 顯示早餐按鈕（當地特色）
            const breakfastButtonContainer = document.getElementById('breakfastButtonContainer');
            if (breakfastButtonContainer) {
                breakfastButtonContainer.style.display = 'block';
                // 修改按鈕文字為當地主題
                const breakfastBtn = document.getElementById('generateBreakfastBtn');
                if (breakfastBtn) {
                    breakfastBtn.innerHTML = `🍽️ 我想吃${chineseCityName}早餐`;
                    breakfastBtn.nextElementSibling.innerHTML = `<em>品嚐來自${chineseCityName}的當地特色早餐</em>`;
                }
            }

            const recordedAtDate = userLocalDate.toLocaleString();
            const latitudeStr = latitude ? latitude.toFixed(5) : 'N/A';
            const longitudeStr = longitude ? longitude.toFixed(5) : 'N/A';
            const targetUTCOffsetStr = requiredUTCOffset >= 0 ? `+${requiredUTCOffset.toFixed(2)}` : requiredUTCOffset.toFixed(2);
            
            // 確保時區偏移是有效的數字
            const cityActualUTCOffset = parseFloat(bestMatchCity.timezoneOffset);
            const timezoneOffsetStr = !isNaN(cityActualUTCOffset) ? 
                (cityActualUTCOffset >= 0 ? `+${cityActualUTCOffset.toFixed(2)}` : cityActualUTCOffset.toFixed(2)) : 
                'N/A';
            
            // 計算時差
            const timeDifference = !isNaN(cityActualUTCOffset) ? 
                Math.abs(cityActualUTCOffset - requiredUTCOffset).toFixed(2) : 
                'N/A';

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
                city_zh: bestMatchCity.city_zh || englishCityName,
                country_zh: bestMatchCity.country_zh || englishCountryName,
                country_iso_code: countryCode,
                latitude: latitude,
                longitude: longitude,
                targetUTCOffset: requiredUTCOffset,
                matchedCityUTCOffset: cityActualUTCOffset,
                recordedDateString: userLocalDateString,
                greeting: greetingFromAPI,
                story: storyFromAPI,
                imageUrl: null, // 初始設為 null，生成成功後更新
                timezone: bestMatchCity.timezone || 'UTC',
                source: bestMatchCity.source || 'local_database',
                translationSource: bestMatchCity.translationSource || 'local_database',
                timeMinutes: userLocalDate.getMinutes(),
                latitudePreference: targetLatitude,
                latitudeDescription: latitudeDescription,
                latitudeCategory: bestMatchCity.latitudeCategory || ''
            };

            // 先保存記錄
            const savedDocId = await saveHistoryRecord(historyRecord);
            await saveToGlobalDailyRecord(historyRecord);

            // 設置當地早餐按鈕點擊事件
            setupBreakfastButton({
                city: englishCityName,
                country: englishCountryName,
                city_zh: chineseCityName,
                country_zh: chineseCountryName,
                isUniverseTheme: false
            }, chineseCityName, chineseCountryName, savedDocId);

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
            return null;
        }

        // 確保記錄數據包含所有必要欄位
        recordData.greeting = recordData.greeting || "";
        recordData.story = recordData.story || "";
        recordData.imageUrl = recordData.imageUrl || null;
        recordData.groupName = currentGroupName || "";  // 添加組別資訊
        recordData.recordedAt = serverTimestamp(); // 確保有記錄時間

        // 檢查是否為特殊情況（未知星球）
        const isSpecialCase = recordData.city === "Unknown Planet" || recordData.city_zh === "未知星球";
        
        // 如果是特殊情況，允許沒有經緯度
        if (isSpecialCase) {
            recordData.latitude = recordData.latitude || 0;
            recordData.longitude = recordData.longitude || 0;
        } else {
            // 對於一般情況，檢查經緯度
            if (recordData.latitude === null || recordData.longitude === null) {
                console.error("無法儲存地球歷史記錄：經緯度無效。", recordData);
                return null;
            }
        }

        // 確保時區資訊有效
        if (recordData.timezone && typeof recordData.timezone === 'object') {
            recordData.timezone.gmtOffset = recordData.timezone.gmtOffset || 0;
            recordData.timezone.countryCode = recordData.timezone.countryCode || '';
        }

        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        
        // 添加重試機制
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`[saveHistoryRecord] 嘗試保存記錄 (第 ${attempt} 次)`);
                const docRef = await addDoc(historyCollectionRef, recordData);
                console.log(`[saveHistoryRecord] 個人歷史記錄已儲存，文件 ID: ${docRef.id}`);
                
                // 驗證記錄是否真的保存成功
                try {
                    const savedDoc = await getDoc(docRef);
                    if (savedDoc.exists()) {
                        console.log(`[saveHistoryRecord] 記錄保存驗證成功: ${docRef.id}`);
                        return docRef.id;
                    } else {
                        console.warn(`[saveHistoryRecord] 記錄保存後無法找到，嘗試 ${attempt}/3`);
                        if (attempt === 3) return null;
                        continue;
                    }
                } catch (verifyError) {
                    console.warn(`[saveHistoryRecord] 無法驗證記錄保存狀態: ${verifyError.message}`);
                    // 如果無法驗證但沒有保存錯誤，假設成功
                    return docRef.id;
                }
                
            } catch (e) {
                console.error(`[saveHistoryRecord] 第 ${attempt} 次嘗試失敗:`, e);
                if (attempt === 3) {
                    console.error("[saveHistoryRecord] 所有嘗試都失敗，無法儲存歷史記錄");
                    return null;
                }
                // 等待一段時間後重試
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        
        return null;
    }

    async function saveToGlobalDailyRecord(recordData) {
        if (!auth.currentUser) {
            console.warn("無法儲存全域記錄：Firebase 會話未就緒。");
            return;
        }

        try {
            // 確保所有必要欄位都有值
            const sanitizedData = {
                dataIdentifier: recordData.dataIdentifier,
                userDisplayName: recordData.userDisplayName,
                groupName: currentGroupName || "",
                recordedAt: recordData.recordedAt,
                recordedDateString: recordData.recordedDateString,
                city: recordData.city,
                country: recordData.country,
                city_zh: recordData.city_zh || recordData.city,
                country_zh: recordData.country_zh || recordData.country,
                country_iso_code: recordData.country_iso_code || '',
                latitude: recordData.latitude || 0,
                longitude: recordData.longitude || 0,
                timezone: recordData.timezone || "Unknown",
                greeting: recordData.greeting || "",
                story: recordData.story || "",
                imageUrl: recordData.imageUrl || null,
                source: recordData.source || 'local_database',
                translationSource: recordData.translationSource || 'local_database'
            };

            console.log(`[saveToGlobalDailyRecord] 準備儲存全域記錄:`, sanitizedData);

            const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
            const docRef = await addDoc(globalCollectionRef, sanitizedData);
            console.log(`[saveToGlobalDailyRecord] 全域每日記錄已儲存，文件 ID: ${docRef.id}`);
            await updateGroupFilter();  // 更新組別選擇下拉選單
        } catch (e) {
            console.error("[saveToGlobalDailyRecord] 儲存全域每日記錄到 Firestore 失敗:", e);
            throw e;  // 重新拋出錯誤以便上層處理
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

                // 城市訪問次數顯示（只有重複訪問才顯示）
                const visitInfo = cityVisitNumber > 1 ? `<br><span class="visit-info" style="color: #007bff; font-size: 0.8em;">第 ${cityVisitNumber} 次拜訪這座城市</span>` : '';

                const li = document.createElement('li');
                li.innerHTML = `<span class="date">${recordDate}</span> -  
                                甦醒於: <span class="location">${cityDisplay || '未知城市'}, ${countryDisplay || '未知國家'}</span>
                                ${visitInfo}`;
                
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
        modalContent.innerHTML = '<div style="text-align: center; padding: 20px;">載入最新資料中...</div>';
        modal.style.display = 'block';
        modal.classList.add('show');
        
        try {
            // 🔄 重新從Firebase讀取最新的記錄數據（解決早餐圖片時序問題）
            let latestRecord = record;
            if (record.docId) {
                console.log(`[showHistoryLogModal] 重新讀取記錄 ${record.docId} 的最新數據`);
                try {
                    const { doc, getDoc } = window.firebaseSDK;
                    const recordRef = doc(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`, record.docId);
                    const docSnap = await getDoc(recordRef);
                    
                    if (docSnap.exists()) {
                        latestRecord = { ...docSnap.data(), docId: record.docId };
                        console.log(`[showHistoryLogModal] 成功讀取最新數據:`, latestRecord);
                    } else {
                        console.log(`[showHistoryLogModal] 記錄不存在，使用緩存數據`);
                    }
                } catch (firebaseError) {
                    console.error(`[showHistoryLogModal] Firebase讀取失敗，使用緩存數據:`, firebaseError);
                }
            }
            
            // 計算甦醒次數（使用最新記錄）
            const wakeUpNumber = await calculateWakeUpNumber(latestRecord);
            
            // 計算城市訪問次數（使用最新記錄）
            const cityVisitNumber = await calculateCityVisitNumber(latestRecord);
            
            // 設定彈窗標題
            modalTitle.textContent = `第 ${wakeUpNumber} 次的甦醒日誌`;
            
            // 準備城市和國家顯示名稱（使用最新記錄）
            const cityDisplay = latestRecord.city_zh && latestRecord.city_zh !== latestRecord.city ? 
                `${latestRecord.city_zh} (${latestRecord.city})` : latestRecord.city;
            const countryDisplay = latestRecord.country_zh && latestRecord.country_zh !== latestRecord.country ? 
                `${latestRecord.country_zh} (${latestRecord.country})` : latestRecord.country;
            
            // 處理記錄時間（確保兼容性）
            let recordTime = '未知時間';
            if (latestRecord.recordedAt) {
                if (latestRecord.recordedAt.toDate) {
                    recordTime = latestRecord.recordedAt.toDate().toLocaleString('zh-TW');
                } else if (latestRecord.recordedAt instanceof Date) {
                    recordTime = latestRecord.recordedAt.toLocaleString('zh-TW');
                }
            }
            
            // 創建詳細內容（使用最新記錄）
            let contentHTML = `
                <div class="log-detail" style="text-align: left;">
                    <h3>基本資訊</h3>
                    <p><strong>記錄時間：</strong>${recordTime}</p>
                    <p><strong>甦醒地點：</strong>${cityDisplay}, ${countryDisplay}</p>
                    ${cityVisitNumber > 1 ? `<p><strong>城市訪問：</strong>這是你第 ${cityVisitNumber} 次拜訪這座城市</p>` : ''}
                    ${latestRecord.timezone ? `<p><strong>時區：</strong>${latestRecord.timezone}</p>` : ''}
                    ${latestRecord.groupName ? `<p><strong>組別：</strong>${latestRecord.groupName}</p>` : ''}
                </div>
            `;
            
            // 🖼️ 如果有早餐圖片，優先顯示（使用最新記錄的imageUrl）
            if (latestRecord.imageUrl) {
                console.log(`[showHistoryLogModal] 發現早餐圖片: ${latestRecord.imageUrl}`);
                const recordId = latestRecord.docId || 'unknown';
                const cityDisplayName = latestRecord.city_zh || latestRecord.city || '未知城市';
                contentHTML += `
                    <div class="log-detail" style="text-align: left;">
                        <h3>今日早餐</h3>
                        <div id="historyImageContainer-${recordId}" style="text-align: center; margin: 10px 0;">
                            <img src="${latestRecord.imageUrl}" alt="早餐圖片" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
                                 onerror="handleHistoryImageError(this, '${recordId}', '${currentDataIdentifier}', '${cityDisplayName}')">
                        </div>
                    </div>
                `;
            } else {
                console.log(`[showHistoryLogModal] 沒有早餐圖片`);
            }
            
            // 如果有故事內容，顯示故事（使用最新記錄）
            if (latestRecord.story) {
                contentHTML += `
                    <div class="log-detail" style="text-align: left;">
                        <h3>今日故事</h3>
                        <div class="story-content">${latestRecord.story}</div>
                    </div>
                `;
            }
            
            // 座標資訊（使用最新記錄）
            if (latestRecord.latitude && latestRecord.longitude) {
                contentHTML += `
                    <div class="log-detail" style="text-align: left;">
                        <h3>座標資訊</h3>
                        <p><strong>緯度：</strong>${latestRecord.latitude.toFixed(6)}</p>
                        <p><strong>經度：</strong>${latestRecord.longitude.toFixed(6)}</p>
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

// 全域函數：處理圖片載入錯誤
window.handleImageLoadError = async function(imgElement, recordId, userIdentifier, cityName) {
    console.log(`[handleImageLoadError] 圖片載入失敗，嘗試刷新URL: recordId=${recordId}, userIdentifier=${userIdentifier}`);
    
    // 避免重複嘗試
    if (imgElement.dataset.retryAttempted === 'true') {
        console.log('[handleImageLoadError] 已嘗試過刷新，不再重試');
        imgElement.parentElement.innerHTML = `
            <p style="color: #888; font-style: italic;">
                <em>${cityName}的早餐圖片暫時無法顯示</em><br>
                <small>圖片可能已過期，請聯繫管理員</small>
            </p>
        `;
        return;
    }
    
    // 標記為已嘗試
    imgElement.dataset.retryAttempted = 'true';
    
    // 顯示載入中狀態
    const container = imgElement.parentElement;
    container.innerHTML = `
        <p style="color: #007bff;">
            <em>正在嘗試修復${cityName}的早餐圖片...</em>
        </p>
    `;
    
    try {
        // 調用刷新圖片URL的API
        const response = await fetch('/api/refreshImageUrl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recordId: recordId,
                userIdentifier: userIdentifier
            })
        });
        
        if (!response.ok) {
            throw new Error(`API錯誤: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.newImageUrl) {
            console.log('[handleImageLoadError] 成功獲取新的圖片URL:', result.newImageUrl);
            
            // 更新圖片
            container.innerHTML = `
                <div class="postcard-image-container">
                    <img src="${result.newImageUrl}" alt="${cityName}的早餐" style="max-width: 100%; border-radius: 8px;">
                    <p style="font-size: 0.9em; color: #555;"><em>${cityName}的早餐</em></p>
                </div>
            `;
        } else {
            throw new Error('API返回格式錯誤');
        }
        
    } catch (error) {
        console.error('[handleImageLoadError] 刷新圖片URL失敗:', error);
        container.innerHTML = `
            <p style="color: #888; font-style: italic;">
                <em>${cityName}的早餐圖片暫時無法顯示</em><br>
                <small>修復失敗: ${error.message}</small>
            </p>
        `;
    }
};

// 全域函數：處理歷史記錄中的圖片載入錯誤
window.handleHistoryImageError = async function(imgElement, recordId, userIdentifier, cityName) {
    console.log(`[handleHistoryImageError] 歷史圖片載入失敗，嘗試刷新URL: recordId=${recordId}, userIdentifier=${userIdentifier}`);
    
    // 避免重複嘗試
    if (imgElement.dataset.retryAttempted === 'true') {
        console.log('[handleHistoryImageError] 已嘗試過刷新，不再重試');
        const containerId = `historyImageContainer-${recordId}`;
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <p style="color: #888; font-style: italic; text-align: center;">
                    <em>${cityName}的早餐圖片暫時無法顯示</em><br>
                    <small>圖片可能已過期</small>
                </p>
            `;
        }
        return;
    }
    
    // 標記為已嘗試
    imgElement.dataset.retryAttempted = 'true';
    
    // 顯示載入中狀態
    const containerId = `historyImageContainer-${recordId}`;
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[handleHistoryImageError] 找不到圖片容器');
        return;
    }
    
    container.innerHTML = `
        <p style="color: #007bff; text-align: center;">
            <em>正在嘗試修復${cityName}的早餐圖片...</em>
        </p>
    `;
    
    try {
        // 調用刷新圖片URL的API
        const response = await fetch('/api/refreshImageUrl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recordId: recordId,
                userIdentifier: userIdentifier
            })
        });
        
        if (!response.ok) {
            throw new Error(`API錯誤: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.newImageUrl) {
            console.log('[handleHistoryImageError] 成功獲取新的圖片URL:', result.newImageUrl);
            
            // 更新圖片
            container.innerHTML = `
                <img src="${result.newImageUrl}" alt="早餐圖片" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            `;
        } else {
            throw new Error('API返回格式錯誤');
        }
        
    } catch (error) {
        console.error('[handleHistoryImageError] 刷新圖片URL失敗:', error);
        container.innerHTML = `
            <p style="color: #888; font-style: italic; text-align: center;">
                <em>${cityName}的早餐圖片暫時無法顯示</em><br>
                <small>修復失敗: ${error.message}</small>
            </p>
        `;
    }
};

// 全域函數：設置早餐按鈕
window.setupBreakfastButton = function(recordData, cityDisplayName, countryDisplayName, recordId) {
    console.log(`[setupBreakfastButton] 設置早餐按鈕: ${cityDisplayName}, ${countryDisplayName}, recordId: ${recordId}`);
    
    const breakfastBtn = document.getElementById('generateBreakfastBtn');
    if (!breakfastBtn) {
        console.error('[setupBreakfastButton] 找不到早餐按鈕元素');
        return;
    }
    
    // 移除舊的事件監聽器
    const newBtn = breakfastBtn.cloneNode(true);
    breakfastBtn.parentNode.replaceChild(newBtn, breakfastBtn);
    
    // 添加新的事件監聽器
    document.getElementById('generateBreakfastBtn').addEventListener('click', () => {
        generateBreakfastImage(recordData, cityDisplayName, countryDisplayName, recordId);
    });
};

// 全域函數：生成早餐圖片
window.generateBreakfastImage = async function(recordData, cityDisplayName, countryDisplayName, recordId) {
    console.log(`[generateBreakfastImage] 開始生成早餐圖片: ${cityDisplayName}, ${countryDisplayName}`);
    
    const breakfastBtn = document.getElementById('generateBreakfastBtn');
    const breakfastButtonContainer = document.getElementById('breakfastButtonContainer');
    
    if (!breakfastBtn || !breakfastButtonContainer) {
        console.error('[generateBreakfastImage] 找不到按鈕元素');
        return;
    }
    
    // 禁用按鈕並顯示載入狀態
    breakfastBtn.disabled = true;
    breakfastBtn.innerHTML = '🍳 生成中...';
    breakfastBtn.nextElementSibling.innerHTML = '<em>正在生成專屬早餐圖片，請稍候...</em>';
    
    try {
        // 獲取 Firebase Auth token
        const auth = window.firebaseSDK.getAuth();
        if (!auth.currentUser) {
            throw new Error('用戶未登入');
        }
        
        const idToken = await auth.currentUser.getIdToken();
        
        // 呼叫早餐圖片生成API
        const imageResponse = await fetch('/api/generateImage', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ 
                city: recordData.city,
                country: recordData.country,
                isUniverseTheme: recordData.isUniverseTheme || false
            })
        });

        if (!imageResponse.ok) {
            throw new Error(`生成圖片失敗: ${await imageResponse.text()}`);
        }
        
        const imageData = await imageResponse.json();

        if (!imageData.imageUrl) {
            throw new Error('API 沒有返回圖片 URL');
        }

        console.log(`[generateBreakfastImage] 圖片生成成功: ${imageData.imageUrl}`);
        
        // 隱藏按鈕容器並創建圖片容器
        breakfastButtonContainer.style.display = 'none';
        
        const breakfastContainer = document.createElement('div');
        breakfastContainer.id = 'breakfastImageContainer';
        breakfastContainer.style.marginTop = '20px';
        breakfastContainer.style.textAlign = 'center';
        
        const displayName = recordData.isUniverseTheme ? '星際早餐' : `${cityDisplayName}的早餐`;
        breakfastContainer.innerHTML = `
            <div class="postcard-image-container">
                <img src="${imageData.imageUrl}" alt="${displayName}" style="max-width: 100%; border-radius: 8px;">
                <p style="font-size: 0.9em; color: #555;"><em>今日的${displayName}</em></p>
            </div>
        `;
        
        // 插入圖片容器
        const debugInfo = document.getElementById('debugInfo');
        debugInfo.parentNode.insertBefore(breakfastContainer, debugInfo);
        
        // 更新 Firebase 記錄中的圖片 URL
        if (recordId) {
            try {
                const { getFirestore, doc, updateDoc, getDoc } = window.firebaseSDK;
                const db = getFirestore();
                // 使用全域 appId 變數，而非 window.firebaseConfig.appId
                const safeAppId = window.appId || (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id-worldclock-history');
                const currentDataIdentifier = window.currentDataIdentifier || localStorage.getItem('worldClockUserName');
                
                console.log(`[generateBreakfastImage] 使用 appId: ${safeAppId}, currentDataIdentifier: ${currentDataIdentifier}, recordId: ${recordId}`);
                
                const historyDocRef = doc(db, `artifacts/${safeAppId}/userProfiles/${currentDataIdentifier}/clockHistory`, recordId);
                
                // 🔍 先檢查文檔是否存在
                const docSnap = await getDoc(historyDocRef);
                if (!docSnap.exists()) {
                    console.warn(`[generateBreakfastImage] 記錄不存在，這可能導致歷史軌跡中缺少早餐圖片: ${recordId}`);
                    console.warn(`[generateBreakfastImage] 完整路徑: artifacts/${safeAppId}/userProfiles/${currentDataIdentifier}/clockHistory/${recordId}`);
                    
                    // ⚠️ 警告用戶可能的數據問題
                    console.error(`[generateBreakfastImage] 警告：原始記錄不存在可能導致歷史軌跡中看不到早餐圖片。建議重新「開始這一天」以正確保存記錄。`);
                    
                    // 🔧 嘗試創建記錄，但標記為補救措施
                    try {
                        const { setDoc } = window.firebaseSDK;
                        const completeRecordData = {
                            // 使用傳入的記錄數據，如果沒有則使用預設值
                            city: recordData.city || "Unknown City",
                            country: recordData.country || "Unknown Country",
                            city_zh: recordData.city_zh || recordData.city || "未知城市",
                            country_zh: recordData.country_zh || recordData.country || "未知國家",
                            latitude: recordData.latitude || 0,
                            longitude: recordData.longitude || 0,
                            targetUTCOffset: recordData.targetUTCOffset || 0,
                            timezone: recordData.timezone || { timeZoneId: "UTC", gmtOffset: 0 },
                            greeting: recordData.greeting || "Good morning",
                            story: recordData.story || "您在這座城市甦醒了。",
                            translationSource: recordData.translationSource || "original",
                            userLocalTime: recordData.userLocalTime || new Date().toLocaleTimeString(),
                            targetLatitude: recordData.targetLatitude || 0,
                            latitudeDescription: recordData.latitudeDescription || "未知偏好",
                            isUniverseTheme: recordData.isUniverseTheme || false,
                            groupName: recordData.groupName || "",
                            recordedAt: recordData.recordedAt || new Date(),
                            // 添加早餐圖片
                            imageUrl: imageData.imageUrl,
                            docId: recordId,
                            // 標記為補救創建
                            _isRecoveryRecord: true,
                            _recoveryReason: "原始記錄不存在，為早餐圖片創建補救記錄"
                        };
                        
                        await setDoc(historyDocRef, completeRecordData);
                        console.log(`[generateBreakfastImage] 已創建補救記錄: ${recordId}`);
                        
                        // 🔄 創建成功後，重新顯示最後記錄以反映早餐圖片
                        setTimeout(() => {
                            console.log(`[generateBreakfastImage] 重新載入最後記錄以顯示早餐圖片（補救記錄）`);
                            if (typeof displayLastRecordForCurrentUser === 'function') {
                                displayLastRecordForCurrentUser();
                            }
                        }, 1000);
                        
                        return;
                    } catch (setDocError) {
                        console.error(`[generateBreakfastImage] 創建補救記錄失敗: ${setDocError}`);
                        return;
                    }
                }
                
                console.log(`[generateBreakfastImage] 找到記錄，準備更新圖片URL: ${recordId}`);
                await updateDoc(historyDocRef, {
                    imageUrl: imageData.imageUrl
                });
                
                console.log(`[generateBreakfastImage] 圖片 URL 已更新到記錄中: ${recordId}`);
                
                // 🔄 更新成功後，重新顯示最後記錄以反映早餐圖片
                setTimeout(() => {
                    console.log(`[generateBreakfastImage] 重新載入最後記錄以顯示早餐圖片`);
                    if (typeof displayLastRecordForCurrentUser === 'function') {
                        displayLastRecordForCurrentUser();
                    }
                }, 1000); // 給Firebase一點時間完成更新
                
            } catch (updateError) {
                console.error('[generateBreakfastImage] 更新記錄中的圖片 URL 失敗:', updateError);
                console.error('[generateBreakfastImage] 錯誤詳細信息:', {
                    recordId,
                    currentDataIdentifier: window.currentDataIdentifier || localStorage.getItem('worldClockUserName'),
                    appId: window.appId || 'default-app-id-worldclock-history'
                });
            }
        }
        
    } catch (error) {
        console.error('[generateBreakfastImage] 生成早餐圖片失敗:', error);
        
        // 顯示錯誤狀態
        breakfastBtn.innerHTML = '❌ 生成失敗';
        breakfastBtn.nextElementSibling.innerHTML = `<em style="color: #dc3545;">生成失敗: ${error.message}</em>`;
        
        // 3秒後恢復按鈕
        setTimeout(() => {
            breakfastBtn.disabled = false;
            if (recordData.isUniverseTheme) {
                breakfastBtn.innerHTML = '🌌 我想吃宇宙早餐';
                breakfastBtn.nextElementSibling.innerHTML = '<em>探索來自星際的神秘早餐</em>';
            } else {
                breakfastBtn.innerHTML = `🍽️ 我想吃${cityDisplayName}早餐`;
                breakfastBtn.nextElementSibling.innerHTML = `<em>品嚐來自${cityDisplayName}的當地特色早餐</em>`;
            }
        }, 3000);
    }
};
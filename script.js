// 只保留 DOMContentLoaded 監聽器用於 UI 前置作業（如必要）
// 主要邏輯全部移到 firebaseReady 事件

// 1. 先移除 DOMContentLoaded 裡一開始的 window.firebaseSDK 解構
// 2. 將主程式碼全部搬到 firebaseReady 裡

// 保留全域變數宣告（如 let clockLeafletMap = null; 等）
let citiesData = [];
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

window.addEventListener('firebaseReady', async (event) => {
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, setDoc, getDoc, limit,
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

        // 初始化成功後載入城市數據
        await loadCitiesData();

    } catch (e) {
        console.error("Firebase 初始化失敗:", e);
        currentUserIdSpan.textContent = "Firebase 初始化失敗";
        alert("Firebase 初始化失敗，部分功能可能無法使用。");
        return;
    }

    // 將城市數據載入邏輯移到單獨的函數
    async function loadCitiesData() {
        try {
            const response = await fetch('cities_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            citiesData = await response.json();
            console.log("城市數據已載入", citiesData.length, "筆");
            if (citiesData.length === 0) {
                resultTextDiv.innerHTML = "提示：載入的城市數據為空。";
                findCityButton.disabled = true;
            } else if (currentDataIdentifier && auth.currentUser) {
                findCityButton.disabled = false;
            }
        } catch (e) {
            console.error("無法載入城市數據:", e);
            resultTextDiv.innerHTML = "錯誤：無法載入城市數據。";
            findCityButton.disabled = true;
        }
    }

    async function fetchStoryFromAPI(city, country, countryCode) {
    // 使用英文名稱進行API調用，避免中文字符導致的400錯誤
    console.log(`[fetchStoryFromAPI] Calling backend /api/generateStory for City: ${city}, Country: ${country}, Country Code: ${countryCode}`);

    try {
        const response = await fetch('/api/generateStory', { // 呼叫您 Vercel 部署的 API 路徑
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                city: city,
                country: country,
                // language: "Traditional Chinese" // 後端預設為繁體中文，如果需要可以從前端傳遞
            }),
        });

        if (!response.ok) {
            // 如果 API 返回 HTTP 錯誤狀態 (例如 4xx, 5xx)
            const errorData = await response.json().catch(() => ({ error: "無法解析 API 錯誤回應" })); // 嘗試解析錯誤詳情
            console.error(`API Error from /api/generateStory: ${response.status} ${response.statusText}`, errorData);
            // 返回一個包含錯誤訊息的物件，讓調用者可以處理
            return {
                greeting: `(系統提示：問候語獲取失敗 - ${response.status})`,
                story: `系統提示：關於 ${city}, ${country} 的小知識獲取失敗，請稍後再試。錯誤: ${errorData.error || response.statusText}`
            };
        }

        const data = await response.json(); // 解析來自後端 API 的 JSON 回應
        console.log("[fetchStoryFromAPI] Received data from backend:", data);

        // 驗證後端回傳的資料結構是否符合預期 (greeting 和 trivia/story)
        if (data && typeof data.greeting === 'string' && typeof data.trivia === 'string') {
            return {
                greeting: data.greeting,
                story: data.trivia // 後端回傳的是 trivia，我們在前端當作 story 使用
            };
        } else {
            console.warn("[fetchStoryFromAPI] Backend response format unexpected:", data);
            return {
                greeting: "(系統提示：收到的問候語格式有誤)",
                story: `關於 ${city}, ${country} 的小知識正在整理中，請稍後查看！(回應格式問題)`
            };
        }

    } catch (error) {
        console.error("Error calling /api/generateStory from frontend:", error);
        // 網路錯誤或其他前端 fetch 相關的錯誤
        return {
            greeting: "(系統提示：網路錯誤，無法獲取問候語)",
            story: `獲取 ${city}, ${country} 的小知識時發生網路連線問題，請檢查您的網路並重試。`
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
                if (citiesData.length > 0) {
                    console.log("Firebase 已認證且 currentDataIdentifier 已設定，啟用 findCityButton (如果城市數據已載入)。");
                    findCityButton.disabled = false;
                }
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

        if (showAlert) alert(`名稱已設定為 "${rawUserDisplayName}"${currentGroupName ? `，組別為 "${currentGroupName}"` : ''}。你的歷史記錄將以此名稱關聯。`);

        // 更新組別選擇下拉選單
        await updateGroupFilter();

        // 檢查是否在歷史記錄分頁，如果是則重新載入歷史記錄
        if (document.getElementById('HistoryTab').style.display !== 'none') {
            console.log("[setOrLoadUserName] 在歷史記錄分頁，重新載入歷史記錄");
            await loadHistory();
        }

        // 檢查是否在時鐘分頁，如果是則顯示最後記錄
        if (document.getElementById('ClockTab').style.display !== 'none') {
            console.log("[setOrLoadUserName] 在時鐘分頁，顯示最後記錄");
            await displayLastRecordForCurrentUser();
        }

        if (citiesData.length > 0 && auth.currentUser && currentDataIdentifier) {
            console.log("[setOrLoadUserName] 所有條件滿足，啟用 findCityButton。");
            findCityButton.disabled = false;
        } else {
            console.log("[setOrLoadUserName] 條件不滿足，findCityButton 保持禁用。Cities loaded:", citiesData.length > 0, "Auth current user:", !!auth.currentUser, "Data ID set:", !!currentDataIdentifier);
            findCityButton.disabled = true;
        }

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

                debugInfoSmall.innerHTML = `(記錄於: ${recordedAtDate})<br>(目標城市緯度: ${latitudeStr}°, 經度: ${longitudeStr}°)<br>(目標 UTC 偏移: ${targetUTCOffsetStr}, 城市實際 UTC 偏移: ${cityActualUTCOffset !== null ? cityActualUTCOffset.toFixed(2) : 'N/A'}, 時区: ${lastRecord.timezone || '未知'});`;
            } else {
                resultTextDiv.innerHTML = `<p>歡迎，${rawUserDisplayName}！此名稱尚無歷史記錄。</p><p>按下「我在哪裡甦醒？」按鈕，開始您的主觀時間之旅吧！</p>`;
                console.log("[displayLastRecordForCurrentUser] 此識別碼尚無歷史記錄。");
            }
        } catch (e) {
            console.error("[displayLastRecordForCurrentUser] 讀取最後一筆記錄失敗:", e);
            resultTextDiv.innerHTML = "<p>讀取最後記錄失敗。</p>";
        }
    }

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
        if (!ianaTimeZone || typeof ianaTimeZone !== 'string') {
            console.warn("無效的時區輸入:", ianaTimeZone);
            return 0; // 返回 UTC 偏移
        }

        try {
            const now = new Date();
            
            // 方法1：使用 Intl.DateTimeFormat 的 formatToParts
            const formatter = new Intl.DateTimeFormat('en', {
                timeZone: ianaTimeZone,
                timeZoneName: 'longOffset'
            });
            
            // 首先嘗試使用 formatToParts
            const parts = formatter.formatToParts(now);
            let offsetString = parts.find(part => 
                (part.type === 'timeZoneName' || part.type === 'unknown') && 
                (part.value.includes('GMT') || part.value.includes('UTC'))
            )?.value;

            // 如果 formatToParts 沒有找到偏移，嘗試其他方法
            if (!offsetString) {
                // 方法2：使用完整格式化字符串
                const fullString = formatter.format(now);
                const match = fullString.match(/(GMT|UTC)([+-]\d{1,2}(:\d{2})?)/);
                if (match) {
                    offsetString = match[0];
                } else {
                    // 方法3：使用另一種格式化選項
                    const altFormatter = new Intl.DateTimeFormat('en', {
                        timeZone: ianaTimeZone,
                        hour: 'numeric',
                        minute: 'numeric',
                        timeZoneName: 'short'
                    });
                    const altString = altFormatter.format(now);
                    const altMatch = altString.match(/(GMT|UTC)([+-]\d{1,2}(:\d{2})?)/);
                    if (altMatch) {
                        offsetString = altMatch[0];
                    }
                }
            }

            // 如果還是沒有找到偏移，使用計算方法
            if (!offsetString) {
                // 方法4：通過比較本地時間和UTC時間來計算偏移
                const localDate = new Date(now.toLocaleString('en-US', { timeZone: ianaTimeZone }));
                const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
                const offsetInMinutes = (localDate - utcDate) / (60 * 1000);
                return offsetInMinutes / 60;
            }

            return parseOffsetString(offsetString);
        } catch (e) {
            console.warn(`處理時區 ${ianaTimeZone} 時發生錯誤:`, e);
            return 0; // 對於任何錯誤，返回 UTC 偏移
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
        mapContainerDiv.classList.remove('universe-message');
        debugInfoSmall.innerHTML = "";

        // 清除所有已存在的早餐圖片容器
        const existingBreakfastContainers = document.querySelectorAll('#breakfastImageContainer');
        existingBreakfastContainers.forEach(container => container.remove());
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

    async function findMatchingCity() {
        clearPreviousResults();
        console.log("--- 開始尋找匹配城市 ---");
        findCityButton.disabled = true; // 防止重複點擊
        resultTextDiv.innerHTML = "<p>尋找中，請稍候...</p>";

        if (!currentDataIdentifier) {
            alert("請先設定你的顯示名稱。");
            findCityButton.disabled = false;
            return;
        }
        if (!auth.currentUser) {
            alert("Firebase 會話未就緒，請稍候或刷新頁面。");
            findCityButton.disabled = false;
            return;
        }
        if (citiesData.length === 0) {
            resultTextDiv.innerHTML = "錯誤：城市數據未載入或為空。";
            findCityButton.disabled = false;
            return;
        }

        // 獲取用戶的城市訪問統計
        const cityVisitStats = await getUserCityVisitStats();

        // 獲取用戶當前的本地時間
        const userLocalDate = new Date();
        
        // 計算用戶的 UTC 時間（考慮日期）
        const userUTCHours = userLocalDate.getUTCHours();
        const userUTCMinutes = userLocalDate.getUTCMinutes();
        const userUTCTime = userUTCHours + userUTCMinutes / 60;

        // 目標時間是早上 8:00（UTC）
        const targetHour = 8;
        
        // 計算時差（考慮跨日的情況）
        let hourDiff = targetHour - userUTCTime;
        
        // 調整時差到 -12 到 12 的範圍內
        while (hourDiff > 12) {
            hourDiff -= 24;
        }
        while (hourDiff < -12) {
            hourDiff += 24;
        }

        // 目標 UTC 偏移就是這個時差
        const targetUTCOffsetHours = hourDiff;

        console.log(`用戶當前本地時間: ${userLocalDate.toLocaleTimeString()}`);
        console.log(`用戶當前 UTC 時間: ${userUTCTime.toFixed(2)}`);
        console.log(`目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)} (尋找當地時間接近 ${targetHour}:00 的地方)`);

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

            // 計算該城市當前的當地時間（小時）
            const cityLocalTime = (userUTCTime + cityUTCOffset + 24) % 24;
            
            // 檢查該城市的當地時間是否接近目標時間（早上 8:00）
            // 允許 40 分鐘的誤差
            const timeDiff = Math.abs(cityLocalTime - targetHour);
            const adjustedTimeDiff = Math.min(timeDiff, 24 - timeDiff);
            
            if (adjustedTimeDiff <= 0.67) { // 0.67 小時 = 40 分鐘
                candidateCities.push({
                    ...city,
                    timeDiff: adjustedTimeDiff,
                    localTime: cityLocalTime
                });
                console.log(`找到候選城市: ${city.city}, 當地時間: ${cityLocalTime.toFixed(2)}, 時差: ${adjustedTimeDiff.toFixed(2)}`);
            }
        }

        // 如果沒有找到任何候選城市，顯示宇宙訊息
        if (candidateCities.length === 0) {
            resultTextDiv.innerHTML = `
                <p style="font-weight: bold; font-size: 1.1em;">(系統提示：無法找到符合條件的城市)</p>
                <p>今天的你已脫離地球，<br>與<strong>未知星球 (Universe)</strong>非地球生物共同開啟了新的一天！</p>
                <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">在浩瀚宇宙中，時間的概念變得模糊。這裡沒有日出日落，沒有晨昏交替，只有永恆的星光陪伴著你。</p>
            `;

            countryFlagImg.style.display = 'none';
            mapContainerDiv.classList.add('universe-message');
            mapContainerDiv.innerHTML = "<p>浩瀚宇宙，無從定位...</p>";

            // 創建早餐圖片容器
            const breakfastContainer = document.createElement('div');
            breakfastContainer.id = 'breakfastImageContainer';
            breakfastContainer.style.marginTop = '20px';
            breakfastContainer.style.textAlign = 'center';
            breakfastContainer.innerHTML = '<p style="color: #007bff;"><i>正在為你準備宇宙早餐......</i></p>';
            
            // 將早餐圖片容器插入到地圖和 debugInfo 之間
            debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);
            debugInfoSmall.innerHTML = `(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 時區: Unknown)`;

            // 生成宇宙早餐圖片
            try {
                const token = await auth.currentUser.getIdToken();
                const imageResponse = await fetch('/api/generateImage', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        city: "Unknown Planet",
                        country: "Universe"
                    })
                });

                if (!imageResponse.ok) throw new Error(await imageResponse.text());
                const imageData = await imageResponse.json();

                if (imageData.imageUrl) {
                    breakfastContainer.innerHTML = `
                        <div class="postcard-image-container">
                            <img src="${imageData.imageUrl}" alt="宇宙早餐" style="max-width: 100%; border-radius: 8px;">
                            <p style="font-size: 0.9em; color: #555;"><em>宇宙早餐</em></p>
                        </div>
                    `;

                    const recordData = {
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
                        targetUTCOffset: targetUTCOffsetHours,
                        matchedCityUTCOffset: null,
                        recordedDateString: userLocalDate.toISOString().split('T')[0],
                        greeting: "(系統提示：無法找到符合條件的城市)",
                        story: "在浩瀚宇宙中，時間的概念變得模糊。這裡沒有日出日落，沒有晨昏交替，只有永恆的星光陪伴著你。",
                        imageUrl: imageData.imageUrl,
                        timezone: "Unknown"
                    };
                    await saveHistoryRecord(recordData);
                    await saveToGlobalDailyRecord(recordData);
                }
            } catch (error) {
                console.error("生成宇宙早餐圖片失敗:", error);
                breakfastContainer.innerHTML = `<p style="color: red;">抱歉，生成宇宙早餐圖片時發生錯誤：${error.message}</p>`;
            }

            findCityButton.disabled = false;
            return;
        }

        // 根據時間差排序候選城市
        candidateCities.sort((a, b) => a.timeDiff - b.timeDiff);

        // 找出時間差最小的值
        const minTimeDiff = candidateCities[0].timeDiff;
        
        // 篩選出時間差最小的城市
        const bestTimeCities = candidateCities.filter(city => city.timeDiff === minTimeDiff);

        // 根據時間差計算緯度範圍
        let latitudeRange;
        if (minTimeDiff <= 0.1) { // 時間差小於 6 分鐘
            latitudeRange = { min: 0, max: 25 }; // 低緯度地區
        } else if (minTimeDiff <= 0.3) { // 時間差小於 12 分鐘
            latitudeRange = { min: 15, max: 50 }; // 中緯度地區
        } else { // 時間差大於 12 分鐘
            latitudeRange = { min: 35, max: 90 }; // 高緯度地區
        }
        
        // 在時間差最小的城市中，根據緯度範圍篩選
        const matchingCities = bestTimeCities.filter(city => {
            const latitude = Math.abs(city.latitude); // 使用絕對值以包含南北半球
            return latitude >= latitudeRange.min && latitude <= latitudeRange.max;
        });

        // 使用新的智能選擇邏輯（考慮訪問歷史）
        let bestMatchCity;
        if (matchingCities.length > 0) {
            bestMatchCity = selectCityWithVisitHistory(matchingCities, cityVisitStats);
        } else {
            // 如果沒有符合緯度範圍的城市，在所有時間差最小的城市中智能選擇
            bestMatchCity = selectCityWithVisitHistory(bestTimeCities, cityVisitStats);
        }

        // 如果還是沒有選到城市，使用原來的邏輯
        if (!bestMatchCity) {
            bestMatchCity = bestTimeCities[0];
        }

        const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone);

        // 使用英文名稱調用API，避免中文字符導致的400錯誤
        const apiResponse = await fetchStoryFromAPI(bestMatchCity.city, bestMatchCity.country, bestMatchCity.country_iso_code);
        const greetingFromAPI = apiResponse.greeting;
        const storyFromAPI = apiResponse.story;

        // 計算此城市的訪問次數（包含本次）
        const currentVisitCount = (cityVisitStats[bestMatchCity.city] || 0) + 1;
        let explorationMessage = "";
        if (currentVisitCount === 1) {
            explorationMessage = "<p style='color: #28a745; font-size: 0.9em; margin-top: 8px;'>🎉 這是你第一次來到這個地方！</p>";
        } else if (currentVisitCount <= 3) {
            explorationMessage = `<p style='color: #17a2b8; font-size: 0.9em; margin-top: 8px;'>✨ 你已經來過${currentVisitCount-1}次，再次體驗這個地方的魅力！</p>`;
        }

        resultTextDiv.innerHTML = `
            <p style="font-weight: bold; font-size: 1.1em;">${greetingFromAPI}</p>
            <p>今天的你是<strong>${bestMatchCity.city_zh} (${bestMatchCity.country_zh})</strong>人！</p>
            ${explorationMessage}
            <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyFromAPI}</p>
        `;

        if (bestMatchCity.country_iso_code) {
            countryFlagImg.src = `https://flagcdn.com/w40/${bestMatchCity.country_iso_code.toLowerCase()}.png`;
            countryFlagImg.alt = `${bestMatchCity.country_zh} 國旗`;
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
            clockLeafletMap = L.map(mapContainerDiv).setView([bestMatchCity.latitude, bestMatchCity.longitude], 7);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd', maxZoom: 19
            }).addTo(clockLeafletMap);
            L.circleMarker([bestMatchCity.latitude, bestMatchCity.longitude], {
                color: 'red', fillColor: '#f03', fillOpacity: 0.8, radius: 8
            }).addTo(clockLeafletMap).bindPopup(`<b>${bestMatchCity.city_zh} (${bestMatchCity.country_zh})</b><br>${bestMatchCity.country_zh}`).openPopup();
        } else {
            mapContainerDiv.innerHTML = "<p>無法顯示地圖，城市座標資訊不完整或無效。</p>";
        }

        // 創建早餐圖片容器
        const breakfastContainer = document.createElement('div');
        breakfastContainer.id = 'breakfastImageContainer';
        breakfastContainer.style.marginTop = '20px';
        breakfastContainer.style.textAlign = 'center';
        breakfastContainer.innerHTML = '<p style="color: #007bff;"><i>正在為你準備當地早餐......</i></p>';
        
        // 將早餐圖片容器插入到地圖和 debugInfo 之間
        debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);
        
        // 計算此城市的訪問次數（包含本次）用於debugInfo顯示
        const visitCountForDebug = (cityVisitStats[bestMatchCity.city] || 0) + 1;
        const visitMessage = visitCountForDebug === 1 ? "首次造訪" : `第${visitCountForDebug}次造訪`;
        
        debugInfoSmall.innerHTML = `(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 城市實際 UTC 偏移: ${cityActualUTCOffset.toFixed(2)}, 時區: ${bestMatchCity.timezone}, ${visitMessage})`;

        // 生成早餐圖片
        try {
            // 先獲取認證令牌
            const token = await auth.currentUser.getIdToken();
            
            const imageResponse = await fetch('/api/generateImage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`  // 添加認證令牌
                },
                body: JSON.stringify({ 
                    city: bestMatchCity.city_zh || bestMatchCity.city,
                    country: bestMatchCity.country_zh || bestMatchCity.country
                })
            });

            if (!imageResponse.ok) throw new Error(await imageResponse.text());
            const imageData = await imageResponse.json();

            if (imageData.imageUrl) {
                breakfastContainer.innerHTML = `
                    <div class="postcard-image-container">
                        <img src="${imageData.imageUrl}" alt="${bestMatchCity.city_zh}的早餐" style="max-width: 100%; border-radius: 8px;">
                        <p style="font-size: 0.9em; color: #555;"><em>${bestMatchCity.city_zh}的早餐</em></p>
                    </div>
                `;

                const recordData = {
                    dataIdentifier: currentDataIdentifier,
                    userDisplayName: rawUserDisplayName,
                    recordedAt: serverTimestamp(),
                    localTime: userLocalDate.toLocaleTimeString(),
                    city: bestMatchCity.city,
                    country: bestMatchCity.country,
                    city_zh: bestMatchCity.city_zh || "",
                    country_zh: bestMatchCity.country_zh || "",
                    country_iso_code: bestMatchCity.country_iso_code.toLowerCase(),
                    latitude: bestMatchCity.latitude,
                    longitude: bestMatchCity.longitude,
                    targetUTCOffset: targetUTCOffsetHours,
                    matchedCityUTCOffset: !isFinite(cityActualUTCOffset) ? null : cityActualUTCOffset,
                    recordedDateString: userLocalDate.toISOString().split('T')[0],
                    greeting: greetingFromAPI,
                    story: storyFromAPI,
                    imageUrl: imageData.imageUrl,
                    timezone: bestMatchCity.timezone || "Unknown"
                };
                await saveHistoryRecord(recordData);
                await saveToGlobalDailyRecord(recordData);
            }
        } catch (error) {
            console.error("生成早餐圖片失敗:", error);
            breakfastContainer.innerHTML = `<p style="color: red;">抱歉，生成早餐圖片時發生錯誤：${error.message}</p>`;
        }

        console.log("--- 尋找匹配城市結束 (找到城市) ---");
        findCityButton.disabled = false;
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

        console.log(`[saveToGlobalDailyRecord] 原始記錄日期: ${recordData.recordedDateString}`);

        const globalRecord = {
            dataIdentifier: recordData.dataIdentifier,
            userDisplayName: recordData.userDisplayName,
            groupName: currentGroupName || "",  // 添加組別資訊
            recordedAt: recordData.recordedAt,
            recordedDateString: recordData.recordedDateString,  // 使用原始記錄的日期字串
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
                renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history');
                return;
            }

            // 新增：建立表格
            const table = document.createElement('table');
            table.className = 'history-table';
            const thead = document.createElement('thead');
            thead.innerHTML = `<tr><th>時間</th><th>甦醒於</th><th></th></tr>`;
            table.appendChild(thead);
            const tbody = document.createElement('tbody');

            // 建立標記映射用於互動
            const markerMap = new Map();
            let recordIndex = 0;
            
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                const docId = doc.id;
                const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '日期未知';
                const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

                // 建立表格列
                const tr = document.createElement('tr');
                tr.className = 'hoverable-history-item';
                tr.dataset.timestamp = record.recordedAt ? record.recordedAt.toMillis() : Date.now();
                tr.dataset.lat = record.latitude;
                tr.dataset.lon = record.longitude;
                
                const tdTime = document.createElement('td');
                tdTime.textContent = recordDate;
                const tdLocation = document.createElement('td');
                tdLocation.textContent = `${cityDisplay || '未知城市'}, ${countryDisplay || '未知國家'}`;
                const tdButton = document.createElement('td');
                const detailsButton = document.createElement('button');
                detailsButton.textContent = '查看日誌';
                detailsButton.className = 'history-log-button';
                
                // 防止按鈕點擊事件冒泡
                const handleButtonClick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await showHistoryLogModal(record);
                };
                
                detailsButton.addEventListener('click', handleButtonClick);
                detailsButton.addEventListener('touchstart', handleButtonClick, { passive: false });
                
                tdButton.appendChild(detailsButton);
                tr.appendChild(tdTime);
                tr.appendChild(tdLocation);
                tr.appendChild(tdButton);
                tbody.appendChild(tr);

                // 地圖點資料
                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    historyPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${recordDate} @ ${cityDisplay}, ${countryDisplay}`,
                        timestamp: record.recordedAt.toMillis(),
                        listItem: tr,
                        index: recordIndex,
                        record: record
                    });
                }
                recordIndex++;
            });
            
            table.appendChild(tbody);
            historyListUl.innerHTML = '';
            historyListUl.appendChild(table);
            
            // 按時間順序排序點位（從舊到新）
            historyPoints.sort((a, b) => a.timestamp - b.timestamp);
            
            // 渲染地圖
            renderHistoryMap(historyPoints, markerMap);
            
        } catch (e) {
            console.error("[loadHistory] 讀取歷史記錄失敗:", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
            historyMapContainerDiv.innerHTML = '<p>讀取歷史記錄時發生錯誤。</p>';
            historyDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    // 新增：專門處理歷史軌跡地圖的函數
    function renderHistoryMap(points, markerMap) {
        if (historyLeafletMap) {
            historyLeafletMap.remove();
            historyLeafletMap = null;
        }
        historyMapContainerDiv.innerHTML = '';

        if (points.length === 0) {
            historyMapContainerDiv.innerHTML = '<p>無有效的歷史位置記錄可顯示。</p>';
            historyDebugInfoSmall.textContent = "無有效座標點";
            return;
        }

        // 初始化地圖
        historyLeafletMap = L.map(historyMapContainerDiv);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(historyLeafletMap);

        // 創建圖層組
        historyMarkerLayerGroup = L.layerGroup().addTo(historyLeafletMap);

        // 為每個點添加標記
        points.forEach((point, index) => {
            const isLast = index === points.length - 1;
            
            // 最後一筆為紅色，其他為黃色
            const markerColor = isLast ? '#ff0000' : '#FFD700';
            const markerFillColor = isLast ? '#ff0000' : '#FFD700';
            const markerRadius = isLast ? 10 : 8;
            
            const marker = L.circleMarker([point.lat, point.lon], {
                color: markerColor,
                fillColor: markerFillColor,
                fillOpacity: 0.8,
                radius: markerRadius,
                weight: 2
            }).addTo(historyMarkerLayerGroup);

            // 保存標記引用
            markerMap.set(point.timestamp.toString(), {
                marker: marker,
                originalRadius: markerRadius,
                originalColor: markerColor,
                originalFillColor: markerFillColor
            });
            
            // 點擊標記顯示詳細資訊
            marker.on('click', function() {
                const cityDisplay = point.record.city_zh && point.record.city_zh !== point.record.city ? 
                    `${point.record.city_zh} (${point.record.city})` : point.record.city;
                const countryDisplay = point.record.country_zh && point.record.country_zh !== point.record.country ? 
                    `${point.record.country_zh} (${point.record.country})` : point.record.country;
                const recordDate = point.record.recordedAt && point.record.recordedAt.toDate ? 
                    point.record.recordedAt.toDate().toLocaleString('zh-TW', { 
                        year: 'numeric', month: 'numeric', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                    }) : '日期未知';
                
                const popupContent = `
                    <div style="text-align: center;">
                        <h4 style="margin: 5px 0; color: #2c3e50;">第 ${index + 1} 次甦醒</h4>
                        <p style="margin: 5px 0; font-weight: bold;">${cityDisplay}</p>
                        <p style="margin: 5px 0;">${countryDisplay}</p>
                        <p style="margin: 5px 0; font-size: 0.9em; color: #666;">${recordDate}</p>
                    </div>
                `;
                
                marker.bindPopup(popupContent).openPopup();
            });

            // 如果不是最後一個點，繪製到下一個點的線條
            if (index < points.length - 1) {
                const nextPoint = points[index + 1];
                
                // 線條顏色：黃色
                L.polyline([[point.lat, point.lon], [nextPoint.lat, nextPoint.lon]], {
                    color: '#FFD700',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 10'
                }).addTo(historyMarkerLayerGroup);

                // 在線段70%處添加箭頭
                const startLatLng = L.latLng(point.lat, point.lon);
                const endLatLng = L.latLng(nextPoint.lat, nextPoint.lon);
                const arrowLatLng = interpolateLatLng(startLatLng, endLatLng, 0.7);
                
                L.circleMarker(arrowLatLng, {
                    color: '#FFD700',
                    fillColor: '#FFD700',
                    fillOpacity: 0.8,
                    radius: 4,
                    weight: 1
                }).addTo(historyMarkerLayerGroup);
            }

            // 為對應的列表項添加事件
            if (point.listItem) {
                const highlightMarker = () => {
                    // 重置所有標記
                    markerMap.forEach((markerInfo, timestamp) => {
                        markerInfo.marker.setRadius(markerInfo.originalRadius);
                        markerInfo.marker.setStyle({
                            color: markerInfo.originalColor,
                            fillColor: markerInfo.originalFillColor,
                            weight: 2,
                            fillOpacity: 0.8
                        });
                    });
                    
                    // 高亮當前標記
                    const markerInfo = markerMap.get(point.timestamp.toString());
                    if (markerInfo) {
                        markerInfo.marker.setRadius(markerInfo.originalRadius * 1.5);
                        markerInfo.marker.setStyle({
                            weight: 4,
                            fillOpacity: 1
                        });
                    }
                    
                    // 重置所有表格行樣式
                    document.querySelectorAll('.hoverable-history-item').forEach(row => {
                        row.classList.remove('active');
                    });
                    point.listItem.classList.add('active');
                };

                const resetMarker = () => {
                    const markerInfo = markerMap.get(point.timestamp.toString());
                    if (markerInfo) {
                        markerInfo.marker.setRadius(markerInfo.originalRadius);
                        markerInfo.marker.setStyle({
                            color: markerInfo.originalColor,
                            fillColor: markerInfo.originalFillColor,
                            weight: 2,
                            fillOpacity: 0.8
                        });
                    }
                    point.listItem.classList.remove('active');
                };

                // 桌面版滑鼠事件
                point.listItem.addEventListener('mouseenter', highlightMarker);
                point.listItem.addEventListener('mouseleave', resetMarker);

                // 手機版觸控事件
                let touchTimeout;
                let touchStartY;
                let isTouchMoved = false;

                point.listItem.addEventListener('touchstart', (e) => {
                    touchStartY = e.touches[0].clientY;
                    isTouchMoved = false;
                }, { passive: true });

                point.listItem.addEventListener('touchmove', (e) => {
                    if (!touchStartY) return;
                    const touchDeltaY = Math.abs(e.touches[0].clientY - touchStartY);
                    if (touchDeltaY > 10) {
                        isTouchMoved = true;
                        resetMarker();
                    }
                }, { passive: true });

                point.listItem.addEventListener('touchend', (e) => {
                    if (!isTouchMoved) {
                        e.preventDefault();
                        highlightMarker();
                        
                        // 3秒後自動取消高亮
                        clearTimeout(touchTimeout);
                        touchTimeout = setTimeout(() => {
                            resetMarker();
                        }, 3000);
                    }
                    touchStartY = null;
                    isTouchMoved = false;
                });
                
                // 點擊表格行定位到地圖標記
                point.listItem.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'BUTTON') {
                        historyLeafletMap.setView([point.lat, point.lon], 10);
                        
                        // 顯示彈窗
                        setTimeout(() => {
                            marker.fire('click');
                        }, 300);
                    }
                });
            }
        });

        // 調整地圖視圖以顯示所有點
        const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
        historyLeafletMap.fitBounds(bounds, {
            padding: [50, 50]
        });

        historyDebugInfoSmall.textContent = `已顯示 ${points.length} 個歷史位置點`;
    }

    // 輔助函數：在兩點之間進行插值
    function interpolateLatLng(start, end, fraction) {
        const lat = start.lat + (end.lat - start.lat) * fraction;
        const lng = start.lng + (end.lng - start.lng) * fraction;
        return L.latLng(lat, lng);
    }

    // **新增：顯示歷史日誌模態框的函數 (修正版)**
    async function showHistoryLogModal(record) {
        const modal = document.getElementById('historyLogModal');
        const modalContent = document.getElementById('historyLogModalContent');
        if (!modal || !modalContent) {
            console.error("找不到模態框元素");
            return;
        }

        const cityDisplay = formatCityName(record);
        document.getElementById('modalTitle').textContent = `${cityDisplay || '未知地點'} - 甦醒日誌`;

        // 計算這是第幾次甦醒
        let awakingNumber = "未知";
        try {
            if (currentDataIdentifier && auth.currentUser) {
                const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
                const q = query(historyCollectionRef, orderBy("recordedAt", "asc"));
                const querySnapshot = await getDocs(q);
                
                let recordIndex = 0;
                querySnapshot.forEach((doc, index) => {
                    const historyRecord = doc.data();
                    // 比較記錄時間戳來確定是第幾次
                    if (historyRecord.recordedAt && record.recordedAt && 
                        historyRecord.recordedAt.toMillis() === record.recordedAt.toMillis()) {
                        recordIndex = index + 1; // 加1因為索引從0開始
                    }
                });
                
                if (recordIndex > 0) {
                    awakingNumber = `第 ${recordIndex} 次`;
                }
            }
        } catch (error) {
            console.error("計算甦醒次數失敗:", error);
        }

        const recordDate = formatDate(record.recordedAt);
        modalContent.innerHTML = `
            <div id="logBasicInfo">
                <p style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 12px; border-radius: 6px; text-align: center; font-weight: bold; margin-bottom: 15px;">
                    ✨ ${awakingNumber}甦醒日誌 ✨
                </p>
                <p><strong>記錄時間:</strong> ${recordDate}</p>
                <p><strong>使用者當地時間:</strong> ${record.localTime || '未知'}</p>
                <p><strong>甦醒地點:</strong> ${cityDisplay}, ${formatCountryName(record)}</p>
                <p style="margin-top:15px;"><strong>當時的問候:</strong></p>
                <p style="font-weight: bold; font-style: italic; color: #2c3e50;">${record.greeting || '此記錄無問候語。'}</p>
                <p style="margin-top:15px;"><strong>相關小知識/記事:</strong></p>
                <p style="font-style: italic; color: #34495e; white-space: pre-wrap;">${record.story || '此記錄無相關記事。'}</p>
                ${record.imageUrl ? `
                    <p style="margin-top:15px;"><strong>當日早餐:</strong></p>
                    <div class="postcard-image-container">
                        <img src="${record.imageUrl}" alt="${cityDisplay}的早餐" style="max-width: 100%; border-radius: 8px;">
                        <p style="font-size: 0.9em; color: #555;"><em>${cityDisplay}的早餐</em></p>
                    </div>
                ` : '<p style="color: #999; margin-top: 15px;"><em>此記錄沒有早餐圖片。</em></p>'}
                <hr style="margin: 20px 0;">
                <p><small>時區: ${record.timezone || '未知'}, 國家代碼: ${record.country_iso_code || 'N/A'}</small></p>
                <p><small>座標: Lat ${record.latitude?.toFixed(4) || 'N/A'}, Lon ${record.longitude?.toFixed(4) || 'N/A'}</small></p>
            </div>
        `;

        modal.style.display = 'block';
        // 添加一個小延遲以確保 display: block 已經生效
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        setupModalClose(modal, modalContent);
    }

    function setupModalClose(modal, modalContent) {
        const closeFunction = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            modal.classList.remove('show');
            // 等待動畫完成後再隱藏模態框
            setTimeout(() => {
                modal.style.display = 'none';
                modalContent.innerHTML = '';
            }, 300);
        };

        const closeButton = document.getElementById('historyLogModalClose');
        const footerButton = document.getElementById('closeModalFooterButton');

        // 為關閉按鈕添加事件監聽器
        if (closeButton) {
            closeButton.addEventListener('click', closeFunction);
            closeButton.addEventListener('touchstart', closeFunction, { passive: false });
        }
        if (footerButton) {
            footerButton.addEventListener('click', closeFunction);
            footerButton.addEventListener('touchstart', closeFunction, { passive: false });
        }

        // 點擊模態框背景關閉
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeFunction(event);
            }
        });

        // 觸控模態框背景關閉
        window.addEventListener('touchstart', (event) => {
            if (event.target === modal) {
                closeFunction(event);
            }
        }, { passive: false });
    }

    async function generatePostcard(record, buttonElement) {
        const postcardSection = document.getElementById('postcardSection');
        if (!postcardSection) {
            console.error("找不到明信片顯示區塊");
            return;
        }

        // 已有圖片則直接顯示
        if (record.imageUrl) {
            renderPostcard(record, postcardSection);
            if (buttonElement) buttonElement.style.display = 'none';
            return;
        }

        try {
            buttonElement.disabled = true;
            buttonElement.textContent = '生成中...';
            postcardSection.innerHTML = '<p style="color: #007bff; text-align:center;"><i>正在為你準備當地人常吃的早餐......</i></p>';

            // 獲取當前用戶的認證 token
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

            const response = await fetch('/api/generateImage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    city: record.city_zh || record.city,
                    country: record.country_zh || record.country
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("圖片生成 API 錯誤:", response.status, errorText);
                throw new Error(`API 錯誤 (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            if (!data.imageUrl) throw new Error('圖片生成失敗：未收到圖片 URL');

            // 更新 Firestore 記錄
            await updateRecordWithImage(record, data.imageUrl);
            record.imageUrl = data.imageUrl;
            renderPostcard(record, postcardSection);
            if (buttonElement) buttonElement.style.display = 'none';

        } catch (error) {
            console.error("圖片生成失敗:", error);
            postcardSection.innerHTML = `<p style="color: red;">生成圖片時發生錯誤：${error.message}</p>`;
            if (buttonElement) {
                buttonElement.disabled = false;
                buttonElement.textContent = '重試生成早餐圖';
            }
        }
    }

    async function updateRecordWithImage(record, imageUrl) {
        if (!currentDataIdentifier) return;
        
        try {
            const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
            const q = query(historyCollectionRef, 
                where("recordedAt", "==", record.recordedAt),
                where("city", "==", record.city),
                where("country", "==", record.country)
            );

            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const docRef = doc(db, querySnapshot.docs[0].ref.path);
                await setDoc(docRef, { imageUrl }, { merge: true });
                console.log("成功更新記錄的圖片 URL");
            }
        } catch (e) {
            console.error("更新記錄圖片 URL 失敗:", e);
            throw e;
        }
    }

    function renderPostcard(record, container) {
        const cityDisplay = formatCityName(record);
        const countryDisplay = formatCountryName(record);
        const recordDate = formatDate(record.recordedAt);
        const story = record.story || `在${cityDisplay || '未知地點'}的美好時光`;

        container.innerHTML = `
            <div class="postcard-image-container" style="margin-top: 10px; text-align: center;">
                <img src="${record.imageUrl}" 
                     alt="為 ${cityDisplay} 今日早餐圖" 
                     style="max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin-bottom: 10px;">
                <p style="font-size: 0.9em; color: #555;"><em>「${story.length > 70 ? story.substring(0, 70) + '...' : story}」</em></p>
                <p style="font-size: 0.8em; color: #777;">${cityDisplay || ''}${cityDisplay && countryDisplay ? ', ' : ''}${countryDisplay || ''} - ${recordDate}</p>
                <button onclick="window.open('${record.imageUrl}', '_blank')" 
                        style="padding: 8px 15px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                    在新視窗中查看/下載圖片
                </button>
            </div>
        `;
    }

    // 輔助函數
    function formatCityName(record) {
        return record.city_zh && record.city_zh !== record.city ? 
               `${record.city_zh} (${record.city})` : record.city;
    }

    function formatCountryName(record) {
        return record.country_zh && record.country_zh !== record.country ? 
               `${record.country_zh} (${record.country})` : record.country;
    }

    function formatDate(timestamp) {
        return timestamp && timestamp.toDate ? 
               timestamp.toDate().toLocaleDateString('zh-TW', { 
                   year: 'numeric', month: 'long', day: 'numeric' 
               }) : '一個特別的日子';
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
            const globalPoints = [];

            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    const record = doc.data();

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

    // 確保在 DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTabButtons);
    } else {
        initializeTabButtons();
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

    // 初始載入時，嘗試設定一個預設的使用者名稱 (如果 localStorage 中有)
    // 或者，直接觸發 ClockTab 的顯示 (如果已經有用戶名)
    const initialUserName = localStorage.getItem('worldClockUserName');
    let initialLoadHandled = false;  // 添加全局變量來追蹤初始載入狀態

    if (initialUserName) {
        userNameInput.value = initialUserName;
        // 等待 auth 狀態變更處理
    } else {
        openTab(null, 'ClockTab', true);  // 添加第三個參數表示這是初始載入
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

    // 初始化時嘗試恢復組別設定
    const initialGroupName = localStorage.getItem('worldClockGroupName');
    if (initialGroupName) {
        groupNameInput.value = initialGroupName;
        currentGroupName = initialGroupName;
        currentGroupNameSpan.textContent = `(${initialGroupName})`;
    }

    // 添加 CSS 樣式
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

    // 等待 Firebase 準備就緒
    window.addEventListener('firebaseReady', async (event) => {
        const firebaseConfig = event.detail;
        
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

        // ... rest of your existing code ...

        // 初始化 Firebase
        try {
            console.log("開始初始化 Firebase...");
            setLogLevel('debug');
            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            console.log("Firebase 初始化成功。App ID:", appId, "Project ID:", firebaseConfig.projectId);

            // 初始化成功後載入城市數據
            await loadCitiesData();
        } catch (e) {
            console.error("Firebase 初始化失敗:", e);
            currentUserIdSpan.textContent = "Firebase 初始化失敗";
            alert("Firebase 初始化失敗，部分功能可能無法使用。");
            return;
        }

        // ... rest of your existing code ...
    });

});
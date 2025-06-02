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

    let currentGroupName = "";
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

    setUserNameButton.addEventListener('click', async () => {
        console.log("「設定/更新名稱」按鈕被點擊。");
        await setOrLoadUserName(userNameInput.value.trim());
    });

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
            console.error("獲取時區偏移時發生錯誤:", ianaTimeZone, e);
            
            // 最後的備用方法：直接使用時間差異計算
            try {
                const now = new Date();
                const localDate = new Date(now.toLocaleString('en-US', { timeZone: ianaTimeZone }));
                const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
                const offsetInMinutes = (localDate - utcDate) / (60 * 1000);
                return offsetInMinutes / 60;
            } catch (fallbackError) {
                console.error("備用方法也失敗:", fallbackError);
                return NaN;
            }
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
            // 允許 30 分鐘的誤差
            const timeDiff = Math.abs(cityLocalTime - targetHour);
            const adjustedTimeDiff = Math.min(timeDiff, 24 - timeDiff);
            
            if (adjustedTimeDiff <= 1.0) { // 1.0 小時 = 60 分鐘
                candidateCities.push({
                    ...city,
                    timeDiff: adjustedTimeDiff,
                    localTime: cityLocalTime
                });
                console.log(`找到候選城市: ${city.city}, 當地時間: ${cityLocalTime.toFixed(2)}, 時差: ${adjustedTimeDiff.toFixed(2)}`);
            }
        }

        // 根據時間差排序候選城市
        candidateCities.sort((a, b) => a.timeDiff - b.timeDiff);

        if (candidateCities.length === 0) {
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
            debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);
            debugInfoSmall.innerHTML = `(嘗試尋找的目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)})`;

            // 生成早餐圖片，使用特殊的宇宙主題提示
            try {
                const imageResponse = await fetch('/api/generateImage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        city: "未知星球",
                        country: "宇宙",
                        isUniverseTheme: true  // 只需要傳遞這個標記，讓後端決定使用哪個 prompt
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
                        targetUTCOffset: targetUTCOffsetHours,
                        matchedCityUTCOffset: null,
                        recordedDateString: userLocalDate.toISOString().split('T')[0],
                        greeting: greetingFromAPI,
                        story: storyFromAPI,
                        imageUrl: imageData.imageUrl,
                        timezone: "Cosmic/Unknown",
                        isUniverseTheme: true
                    };
                    await saveHistoryRecord(universeRecord);
                    await saveToGlobalDailyRecord(universeRecord);
                }
            } catch (error) {
                console.error("生成早餐圖片失敗:", error);
                breakfastContainer.innerHTML = `<p style="color: red;">抱歉，生成星際早餐圖片時發生錯誤：${error.message}</p>`;
            }

            console.log("--- 尋找匹配城市結束 (宇宙情況) ---");
            findCityButton.disabled = false;
            return;
        }

        // 選擇時間差最小的城市
        const bestMatchCity = candidateCities[0];
        const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone);
        const finalCityName = bestMatchCity.city_zh && bestMatchCity.city_zh !== bestMatchCity.city ? `${bestMatchCity.city_zh} (${bestMatchCity.city})` : bestMatchCity.city;
        const finalCountryName = bestMatchCity.country_zh && bestMatchCity.country_zh !== bestMatchCity.country ? `${bestMatchCity.country_zh} (${bestMatchCity.country})` : bestMatchCity.country;

        const apiResponse = await fetchStoryFromAPI(finalCityName, finalCountryName, bestMatchCity.country_iso_code);
        const greetingFromAPI = apiResponse.greeting;
        const storyFromAPI = apiResponse.story;

        resultTextDiv.innerHTML = `
            <p style="font-weight: bold; font-size: 1.1em;">${greetingFromAPI}</p>
            <p>今天的你是<strong>${finalCityName} (${finalCountryName})</strong>人！</p>
            <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyFromAPI}</p>
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

        // 創建早餐圖片容器
        const breakfastContainer = document.createElement('div');
        breakfastContainer.id = 'breakfastImageContainer';
        breakfastContainer.style.marginTop = '20px';
        breakfastContainer.style.textAlign = 'center';
        breakfastContainer.innerHTML = '<p style="color: #007bff;"><i>正在為你準備當地早餐......</i></p>';
        
        // 將早餐圖片容器插入到地圖和 debugInfo 之間
        debugInfoSmall.parentNode.insertBefore(breakfastContainer, debugInfoSmall);
        debugInfoSmall.innerHTML = `(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 城市實際 UTC 偏移: ${cityActualUTCOffset.toFixed(2)}, 時區: ${bestMatchCity.timezone})`;

        // 生成早餐圖片
        try {
            const imageResponse = await fetch('/api/generateImage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                        <img src="${imageData.imageUrl}" alt="${finalCityName}的早餐" style="max-width: 100%; border-radius: 8px;">
                        <p style="font-size: 0.9em; color: #555;"><em>${finalCityName}的早餐</em></p>
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

        const userLocalDate = new Date();
        const userLocalDateString = userLocalDate.toISOString().split('T')[0];

        console.log(`[saveToGlobalDailyRecord] 使用者本地日期: ${userLocalDateString}`);
        console.log(`[saveToGlobalDailyRecord] 原始記錄日期: ${recordData.recordedDateString}`);

        const globalRecord = {
            dataIdentifier: recordData.dataIdentifier,
            userDisplayName: recordData.userDisplayName,
            groupName: currentGroupName || "",  // 添加組別資訊
            recordedAt: recordData.recordedAt,
            recordedDateString: userLocalDateString,
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

            // 收集所有有效的歷史記錄點
            const markerMap = new Map(); // 用於存儲標記的引用
            
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                console.log("[loadHistory] 處理記錄:", record);
                const docId = doc.id;
                const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '日期未知';

                const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

                const li = document.createElement('li');
                li.innerHTML = `<span class="date">${recordDate}</span> -  
                                甦醒於: <span class="location">${cityDisplay || '未知城市'}, ${countryDisplay || '未知國家'}</span>`;
                
                const detailsButton = document.createElement('button');
                detailsButton.textContent = '查看日誌';
                detailsButton.className = 'history-log-button';

                // 替換原本的 onclick 事件處理
                const handleButtonClick = (e) => {
                    e.preventDefault();  // 防止預設行為
                    e.stopPropagation(); // 防止事件冒泡
                    showHistoryLogModal(record);
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

            // 渲染地圖
            if (historyLeafletMap) {
                historyLeafletMap.remove();
                historyLeafletMap = null;
            }
            historyMapContainerDiv.innerHTML = '';

            if (historyPoints.length > 0) {
                // 初始化地圖
                historyLeafletMap = L.map(historyMapContainerDiv);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 19
                }).addTo(historyLeafletMap);

                // 創建一個新的圖層組
                historyMarkerLayerGroup = L.layerGroup().addTo(historyLeafletMap);

                // 添加箭頭樣式的定義
                const arrowHead = {
                    color: '#3388ff',
                    fillColor: '#3388ff',
                    fillOpacity: 0.8,
                    weight: 2,
                    opacity: 0.8,
                    radius: 6
                };

                // 為每個點添加標記
                historyPoints.forEach((point, index) => {
                    // 添加標記
                    const marker = L.circleMarker([point.lat, point.lon], {
                        color: '#3388ff',
                        fillColor: index === historyPoints.length - 1 ? '#ff4444' : '#3388ff',
                        fillOpacity: 0.8,
                        radius: index === historyPoints.length - 1 ? 8 : 6
                    }).addTo(historyMarkerLayerGroup);

                    // 保存標記引用到 markerMap
                    markerMap.set(point.timestamp.toString(), {
                        marker: marker,
                        originalRadius: index === historyPoints.length - 1 ? 8 : 6
                    });
                    
                    // 添加序號和標題
                    marker.bindTooltip(`#${index + 1}: ${point.title}`, {
                        permanent: false,
                        direction: 'top'
                    });

                    // 如果不是最後一個點，畫一條線到下一個點
                    if (index < historyPoints.length - 1) {
                        const nextPoint = historyPoints[index + 1];
                        
                        // 計算箭頭的位置（在線段的70%處）
                        const startLatLng = L.latLng(point.lat, point.lon);
                        const endLatLng = L.latLng(nextPoint.lat, nextPoint.lon);
                        const arrowLatLng = interpolateLatLng(startLatLng, endLatLng, 0.7);

                        // 畫主線
                        L.polyline([[point.lat, point.lon], [nextPoint.lat, nextPoint.lon]], {
                            color: '#3388ff',
                            weight: 2,
                            opacity: 0.6,
                            dashArray: '5, 10'
                        }).addTo(historyMarkerLayerGroup);

                        // 在線段70%處添加箭頭
                        L.circleMarker(arrowLatLng, arrowHead).addTo(historyMarkerLayerGroup);
                    }

                    // 為對應的列表項添加滑鼠事件
                    if (point.listItem) {
                        const highlightMarker = () => {
                            const markerInfo = markerMap.get(point.timestamp.toString());
                            if (markerInfo) {
                                markerInfo.marker.setRadius(markerInfo.originalRadius * 1.5);
                                markerInfo.marker.setStyle({
                                    weight: 3,
                                    fillOpacity: 1
                                });
                            }
                            point.listItem.classList.add('active');
                        };

                        const resetMarker = () => {
                            const markerInfo = markerMap.get(point.timestamp.toString());
                            if (markerInfo) {
                                markerInfo.marker.setRadius(markerInfo.originalRadius);
                                markerInfo.marker.setStyle({
                                    weight: 2,
                                    fillOpacity: 0.8
                                });
                            }
                            point.listItem.classList.remove('active');
                        };

                        // 滑鼠事件
                        point.listItem.addEventListener('mouseenter', highlightMarker);
                        point.listItem.addEventListener('mouseleave', resetMarker);

                        // 觸控事件處理
                        let touchTimeout;
                        let touchStartY;
                        let isTouchMoved = false;

                        point.listItem.addEventListener('touchstart', (e) => {
                            // 記錄起始觸控位置
                            touchStartY = e.touches[0].clientY;
                            isTouchMoved = false;
                        }, { passive: true });

                        point.listItem.addEventListener('touchmove', (e) => {
                            if (!touchStartY) return;
                            
                            // 計算垂直移動距離
                            const touchDeltaY = Math.abs(e.touches[0].clientY - touchStartY);
                            
                            // 如果移動超過 10px，標記為滾動意圖
                            if (touchDeltaY > 10) {
                                isTouchMoved = true;
                                resetMarker();
                            }
                        }, { passive: true });

                        point.listItem.addEventListener('touchend', (e) => {
                            // 只有在沒有明顯滾動時才觸發高亮
                            if (!isTouchMoved) {
                                e.preventDefault();
                                
                                // 重置所有其他項目的狀態
                                historyPoints.forEach(p => {
                                    if (p.listItem && p !== point) {
                                        const otherMarkerInfo = markerMap.get(p.timestamp.toString());
                                        if (otherMarkerInfo) {
                                            otherMarkerInfo.marker.setRadius(otherMarkerInfo.originalRadius);
                                            otherMarkerInfo.marker.setStyle({
                                                weight: 2,
                                                fillOpacity: 0.8
                                            });
                                        }
                                        p.listItem.classList.remove('active');
                                    }
                                });

                                // 高亮當前項目
                                highlightMarker();

                                // 設置自動取消高亮的計時器
                                clearTimeout(touchTimeout);
                                touchTimeout = setTimeout(() => {
                                    resetMarker();
                                }, 3000);
                            }
                            
                            // 重置觸控狀態
                            touchStartY = null;
                            isTouchMoved = false;
                        });

                        // 確保在滾動時取消高亮
                        const scrollHandler = () => {
                            clearTimeout(touchTimeout);
                            resetMarker();
                        };

                        // 為容器添加滾動事件監聽
                        historyListUl.addEventListener('scroll', scrollHandler, { passive: true });
                        document.addEventListener('scroll', scrollHandler, { passive: true });
                    }
                });

                // 調整地圖視圖以顯示所有點
                const bounds = L.latLngBounds(historyPoints.map(p => [p.lat, p.lon]));
                historyLeafletMap.fitBounds(bounds, {
                    padding: [50, 50]
                });

                historyDebugInfoSmall.textContent = `已顯示 ${historyPoints.length} 個歷史位置點`;
            } else {
                historyMapContainerDiv.innerHTML = '<p>無有效的歷史位置記錄可顯示。</p>';
                historyDebugInfoSmall.textContent = "無有效座標點";
            }
        } catch (e) {
            console.error("讀取歷史記錄失敗:", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
            historyMapContainerDiv.innerHTML = '<p>讀取歷史記錄時發生錯誤。</p>';
            historyDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    // 輔助函數：在兩點之間進行插值
    function interpolateLatLng(start, end, fraction) {
        const lat = start.lat + (end.lat - start.lat) * fraction;
        const lng = start.lng + (end.lng - start.lng) * fraction;
        return L.latLng(lat, lng);
    }

    // **新增：顯示歷史日誌模態框的函數 (修正版)**
    function showHistoryLogModal(record) {
        const modal = document.getElementById('historyLogModal');
        const modalContent = document.getElementById('historyLogModalContent');
        if (!modal || !modalContent) {
            console.error("找不到模態框元素");
            return;
        }

        const cityDisplay = formatCityName(record);
        document.getElementById('modalTitle').textContent = `${cityDisplay || '未知地點'} - 甦醒日誌`;

        const recordDate = formatDate(record.recordedAt);
        modalContent.innerHTML = `
            <div id="logBasicInfo">
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
        setupModalClose(modal, modalContent);
    }

    function setupModalClose(modal, modalContent) {
        const closeFunction = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            modal.style.display = 'none';
            modalContent.innerHTML = '';
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
                    } else {
                        console.log("[loadGlobalTodayMap] 跳過無效座標的記錄:", record);
                    }
                });
            }

            console.log(`[loadGlobalTodayMap] 準備渲染 ${globalPoints.length} 個點位`);
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

                // 為有多人的標記添加點擊事件
                if (location.titles.length > 1) {
                    marker.on('click', function() {
                        this.openTooltip();
                    });
                }
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

            console.log(`[renderPointsOnMap] (${mapTitle}) 計算出的 BBOX:, ${west},${south},${east},${north}`);
            currentMapInstance.fitBounds([[south, west], [north, east]], {padding: [20,20]});
        } else if (currentMapInstance) {
            currentMapInstance.setView([20, 0], 2);
        }

        if(debugDivElement) debugDivElement.textContent = `${mapTitle} - 顯示 ${validPointsForBboxCount} 個有效位置。`;
    }

    window.openTab = function(evt, tabName, isInitialLoad = false) {
        console.log(`[openTab] 切換到分頁: ${tabName}, 事件觸發: ${!!evt}, 初始載入: ${isInitialLoad}`);
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
            if (user && currentDataIdentifier) {
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
        }
        .hoverable-history-item:hover,
        .hoverable-history-item.active {
            background-color: rgba(51, 136, 255, 0.1);
        }
        @media (hover: none) {
            .hoverable-history-item:hover {
                background-color: transparent;
            }
            .hoverable-history-item {
                margin: 2px 0;  /* 增加項目間距，便於觸控 */
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



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
      apiKey: "AIzaSyC5-AKkFhx9olWx57bdB985IwZA9DpH66o", // 請替換成您的 Firebase API Key
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
        return true;
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

                // **修改：顯示問候語和故事**
                const greetingText = lastRecord.greeting || ""; // 從記錄中獲取問候語
                const storyText = lastRecord.story || "上次甦醒時的特別記事未記錄。"; // 從記錄中獲取故事

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
        mapContainerDiv.classList.remove('universe-message');
        debugInfoSmall.innerHTML = "";
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

        const userLocalDate = new Date();
        const year = userLocalDate.getFullYear();
        const month = (userLocalDate.getMonth() + 1).toString().padStart(2, '0');
        const day = userLocalDate.getDate().toString().padStart(2, '0');
        const localDateStringForRecord = `${year}-${month}-${day}`;

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
        // const countryGreetingInfo = getGreetingForCountry("UNIVERSE_CODE"); // 不再需要前端生成問候語
        // const storyText = await fetchStoryFromAPI("未知星球", "宇宙", "UNIVERSE_CODE"); // 舊的單獨故事獲取

        // **新的調用方式**
        const apiResponse = await fetchStoryFromAPI("未知星球", "宇宙", "UNIVERSE_CODE");
        const greetingFromAPI = apiResponse.greeting;
        const storyFromAPI = apiResponse.story;

        resultTextDiv.innerHTML = `
            <p style="font-weight: bold; font-size: 1.1em;">${greetingFromAPI}</p>
            <p>今天的你，在當地 <strong>${userTimeFormatted}</strong> 開啟了這一天，<br>但是很抱歉，你已經脫離地球了，與非地球生物共同開啟了新的一天。</p>
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
            debugInfoSmall.innerHTML = `(嘗試尋找的目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)})`;

            const universeRecord = {
                dataIdentifier: currentDataIdentifier,
                userDisplayName: rawUserDisplayName,
                recordedAt: serverTimestamp(),
                localTime: userTimeFormatted,
                city: "Unknown Planet",
                country: "Universe",
                city_zh: "未知星球",
                country_zh: "宇宙",
                country_iso_code: "universe_code",
                latitude: null,
                longitude: null,
                targetUTCOffset: targetUTCOffsetHours,
                matchedCityUTCOffset: null,
                recordedDateString: localDateStringForRecord,
                greeting: greetingFromAPI, // **儲存從 API 獲取的問候語**
                story: storyFromAPI,       // **儲存從 API 獲取的故事/知識**
                timezone: "Cosmic/Unknown"
            };
            await saveHistoryRecord(universeRecord);
            await saveToGlobalDailyRecord(universeRecord);
            console.log("--- 尋找匹配城市結束 (宇宙情況) ---");
            findCityButton.disabled = false;
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

        // const countryGreetingInfo = getGreetingForCountry(bestMatchCity.country_iso_code); // 不再需要前端生成問候語
        // const storyText = await fetchStoryFromAPI(finalCityName, finalCountryName, bestMatchCity.country_iso_code); // 舊的單獨故事獲取

        // **新的調用方式**
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
                recordedDateString: localDateStringForRecord,
                greeting: greetingFromAPI, // **儲存從 API 獲取的問候語**
                story: storyFromAPI,       // **儲存從 API 獲取的故事/知識**
                timezone: bestMatchCity.timezone || "Unknown"
            };
            await saveHistoryRecord(recordData);
            await saveToGlobalDailyRecord(recordData);
            console.log("--- 尋找匹配城市結束 (找到城市) ---");
        }
        findCityButton.disabled = false; // 重新啟用按鈕
    }

    async function saveHistoryRecord(recordData) {
        if (!currentDataIdentifier) {
            console.warn("無法儲存歷史記錄：使用者名稱未設定。");
            return;
        }
        // 確保記錄數據包含 greeting 和 story，即使是空字符串
        recordData.greeting = recordData.greeting || "";
        recordData.story = recordData.story || "";

        if (recordData.city !== "Unknown Planet" && recordData.city_zh !== "未知星球" &&
            (typeof recordData.latitude !== 'number' || !isFinite(recordData.latitude) ||
             typeof recordData.longitude !== 'number' || !isFinite(recordData.longitude))) {
            console.error("無法儲存地球歷史記錄：經緯度無效。", recordData);
            return;
        }
        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        try {
            const docRef = await addDoc(historyCollectionRef, recordData);
            console.log("個人歷史記錄已儲存，文件 ID:", docRef.id, "包含問候與故事。");
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
            // 全域記錄通常不需要儲存個人化的問候或故事，但如果需要也可以加入
            // greeting: recordData.greeting,
            // story: recordData.story
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
                const docId = doc.id; // 獲取文件ID，以便將來可能使用
                const li = document.createElement('li');
                const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '日期未知';

                const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

                li.innerHTML = `<span class="date">${recordDate}</span> -  
                                甦醒於: <span class="location">${cityDisplay || '未知城市'}, ${countryDisplay || '未知國家'}</span>`;
                
                // **新增：查看日誌按鈕**
                const detailsButton = document.createElement('button');
                detailsButton.textContent = '查看日誌';
                detailsButton.className = 'history-log-button';
                detailsButton.onclick = () => showHistoryLogModal(record); // 傳遞整個 record 對象
                li.appendChild(detailsButton);

                historyListUl.appendChild(li);

                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    historyPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${recordDate} @ ${cityDisplay}, ${countryDisplay}`
                    });
                } else if (record.city !== "Unknown Planet" && record.city_zh !== "未知星球") {
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
    
    // **新增：顯示歷史日誌模態框的函數**
    function showHistoryLogModal(record) {
        const modal = document.getElementById('historyLogModal');
        const modalContent = document.getElementById('historyLogModalContent');
        const closeModalButton = document.getElementById('historyLogModalClose');

        if (!modal || !modalContent || !closeModalButton) {
            console.error("模態框 HTML 元素未找到！請檢查您的 HTML 結構。");
            // 提供一個簡單的 alert 作為後備
            const recordDateStr = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('zh-TW') : '日期未知';
            const cityDisplayStr = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
            const countryDisplayStr = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;
            alert(
`事件日誌詳情:
記錄時間: ${recordDateStr}
使用者當地時間: ${record.localTime || '未知'}
甦醒地點: ${cityDisplayStr}, ${countryDisplayStr}
開頭問候: ${record.greeting || '無記錄'}
城市小知識/事件:
${record.story || '無記錄'}`
            );
            return;
        }

        const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '日期未知';
        const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
        const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

        modalContent.innerHTML = `
            <h3>事件日誌詳情</h3>
            <p><strong>記錄時間:</strong> ${recordDate}</p>
            <p><strong>使用者當地時間:</strong> ${record.localTime || '未知'}</p>
            <p><strong>甦醒地點:</strong> ${cityDisplay}, ${countryDisplay}</p>
            <p><strong>當時的問候:</strong></p>
            <p style="font-weight: bold;"><em>${record.greeting || '無記錄'}</em></p>
            <p><strong>甦醒日誌:</strong></p>
            <p style="font-style: italic;">${record.story || '無記錄'}</p>
            <hr>
            <p><small>時區: ${record.timezone || '未知'}, 國家代碼: ${record.country_iso_code || 'N/A'}</small></p>
            <p><small>座標: Lat ${record.latitude !== null ? record.latitude.toFixed(4) : 'N/A'}, Lon ${record.longitude !== null ? record.longitude.toFixed(4) : 'N/A'}</small></p>
        `;
        modal.style.display = 'block';

        const generatePostcardButton = document.getElementById('generatePostcardButton');
       if (generatePostcardButton) {
           generatePostcardButton.onclick = () => generatePostcard(record);
       }
        
        closeModalButton.onclick = () => {
            modal.style.display = 'none';
        };

        // 點擊模態框外部區域關閉模態框
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        };
    }

async function generatePostcard(record) {
    const modalContent = document.getElementById('historyLogModalContent');
    if (!modalContent) return;

    modalContent.innerHTML += '<p>正在生成明信片，請稍候...</p>';

    const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleDateString('zh-TW') : '未知日期';
    const cityDisplay = record.city_zh && record.city_zh !== record.city ? `<span class="math-inline">\{record\.city\_zh\} \(</span>{record.city})` : record.city;
    const countryDisplay = record.country_zh && record.country_zh !== record.country ? `<span class="math-inline">\{record\.country\_zh\} \(</span>{record.country})` : record.country;
    const story = record.story || '無特別事件';

    // 創建一個更詳細的提示
    const prompt = `Generate a postcard-style image related to a moment in ${cityDisplay}, ${countryDisplay} on <span class="math-inline">\{recordDate\}\. The key event or detail to inspire the image is\: "</span>{story}". The image should evoke the feeling or theme of this event in the style of a vibrant travel postcard.`;

    try {
        const response = await fetch('/api/generateImage', { // 假設您創建了 /api/generateImage 這個後端路由
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "無法解析圖片生成 API 錯誤" }));
            console.error("圖片生成 API 錯誤:", response.status, errorData);
            modalContent.innerHTML += `<p style="color: red;">生成明信片失敗，請稍後再試。錯誤：${errorData.error || response.statusText}</p>`;
            return;
        }

        const data = await response.json();
        if (data && data.imageUrl) {
            const postcardHtml = `
                <div class="postcard-container">
                    <h3>您的明信片</h3>
                    <img src="<span class="math-inline">\{data\.imageUrl\}" alt\="Generated Postcard" style\="max\-width\: 100%; height\: auto; border\: 1px solid \#ccc;"\>
<p style\="margin\-top\: 10px; font\-size\: 0\.8em;"\></span>{cityDisplay}, ${countryDisplay} - <span class="math-inline">\{recordDate\}</p\>
<p style\="font\-size\: 0\.9em; font\-style\: italic;"\>"</span>{story.length > 50 ? story.substring(0, 50) + '...' : story}"</p>
                    <button onclick="window.open('${data.imageUrl}', '_blank')">在新視窗中查看/下載</button>
                </div>
            `;
            modalContent.innerHTML = postcardHtml;
        } else {
            console.warn("圖片生成 API 回應格式不正確:", data);
            modalContent.innerHTML += '<p style="color: orange;">無法顯示明信片，後端回應格式有誤。</p>';
        }

    } catch (error) {
        console.error("前端呼叫圖片生成 API 失敗:", error);
        modalContent.innerHTML += '<p style="color: red;">前端請求圖片生成時發生錯誤，請檢查網路。</p>';
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
            if (currentMapInstance.getContainer().innerHTML.includes("<p>")) {
                 mapDivElement.innerHTML = '';
                 mapDivElement.appendChild(currentMapInstance.getContainer());
            }
            currentMapInstance.invalidateSize();
        }

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

        points.forEach(point => {
            if (typeof point.lat === 'number' && isFinite(point.lat) && typeof point.lon === 'number' && isFinite(point.lon)) {
                const marker = L.circleMarker([point.lat, point.lon], {
                    color: 'red', fillColor: '#f03', fillOpacity: 0.7, radius: 6 // Changed color for distinction
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

            console.log(`[renderPointsOnMap] (${mapTitle}) 計算出的 BBOX:, ${west},${south},${east},${north}`);
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

        setTimeout(() => {
            if (tabName === 'HistoryTab') {
                if (historyLeafletMap && historyMapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] HistoryTab is visible, invalidating map size.");
                    historyLeafletMap.invalidateSize();
                }
                if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) {
                    console.log("[openTab] 呼叫 loadHistory for HistoryTab.");
                    loadHistory();
                }
            } else if (tabName === 'GlobalTodayMapTab') {
                if (globalLeafletMap && globalTodayMapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] GlobalTodayMapTab is visible, invalidating map size.");
                    globalLeafletMap.invalidateSize();
                }
                if (auth.currentUser && !triggeredBySetName) {
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
                // 如果是由設定名稱觸發的，displayLastRecordForCurrentUser 已經在 setOrLoadUserName 中呼叫
                // 如果是手動切換到 ClockTab 且已有用戶，也應該確保顯示最後記錄
                if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) {
                    console.log("[openTab] 手動切換到 ClockTab，準備顯示最後記錄。");
                    displayLastRecordForCurrentUser();
                }
            }
        }, 0);
    }

    // 初始載入時，嘗試設定一個預設的使用者名稱 (如果 localStorage 中有)
    // 或者，直接觸發 ClockTab 的顯示 (如果已經有用戶名)
    const initialUserName = localStorage.getItem('worldClockUserName');
    if (initialUserName) {
        userNameInput.value = initialUserName;
        // 等待 Firebase auth 狀態確認後再執行 setOrLoadUserName
        // onAuthStateChanged 將處理這個邏輯
    } else {
        // 如果沒有預存的用戶名，並且不是在設定用戶名時，預設打開時鐘分頁
        // 並且確保 displayLastRecordForCurrentUser 在 auth 就緒後被調用
         openTab(null, 'ClockTab');
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

});

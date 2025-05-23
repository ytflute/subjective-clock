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
                if (document.getElementById('HistoryTab').classList.contains('active')) {
                     loadHistory();
                }
            }
            if (document.getElementById('GlobalTodayMapTab') && document.getElementById('GlobalTodayMapTab').classList.contains('active')) {
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

        if (citiesData.length > 0 && auth.currentUser) { 
            findCityButton.disabled = false;
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
                
                if (lastRecord.country === "宇宙Universe" && lastRecord.city === "未知星球Unknown Planet") {
                     resultTextDiv.innerHTML = `這是 ${rawUserDisplayName} 於 <strong>${userTimeFormatted}</strong> 的最後一筆記錄，<br>當時你已脫離地球，與<strong>${finalCityName} (${finalCountryName})</strong>的非地球生物共同開啟了新的一天！`;
                } else {
                     resultTextDiv.innerHTML = `這是 ${rawUserDisplayName} 於 <strong>${userTimeFormatted}</strong> 的最後一筆記錄，<br>當時與 <strong>${finalCityName} (${finalCountryName})</strong> 的人 (當地約 <strong>8:00 AM</strong>) 同步，<br>一起開啟了新的一天！`;
                }

                if (lastRecord.country_iso_code && lastRecord.country_iso_code !== 'universe_code') { 
                    countryFlagImg.src = `https://flagcdn.com/w40/${lastRecord.country_iso_code.toLowerCase()}.png`;
                    countryFlagImg.alt = `${finalCountryName} 國旗`;
                    countryFlagImg.style.display = 'inline-block';
                } else {
                    countryFlagImg.style.display = 'none';
                }

                if (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude) && 
                    typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) {
                    const lat = lastRecord.latitude;
                    const lon = lastRecord.longitude;
                    mapContainerDiv.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-1},${lat-1},${lon+1},${lat+1}&amp;layer=mapnik&amp;marker=${lat},${lon}" style="border: 1px solid black"></iframe><br/><small><a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=7/${lat}/${lon}" target="_blank">查看較大地圖</a></small>`;
                } else if (lastRecord.city === "未知星球Unknown Planet") {
                     mapContainerDiv.innerHTML = "<p>浩瀚宇宙，無從定位...</p>";
                }
                else {
                     mapContainerDiv.innerHTML = "<p>無法顯示地圖，此記錄座標資訊不完整或無效。</p>";
                }
                
                const recordedAtDate = lastRecord.recordedAt && lastRecord.recordedAt.toDate ? lastRecord.recordedAt.toDate().toLocaleString('zh-TW') : '未知記錄時間';
                const targetUTCOffsetStr = (typeof lastRecord.targetUTCOffset === 'number' && isFinite(lastRecord.targetUTCOffset)) ? lastRecord.targetUTCOffset.toFixed(2) : 'N/A';
                const latitudeStr = (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude)) ? lastRecord.latitude.toFixed(2) : 'N/A';
                const longitudeStr = (typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) ? lastRecord.longitude.toFixed(2) : 'N/A';

                debugInfoSmall.innerHTML = `(記錄於: ${recordedAtDate})<br>(目標城市緯度: ${latitudeStr}°, 經度: ${longitudeStr}°)<br>(目標 UTC 偏移: ${targetUTCOffsetStr}, 城市實際 UTC 偏移: ${cityActualUTCOffset !== null ? cityActualUTCOffset.toFixed(2) : 'N/A'}, 時區: ${lastRecord.timezone || '未知'})`;
            } else {
                resultTextDiv.innerHTML = `<p>歡迎，${rawUserDisplayName}！此名稱尚無歷史記錄。</p>`;
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
        mapContainerDiv.innerHTML = "";
        debugInfoSmall.innerHTML = "";
    }

    async function findMatchingCity() { 
        clearPreviousResults();
        console.log("--- 開始尋找匹配城市 ---");

        if (!currentDataIdentifier) { 
            alert("請先設定你的顯示名稱。");
            return;
        }
        if (!auth.currentUser) { 
            alert("Firebase 會話未就緒，請稍候或刷新頁面。");
            return;
        }
        if (citiesData.length === 0) {
            resultTextDiv.innerHTML = "錯誤：城市數據未載入或為空。";
            return;
        }

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

            if (typeof bestMatchCity.latitude === 'number' && isFinite(bestMatchCity.latitude) && 
                typeof bestMatchCity.longitude === 'number' && isFinite(bestMatchCity.longitude)) { 
                const lat = bestMatchCity.latitude;
                const lon = bestMatchCity.longitude;
                mapContainerDiv.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-1},${lat-1},${lon+1},${lat+1}&amp;layer=mapnik&amp;marker=${lat},${lon}" style="border: 1px solid black"></iframe><br/><small><a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=7/${lat}/${lon}" target="_blank">查看較大地圖</a></small>`;
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
            historyMapContainerDiv.innerHTML = '<p>地圖軌跡功能已移除。</p>'; 
            return;
        }
        historyListUl.innerHTML = '<li>載入歷史記錄中...</li>';
        historyMapContainerDiv.innerHTML = '<p>地圖軌跡功能已移除。</p>'; 
        historyDebugInfoSmall.textContent = "";

        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        const q = query(historyCollectionRef, orderBy("recordedAt", "desc")); 

        try {
            const querySnapshot = await getDocs(q);
            historyListUl.innerHTML = ''; 
            if (querySnapshot.empty) {
                historyListUl.innerHTML = '<li>尚無歷史記錄。</li>';
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
            });

        } catch (e) {
            console.error("讀取歷史記錄失敗:", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
            historyMapContainerDiv.innerHTML = '<p>讀取歷史記錄時發生錯誤。</p>'; 
            historyDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    async function loadGlobalTodayMap() {
        if (!auth.currentUser) { 
            globalTodayMapContainerDiv.innerHTML = '<p>Firebase 認證中，請稍候...</p>';
            return;
        }
        
        const selectedDateValue = globalDateInput.value; 
        if (!selectedDateValue) {
            globalTodayMapContainerDiv.innerHTML = '<p>請先選擇一個日期。</p>';
            return;
        }
        
        globalTodayMapContainerDiv.innerHTML = '<p>載入今日眾人地圖中...</p>';
        globalTodayDebugInfoSmall.textContent = `查詢日期: ${selectedDateValue}`;
        console.log(`[loadGlobalTodayMap] 查詢日期: ${selectedDateValue}`);

        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        const q = query(globalCollectionRef, where("recordedDateString", "==", selectedDateValue));

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[loadGlobalTodayMap] Firestore 查詢完成。找到 ${querySnapshot.size} 筆記錄。`);
            if (querySnapshot.empty) {
                globalTodayMapContainerDiv.innerHTML = `<p>日期 ${selectedDateValue} 尚無眾人甦醒記錄。</p>`;
                return;
            }

            const globalPoints = [];
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

            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, `日期 ${selectedDateValue} 的眾人甦醒地圖`);

        } catch (e) {
            console.error("讀取全域每日記錄失敗:", e);
            globalTodayMapContainerDiv.innerHTML = '<p>讀取全域地圖資料失敗。</p>';
            globalTodayDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    function renderPointsOnMap(points, mapDiv, debugDiv, mapTitle = "地圖") {
        console.log(`[renderPointsOnMap] 準備渲染地圖: "${mapTitle}", 點數量: ${points ? points.length : 0}`);
        if (!points || points.length === 0) { 
            mapDiv.innerHTML = `<p>${mapTitle}：尚無有效座標點可顯示。</p>`;
            if(debugDiv) debugDiv.textContent = "";
            console.log("[renderPointsOnMap] 沒有點可以渲染。");
            return;
        }

        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        let validPointsForBboxCount = 0;
        
        points.forEach((point) => { 
            // 再次確認點的有效性
            if (typeof point.lat === 'number' && isFinite(point.lat) && typeof point.lon === 'number' && isFinite(point.lon)) {
                minLat = Math.min(minLat, point.lat);
                maxLat = Math.max(maxLat, point.lat);
                minLon = Math.min(minLon, point.lon);
                maxLon = Math.max(maxLon, point.lon);
                validPointsForBboxCount++;
            } else {
                console.warn("[renderPointsOnMap] 發現無效的點用於計算 bbox:", point);
            }
        });

        if (validPointsForBboxCount === 0) {
            mapDiv.innerHTML = `<p>${mapTitle}：所有提供的點座標均無效。</p>`;
            if(debugDiv) debugDiv.textContent = "所有點座標無效";
            console.log("[renderPointsOnMap] 所有點座標均無效。");
            return;
        }
        
        const latDiff = maxLat - minLat;
        const lonDiff = maxLon - minLon;
        const defaultMargin = 0.5; // 稍微減小預設邊距，如果只有一個點，讓它更居中
        const latMargin = latDiff < 0.01 ? defaultMargin : latDiff * 0.2 + 0.1; // 調整邊距計算
        const lonMargin = lonDiff < 0.01 ? defaultMargin : lonDiff * 0.2 + 0.1; 

        let south = Math.max(-85, minLat - latMargin); // OpenStreetMap 緯度通常在 +/- 85 內較好顯示
        let west = Math.max(-180, minLon - lonMargin);
        let north = Math.min(85, maxLat + latMargin);
        let east = Math.min(180, maxLon + lonMargin);
        
        // 確保 west < east 和 south < north
        if (west >= east) { 
            const centerLon = (minLon + maxLon) / 2; 
            west = centerLon - (defaultMargin / 2); 
            east = centerLon + (defaultMargin / 2);
        }
        if (south >= north) { 
            const centerLat = (minLat + maxLat) / 2; 
            south = centerLat - (defaultMargin / 2);
            north = centerLat + (defaultMargin / 2);
        }
        // 再次夾緊以確保在有效範圍內
        west = Math.max(-180, Math.min(west, 179.9999)); 
        east = Math.min(180, Math.max(east, west + 0.0001)); // 確保 east > west
        south = Math.max(-85, Math.min(south, 84.9999));   // OpenStreetMap 緯度限制
        north = Math.min(85, Math.max(north, south + 0.0001));  // OpenStreetMap 緯度限制

        const bbox = `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`;
        
        const maxMarkersToShow = 50; 
        let displayMarkersStringArray = [];
        
        points.slice(0, maxMarkersToShow).forEach((point, index) => {
            // *** 修改點：在這裡加入日誌，檢查每個 point ***
            console.log(`[renderPointsOnMap] 準備標記 ${index}: lat=${point.lat}, lon=${point.lon}, title=${point.title}`);
            if (typeof point.lat === 'number' && isFinite(point.lat) &&
                typeof point.lon === 'number' && isFinite(point.lon)) {
                displayMarkersStringArray.push(`${point.lat.toFixed(5)},${point.lon.toFixed(5)}`); 
            } else {
                console.warn(`[renderPointsOnMap] 跳過無效標記點:`, point);
            }
        });
        const displayMarkersString = displayMarkersStringArray.join('|');

        console.log(`[renderPointsOnMap] 渲染多點地圖 (${mapTitle}): BBOX=`, bbox, "Markers=", displayMarkersString);
        // 如果 displayMarkersString 為空（所有點都無效），則不添加 marker 參數
        const markerParam = displayMarkersString ? `&marker=${displayMarkersString}` : "";
        const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${markerParam}`;
        
        mapDiv.innerHTML = `<iframe src="${mapUrl}" style="border: 1px solid black"></iframe><br/><small>${mapTitle} (顯示最多 ${Math.min(points.length, maxMarkersToShow)} 個有效位置)</small>`;
        if(debugDiv) debugDiv.textContent = `地圖邊界框 (W,S,E,N): ${bbox}`;
    }

    function renderHistoryMap(points) { 
        console.log("renderHistoryMap 被呼叫，但地圖功能已移除。Points:", points);
        historyMapContainerDiv.innerHTML = "<p>地圖軌跡顯示功能已暫時移除。</p>"; 
        return; 
    }

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

        if (tabName === 'HistoryTab' && currentDataIdentifier && auth.currentUser && !triggeredBySetName) { 
            loadHistory();
        } else if (tabName === 'GlobalTodayMapTab' && auth.currentUser && !triggeredBySetName) {
            if (globalDateInput && !globalDateInput.value) { 
                globalDateInput.valueAsDate = new Date();
            }
            loadGlobalTodayMap();
        }
    }
});

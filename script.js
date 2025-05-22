document.addEventListener('DOMContentLoaded', async () => {
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, setDoc, getDoc,
        setLogLevel
    } = window.firebaseSDK;

    // DOM 元素
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

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Firebase 會話已認證 (UID):", user.uid);
            if (currentDataIdentifier && citiesData.length > 0) {
                findCityButton.disabled = false;
            }
            if (currentDataIdentifier && document.getElementById('HistoryTab').classList.contains('active')) {
                loadHistory();
            }
        } else {
            console.log("Firebase 會話未認證，嘗試登入...");
            if (initialAuthToken) {
                signInWithCustomToken(auth, initialAuthToken)
                    .catch((error) => {
                        console.error("使用 initialAuthToken 登入失敗, 嘗試匿名登入:", error.code, error.message);
                        signInAnonymously(auth).catch(anonError => console.error("匿名登入失敗:", anonError));
                    });
            } else {
                 signInAnonymously(auth).catch(error => console.error("匿名登入失敗:", error));
            }
        }
    });
    
    function sanitizeNameToFirestoreId(name) {
        if (!name) return null;
        let sanitized = name.toLowerCase().trim();
        sanitized = sanitized.replace(/\s+/g, '_'); 
        sanitized = sanitized.replace(/[^a-z0-9_.-]/g, ''); 
        if (sanitized === "." || sanitized === "..") {
            sanitized = `name_${sanitized.replace(/\./g, '')}`; 
        }
        if (sanitized.startsWith("__") && sanitized.endsWith("__")) {
             sanitized = `name${sanitized}`;
        }
        return sanitized.substring(0, 100) || null; 
    }

    setUserNameButton.addEventListener('click', async () => {
        const newDisplayNameRaw = userNameInput.value.trim();
        if (!newDisplayNameRaw) {
            alert("顯示名稱不能為空。");
            return;
        }
        const sanitizedName = sanitizeNameToFirestoreId(newDisplayNameRaw);
        if (!sanitizedName) {
            alert("處理後的名稱無效，請嘗試其他名稱。");
            return;
        }
        currentDataIdentifier = sanitizedName;
        rawUserDisplayName = newDisplayNameRaw;
        currentUserIdSpan.textContent = currentDataIdentifier; 
        currentUserDisplayNameSpan.textContent = rawUserDisplayName; 
        console.log("使用者資料識別碼已設定為:", currentDataIdentifier);
        alert(`名稱已設定為 "${rawUserDisplayName}"。你的歷史記錄將以此名稱關聯。`);
        if (citiesData.length > 0 && auth.currentUser) { 
            findCityButton.disabled = false;
        }
        if (document.getElementById('HistoryTab').classList.contains('active')) {
            loadHistory(); 
        }
    });

    fetch('cities_data.json')
        .then(response => response.json())
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

        console.log(`用戶實際時間: ${userLocalHours}:${userLocalMinutes < 10 ? '0' : ''}${userLocalMinutes} (UTC${userUTCOffsetHours >= 0 ? '+' : ''}${userUTCOffsetHours.toFixed(2)})`);
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
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            resultTextDiv.innerHTML = `雖然你在當地 <strong>${userTimeFormatted}</strong> 起床，<br>但抱歉，目前找不到世界上當地時間約為 <strong>8:00 AM</strong> (與計算目標時區相差30分鐘內) 且符合時區條件的地区。`;
            debugInfoSmall.innerHTML = `(嘗試尋找的目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)})`;
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
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone);

            const finalCityName = bestMatchCity.city_zh && bestMatchCity.city_zh !== bestMatchCity.city ? `${bestMatchCity.city_zh} (${bestMatchCity.city})` : bestMatchCity.city;
            const finalCountryName = bestMatchCity.country_zh && bestMatchCity.country_zh !== bestMatchCity.country ? `${bestMatchCity.country_zh} (${bestMatchCity.country})` : bestMatchCity.country;

            const bestCityCurrentUTCHours = userLocalHours + userLocalMinutes/60 - userUTCOffsetHours;
            let bestCityApproxLocalHour = bestCityCurrentUTCHours + (isFinite(cityActualUTCOffset) ? cityActualUTCOffset : 0) ; 
            let bestCityApproxLocalMinute = (bestCityApproxLocalHour - Math.floor(bestCityApproxLocalHour)) * 60;
            bestCityApproxLocalHour = Math.floor(bestCityApproxLocalHour);
            if (bestCityApproxLocalHour < 0) bestCityApproxLocalHour += 24;
            if (bestCityApproxLocalHour >= 24) bestCityApproxLocalHour -= 24;
            
            resultTextDiv.innerHTML = `你雖然在當地起床時間是 <strong>${userTimeFormatted}</strong>，<br>但是你的作息正好跟 <strong>${finalCityName} (${finalCountryName})</strong> 的人 (當地約 <strong>${String(bestCityApproxLocalHour).padStart(2, '0')}:${String(Math.round(bestCityApproxLocalMinute)).padStart(2, '0')}</strong>) 接近 <strong>8:00 AM</strong> 一樣，<br>一起開啟了新的一天！`;

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
            
            debugInfoSmall.innerHTML = `(目標城市緯度: ${bestMatchCity.latitude.toFixed(2)}°, 計算目標緯度: ${targetLatitude.toFixed(2)}°, 緯度差: ${minLatDiff.toFixed(2)}°)<br>(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 城市實際 UTC 偏移: ${!isFinite(cityActualUTCOffset) ? 'N/A' : cityActualUTCOffset.toFixed(2)}, 時區: ${bestMatchCity.timezone})`;

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
                matchedCityUTCOffset: !isFinite(cityActualUTCOffset) ? null : cityActualUTCOffset
            };
            await saveHistoryRecord(recordData);

        } else {
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            resultTextDiv.innerHTML = `雖然你在當地 <strong>${userTimeFormatted}</strong> 起床，<br>在符合時區的城市中，似乎找不到緯度匹配的城市。`;
            debugInfoSmall.innerHTML = `(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 目標緯度: ${targetLatitude.toFixed(2)})`;
        }
        console.log("--- 尋找匹配城市結束 ---");
    }

    async function saveHistoryRecord(recordData) {
        if (!currentDataIdentifier) { 
            console.warn("無法儲存歷史記錄：使用者名稱未設定。");
            return;
        }
        if (typeof recordData.latitude !== 'number' || !isFinite(recordData.latitude) || 
            typeof recordData.longitude !== 'number' || !isFinite(recordData.longitude)) {
            console.error("無法儲存歷史記錄：經緯度無效。", recordData);
            return;
        }
        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        try {
            const docRef = await addDoc(historyCollectionRef, recordData);
            console.log("歷史記錄已儲存，文件 ID:", docRef.id);
        } catch (e) {
            console.error("儲存歷史記錄到 Firestore 失敗:", e);
        }
    }

    async function loadHistory() {
        if (!currentDataIdentifier) { 
            historyListUl.innerHTML = '<li>請先設定你的顯示名稱以查看歷史記錄。</li>';
            historyMapContainerDiv.innerHTML = '<p>設定名稱後才能查看歷史地圖軌跡。</p>';
            return;
        }
        historyListUl.innerHTML = '<li>載入歷史記錄中...</li>';
        historyMapContainerDiv.innerHTML = '<p>載入地圖軌跡中...</p>';
        historyDebugInfoSmall.textContent = "";

        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        const q = query(historyCollectionRef, orderBy("recordedAt", "desc")); 

        try {
            const querySnapshot = await getDocs(q);
            historyListUl.innerHTML = ''; 
            if (querySnapshot.empty) {
                historyListUl.innerHTML = '<li>尚無歷史記錄。</li>';
                historyMapContainerDiv.innerHTML = '<p>尚無歷史記錄可顯示於地圖。</p>';
                return;
            }

            const historyPoints = [];
            let firstRecord = true; // isMostRecent 標記似乎未使用，可以考慮移除

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
                        city: cityDisplay, // 用於潛在的標記標題
                        date: recordDate
                        // isMostRecent: firstRecord // 此標記目前未使用
                    });
                    // firstRecord = false; // 如果需要，則保留
                } else {
                    console.warn("跳過經緯度無效的歷史記錄:", record);
                }
            });

            renderHistoryMap(historyPoints);

        } catch (e) {
            console.error("讀取歷史記錄失敗:", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
            historyMapContainerDiv.innerHTML = '<p>讀取地圖軌跡失敗。</p>';
            historyDebugInfoSmall.textContent = `錯誤: ${e.message}`;
        }
    }

    function renderHistoryMap(points) { 
        if (!points || points.length === 0) {
            historyMapContainerDiv.innerHTML = "<p>尚無歷史記錄可顯示於地圖 (或所有記錄座標無效)。</p>";
            return;
        }

        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        
        points.forEach((point) => { 
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        });
        
        const latDiff = maxLat - minLat;
        const lonDiff = maxLon - minLon;

        const defaultMargin = 1.0; // 預設邊距，例如1度
        const latMargin = latDiff < 0.1 ? defaultMargin : latDiff * 0.2 + 0.2; 
        const lonMargin = lonDiff < 0.1 ? defaultMargin : lonDiff * 0.2 + 0.2; 

        let south = Math.max(-90, minLat - latMargin);
        let west = Math.max(-180, minLon - lonMargin);
        let north = Math.min(90, maxLat + latMargin);
        let east = Math.min(180, maxLon + lonMargin);
        
        if (west >= east) { 
            const centerLon = (minLon + maxLon) / 2; // 或取第一個點的經度
            west = centerLon - defaultMargin / 2; 
            east = centerLon + defaultMargin / 2;
        }
        if (south >= north) { 
            const centerLat = (minLat + maxLat) / 2; // 或取第一個點的緯度
            south = centerLat - defaultMargin / 2;
            north = centerLat + defaultMargin / 2;
        }
        // 再次夾緊以確保在有效範圍內
        west = Math.max(-180, Math.min(west, 179.9999)); 
        east = Math.min(180, Math.max(east, -179.9999)); 
        south = Math.max(-90, Math.min(south, 89.9999));   
        north = Math.min(90, Math.max(north, -89.9999));  

        // 最後再確認 west < east, south < north
        if (west >= east) east = west + 0.0001;
        if (south >= north) north = south + 0.0001;


        const bbox = `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`;
        
        const maxMarkersToShow = 20; 
        let displayMarkersString = "";
        
        points.slice(0, maxMarkersToShow).forEach((point, index) => {
            displayMarkersString += `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`; // 使用固定小數位數
            if (index < Math.min(points.length, maxMarkersToShow) - 1) {
                displayMarkersString += '|';
            }
        });

        console.log("渲染歷史地圖: BBOX=", bbox, "Markers=", displayMarkersString);
        const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${displayMarkersString ? '&marker=' + displayMarkersString : ''}`;
        
        historyMapContainerDiv.innerHTML = `<iframe src="${mapUrl}" style="border: 1px solid black"></iframe><br/><small>地圖顯示最近 ${Math.min(points.length, maxMarkersToShow)} 筆記錄位置。</small>`;
        historyDebugInfoSmall.textContent = `地圖邊界框 (W,S,E,N): ${bbox}`;
    }

    window.openTab = function(evt, tabName) {
        let i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tab-button");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";

        if (tabName === 'HistoryTab' && currentDataIdentifier && auth.currentUser) { 
            loadHistory();
        }
    }
});

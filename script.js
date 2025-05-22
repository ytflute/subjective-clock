document.addEventListener('DOMContentLoaded', async () => {
    // 從 window 中獲取 Firebase SDK 函數
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, setDoc, getDoc,
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

    // 全域變數
    let citiesData = [];
    let db, auth;
    let currentUserId = null;
    let userDisplayName = ""; 

    // Firebase 設定
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id-worldclock-history'; 
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    const firebaseConfig = {
      apiKey: "AIzaSyC5-AKkFhx9olWx57bdB985IwZA9DpH66o", // 使用者提供的金鑰
      authDomain: "subjective-clock.firebaseapp.com",
      projectId: "subjective-clock",
      storageBucket: "subjective-clock.appspot.com", // 通常是 .appspot.com
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

    // 初始化 Firebase
    try {
        setLogLevel('debug'); 
        const app = initializeApp(firebaseConfig); 
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase 初始化成功。App ID (用於路徑):", appId, "Project ID (來自設定):", firebaseConfig.projectId);
    } catch (e) {
        console.error("Firebase 初始化失敗:", e);
        currentUserIdSpan.textContent = "Firebase 初始化失敗";
        alert("Firebase 初始化失敗，部分功能可能無法使用。");
        return;
    }

    // Firebase 認證狀態監聽
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            currentUserIdSpan.textContent = currentUserId;
            console.log("使用者已認證:", currentUserId);
            await loadUserDisplayName(); 
            
            if (citiesData.length > 0) {
                findCityButton.disabled = false;
            }
            if (document.getElementById('HistoryTab').classList.contains('active')) {
                loadHistory();
            }
        } else {
            console.log("使用者未認證，嘗試登入...");
            currentUserIdSpan.textContent = "認證中...";
            if (initialAuthToken) {
                console.log("嘗試使用 initialAuthToken 登入...");
                signInWithCustomToken(auth, initialAuthToken)
                    .then((userCredential) => {
                        console.log("使用 initialAuthToken 登入成功:", userCredential.user.uid);
                    })
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
    
    async function loadUserDisplayName() {
        if (!currentUserId) return;
        const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profiles/userData`);
        try {
            const docSnap = await getDoc(userProfileRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                userDisplayName = data.displayName || "";
                userNameInput.value = userDisplayName;
                currentUserDisplayNameSpan.textContent = userDisplayName || "未設定";
                console.log("已載入使用者顯示名稱:", userDisplayName);
            } else {
                console.log("使用者設定檔不存在。");
                currentUserDisplayNameSpan.textContent = "未設定";
            }
        } catch (e) {
            console.error("讀取使用者名稱失敗:", e);
            currentUserDisplayNameSpan.textContent = "讀取名稱失敗";
        }
    }

    setUserNameButton.addEventListener('click', async () => {
        if (!currentUserId) {
            alert("請先等待認證完成。");
            return;
        }
        const newDisplayName = userNameInput.value.trim();
        if (!newDisplayName) {
            alert("名稱不能為空。");
            return;
        }
        const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profiles/userData`);
        try {
            await setDoc(userProfileRef, {
                displayName: newDisplayName,
                updatedAt: serverTimestamp() 
            }, { merge: true }); 
            
            userDisplayName = newDisplayName; 
            currentUserDisplayNameSpan.textContent = userDisplayName;
            alert("名稱已更新！");
            console.log("使用者顯示名稱已儲存:", newDisplayName);
        } catch (e) {
            console.error("儲存使用者名稱失敗:", e);
            alert("儲存名稱失敗，請檢查控制台錯誤。");
        }
    });

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
                resultTextDiv.innerHTML = "提示：載入的城市數據為空。請檢查 cities_data.json 檔案是否包含有效的城市資料。";
                findCityButton.disabled = true;
            } else if (currentUserId) { 
                findCityButton.disabled = false;
            }
        })
        .catch(e => {
            console.error("無法載入城市數據:", e);
            resultTextDiv.innerHTML = "錯誤：無法載入城市數據。請檢查 cities_data.json 檔案是否存在、格式正確且內容不為空。";
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

        if (!currentUserId) {
            alert("使用者未認證，無法記錄歷史。請刷新頁面或檢查網路連線。");
            return;
        }
        if (citiesData.length === 0) {
            resultTextDiv.innerHTML = "錯誤：城市數據未載入或為空，無法尋找城市。";
            console.log("錯誤：城市數據未載入或為空。");
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
            // *** 修改點：增加 isNaN 檢查 ***
            if (!city || !city.timezone || 
                typeof city.latitude !== 'number' || isNaN(city.latitude) || 
                typeof city.longitude !== 'number' || isNaN(city.longitude) || 
                !city.country_iso_code) {
                // console.warn("跳過格式不正確或缺少必要資訊的城市數據:", city);
                continue;
            }
            // ***************************

            let cityUTCOffset;
            if (timezoneOffsetCache.has(city.timezone)) {
                cityUTCOffset = timezoneOffsetCache.get(city.timezone);
            } else {
                cityUTCOffset = getCityUTCOffsetHours(city.timezone);
                if (!isNaN(cityUTCOffset)) {
                    timezoneOffsetCache.set(city.timezone, cityUTCOffset);
                }
            }
            if (isNaN(cityUTCOffset)) continue;

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
            let bestCityApproxLocalHour = bestCityCurrentUTCHours + cityActualUTCOffset;
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

            // *** 修改點：增加 isNaN 檢查 ***
            if (typeof bestMatchCity.latitude === 'number' && !isNaN(bestMatchCity.latitude) && 
                typeof bestMatchCity.longitude === 'number' && !isNaN(bestMatchCity.longitude)) {
                const lat = bestMatchCity.latitude;
                const lon = bestMatchCity.longitude;
                mapContainerDiv.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-1},${lat-1},${lon+1},${lat+1}&amp;layer=mapnik&amp;marker=${lat},${lon}" style="border: 1px solid black"></iframe><br/><small><a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=7/${lat}/${lon}" target="_blank">查看較大地圖</a></small>`;
            } else {
                 mapContainerDiv.innerHTML = "<p>無法顯示地圖，城市座標資訊不完整或無效。</p>";
            }
            // ***************************
            
            debugInfoSmall.innerHTML = `(目標城市緯度: ${bestMatchCity.latitude.toFixed(2)}°, 計算目標緯度: ${targetLatitude.toFixed(2)}°, 緯度差: ${minLatDiff.toFixed(2)}°)<br>(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 城市實際 UTC 偏移: ${isNaN(cityActualUTCOffset) ? 'N/A' : cityActualUTCOffset.toFixed(2)}, 時區: ${bestMatchCity.timezone})`;

            const recordData = {
                userId: currentUserId,
                userDisplayName: userDisplayName || "匿名使用者", 
                recordedAt: serverTimestamp(),
                localTime: userTimeFormatted,
                city: bestMatchCity.city,
                country: bestMatchCity.country,
                city_zh: bestMatchCity.city_zh || "",
                country_zh: bestMatchCity.country_zh || "",
                country_iso_code: bestMatchCity.country_iso_code.toLowerCase(),
                latitude: bestMatchCity.latitude, // 確保這裡儲存的是有效數字
                longitude: bestMatchCity.longitude, // 確保這裡儲存的是有效數字
                targetUTCOffset: targetUTCOffsetHours,
                matchedCityUTCOffset: isNaN(cityActualUTCOffset) ? null : cityActualUTCOffset
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
        if (!currentUserId) {
            console.warn("無法儲存歷史記錄：使用者未登入。");
            return;
        }
        // *** 修改點：增加 isNaN 檢查 ***
        if (isNaN(recordData.latitude) || isNaN(recordData.longitude)) {
            console.error("無法儲存歷史記錄：經緯度無效。", recordData);
            return;
        }
        // ***************************
        const historyCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/clockHistory`);
        try {
            const docRef = await addDoc(historyCollectionRef, recordData);
            console.log("歷史記錄已儲存，文件 ID:", docRef.id);
        } catch (e) {
            console.error("儲存歷史記錄到 Firestore 失敗:", e);
        }
    }

    async function loadHistory() {
        if (!currentUserId) {
            historyListUl.innerHTML = '<li>請先設定使用者名稱或等待認證完成。</li>';
            historyMapContainerDiv.innerHTML = '<p>登入後才能查看歷史地圖軌跡。</p>';
            return;
        }
        historyListUl.innerHTML = '<li>載入歷史記錄中...</li>';
        historyMapContainerDiv.innerHTML = '<p>載入地圖軌跡中...</p>';
        historyDebugInfoSmall.textContent = "";

        const historyCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/clockHistory`);
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
            let firstRecord = true;

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

                // *** 修改點：增加 isNaN 檢查 ***
                if (typeof record.latitude === 'number' && !isNaN(record.latitude) &&
                    typeof record.longitude === 'number' && !isNaN(record.longitude)) {
                    historyPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        city: cityDisplay,
                        date: recordDate,
                        isMostRecent: firstRecord 
                    });
                    firstRecord = false;
                } else {
                    console.warn("跳過經緯度無效的歷史記錄:", record);
                }
                // ***************************
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
        let validPointsExist = false;
        
        points.forEach((point) => { 
            // 再次確認，雖然在 loadHistory 中已檢查
            if (typeof point.lat === 'number' && !isNaN(point.lat) && typeof point.lon === 'number' && !isNaN(point.lon)) {
                minLat = Math.min(minLat, point.lat);
                maxLat = Math.max(maxLat, point.lat);
                minLon = Math.min(minLon, point.lon);
                maxLon = Math.max(maxLon, point.lon);
                validPointsExist = true;
            }
        });

        if (!validPointsExist) {
             historyMapContainerDiv.innerHTML = "<p>所有歷史記錄的座標均無效，無法顯示地圖。</p>";
            return;
        }
        
        const latMargin = (maxLat === minLat) ? 1.0 : (maxLat - minLat) * 0.2 + 0.5; // 確保有最小邊距
        const lonMargin = (maxLon === minLon) ? 1.0 : (maxLon - minLon) * 0.2 + 0.5; // 確保有最小邊距

        const south = Math.max(-90, minLat - latMargin);
        const west = Math.max(-180, minLon - lonMargin);
        const north = Math.min(90, maxLat + latMargin);
        const east = Math.min(180, maxLon + lonMargin);
        
        // 確保 west < east 和 south < north，對於單點情況特別處理
        let finalWest = west;
        let finalSouth = south;
        let finalEast = east;
        let finalNorth = north;

        if (finalWest >= finalEast) { // 如果經度範圍無效 (例如單點或所有點在同一經度)
            finalWest = finalWest - 0.5; // 擴展一點
            finalEast = finalEast + 0.5;
        }
        if (finalSouth >= finalNorth) { // 如果緯度範圍無效
            finalSouth = finalSouth - 0.5;
            finalNorth = finalNorth + 0.5;
        }
        // 再次確保不超出邊界
        finalWest = Math.max(-180, finalWest);
        finalSouth = Math.max(-90, finalSouth);
        finalEast = Math.min(180, finalEast);
        finalNorth = Math.min(90, finalNorth);


        const bbox = `${finalWest},${finalSouth},${finalEast},${finalNorth}`;
        
        const maxMarkersToShow = 20; 
        let displayMarkersString = "";
        points.slice(0, maxMarkersToShow).forEach((point, index) => {
             if (typeof point.lat === 'number' && !isNaN(point.lat) && typeof point.lon === 'number' && !isNaN(point.lon)) {
                displayMarkersString += `${point.lat},${point.lon}${index < Math.min(points.length, maxMarkersToShow) - 1 && index < points.slice(0, maxMarkersToShow).length -1 ? '|' : ''}`;
             }
        });
        // 移除可能因最後一個有效點後無有效點而產生的末尾 '|'
        if (displayMarkersString.endsWith('|')) {
            displayMarkersString = displayMarkersString.slice(0, -1);
        }


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

        if (tabName === 'HistoryTab' && currentUserId) {
            loadHistory();
        }
    }
});

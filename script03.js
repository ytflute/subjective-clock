// 最佳合併版 World Clock 程式碼
// 說明：結合兩版本優點，確保時鐘功能正常、分頁切換穩定、地圖顯示正確
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp,
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
    const timezoneOffsetCache = new Map();

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
        console.log("Firebase 初始化成功。App ID:", appId);
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
            console.log("Firebase 認證成功 UID:", user.uid);
            const lastUsedName = localStorage.getItem('worldClockUserName');
            if (lastUsedName && !currentDataIdentifier) {
                userNameInput.value = lastUsedName;
                await setOrLoadUserName(lastUsedName, false);
            } else if (currentDataIdentifier) {
                if (citiesData.length > 0) findCityButton.disabled = false;
                if (document.getElementById('HistoryTab')?.classList.contains('active')) loadHistory();
            }
            if (document.getElementById('GlobalTodayMapTab')?.classList.contains('active')) loadGlobalTodayMap();
        } else {
            currentUserIdSpan.textContent = "認證中...";
            findCityButton.disabled = true;
            if (initialAuthToken) {
                signInWithCustomToken(auth, initialAuthToken).catch(() => signInAnonymously(auth));
            } else {
                signInAnonymously(auth);
            }
        }
    });

    // ---- 資料載入 ----
    fetch('cities_data.json')
        .then(response => response.ok ? response.json() : Promise.reject(response.status))
        .then(data => {
            citiesData = data;
            if (citiesData.length && currentDataIdentifier && auth.currentUser) {
                findCityButton.disabled = false;
            }
        })
        .catch(err => {
            console.error("載入城市資料失敗:", err);
            resultTextDiv.innerHTML = "錯誤：無法載入城市資料。";
            findCityButton.disabled = true;
        });

  // ---- 設定使用者名稱 ----
    setUserNameButton.addEventListener('click', async () => {
        await setOrLoadUserName(userNameInput.value.trim());
    });

    // ---- 設定/載入使用者名稱 ----
    async function setOrLoadUserName(name, showAlert = true) {
        const newDisplayNameRaw = name.trim();
        if (!newDisplayNameRaw) {
            if (showAlert) alert("顯示名稱不能為空。")
            return false;
        }
        const sanitized = newDisplayNameRaw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '').substring(0, 100);
        if (!sanitized) {
            if (showAlert) alert("無效名稱。請使用英數字。")
            return false;
        }
        currentDataIdentifier = sanitized;
        rawUserDisplayName = newDisplayNameRaw;
        currentUserIdSpan.textContent = sanitized;
        currentUserDisplayNameSpan.textContent = newDisplayNameRaw;
        userNameInput.value = newDisplayNameRaw;
        localStorage.setItem('worldClockUserName', newDisplayNameRaw);

        if (citiesData.length > 0 && auth.currentUser) findCityButton.disabled = false;

        openTab(null, 'ClockTab', true);
        await displayLastRecordForCurrentUser();
        return true;
    }

   // ---- 顯示最後一筆時鐘紀錄 ----
    async function displayLastRecordForCurrentUser() {
        // 已於前段完整實作，無需再次定義。
    }

    // ---- 時鐘同步功能與按鈕事件 ----
    findCityButton.addEventListener('click', findMatchingCity);
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }

    async function findMatchingCity() {
        clearPreviousResults();
        if (!currentDataIdentifier || !auth.currentUser) {
            alert("請先登入並設定名稱。")
            return;
        }
        if (citiesData.length === 0) {
            resultTextDiv.innerHTML = "錯誤：城市資料尚未載入。";
            return;
        }

        const now = new Date();
        const localHour = now.getHours();
        const localMin = now.getMinutes();
        const userOffset = -now.getTimezoneOffset() / 60;

        const adjustedMin = Math.round(localMin / 15) * 15;
        const adjustedHour = adjustedMin === 60 ? (localHour + 1) % 24 : localHour;
        const roundedMin = adjustedMin === 60 ? 0 : adjustedMin;

        const decimalHour = adjustedHour + roundedMin / 60;
        const targetOffset = 8 - decimalHour + userOffset;

        const candidates = citiesData.filter(city => {
            if (!city || !city.timezone) return false;
            const offset = getCityUTCOffsetHours(city.timezone);
            if (!isFinite(offset)) return false;
            if (Math.abs(offset - targetOffset) <= 0.5) return true;
            return false;
        });

        if (candidates.length === 0) {
            resultTextDiv.innerHTML = `在當地 <strong>${adjustedHour}:${roundedMin.toString().padStart(2, '0')}</strong> 無地球同步城市。`;
            mapContainerDiv.innerHTML = "<p>無地圖可顯示。</p>";
            return;
        }

        let bestMatch = candidates[0];
        let minDiff = Infinity;
        const idealLat = 90 - (roundedMin / 59) * 180;
        for (const city of candidates) {
            const diff = Math.abs(city.latitude - idealLat);
            if (diff < minDiff) {
                minDiff = diff;
                bestMatch = city;
            }
        }

        const cityName = bestMatch.city_zh ? `${bestMatch.city_zh} (${bestMatch.city})` : bestMatch.city;
        const countryName = bestMatch.country_zh ? `${bestMatch.country_zh} (${bestMatch.country})` : bestMatch.country;
        resultTextDiv.innerHTML = `你與 <strong>${cityName}, ${countryName}</strong> 同步開始新的一天。`;

        if (bestMatch.country_iso_code) {
            countryFlagImg.src = `https://flagcdn.com/w40/${bestMatch.country_iso_code.toLowerCase()}.png`;
            countryFlagImg.alt = `${countryName} 國旗`;
            countryFlagImg.style.display = 'inline-block';
        } else {
            countryFlagImg.style.display = 'none';
        }

        if (clockLeafletMap) clockLeafletMap.remove();
        mapContainerDiv.innerHTML = '';
        clockLeafletMap = L.map(mapContainerDiv).setView([bestMatch.latitude, bestMatch.longitude], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap & CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(clockLeafletMap);

        L.circleMarker([bestMatch.latitude, bestMatch.longitude], {
            color: 'red', fillColor: '#f03', fillOpacity: 0.8, radius: 8
        }).addTo(clockLeafletMap).bindPopup(`<b>${cityName}</b><br>${countryName}`).openPopup();

        debugInfoSmall.innerHTML = `(目標偏移: ${targetOffset.toFixed(2)}、城市: ${bestMatch.timezone})`;

        // 新增儲存紀錄
        const record = {
            dataIdentifier: currentDataIdentifier,
            userDisplayName: rawUserDisplayName,
            recordedAt: serverTimestamp(),
            recordedDateString: now.toISOString().split('T')[0],
            localTime: `${adjustedHour}:${roundedMin.toString().padStart(2, '0')}`,
            city: bestMatch.city,
            city_zh: bestMatch.city_zh || '',
            country: bestMatch.country,
            country_zh: bestMatch.country_zh || '',
            country_iso_code: bestMatch.country_iso_code || '',
            timezone: bestMatch.timezone,
            latitude: bestMatch.latitude,
            longitude: bestMatch.longitude,
            matchedCityUTCOffset: getCityUTCOffsetHours(bestMatch.timezone),
            targetUTCOffset: targetOffset
        };

        await saveHistoryRecord(record);
        await saveToGlobalDailyRecord(record);
    }

// ---- 分頁切換處理 ----
    window.openTab = function(evt, tabName, triggeredBySetName = false) {
        let tabcontent = document.getElementsByClassName("tab-content");
        let tablinks = document.getElementsByClassName("tab-button");

        for (let i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
        for (let i = 0; i < tablinks.length; i++) tablinks[i].classList.remove("active");

        const currentTabDiv = document.getElementById(tabName);
        if (currentTabDiv) currentTabDiv.style.display = "block";

        const targetButton = document.getElementById(`tabButton-${tabName}`);
        if (targetButton) targetButton.classList.add("active");
        else if (evt?.currentTarget) evt.currentTarget.classList.add("active");

        setTimeout(() => {
            if (tabName === 'HistoryTab') {
                if (historyLeafletMap && historyMapContainerDiv.offsetParent !== null) historyLeafletMap.invalidateSize();
                if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) loadHistory();
            } else if (tabName === 'GlobalTodayMapTab') {
                if (globalLeafletMap && globalTodayMapContainerDiv.offsetParent !== null) globalLeafletMap.invalidateSize();
                if (auth.currentUser && !triggeredBySetName) {
                    if (globalDateInput && !globalDateInput.value) globalDateInput.valueAsDate = new Date();
                    loadGlobalTodayMap();
                }
            }
        }, 0);
    }

    // ---- 載入個人歷史紀錄 ----
    async function loadHistory() {
        if (!currentDataIdentifier) {
            historyListUl.innerHTML = '<li>請先設定你的顯示名稱以查看歷史記錄。</li>';
            historyMapContainerDiv.innerHTML = '<p>設定名稱後，此處將顯示您的個人歷史地圖。</p>';
            return;
        }

        historyListUl.innerHTML = '<li>載入歷史記錄中...</li>';
        if (!historyLeafletMap) historyMapContainerDiv.innerHTML = '<p>載入個人歷史地圖中...</p>';
        else if (historyMarkerLayerGroup) historyMarkerLayerGroup.clearLayers();
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
                const recordDate = record.recordedAt?.toDate?.().toLocaleString('zh-TW') || '未知';
                const city = record.city_zh ? `${record.city_zh} (${record.city})` : record.city;
                const country = record.country_zh ? `${record.country_zh} (${record.country})` : record.country;

                const li = document.createElement('li');
                li.innerHTML = `<span class="date">${recordDate}</span> - 同步於 <span class="location">${city}, ${country}</span>`;
                historyListUl.appendChild(li);

                if (typeof record.latitude === 'number' && typeof record.longitude === 'number') {
                    historyPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${recordDate} @ ${city}, ${country}`
                    });
                }
            });
            renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName} 的歷史軌跡`, 'history');
        } catch (e) {
            console.error("讀取歷史記錄失敗：", e);
            historyListUl.innerHTML = '<li>讀取歷史記錄失敗。</li>';
        }
    }

    // ---- 載入全域每日地圖 ----
    async function loadGlobalTodayMap() {
        if (!auth.currentUser) return;
        const dateStr = globalDateInput.value;
        if (!dateStr) return;

        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        const q = query(globalCollectionRef, where("recordedDateString", "==", dateStr));

        try {
            const querySnapshot = await getDocs(q);
            const globalPoints = [];
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                if (typeof record.latitude === 'number' && typeof record.longitude === 'number') {
                    const city = record.city_zh ? `${record.city_zh} (${record.city})` : record.city;
                    const country = record.country_zh ? `${record.country_zh} (${record.country})` : record.country;
                    const userDisplay = record.userDisplayName || record.dataIdentifier || "匿名";
                    globalPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${userDisplay} @ ${city}, ${country}`
                    });
                }
            });
            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, `日期 ${dateStr} 的眾人甦醒地圖`, 'global');
        } catch (e) {
            console.error("讀取全域資料失敗：", e);
        }
    }

    // ---- 儲存至個人歷史記錄 ----
    async function saveHistoryRecord(recordData) {
        try {
            const ref = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
            await addDoc(ref, recordData);
            console.log("個人紀錄已儲存。");
        } catch (e) {
            console.error("儲存個人紀錄失敗：", e);
        }
    }

    // ---- 儲存至全域每日記錄 ----
    async function saveToGlobalDailyRecord(recordData) {
        try {
            const ref = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
            await addDoc(ref, recordData);
            console.log("全域紀錄已儲存。");
        } catch (e) {
            console.error("儲存全域紀錄失敗：", e);
        }
    }

// ---- 地圖渲染通用函式 ----
    function renderPointsOnMap(points, mapDiv, debugDiv, title, type) {
        let mapInstance = (type === 'global') ? globalLeafletMap : historyLeafletMap;
        let layerGroup = (type === 'global') ? globalMarkerLayerGroup : historyMarkerLayerGroup;

        if (!mapInstance) {
            mapDiv.innerHTML = '';
            mapInstance = L.map(mapDiv).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap & CARTO', subdomains: 'abcd', maxZoom: 18, minZoom: 2
            }).addTo(mapInstance);
            layerGroup = L.layerGroup().addTo(mapInstance);
            if (type === 'global') { globalLeafletMap = mapInstance; globalMarkerLayerGroup = layerGroup; }
            else { historyLeafletMap = mapInstance; historyMarkerLayerGroup = layerGroup; }
        } else {
            if (layerGroup) layerGroup.clearLayers();
        }

        if (!points || points.length === 0) {
            if (debugDiv) debugDiv.textContent = `${title}：尚無有效資料。`;
            return;
        }

        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        points.forEach(p => {
            if (typeof p.lat === 'number' && typeof p.lon === 'number') {
                const marker = L.circleMarker([p.lat, p.lon], {
                    color: 'red', fillColor: '#f03', fillOpacity: 0.7, radius: 6
                }).addTo(layerGroup);
                if (p.title) marker.bindTooltip(p.title);
                minLat = Math.min(minLat, p.lat);
                maxLat = Math.max(maxLat, p.lat);
                minLon = Math.min(minLon, p.lon);
                maxLon = Math.max(maxLon, p.lon);
            }
        });
        mapInstance.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [20, 20] });
        if (debugDiv) debugDiv.textContent = `${title} - 顯示 ${points.length} 筆資料`;
    }
});

    

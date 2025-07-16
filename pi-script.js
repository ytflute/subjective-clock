// Raspberry Pi 專用甦醒地圖腳本
// 簡化版本，專為 800x480 螢幕和固定使用者 "future" 設計

// 全域變數
let db, auth;
let currentDataIdentifier = null;
let rawUserDisplayName = "future";
let clockLeafletMap = null;
let globalLeafletMap = null;
let globalMarkerLayerGroup = null;
let historyLeafletMap = null;
let historyMarkerLayerGroup = null;
let currentGroupName = "";
let initialLoadHandled = false;

// 當 Firebase 準備就緒時執行
window.addEventListener('firebaseReady', async (event) => {
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, 
        serverTimestamp, doc, setDoc, getDoc, limit, updateDoc, setLogLevel
    } = window.firebaseSDK;

    // 取得 DOM 元素
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
    const groupFilterSelect = document.getElementById('groupFilter');
    const connectionStatus = document.getElementById('connectionStatus');

    // 設定 Firebase
    try {
        db = getFirestore();
        auth = getAuth();
        
        // 更新連線狀態
        updateConnectionStatus(true);
        console.log('Firebase 初始化成功');
    } catch (error) {
        console.error('Firebase 初始化失敗:', error);
        updateConnectionStatus(false);
    }

    // 基於時間分鐘數計算目標緯度
    function calculateTargetLatitudeFromTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // 特例時間段檢查 (7:50-8:10)
        if ((hours === 7 && minutes >= 50) || (hours === 8 && minutes <= 10)) {
            console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 特例時間段，使用當地位置`);
            return 'local';
        }
        
        // 線性映射：0分=北緯70度，30分≈赤道0度，59分=南緯70度
        const targetLatitude = 70 - (minutes * 140 / 59);
        console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 目標緯度: ${targetLatitude.toFixed(2)}度`);
        
        return targetLatitude;
    }

    // 更新連線狀態
    function updateConnectionStatus(connected) {
        if (connectionStatus) {
            connectionStatus.className = connected ? 'status-dot' : 'status-dot offline';
        }
    }

    // 分頁切換功能
    function initializeTabButtons() {
        const tabButtons = document.getElementsByClassName('tab-button');
        
        Array.from(tabButtons).forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                showTab(targetTab);
            });
        });
    }

    function showTab(tabName) {
        // 隱藏所有分頁內容
        const tabContents = document.getElementsByClassName("tab-content");
        for (let i = 0; i < tabContents.length; i++) {
            tabContents[i].classList.remove("active");
        }

        // 移除所有按鈕的活動狀態
        const tabButtons = document.getElementsByClassName("tab-button");
        for (let i = 0; i < tabButtons.length; i++) {
            tabButtons[i].classList.remove("active");
        }

        // 顯示選中的分頁
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add("active");
        }

        // 啟動對應的按鈕
        const targetButton = document.getElementById(`tabButton-${tabName}`);
        if (targetButton) {
            targetButton.classList.add("active");
        }

        // 根據分頁載入對應內容
        switch(tabName) {
            case 'HistoryTab':
                if (!historyLeafletMap) {
                    initHistoryMap();
                }
                break;
            case 'GlobalTodayMapTab':
                if (!globalLeafletMap) {
                    initGlobalMap();
                }
                break;
        }
    }

    // 初始化今日甦醒地圖
    function initClockMap(latitude, longitude, cityName, countryName) {
        try {
            // 清理現有地圖
            if (clockLeafletMap) {
                clockLeafletMap.remove();
                clockLeafletMap = null;
            }

            // 創建新地圖
            clockLeafletMap = L.map('mapContainer', {
                zoomControl: true,
                scrollWheelZoom: false
            }).setView([latitude, longitude], 6);

            // 添加地圖圖層
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(clockLeafletMap);

            // 添加標記
            const marker = L.marker([latitude, longitude]).addTo(clockLeafletMap);
            marker.bindPopup(`<b>${cityName}</b><br/>${countryName}`).openPopup();

            // 調整地圖大小
            setTimeout(() => {
                clockLeafletMap.invalidateSize();
            }, 100);

            console.log('今日甦醒地圖初始化完成');
        } catch (error) {
            console.error('地圖初始化失敗:', error);
        }
    }

    // 初始化歷史地圖
    function initHistoryMap() {
        try {
            if (historyLeafletMap) {
                historyLeafletMap.remove();
            }

            historyLeafletMap = L.map('historyMapContainer', {
                zoomControl: true,
                scrollWheelZoom: false
            }).setView([25, 121], 2);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(historyLeafletMap);

            historyMarkerLayerGroup = L.layerGroup().addTo(historyLeafletMap);

            setTimeout(() => {
                historyLeafletMap.invalidateSize();
            }, 100);

            console.log('歷史地圖初始化完成');
        } catch (error) {
            console.error('歷史地圖初始化失敗:', error);
        }
    }

    // 初始化全球地圖
    function initGlobalMap() {
        try {
            if (globalLeafletMap) {
                globalLeafletMap.remove();
            }

            globalLeafletMap = L.map('globalTodayMapContainer', {
                zoomControl: true,
                scrollWheelZoom: false
            }).setView([25, 121], 2);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(globalLeafletMap);

            globalMarkerLayerGroup = L.layerGroup().addTo(globalLeafletMap);

            setTimeout(() => {
                globalLeafletMap.invalidateSize();
            }, 100);

            console.log('全球地圖初始化完成');
        } catch (error) {
            console.error('全球地圖初始化失敗:', error);
        }
    }

    // 載入使用者資料
    async function loadUserData() {
        try {
            setUserNameButton.disabled = true;
            setUserNameButton.textContent = '載入中...';

            // 固定使用者名稱為 "future"
            rawUserDisplayName = "future";
            userNameInput.value = rawUserDisplayName;

            // 更新顯示
            if (currentUserIdSpan) currentUserIdSpan.textContent = rawUserDisplayName;
            if (currentUserDisplayNameSpan) currentUserDisplayNameSpan.textContent = rawUserDisplayName;

            // 啟用開始按鈕
            findCityButton.disabled = false;
            setUserNameButton.textContent = '載入完成';
            
            console.log('使用者資料載入完成:', rawUserDisplayName);
            
            setTimeout(() => {
                setUserNameButton.textContent = '載入資料';
                setUserNameButton.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('載入使用者資料失敗:', error);
            setUserNameButton.textContent = '載入失敗';
            setUserNameButton.disabled = false;
        }
    }

    // 開始這一天
    async function startTheDay() {
        try {
            findCityButton.disabled = true;
            findCityButton.textContent = '尋找中...';
            resultTextDiv.textContent = '正在尋找你的甦醒城市...';

            // 計算目標緯度
            const targetLatitude = calculateTargetLatitudeFromTime();
            
            // 呼叫 API 尋找城市
            let response;
            if (targetLatitude === 'local') {
                // 使用當地位置
                response = await fetch('/api/find-city-geonames', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ useCurrentLocation: true })
                });
            } else {
                // 使用計算的緯度
                response = await fetch('/api/find-city-geonames', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetLatitude })
                });
            }

            const data = await response.json();

            if (data.success && data.city) {
                // 顯示結果
                const resultText = `今天你在 ${data.city.name}, ${data.city.country} 甦醒！`;
                resultTextDiv.textContent = resultText;

                // 顯示國旗
                if (data.city.country_iso_code) {
                    const flagUrl = `https://flagcdn.com/96x72/${data.city.country_iso_code.toLowerCase()}.png`;
                    countryFlagImg.src = flagUrl;
                    countryFlagImg.style.display = 'block';
                }

                // 初始化地圖
                initClockMap(
                    data.city.latitude,
                    data.city.longitude,
                    data.city.name,
                    data.city.country
                );

                // 儲存到 Firebase
                await saveToFirebase(data.city);

                // 更新除錯資訊
                debugInfoSmall.textContent = `緯度: ${data.city.latitude.toFixed(4)}, 經度: ${data.city.longitude.toFixed(4)}`;

                console.log('甦醒城市尋找成功:', data.city);

            } else {
                throw new Error(data.error || '尋找城市失敗');
            }

        } catch (error) {
            console.error('開始這一天失敗:', error);
            resultTextDiv.textContent = '發生錯誤，請重試';
            updateConnectionStatus(false);
        } finally {
            findCityButton.disabled = false;
            findCityButton.textContent = '開始這一天';
        }
    }

    // 儲存到 Firebase
    async function saveToFirebase(cityData) {
        try {
            if (!db || !auth.currentUser) {
                console.log('Firebase 未就緒，跳過儲存');
                return;
            }

            const recordData = {
                userId: rawUserDisplayName,
                displayName: rawUserDisplayName,
                groupName: currentGroupName,
                city: cityData.name,
                country: cityData.country,
                countryIsoCode: cityData.country_iso_code,
                latitude: cityData.latitude,
                longitude: cityData.longitude,
                timezone: cityData.timezone || '',
                localTime: cityData.local_time || '',
                timestamp: serverTimestamp(),
                date: new Date().toISOString().split('T')[0]
            };

            await addDoc(collection(db, 'wakeup_records'), recordData);
            console.log('記錄已儲存至 Firebase');

        } catch (error) {
            console.error('儲存至 Firebase 失敗:', error);
        }
    }

    // 載入歷史記錄
    async function loadHistory() {
        try {
            if (!db) return;

            refreshHistoryButton.disabled = true;
            refreshHistoryButton.textContent = '載入中...';

            const q = query(
                collection(db, 'wakeup_records'),
                where('userId', '==', rawUserDisplayName),
                orderBy('timestamp', 'desc'),
                limit(10)
            );

            const querySnapshot = await getDocs(q);
            
            // 清空列表
            historyListUl.innerHTML = '';

            // 清空地圖標記
            if (historyMarkerLayerGroup) {
                historyMarkerLayerGroup.clearLayers();
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                // 添加到列表
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${data.city}, ${data.country}</strong><br>
                    <small>${data.date} | ${data.localTime || '時間未知'}</small>
                `;
                historyListUl.appendChild(li);

                // 添加到地圖
                if (historyMarkerLayerGroup && data.latitude && data.longitude) {
                    const marker = L.marker([data.latitude, data.longitude])
                        .bindPopup(`${data.city}, ${data.country}<br>${data.date}`)
                        .addTo(historyMarkerLayerGroup);
                }
            });

            historyDebugInfoSmall.textContent = `載入了 ${querySnapshot.size} 筆記錄`;

        } catch (error) {
            console.error('載入歷史記錄失敗:', error);
            historyDebugInfoSmall.textContent = '載入失敗';
        } finally {
            refreshHistoryButton.disabled = false;
            refreshHistoryButton.textContent = '刷新記錄';
        }
    }

    // 載入全球地圖
    async function loadGlobalMap() {
        try {
            if (!db) return;

            refreshGlobalMapButton.disabled = true;
            refreshGlobalMapButton.textContent = '載入中...';

            const selectedDate = globalDateInput.value || new Date().toISOString().split('T')[0];
            
            let q = query(
                collection(db, 'wakeup_records'),
                where('date', '==', selectedDate),
                orderBy('timestamp', 'desc'),
                limit(100)
            );

            const querySnapshot = await getDocs(q);
            
            // 清空地圖標記
            if (globalMarkerLayerGroup) {
                globalMarkerLayerGroup.clearLayers();
            }

            let recordCount = 0;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                if (data.latitude && data.longitude) {
                    const marker = L.marker([data.latitude, data.longitude])
                        .bindPopup(`
                            <strong>${data.displayName || data.userId}</strong><br>
                            ${data.city}, ${data.country}<br>
                            ${data.localTime || '時間未知'}
                        `)
                        .addTo(globalMarkerLayerGroup);
                    recordCount++;
                }
            });

            globalTodayDebugInfoSmall.textContent = `${selectedDate} 共 ${recordCount} 個甦醒點`;

        } catch (error) {
            console.error('載入全球地圖失敗:', error);
            globalTodayDebugInfoSmall.textContent = '載入失敗';
        } finally {
            refreshGlobalMapButton.disabled = false;
            refreshGlobalMapButton.textContent = '查詢';
        }
    }

    // 事件監聽器
    setUserNameButton.addEventListener('click', loadUserData);
    findCityButton.addEventListener('click', startTheDay);
    refreshHistoryButton.addEventListener('click', loadHistory);
    refreshGlobalMapButton.addEventListener('click', loadGlobalMap);

    // 初始化
    initializeTabButtons();
    
    // 設定今天的日期
    globalDateInput.value = new Date().toISOString().split('T')[0];

    // Firebase 認證
    try {
        await signInAnonymously(auth);
        console.log('Firebase 匿名登入成功');
        updateConnectionStatus(true);
        
        // 自動載入使用者資料
        await loadUserData();
        
    } catch (error) {
        console.error('Firebase 認證失敗:', error);
        updateConnectionStatus(false);
    }

    console.log('Raspberry Pi 甦醒地圖初始化完成');
});

// 錯誤處理
window.addEventListener('error', (event) => {
    console.error('全域錯誤:', event.error);
});

// 載入狀態指示
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 載入完成，等待 Firebase...');
}); 
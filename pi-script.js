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

// 主要互動地圖 (唯一地圖實例)
let mainInteractiveMap = null;
let dayCounter = 1; // Day 計數器

// 軌跡線相關
let trajectoryLayer = null; // 軌跡線圖層
let trajectoryData = []; // 軌跡點數據

// 新增：狀態管理
let currentState = 'waiting'; // waiting, loading, result, error
window.currentState = currentState;

// 設定基本的全域函數（確保始終可用）
window.startTheDay = function() {
    console.log('⚠️ 使用基本版本的 startTheDay 函數');
    console.log('🔍 檢查初始化狀態:', {
        firebaseSDK: !!window.firebaseSDK,
        firebaseConfig: !!window.firebaseConfig,
        currentState: window.currentState || 'unknown'
    });
    
    // 如果 Firebase 還沒準備好，嘗試等待和重試
    if (!window.firebaseSDK || !window.firebaseConfig) {
        console.log('🔄 Firebase 未就緒，嘗試等待...');
        
        // 顯示載入狀態
        try {
            const waitingStateEl = document.getElementById('waitingState');
            const loadingStateEl = document.getElementById('loadingState');
            const errorStateEl = document.getElementById('errorState');
            
            // 隱藏其他狀態
            [waitingStateEl, loadingStateEl, errorStateEl].forEach(el => {
                if (el) el.classList.remove('active');
            });
            
            // 顯示載入狀態
            if (loadingStateEl) {
                loadingStateEl.classList.add('active');
                const loadingText = loadingStateEl.querySelector('.loading-text');
                if (loadingText) {
                    loadingText.textContent = '正在初始化系統...';
                }
            }
        } catch (e) {
            console.error('❌ 狀態切換失敗:', e);
        }
        
        // 設置重試機制
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 1000; // 1秒
        
        const retryTimer = setInterval(() => {
            retryCount++;
            console.log(`🔄 重試 ${retryCount}/${maxRetries} - 檢查 Firebase 狀態`);
            
            if (window.firebaseSDK && window.firebaseConfig) {
                console.log('✅ Firebase 已就緒，重新觸發甦醒流程');
                clearInterval(retryTimer);
                
                // 檢查是否有完整版本的 startTheDay 函數
                if (typeof window.startTheDay === 'function' && window.startTheDay.isFullVersion) {
                    window.startTheDay();
                } else {
                    // 手動觸發 firebaseReady 事件
                    window.dispatchEvent(new CustomEvent('firebaseReady'));
                    setTimeout(() => {
                        if (typeof window.startTheDay === 'function') {
                            window.startTheDay();
                        }
                    }, 1000);
                }
            } else if (retryCount >= maxRetries) {
                console.error('❌ Firebase 初始化失敗，已達最大重試次數');
                clearInterval(retryTimer);
                
                // 顯示錯誤狀態
                try {
                    const errorStateEl = document.getElementById('errorState');
                    const errorMessageEl = document.getElementById('errorMessage');
                    const loadingStateEl = document.getElementById('loadingState');
                    
                    if (loadingStateEl) loadingStateEl.classList.remove('active');
                    if (errorStateEl) errorStateEl.classList.add('active');
                    if (errorMessageEl) {
                        errorMessageEl.textContent = 'Firebase 初始化失敗，請重新載入頁面';
                    }
                } catch (e) {
                    console.error('❌ 顯示錯誤狀態失敗:', e);
                }
            }
        }, retryInterval);
        
        return false;
    }
    
    // 如果 Firebase 已就緒但沒有完整版本的函數，顯示錯誤
    try {
        const errorStateEl = document.getElementById('errorState');
        const errorMessageEl = document.getElementById('errorMessage');
        if (errorStateEl && errorMessageEl) {
            // 隱藏其他狀態
            ['waitingState', 'loadingState', 'resultState'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('active');
            });
            // 顯示錯誤狀態
            errorStateEl.classList.add('active');
            errorMessageEl.textContent = 'JavaScript 初始化未完成，請稍候';
            console.log('✅ 顯示錯誤狀態');
        }
    } catch (e) {
        console.error('❌ 顯示錯誤狀態失敗:', e);
    }
    
    return false;
};

// DOM 元素（全域聲明，確保可訪問）
let findCityButton, resultTextDiv, countryFlagImg, mapContainerDiv, debugInfoSmall;
let userNameInput, setUserNameButton, currentUserIdSpan, currentUserDisplayNameSpan;
let historyListUl, historyMapContainerDiv, historyDebugInfoSmall, refreshHistoryButton;
let globalDateInput, refreshGlobalMapButton, globalTodayMapContainerDiv, globalTodayDebugInfoSmall;
let groupNameInput, groupFilterSelect, connectionStatus;

// 新增：顯示狀態元素
let waitingStateEl, resultStateEl, loadingStateEl, errorStateEl;
    let cityNameEl, countryNameEl, greetingTextEl, coordinatesEl, errorMessageEl;

// 當 Firebase 準備就緒時執行
window.addEventListener('firebaseReady', async (event) => {
    console.log('🔥 Firebase Ready 事件觸發');
    console.log('🔍 Firebase 狀態檢查:', {
        firebaseSDK: !!window.firebaseSDK,
        firebaseConfig: !!window.firebaseConfig,
        currentTime: new Date().toISOString()
    });
    
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, 
        serverTimestamp, doc, setDoc, getDoc, limit, updateDoc, setLogLevel
    } = window.firebaseSDK;

    // 取得 DOM 元素
    console.log('🔍 正在取得 DOM 元素...');
    try {
        findCityButton = document.getElementById('findCityButton');
        resultTextDiv = document.getElementById('resultText');
        countryFlagImg = document.getElementById('countryFlag');
        mapContainerDiv = document.getElementById('mapContainer');
        debugInfoSmall = document.getElementById('debugInfo');
        userNameInput = document.getElementById('userName');
        setUserNameButton = document.getElementById('setUserNameButton');
        currentUserIdSpan = document.getElementById('currentUserId');
        currentUserDisplayNameSpan = document.getElementById('currentUserDisplayName');
        historyListUl = document.getElementById('historyList');
        historyMapContainerDiv = document.getElementById('historyMapContainer');
        historyDebugInfoSmall = document.getElementById('historyDebugInfo');
        refreshHistoryButton = document.getElementById('refreshHistoryButton');
        globalDateInput = document.getElementById('globalDate');
        refreshGlobalMapButton = document.getElementById('refreshGlobalMapButton');
        globalTodayMapContainerDiv = document.getElementById('globalTodayMapContainer');
        globalTodayDebugInfoSmall = document.getElementById('globalTodayDebugInfo');
        groupNameInput = document.getElementById('groupName');
        groupFilterSelect = document.getElementById('groupFilter');
        connectionStatus = document.getElementById('connectionStatus');

        // 新增：獲取狀態顯示元素
        waitingStateEl = document.getElementById('waitingState');
        resultStateEl = document.getElementById('resultState');
        loadingStateEl = document.getElementById('loadingState');
        errorStateEl = document.getElementById('errorState');
        cityNameEl = document.getElementById('cityName');
        countryNameEl = document.getElementById('countryName');
        greetingTextEl = document.getElementById('greetingText');
        coordinatesEl = document.getElementById('coordinates');
        errorMessageEl = document.getElementById('errorMessage');

        console.log('✅ DOM 元素取得完成');
        console.log('🔘 findCityButton:', findCityButton ? '找到' : '未找到');
        console.log('🔘 setUserNameButton:', setUserNameButton ? '找到' : '未找到');
        console.log('🔘 findCityButton.disabled:', findCityButton ? findCityButton.disabled : 'N/A');
        console.log('🎨 顯示狀態元素:', {
            waiting: waitingStateEl ? '找到' : '未找到',
            result: resultStateEl ? '找到' : '未找到',
            loading: loadingStateEl ? '找到' : '未找到',
            error: errorStateEl ? '找到' : '未找到'
        });

    } catch (error) {
        console.error('❌ DOM 元素取得失敗:', error);
    }

    // 設定 Firebase
    try {
        console.log('🔥 正在初始化 Firebase...');
        db = getFirestore();
        auth = getAuth();
        
        // 更新連線狀態
        updateConnectionStatus(true);
        console.log('✅ Firebase 初始化成功');
    } catch (error) {
        console.error('❌ Firebase 初始化失敗:', error);
        updateConnectionStatus(false);
    }

    // 基於時間分鐘數計算目標緯度
    function calculateTargetLatitudeFromTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // 驗證時間數值
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.error('❌ 無效的時間數值:', { hours, minutes });
            console.log('⚠️  使用預設緯度: 0 (赤道)');
            return 0;
        }
        
        // 特例時間段檢查 (7:50-8:10)
        if ((hours === 7 && minutes >= 50) || (hours === 8 && minutes <= 10)) {
            console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 特例時間段，使用赤道附近`);
            return 'local';
        }
        
        // 線性映射：0分=北緯70度，30分≈赤道0度，59分=南緯70度
        const targetLatitude = 70 - (minutes * 140 / 59);
        
        // 驗證計算結果
        if (isNaN(targetLatitude) || targetLatitude < -90 || targetLatitude > 90) {
            console.error('❌ 無效的緯度計算結果:', targetLatitude);
            console.log('⚠️  使用預設緯度: 0 (赤道)');
            return 0;
        }
        
        console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 目標緯度: ${targetLatitude.toFixed(2)}度`);
        
        return targetLatitude;
    }

    // 更新連線狀態
    function updateConnectionStatus(connected) {
        console.log('🔗 更新連線狀態:', connected ? '已連線' : '離線');
        if (connectionStatus) {
            connectionStatus.className = connected ? 'status-dot' : 'status-dot offline';
        }
    }

    // 新增：狀態管理函數
    function setState(newState, message = '') {
        console.log(`🔄 狀態切換: ${currentState} -> ${newState}`);
        
        try {
            currentState = newState;

            // 獲取所有狀態元素
            const waitingStateEl = document.getElementById('waitingState');
            const loadingStateEl = document.getElementById('loadingState');
            const resultStateEl = document.getElementById('resultState');
            const errorStateEl = document.getElementById('errorState');

            console.log('🔍 狀態元素檢查:', {
                waiting: !!waitingStateEl,
                loading: !!loadingStateEl,
                result: !!resultStateEl,
                error: !!errorStateEl
            });

            // 移除所有 active 類別
            [waitingStateEl, loadingStateEl, resultStateEl, errorStateEl].forEach(el => {
                if (el) {
                    el.classList.remove('active');
                }
            });

            // 根據新狀態啟動相應元素
            switch (newState) {
                case 'waiting':
                    if (waitingStateEl) {
                        waitingStateEl.classList.add('active');
                        console.log('✅ 等待狀態啟動');
                    } else {
                        console.error('❌ 等待狀態元素未找到');
                    }
                    break;
                case 'loading':
                    if (loadingStateEl) {
                        loadingStateEl.classList.add('active');
                        console.log('✅ 載入狀態啟動');
                    } else {
                        console.error('❌ 載入狀態元素未找到');
                    }
                    break;
                case 'result':
                    if (resultStateEl) {
                        resultStateEl.classList.add('active');
                        console.log('✅ 結果狀態啟動');
                        console.log('🔍 結果狀態詳細信息:', {
                            element: resultStateEl,
                            hasActiveClass: resultStateEl.classList.contains('active'),
                            allClasses: Array.from(resultStateEl.classList),
                            children: resultStateEl.children.length,
                            innerHTML: resultStateEl.innerHTML.substring(0, 200) + '...'
                        });
                        
                        // 檢查結果狀態內的子元素
                        const childElements = resultStateEl.querySelectorAll('*');
                        console.log('🔍 結果狀態子元素數量:', childElements.length);
                        
                        const infoPanel = resultStateEl.querySelector('.result-info-panel');
                        const voiceBar = resultStateEl.querySelector('.voice-loading-bar');
                        const coordInfo = resultStateEl.querySelector('.coordinate-info');
                        
                        console.log('🔍 結果狀態關鍵子元素:', {
                            infoPanel: !!infoPanel,
                            voiceBar: !!voiceBar,
                            coordInfo: !!coordInfo
                        });
                        
                    } else {
                        console.error('❌ 結果狀態元素未找到');
                    }
                    // 結果狀態不需要重新初始化地圖，因為已經在頁面載入時初始化了
                    break;
                case 'error':
                    if (errorStateEl) {
                        errorStateEl.classList.add('active');
                        console.log('✅ 錯誤狀態啟動');
                        
                        // 處理錯誤消息
                        if (message) {
                            const errorMessageEl = errorStateEl.querySelector('.error-message');
                            if (errorMessageEl) {
                                errorMessageEl.textContent = message;
                            }
                        }
                    } else {
                        console.error('❌ 錯誤狀態元素未找到');
                    }
                    break;
                default:
                    console.warn(`⚠️ 未知的狀態: ${newState}`);
            }

            console.log(`✅ 狀態切換完成: ${newState}`);

        } catch (e) {
            console.error('❌ 狀態切換失敗:', e);
        }
    }

    // 移除重複的 setState 定義

    // 分頁切換功能
    function initializeTabButtons() {
        console.log('📑 初始化分頁按鈕...');
        const tabButtons = document.getElementsByClassName('tab-button');
        
        Array.from(tabButtons).forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                console.log('📑 切換到分頁:', targetTab);
                showTab(targetTab);
            });
        });
        console.log(`✅ 已設定 ${tabButtons.length} 個分頁按鈕`);
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
            console.log('🗺️ 初始化今日甦醒地圖:', cityName, countryName);
            
            // 清理現有地圖
            if (clockLeafletMap) {
                clockLeafletMap.remove();
                clockLeafletMap = null;
            }

            // 創建新地圖（使用滿版容器）
            clockLeafletMap = L.map('mapContainer', {
                zoomControl: false, // 禁用默認縮放控制，使用自定義按鈕
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: true,
                keyboard: true,
                dragging: true,
                attributionControl: true
            }).setView([latitude, longitude - 2], 8); // 向左偏移2度，讓標記出現在右半邊

            // 添加地圖圖層
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
                minZoom: 2
            }).addTo(clockLeafletMap);

            // 添加甦醒位置標記
            const marker = L.marker([latitude, longitude], {
                title: `甦醒位置：${cityName}, ${countryName}`
            }).addTo(clockLeafletMap);
            
            // 自定義彈出窗口內容
            const popupContent = `
                <div style="text-align: center; font-family: 'ByteBounce', 'GB18030 Bitmap', 'VT323', 'Microsoft YaHei', '微軟雅黑', monospace; font-size: 14px;">
                    <strong style="color: #000000;">🌅 甦醒位置</strong><br>
                    <span style="color: #333333; font-size: 16px;">${cityName}</span><br>
                    <span style="color: #666666; font-size: 14px;">${countryName}</span><br>
                    <small style="color: #999999; font-size: 12px;">${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°</small>
                </div>
            `;
            
            marker.bindPopup(popupContent, {
                maxWidth: 200,
                className: 'wake-up-popup',
                offset: [150, 0] // 向右移動150px，放在右半邊中間
            }).openPopup();

            // 調整地圖大小（重要：確保地圖正確渲染）
            setTimeout(() => {
                if (clockLeafletMap) {
                    clockLeafletMap.invalidateSize();
                    
                    // 添加載入完成動畫
                    const mapContainer = document.getElementById('mapContainer');
                    if (mapContainer) {
                        mapContainer.classList.add('loaded');
                    }
                    
                    // 初始化自定義縮放按鈕
                    initCustomZoomControls();
                    
                    console.log('🗺️ 地圖大小已調整');
                }
            }, 200);

            console.log('✅ 今日甦醒地圖初始化完成');
        } catch (error) {
            console.error('❌ 地圖初始化失敗:', error);
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

            console.log('✅ 歷史地圖初始化完成');
        } catch (error) {
            console.error('❌ 歷史地圖初始化失敗:', error);
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

            console.log('✅ 全球地圖初始化完成');
        } catch (error) {
            console.error('❌ 全球地圖初始化失敗:', error);
        }
    }

    // 載入使用者資料
    async function loadUserData() {
        console.log('👤 載入使用者資料被呼叫');
        try {
            if (!setUserNameButton) {
                console.error('❌ setUserNameButton 元素未找到');
                return;
            }

            setUserNameButton.disabled = true;
            setUserNameButton.textContent = '載入中...';
            console.log('🔄 按鈕狀態已更新為載入中');

            // 固定使用者名稱為 "future"
            rawUserDisplayName = "future";
            if (userNameInput) userNameInput.value = rawUserDisplayName;

            // 更新顯示
            if (currentUserIdSpan) currentUserIdSpan.textContent = rawUserDisplayName;
            if (currentUserDisplayNameSpan) currentUserDisplayNameSpan.textContent = rawUserDisplayName;

            // 啟用開始按鈕
            if (findCityButton) {
                findCityButton.disabled = false;
                console.log('✅ 開始這一天按鈕已啟用');
            } else {
                console.error('❌ findCityButton 元素未找到');
            }
            
            setUserNameButton.textContent = '載入完成';
            console.log('✅ 使用者資料載入完成:', rawUserDisplayName);
            
            setTimeout(() => {
                if (setUserNameButton) {
                    setUserNameButton.textContent = '載入資料';
                    setUserNameButton.disabled = false;
                }
            }, 2000);

        } catch (error) {
            console.error('❌ 載入使用者資料失敗:', error);
            if (setUserNameButton) {
                setUserNameButton.textContent = '載入失敗';
                setUserNameButton.disabled = false;
            }
        }
    }

    // 開始這一天
    async function startTheDay() {
        console.log('🌅 開始這一天被呼叫 (完整版本)');
        console.log('🔍 當前狀態檢查:', {
            db: !!db,
            auth: !!auth,
            currentState: currentState,
            firebase: !!window.firebaseSDK
        });
        
        // 標記這是完整版本
        startTheDay.isFullVersion = true;
        
        try {
            // 設定載入狀態
            setState('loading');

            if (findCityButton) {
                findCityButton.disabled = true;
                findCityButton.textContent = '尋找中...';
            }
            if (resultTextDiv) resultTextDiv.textContent = '正在尋找你的甦醒城市...';
            console.log('🔄 開始尋找甦醒城市');

            // 計算目標緯度
            const targetLatitude = calculateTargetLatitudeFromTime();
            console.log('🎯 目標緯度:', targetLatitude);
            
            // 計算 UTC 偏移量
            const userLocalDate = new Date();
            const userUTCHours = userLocalDate.getUTCHours();
            const userUTCMinutes = userLocalDate.getUTCMinutes();
            
            // 驗證時間數值
            if (isNaN(userUTCHours) || isNaN(userUTCMinutes)) {
                console.error('❌ 獲取 UTC 時間失敗:', { userUTCHours, userUTCMinutes });
                throw new Error('無法獲取有效的 UTC 時間');
            }
            
            const userUTCTime = userUTCHours + userUTCMinutes / 60;
            const targetLocalHour = 8; // 目標當地時間是早上8點
            
            let requiredUTCOffset = targetLocalHour - userUTCTime;
            
            // 驗證計算結果
            if (isNaN(requiredUTCOffset)) {
                console.error('❌ UTC 偏移量計算失敗:', { targetLocalHour, userUTCTime, requiredUTCOffset });
                throw new Error('UTC 偏移量計算錯誤');
            }
            
            // 調整 UTC 偏移量到合理範圍
            while (requiredUTCOffset > 14) {
                requiredUTCOffset -= 24;
            }
            while (requiredUTCOffset < -12) {
                requiredUTCOffset += 24;
            }
            
            // 最終驗證
            if (isNaN(requiredUTCOffset) || requiredUTCOffset < -12 || requiredUTCOffset > 14) {
                console.error('❌ UTC 偏移量範圍無效:', requiredUTCOffset);
                requiredUTCOffset = 0; // 使用預設值
                console.log('⚠️  使用預設 UTC 偏移量: 0');
            }
            
            console.log('🕰️ UTC 偏移量:', requiredUTCOffset);
            
            // 呼叫 API 尋找城市
            let response;
            console.log('📡 準備呼叫 API...');
            
            const requestBody = {
                targetUTCOffset: requiredUTCOffset
            };
            
            if (targetLatitude === 'local') {
                // 特例時間段：使用赤道附近作為備用方案
                console.log('📡 呼叫 API (特例時間段，使用赤道附近)');
                requestBody.targetLatitude = 0; // 赤道附近
                requestBody.useLocalPosition = false;
            } else {
                // 使用計算的緯度
                console.log('📡 呼叫 API (目標緯度:', targetLatitude, ', UTC偏移:', requiredUTCOffset, ')');
                requestBody.targetLatitude = targetLatitude;
                requestBody.useLocalPosition = false;
            }
            
            response = await fetch('/api/find-city-geonames', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            console.log('📡 API 回應狀態:', response.status);
            const data = await response.json();
            console.log('📡 API 回應資料:', data);

            if (data.success && data.city) {
                // 顯示結果 - 使用新的顯示元素
                await displayAwakeningResult(data.city);

                // 儲存到 Firebase
                await saveToFirebase(data.city);

                console.log('✅ 甦醒城市尋找成功:', data.city);

            } else {
                throw new Error(data.error || '尋找城市失敗');
            }

        } catch (error) {
            console.error('❌ 開始這一天失敗:', error);
            setState('error', error.message || '發生未知錯誤');
            updateConnectionStatus(false);
            
            // 5秒後自動回到等待狀態
            setTimeout(() => {
                setState('waiting');
                updateConnectionStatus(true);
            }, 5000);
        } finally {
            if (findCityButton) {
                findCityButton.disabled = false;
                findCityButton.textContent = '開始這一天';
            }
            console.log('🔄 重設按鈕狀態');
        }
    }

    // 新增：顯示甦醒結果
    async function displayAwakeningResult(cityData) {
        console.log('🎨 顯示甦醒結果:', cityData);
        
        try {
            // 設定城市名稱
            if (cityNameEl) {
                cityNameEl.textContent = cityData.name || cityData.city;
            }
            
            // 設定國家名稱
            if (countryNameEl) {
                countryNameEl.textContent = cityData.country;
            }
            
            // 設定國旗
            if (countryFlagImg && cityData.country_iso_code) {
                const flagUrl = `https://flagcdn.com/96x72/${cityData.country_iso_code.toLowerCase()}.png`;
                countryFlagImg.src = flagUrl;
                countryFlagImg.style.display = 'block';
                console.log('🏁 國旗載入:', flagUrl);
            }
            
            // 獲取並設定故事和問候語
            await generateAndDisplayStoryAndGreeting(cityData);
            
            // 設定座標資訊
            if (coordinatesEl) {
                coordinatesEl.textContent = 
                    `${cityData.latitude.toFixed(4)}°, ${cityData.longitude.toFixed(4)}°`;
            }
            
            // 初始化地圖
            initClockMap(
                cityData.latitude,
                cityData.longitude,
                cityData.name,
                cityData.country
            );
            
            // 設定結果文字（保持相容性）
            const resultText = `今天你在 ${cityData.name}, ${cityData.country} 甦醒！`;
            if (resultTextDiv) resultTextDiv.textContent = resultText;
            
            // 更新除錯資訊（保持相容性）
            if (debugInfoSmall) {
                debugInfoSmall.textContent = `緯度: ${cityData.latitude.toFixed(4)}, 經度: ${cityData.longitude.toFixed(4)}`;
            }
            
            // 切換到結果狀態
            setState('result');
            
            console.log('✅ 結果顯示完成');
            
        } catch (error) {
            console.error('❌ 顯示結果失敗:', error);
            setState('error', '顯示結果時發生錯誤');
        }
    }

    // 新增：生成並顯示故事和問候語
    async function generateAndDisplayStoryAndGreeting(cityData) {
        console.log('📖 正在生成甦醒故事和問候語...');
        
        try {
            // 調用故事生成 API
            const storyResponse = await fetch('/api/generateStory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: cityData.name,
                    country: cityData.country,
                    countryCode: cityData.country_iso_code
                })
            });

            const storyResult = await storyResponse.json();
            console.log('📖 故事 API 回應:', storyResult);

            if (storyResult.greeting && storyResult.story) {
                // 更新結果頁面數據
                const resultData = {
                    city: cityData.name,
                    country: cityData.country,
                    countryCode: cityData.country_iso_code,
                    latitude: cityData.latitude,
                    longitude: cityData.longitude,
                    greeting: storyResult.greeting,
                    story: storyResult.story
                };
                
                // 使用新的結果數據更新函數
                updateResultData(resultData);

                // 語音播放故事（同時啟動打字機效果）
                await speakStory({ 
                    story: storyResult.story,
                    greeting: storyResult.greeting, 
                    languageCode: getLanguageCodeFromCountry(cityData.country_iso_code) 
                });

                console.log(`✅ 故事和問候語顯示成功`);
            } else {
                // 使用備用方案
                console.warn('故事 API 失敗，使用備用問候語');
                await generateFallbackGreeting(cityData);
            }

        } catch (error) {
            console.error('❌ 生成故事失敗:', error);
            // 使用備用方案
            await generateFallbackGreeting(cityData);
        }
    }

    // 新增：備用問候語生成
    async function generateFallbackGreeting(cityData) {
        const fallbackGreeting = getLocalizedGreeting(cityData.country_iso_code);
        const fallbackStory = `今天的你在${cityData.country}的${cityData.name}醒來，準備開始美好的一天！`;
        
        // 更新結果頁面數據
        const resultData = {
            city: cityData.name,
            country: cityData.country,
            countryCode: cityData.country_iso_code,
            latitude: cityData.latitude,
            longitude: cityData.longitude,
            greeting: fallbackGreeting,
            story: fallbackStory
        };
        
        // 使用新的結果數據更新函數
        updateResultData(resultData);
        
        await speakStory({ 
            story: fallbackStory,
            greeting: fallbackGreeting, 
            languageCode: getLanguageCodeFromCountry(cityData.country_iso_code) 
        });
    }

    // 新增：初始化自定義縮放按鈕功能
    function initCustomZoomControls() {
        console.log('🔍 初始化自定義縮放按鈕');
        
        const zoomInButton = document.getElementById('zoomInButton');
        const zoomOutButton = document.getElementById('zoomOutButton');
        
        if (!zoomInButton || !zoomOutButton) {
            console.warn('⚠️ 縮放按鈕元素未找到');
            return;
        }
        
        if (!mainInteractiveMap) {
            console.warn('⚠️ 主地圖實例未找到');
            return;
        }
        
        // 縮放按鈕事件監聽器
        zoomInButton.addEventListener('click', () => {
            if (mainInteractiveMap) {
                const currentZoom = mainInteractiveMap.getZoom();
                const maxZoom = mainInteractiveMap.getMaxZoom();
                
                if (currentZoom < maxZoom) {
                    mainInteractiveMap.zoomIn();
                    console.log('🔍 地圖放大，當前縮放級別:', currentZoom + 1);
                }
                
                updateZoomButtonState();
            }
        });
        
        zoomOutButton.addEventListener('click', () => {
            if (mainInteractiveMap) {
                const currentZoom = mainInteractiveMap.getZoom();
                const minZoom = mainInteractiveMap.getMinZoom();
                
                if (currentZoom > minZoom) {
                    mainInteractiveMap.zoomOut();
                    console.log('🔍 地圖縮小，當前縮放級別:', currentZoom - 1);
                }
                
                updateZoomButtonState();
            }
        });
        
        // 監聽地圖縮放事件，更新按鈕狀態
        mainInteractiveMap.on('zoomend', updateZoomButtonState);
        
        // 初始更新按鈕狀態
        updateZoomButtonState();
        
        console.log('✅ 自定義縮放按鈕初始化完成');
    }
    
    // 新增：更新縮放按鈕狀態
    function updateZoomButtonState() {
        if (!mainInteractiveMap) return;
        
        const zoomInButton = document.getElementById('zoomInButton');
        const zoomOutButton = document.getElementById('zoomOutButton');
        
        if (!zoomInButton || !zoomOutButton) return;
        
        const currentZoom = mainInteractiveMap.getZoom();
        const maxZoom = mainInteractiveMap.getMaxZoom();
        const minZoom = mainInteractiveMap.getMinZoom();
        
        // 更新放大按鈕狀態
        if (currentZoom >= maxZoom) {
            zoomInButton.disabled = true;
            zoomInButton.title = '已達最大縮放級別';
        } else {
            zoomInButton.disabled = false;
            zoomInButton.title = '放大';
        }
        
        // 更新縮小按鈕狀態
        if (currentZoom <= minZoom) {
            zoomOutButton.disabled = true;
            zoomOutButton.title = '已達最小縮放級別';
        } else {
            zoomOutButton.disabled = false;
            zoomOutButton.title = '縮小';
        }
        
        console.log(`🔍 縮放級別更新: ${currentZoom} (範圍: ${minZoom}-${maxZoom})`);
    }

    // 新增：顯示清喉嚨彈出對話框
    function showThroatClearingPopup() {
        console.log('😴 顯示清喉嚨提示');
        const popup = document.getElementById('throatClearingPopup');
        const overlay = document.getElementById('popupOverlay');
        
        if (popup && overlay) {
            popup.classList.add('show');
            overlay.classList.add('show');
        }
    }

    // 新增：隱藏清喉嚨彈出對話框
    function hideThroatClearingPopup() {
        console.log('😊 隱藏清喉嚨提示');
        const popup = document.getElementById('throatClearingPopup');
        const overlay = document.getElementById('popupOverlay');
        
        if (popup && overlay) {
            popup.classList.remove('show');
            overlay.classList.remove('show');
        }
    }

    // 新增：語音播放故事（含當地問候語+打字機效果）
    async function speakStory(storyData) {
        console.log('🎬 正在播放完整語音內容:', storyData);
        
        try {
            // 只播放故事內容，不要問候語
            // 準備要朗讀的內容（當地語言問候 + 故事）
            const fullContent = `${storyData.greeting}\n\n${storyData.story}`;
            const displayContent = fullContent; // 用於打字機效果顯示

            // 檢查瀏覽器是否支援語音合成
            if (!('speechSynthesis' in window)) {
                console.warn('🔇 此瀏覽器不支援語音合成');
                // 即使沒有語音，也要啟動打字機效果
                showVoiceLoading();
                await new Promise(resolve => setTimeout(resolve, 1500));
                startStoryTypewriter(fullContent);
                return;
            }

            // 顯示語音載入提示（清喉嚨階段）
            showVoiceLoading();

            // 停止任何正在播放的語音和打字機效果
            window.speechSynthesis.cancel();
            stopTypeWriterEffect();

            // 短暫延遲後開始播放（模擬清喉嚨時間）
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 創建語音合成實例（播放完整內容）
            const utterance = new SpeechSynthesisUtterance(fullContent);
            
            // 設定語言
            if (storyData.languageCode) {
                utterance.lang = storyData.languageCode;
            }
            
            // 設定語音參數
            utterance.rate = 0.7;  // 稍微慢一點以配合打字機效果
            utterance.pitch = 1.0; // 正常音調
            utterance.volume = 1.0; // 最大音量

            let speechStarted = false;
            let typewriterStarted = false;

            // 語音開始播放時啟動打字機效果
            utterance.onstart = () => {
                console.log('🎬 語音播放開始，啟動打字機效果');
                console.log('🌍 播放內容:', fullContent);
                
                // 隱藏 throat clearing popup
                hideThroatClearingPopup();
                
                speechStarted = true;
                if (!typewriterStarted) {
                    typewriterStarted = true;
                    startStoryTypewriter(displayContent);
                }
            };

            // 播放完成的回調
            utterance.onend = () => {
                console.log('🔊 完整語音播放完成');
                hideVoiceLoading();
                
                // 確保打字機效果也完成
                setTimeout(() => {
                    const voiceLoadingTextEl = document.querySelector('.voice-loading-text');
                    if (voiceLoadingTextEl && displayContent) {
                        voiceLoadingTextEl.textContent = displayContent;
                        voiceLoadingTextEl.classList.remove('typing');
                        voiceLoadingTextEl.classList.add('completed');
                    }
                }, 500);
            };

            utterance.onerror = (error) => {
                console.error('🔇 語音播放錯誤:', error);
                
                // 即使語音失敗，也要啟動打字機效果
                hideThroatClearingPopup();
                if (!typewriterStarted) {
                    typewriterStarted = true;
                    startStoryTypewriter(displayContent);
                }
                
                hideVoiceLoading();
                
                // 確保顯示完整內容
                setTimeout(() => {
                    const voiceLoadingTextEl = document.querySelector('.voice-loading-text');
                    if (voiceLoadingTextEl && displayContent) {
                        voiceLoadingTextEl.textContent = displayContent;
                        voiceLoadingTextEl.classList.remove('typing');
                        voiceLoadingTextEl.classList.add('completed');
                    }
                }, 2000);
            };

            // 開始播放完整內容
            window.speechSynthesis.speak(utterance);
            console.log('🎬 開始播放：當地問候語 + 故事');
            
            // 備用機制：如果 3 秒後語音還沒開始，強制啟動打字機效果
            setTimeout(() => {
                if (!speechStarted && !typewriterStarted) {
                    console.warn('⚠️ 語音播放可能被阻止，強制啟動打字機效果');
                    hideThroatClearingPopup();
                    typewriterStarted = true;
                    startStoryTypewriter(displayContent);
                }
            }, 3000);

        } catch (error) {
            console.error('🔇 語音播放失敗:', error);
            hideVoiceLoading();
            stopTypeWriterEffect();
            
            // 直接顯示完整內容
            const voiceLoadingTextEl = document.querySelector('.voice-loading-text');
            if (voiceLoadingTextEl && storyData.story) {
                const fallbackContent = `${storyData.greeting} ${storyData.story}`;
                voiceLoadingTextEl.textContent = fallbackContent;
            }
        }
    }

    // 保留原始的語音播放問候語函數（備用）
    async function speakGreeting(greetingData) {
        console.log('🔊 正在播放語音問候:', greetingData);
        
        try {
            // 檢查瀏覽器是否支援語音合成
            if (!('speechSynthesis' in window)) {
                console.warn('🔇 此瀏覽器不支援語音合成');
                return;
            }

            // 停止任何正在播放的語音
            window.speechSynthesis.cancel();

            // 創建語音合成實例
            const utterance = new SpeechSynthesisUtterance(greetingData.greeting);
            
            // 設定語言（如果有提供語言代碼）
            if (greetingData.languageCode) {
                utterance.lang = greetingData.languageCode;
            }
            
            // 設定語音參數
            utterance.rate = 0.8;  // 稍微慢一點
            utterance.pitch = 1.0; // 正常音調
            utterance.volume = 1.0; // 最大音量

            // 開始播放
            window.speechSynthesis.speak(utterance);
            console.log(`🔊 開始播放 ${greetingData.language || '未知語言'} 問候語`);

        } catch (error) {
            console.error('🔇 語音播放失敗:', error);
        }
    }

    // 新增：獲取本地化問候語
    function getLocalizedGreeting(countryCode) {
        const GREETINGS = {
            'zh-TW': '早安！新的一天開始了！',
            'zh-CN': '早上好！新的一天开始了！',
            'en': 'Good morning! A new day begins!',
            'ja': 'おはようございます！',
            'ko': '좋은 아침입니다！',
            'es': '¡Buenos días!',
            'fr': 'Bonjour !',
            'de': 'Guten Morgen!',
            'it': 'Buongiorno!',
            'pt': 'Bom dia!',
            'ru': 'Доброе утро!',
            'ar': 'صباح الخير!',
            'th': 'สวัสดีตอนเช้า!',
            'vi': 'Chào buổi sáng!',
            'hi': 'सुप्रभात!',
            'default': 'Good morning!'
        };
        
        const languageMap = {
            'TW': 'zh-TW', 'CN': 'zh-CN', 'HK': 'zh-TW', 'MO': 'zh-TW',
            'JP': 'ja', 'KR': 'ko', 'ES': 'es', 'MX': 'es', 'AR': 'es',
            'FR': 'fr', 'DE': 'de', 'IT': 'it', 'PT': 'pt', 'BR': 'pt',
            'RU': 'ru', 'SA': 'ar', 'TH': 'th', 'VN': 'vi', 'IN': 'hi'
        };
        
        const language = languageMap[countryCode] || 'en';
        return GREETINGS[language] || GREETINGS['default'];
    }

    // 儲存到 Firebase
    async function saveToFirebase(cityData) {
        try {
            if (!db || !auth.currentUser) {
                console.log('⚠️ Firebase 未就緒，跳過儲存');
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
            console.log('✅ 記錄已儲存至 Firebase');
            
            // 更新軌跡線
            setTimeout(() => {
                loadAndDrawTrajectory();
            }, 500);

        } catch (error) {
            console.error('❌ 儲存至 Firebase 失敗:', error);
        }
    }

    // 載入歷史記錄
    async function loadHistory() {
        try {
            if (!db) {
                console.log('⚠️ Firebase 資料庫未初始化');
                return;
            }
            
            if (!auth.currentUser) {
                console.log('⚠️ 使用者未認證，跳過載入歷史記錄');
                return;
            }

            refreshHistoryButton.disabled = true;
            refreshHistoryButton.textContent = '載入中...';
            console.log('📚 載入歷史記錄，使用者:', rawUserDisplayName);

            // 簡化查詢，避免權限問題
            const q = query(
                collection(db, 'wakeup_records'),
                where('userId', '==', rawUserDisplayName),
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
                        .bindPopup(`${data.city}, ${data.country}<br>${data.date}`, {
                            offset: [150, 0] // 向右移動150px，放在右半邊中間
                        })
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
            if (!db) {
                console.log('⚠️ Firebase 資料庫未初始化');
                return;
            }
            
            if (!auth.currentUser) {
                console.log('⚠️ 使用者未認證，跳過載入全球地圖');
                return;
            }

            refreshGlobalMapButton.disabled = true;
            refreshGlobalMapButton.textContent = '載入中...';

            const selectedDate = globalDateInput.value || new Date().toISOString().split('T')[0];
            console.log('🌍 載入全球地圖，日期:', selectedDate);
            
            // 簡化查詢，避免權限問題
            let q = query(
                collection(db, 'wakeup_records'),
                where('date', '==', selectedDate),
                limit(50)  // 減少限制數量
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
                        `, {
                            offset: [150, 0] // 向右移動150px，放在右半邊中間
                        })
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

    // 舊的 initResultMap 函數已移除 - 使用 initMainInteractiveMap

    // 格式化日期
    function formatWakeupDate(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        
        const dayName = days[date.getDay()];
        const month = months[date.getMonth()];
        const day = date.getDate().toString().padStart(2, '0');
        
        return `${month}/${day} ${dayName}`;
    }

    // 更新結果數據
    function updateResultData(data) {
        // 更新天數
        const dayNumberEl = document.getElementById('dayNumber');
        if (dayNumberEl) {
            dayNumberEl.textContent = data.day || '1';
        }

        // 更新日期
        const wakeupDateEl = document.getElementById('wakeupDate');
        if (wakeupDateEl) {
            const currentDate = new Date();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const year = currentDate.getFullYear();
            const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][currentDate.getDay()];
            wakeupDateEl.textContent = `${month}/${day}/${year} ${weekday}`;
        }

        // 更新當地問候語
        const localGreetingEl = document.getElementById('localGreeting');
        if (localGreetingEl && data.greeting) {
            let language = '當地語言';
            let greetingText = data.greeting;
            if (data.language) {
                language = data.language;
            } else {
                const languageMatch = data.greeting.match(/\((.*?)\)/);
                if (languageMatch) {
                    language = languageMatch[1];
                    greetingText = data.greeting.replace(/\s*\([^)]*\)/g, '').trim();
                }
            }
            localGreetingEl.textContent = `${greetingText.toUpperCase()} (${language})`;
        }

        // 更新城市名稱
        const cityNameEl = document.getElementById('cityName');
        if (cityNameEl) {
            cityNameEl.textContent = data.city || 'Unknown City';
        }

        // 更新國家名稱和國旗
        const countryNameEl = document.getElementById('countryName');
        const countryFlagEl = document.getElementById('countryFlag');
        if (countryNameEl) {
            countryNameEl.textContent = data.country || 'Unknown Country';
        }
        if (countryFlagEl && data.flag) {
            countryFlagEl.src = data.flag;
            countryFlagEl.alt = `${data.country} Flag`;
        }

        // 更新座標
        if (data.latitude && data.longitude) {
            const coordinatesEl = document.getElementById('coordinates');
            if (coordinatesEl) {
                coordinatesEl.textContent = `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;
            }
            
            // 更新地圖標記
            initMainInteractiveMap(data.latitude, data.longitude, data.city, data.country);
        }
        
        // 更新語音載入提示文字
        const voiceLoadingTextEl = document.getElementById('voiceLoadingText');
        if (voiceLoadingTextEl) {
            voiceLoadingTextEl.textContent = '剛起床，正在清喉嚨，準備為你朗誦你的甦醒日誌.....';
            voiceLoadingTextEl.classList.remove('typing', 'completed');
        }
    }

    // 打字機效果相關變數
    let typewriterTimer = null;
    let currentStoryText = '';

    // 打字機效果函數
    function typeWriterEffect(text, element, speed = 80) {
        return new Promise((resolve) => {
            // 清除之前的計時器
            if (typewriterTimer) {
                clearTimeout(typewriterTimer);
            }
            
            // 清空元素內容並添加打字狀態
            element.textContent = '';
            element.classList.add('typing');
            element.classList.remove('completed');
            
            let index = 0;
            
            function typeNextChar() {
                if (index < text.length) {
                    element.textContent += text.charAt(index);
                    index++;
                    typewriterTimer = setTimeout(typeNextChar, speed);
                } else {
                    // 打字完成，移除光標並添加完成效果
                    element.classList.remove('typing');
                    element.classList.add('completed');
                    resolve(); // 打字完成
                }
            }
            
            // 開始打字
            typeNextChar();
        });
    }

    // 停止打字機效果
    function stopTypeWriterEffect() {
        if (typewriterTimer) {
            clearTimeout(typewriterTimer);
            typewriterTimer = null;
        }
        
        // 移除打字狀態的 CSS 類
        const voiceLoadingTextEl = document.querySelector('.voice-loading-text');
        if (voiceLoadingTextEl) {
            voiceLoadingTextEl.classList.remove('typing');
            voiceLoadingTextEl.classList.remove('completed');
        }
    }

    // 計算語音播放時間 (估算)
    function estimateSpeechDuration(text) {
        // 使用 0.7 的語音速度，估算實際播放時間
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        const punctuation = (text.match(/[，。！？、；：]/g) || []).length;
        
        // 中文：每字約 400ms (較慢語速)，英文：每詞約 500ms，標點符號：每個 200ms 暫停
        const baseDuration = (chineseChars * 400) + (englishWords * 500) + (punctuation * 200);
        
        // 考慮 0.7 的語音速度
        const adjustedDuration = baseDuration / 0.7;
        
        // 最少 3 秒，最多 40 秒
        return Math.max(3000, Math.min(40000, adjustedDuration));
    }

    // 顯示/隱藏語音載入提示
    function showVoiceLoading() {
        const voiceLoadingBar = document.getElementById('voiceLoadingBar');
        const voiceLoadingTextEl = document.querySelector('.voice-loading-text');
        
        // 顯示 throat clearing popup
        showThroatClearingPopup();
        
        if (voiceLoadingBar) {
            voiceLoadingBar.style.display = 'block';
        }
        // 語音播放時顯示"清喉嚨"訊息
        if (voiceLoadingTextEl) {
            voiceLoadingTextEl.textContent = '剛起床，正在清喉嚨，準備為你朗誦你的甦醒日誌.....';
            voiceLoadingTextEl.classList.remove('typing', 'completed');
        }
    }

    function hideVoiceLoading() {
        const voiceLoadingBar = document.getElementById('voiceLoadingBar');
        if (voiceLoadingBar) {
            voiceLoadingBar.style.display = 'block'; // 保持顯示，但改變內容
        }
        // 語音播放完成後，文字會保持為故事內容 (已在 updateResultData 中設置)
    }

    // 開始語音播放時的打字機效果
    function startStoryTypewriter(storyText) {
        const voiceLoadingTextEl = document.querySelector('.voice-loading-text');
        if (!voiceLoadingTextEl || !storyText) {
            return Promise.resolve();
        }
        
        // 儲存當前故事文字
        currentStoryText = storyText;
        
        // 估算合適的打字速度 (根據語音播放時間調整)
        const estimatedDuration = estimateSpeechDuration(storyText);
        
        // 使用固定的打字速度，讓效果更明顯
        const typeSpeed = 100; // 固定100ms每字，打字機效果更明顯
        
        console.log(`🎬 開始打字機效果 - 文字長度: ${storyText.length}, 估算語音時間: ${estimatedDuration}ms, 打字速度: ${typeSpeed}ms/字`);
        
        // 開始打字機效果
        return typeWriterEffect(storyText, voiceLoadingTextEl, typeSpeed);
    }

    // 根據國家代碼獲取對應的語言代碼
    function getLanguageCodeFromCountry(countryCode) {
        // 國家代碼到語言代碼的映射
        const countryToLanguage = {
            // 亞洲
            'CN': 'zh-CN',      // 中國 - 簡體中文
            'TW': 'zh-TW',      // 台灣 - 繁體中文
            'HK': 'zh-HK',      // 香港 - 繁體中文
            'JP': 'ja-JP',      // 日本 - 日語
            'KR': 'ko-KR',      // 韓國 - 韓語
            'TH': 'th-TH',      // 泰國 - 泰語
            'VN': 'vi-VN',      // 越南 - 越南語
            'IN': 'hi-IN',      // 印度 - 印地語
            'ID': 'id-ID',      // 印尼 - 印尼語
            'MY': 'ms-MY',      // 馬來西亞 - 馬來語
            'SG': 'en-SG',      // 新加坡 - 英語
            'PH': 'en-PH',      // 菲律賓 - 英語
            
            // 歐洲
            'GB': 'en-GB',      // 英國 - 英語
            'IE': 'en-IE',      // 愛爾蘭 - 英語
            'FR': 'fr-FR',      // 法國 - 法語
            'DE': 'de-DE',      // 德國 - 德語
            'IT': 'it-IT',      // 義大利 - 義大利語
            'ES': 'es-ES',      // 西班牙 - 西班牙語
            'PT': 'pt-PT',      // 葡萄牙 - 葡萄牙語
            'NL': 'nl-NL',      // 荷蘭 - 荷蘭語
            'BE': 'nl-BE',      // 比利時 - 荷蘭語
            'CH': 'de-CH',      // 瑞士 - 德語
            'AT': 'de-AT',      // 奧地利 - 德語
            'SE': 'sv-SE',      // 瑞典 - 瑞典語
            'NO': 'nb-NO',      // 挪威 - 挪威語
            'DK': 'da-DK',      // 丹麥 - 丹麥語
            'FI': 'fi-FI',      // 芬蘭 - 芬蘭語
            'RU': 'ru-RU',      // 俄羅斯 - 俄語
            'PL': 'pl-PL',      // 波蘭 - 波蘭語
            'CZ': 'cs-CZ',      // 捷克 - 捷克語
            'HU': 'hu-HU',      // 匈牙利 - 匈牙利語
            'GR': 'el-GR',      // 希臘 - 希臘語
            
            // 美洲
            'US': 'en-US',      // 美國 - 英語
            'CA': 'en-CA',      // 加拿大 - 英語
            'MX': 'es-MX',      // 墨西哥 - 西班牙語
            'BR': 'pt-BR',      // 巴西 - 葡萄牙語
            'AR': 'es-AR',      // 阿根廷 - 西班牙語
            'CL': 'es-CL',      // 智利 - 西班牙語
            'CO': 'es-CO',      // 哥倫比亞 - 西班牙語
            'PE': 'es-PE',      // 秘魯 - 西班牙語
            
            // 大洋洲
            'AU': 'en-AU',      // 澳洲 - 英語
            'NZ': 'en-NZ',      // 紐西蘭 - 英語
            
            // 非洲
            'ZA': 'en-ZA',      // 南非 - 英語
            'EG': 'ar-EG',      // 埃及 - 阿拉伯語
            'MA': 'ar-MA',      // 摩洛哥 - 阿拉伯語
            
            // 中東
            'AE': 'ar-AE',      // 阿聯酋 - 阿拉伯語
            'SA': 'ar-SA',      // 沙烏地阿拉伯 - 阿拉伯語
            'IL': 'he-IL',      // 以色列 - 希伯來語
            'TR': 'tr-TR',      // 土耳其 - 土耳其語
        };
        
        // 獲取對應的語言代碼
        const languageCode = countryToLanguage[countryCode?.toUpperCase()];
        
        // 如果找不到對應的語言代碼，根據地區返回默認值
        if (!languageCode) {
            console.warn(`🌍 未找到國家代碼 ${countryCode} 的語言映射，使用英語作為默認`);
            return 'en-US'; // 默認使用美式英語
        }
        
        console.log(`🌍 國家 ${countryCode} 對應語言代碼: ${languageCode}`);
        return languageCode;
    }

    // 設定事件監聽器
    function setupEventListeners() {
        console.log('🎧 設定事件監聽器...');
        
        if (setUserNameButton) {
            setUserNameButton.addEventListener('click', () => {
                console.log('🔘 載入資料按鈕被點擊');
                loadUserData();
            });
            console.log('✅ 載入資料按鈕事件已設定');
        } else {
            console.error('❌ setUserNameButton 未找到，無法設定事件');
        }

        if (findCityButton) {
            findCityButton.addEventListener('click', () => {
                console.log('🔘 開始這一天按鈕被點擊');
                startTheDay();
            });
            console.log('✅ 開始這一天按鈕事件已設定');
        } else {
            console.error('❌ findCityButton 未找到，無法設定事件');
        }

        if (refreshHistoryButton) {
            refreshHistoryButton.addEventListener('click', loadHistory);
            console.log('✅ 刷新歷史按鈕事件已設定');
        }

        if (refreshGlobalMapButton) {
            refreshGlobalMapButton.addEventListener('click', loadGlobalMap);
            console.log('✅ 刷新全球地圖按鈕事件已設定');
        }

        // 設定清喉嚨對話框點擊關閉事件
        const popupOverlay = document.getElementById('popupOverlay');
        if (popupOverlay) {
            popupOverlay.addEventListener('click', () => {
                console.log('🔘 點擊遮罩關閉清喉嚨提示');
                hideThroatClearingPopup();
                        });
            console.log('✅ 清喉嚨對話框點擊事件已設定');
        }
        

    }

    // 初始化
    initializeTabButtons();
    setupEventListeners();
    
    // 設定今天的日期
    if (globalDateInput) {
        globalDateInput.value = new Date().toISOString().split('T')[0];
    }

    // Firebase 認證
    try {
        console.log('🔐 開始 Firebase 認證...');
        await signInAnonymously(auth);
        console.log('✅ Firebase 匿名登入成功');
        updateConnectionStatus(true);
        
        // 設定初始狀態
        setState('waiting');
        
        // 自動載入使用者資料
        console.log('🤖 自動載入使用者資料...');
        await loadUserData();
        
        // 設定全域函數供實體按鈕調用
        window.startTheDay = startTheDay;
        window.setState = setState;
        console.log('✅ 全域函數已設定');
        
    } catch (error) {
        console.error('❌ Firebase 認證失敗:', error);
        updateConnectionStatus(false);
        setState('error', 'Firebase 初始化失敗');
    }

    console.log('🎉 Raspberry Pi 甦醒地圖初始化完成');
});

// 錯誤處理
window.addEventListener('error', (event) => {
    console.error('🚨 全域錯誤:', event.error);
});

// 載入狀態指示
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM 載入完成，等待 Firebase...');
    console.log('🔍 初始狀態檢查:', {
        firebaseConfig: !!window.firebaseConfig,
        firebaseSDK: !!window.firebaseSDK,
        startTheDayFunction: typeof window.startTheDay,
        currentState: window.currentState
    });
    
    // 初始化背景地圖
    setTimeout(() => {
        console.log('🗺️ 初始化背景地圖...');
        try {
            initMainInteractiveMap(); // 初始化世界地圖作為背景
            console.log('✅ 背景地圖初始化成功');
        } catch (error) {
            console.error('❌ 背景地圖初始化失敗:', error);
        }
    }, 500);
    
    // 添加點擊測試功能
    setTimeout(() => {
        const testButton = document.getElementById('findCityButton');
        if (testButton) {
            console.log('🧪 測試：findCityButton 找到了');
            console.log('🧪 測試：disabled 狀態:', testButton.disabled);
            console.log('🧪 測試：文字內容:', testButton.textContent);
        } else {
            console.log('🧪 測試：findCityButton 未找到');
        }
        
        // 檢查 Firebase 載入狀態
        console.log('🧪 Firebase 載入狀態檢查:', {
            firebaseConfig: !!window.firebaseConfig,
            firebaseSDK: !!window.firebaseSDK,
            configScript: document.querySelector('script[src="/api/config"]') ? '已載入' : '未載入'
        });
    }, 1000);
}); 

// 舊的地圖初始化函數已移除 - 現在只使用一個主要互動地圖 

// 初始化主要互動地圖 (唯一地圖實例)
function initMainInteractiveMap(lat, lon, city, country) {
    if (mainInteractiveMap) {
        mainInteractiveMap.remove();
    }
    
    // 創建主要地圖實例 - 作為背景使用
    mainInteractiveMap = L.map('mainMapContainer', {
        center: [lat || 20, (lon || 0) - 8], // 向左偏移8度，讓標記出現在右半邊
        zoom: lat && lon ? 5 : 2, // 如果有具體位置則縮放，否則顯示世界地圖
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        tap: true,
        touchZoom: true
    });
    
    // 添加地圖瓦片 (灰黃配色)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
    }).addTo(mainInteractiveMap);
    
    // 初始化軌跡線圖層
    if (trajectoryLayer) {
        mainInteractiveMap.removeLayer(trajectoryLayer);
    }
    trajectoryLayer = L.layerGroup().addTo(mainInteractiveMap);
    
    // 如果有具體位置，添加標記
    if (lat && lon && city && country) {
        // 創建自定義圖標
        const customIcon = L.divIcon({
            className: 'trajectory-marker current-location',
            html: `<div class="trajectory-day">TODAY</div>`,
            iconSize: [60, 24],
            iconAnchor: [30, 24]
        });

        const marker = L.marker([lat, lon], {
            icon: customIcon
        }).addTo(mainInteractiveMap);
        
        // 不需要彈窗，標記只顯示TODAY
        marker.bindPopup('', {
            offset: [150, 0]
        });
    }
    
    // 隱藏版權信息
    mainInteractiveMap.attributionControl.setPrefix('');
    
    // 更新坐標顯示
    if (lat && lon) {
        const coordinateEl = document.getElementById('coordinates');
        if (coordinateEl) {
            coordinateEl.textContent = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
        }
    }
    
    // 初始化縮放按鈕功能
    setTimeout(() => {
        initCustomZoomControls();
    }, 100);
    
    // 立即載入並繪製軌跡線
    loadAndDrawTrajectory();
} 

// 載入並繪製軌跡線
async function loadAndDrawTrajectory() {
    try {
        if (!db) {
            console.log('⚠️ Firebase 資料庫未初始化，跳過軌跡線載入');
            return;
        }
        
        console.log('🗺️ 開始載入軌跡線數據...');
        
        // 讀取當前用戶的歷史記錄
        const q = query(
            collection(db, 'wakeup_records'),
            where('userId', '==', rawUserDisplayName),
            orderBy('timestamp', 'asc') // 按時間順序排列
        );
        
        const querySnapshot = await getDocs(q);
        trajectoryData = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.latitude && data.longitude) {
                trajectoryData.push({
                    lat: data.latitude,
                    lng: data.longitude,
                    city: data.city,
                    country: data.country,
                    date: data.date,
                    day: trajectoryData.length + 1
                });
            }
        });
        
        console.log(`📍 載入了 ${trajectoryData.length} 個軌跡點`);
        console.log('查詢用戶名:', rawUserDisplayName);
        
        if (trajectoryData.length === 0) {
            console.log('⚠️ 沒有找到軌跡數據，可能原因:');
            console.log('  1. 尚未按過實體按鈕記錄甦醒位置');
            console.log('  2. 用戶名不匹配 (當前:', rawUserDisplayName, ')');
            console.log('  3. Firebase數據尚未同步');
        }
        
        // 繪製軌跡線
        drawTrajectoryLine();
        
    } catch (error) {
        console.error('❌ 載入軌跡線失敗:', error);
    }
}

// 繪製軌跡線
function drawTrajectoryLine() {
    if (!trajectoryLayer || !mainInteractiveMap) {
        console.log('⚠️ 地圖或軌跡圖層未初始化');
        return;
    }
    
    // 清除現有軌跡線
    trajectoryLayer.clearLayers();
    
    // 如果有2個或以上的點，繪製軌跡線
    if (trajectoryData.length >= 2) {
        // 準備軌跡點座標
        const latlngs = trajectoryData.map(point => [point.lat, point.lng]);
        
        // 創建軌跡線 (polyline)
        const trajectoryLine = L.polyline(latlngs, {
            color: '#FF6B6B',        // 紅色軌跡線
            weight: 3,               // 線條粗細
            opacity: 0.8,            // 透明度
            smoothFactor: 1.0,       // 平滑度
            dashArray: '10, 5'       // 虛線樣式
        }).addTo(trajectoryLayer);
        
        console.log(`🗺️ 軌跡線已繪製，連接 ${trajectoryData.length} 個點`);
    } else {
        console.log('📍 軌跡點少於2個，只顯示Day標記，不繪製連線');
    }
    
    // 添加軌跡點標記
    trajectoryData.forEach((point, index) => {
        // 創建自定義圖標 (顯示Day數字)
        const customIcon = L.divIcon({
            className: 'trajectory-marker',
            html: `<div class="trajectory-day">Day ${point.day}</div>`,
            iconSize: [60, 24],
            iconAnchor: [30, 24]
        });
        
        const marker = L.marker([point.lat, point.lng], {
            icon: customIcon
        }).addTo(trajectoryLayer);
        
        // 不需要彈窗，標記只顯示Day數字
        marker.bindPopup('', {
            offset: [150, 0]
        });
    });
    
    console.log(`🗺️ 軌跡標記繪製完成，包含 ${trajectoryData.length} 個點`);
}

// Debug function for checking trajectory status
window.checkTrajectory = function() {
    console.log('🔍 軌跡線狀態檢查:');
    console.log('當前用戶名:', rawUserDisplayName);
    console.log('軌跡數據點數:', trajectoryData.length);
    console.log('軌跡數據:', trajectoryData);
    console.log('軌跡圖層是否存在:', !!trajectoryLayer);
    console.log('主地圖是否存在:', !!mainInteractiveMap);
    console.log('Firebase資料庫是否就緒:', !!db);
    
    if (trajectoryData.length > 0) {
        console.log('✅ 軌跡數據正常');
        console.log('軌跡點詳情:');
        trajectoryData.forEach((point, index) => {
            console.log(`  Day ${point.day}: ${point.city}, ${point.country} (${point.date})`);
        });
    } else {
        console.log('❌ 沒有軌跡數據');
        console.log('💡 請嘗試按下實體按鈕記錄甦醒位置');
    }
    
    // 手動重新載入軌跡線
    console.log('🔄 手動重新載入軌跡線...');
    loadAndDrawTrajectory();
};

// Debug functions removed for production

// Debug functions removed for production

// ... existing code ...
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
    
    // 嘗試顯示錯誤狀態
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
let cityNameEl, countryNameEl, greetingTextEl, coordinateInfoEl, errorMessageEl;

// 當 Firebase 準備就緒時執行
window.addEventListener('firebaseReady', async (event) => {
    console.log('🔥 Firebase Ready 事件觸發');
    
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
        coordinateInfoEl = document.getElementById('coordinateInfo');
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
        console.log(`🔄 狀態切換: ${currentState} → ${newState}`);
        
        // 移除所有 active 類別
        if (waitingStateEl) waitingStateEl.classList.remove('active');
        if (resultStateEl) resultStateEl.classList.remove('active');
        if (loadingStateEl) loadingStateEl.classList.remove('active');
        if (errorStateEl) errorStateEl.classList.remove('active');
        
        // 設定新狀態
        currentState = newState;
        window.currentState = newState;
        
        switch (newState) {
            case 'waiting':
                if (waitingStateEl) waitingStateEl.classList.add('active');
                break;
            case 'loading':
                if (loadingStateEl) loadingStateEl.classList.add('active');
                break;
            case 'result':
                if (resultStateEl) resultStateEl.classList.add('active');
                break;
            case 'error':
                if (errorStateEl) errorStateEl.classList.add('active');
                if (message && errorMessageEl) {
                    errorMessageEl.textContent = message;
                }
                break;
        }
    }

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
            
            // 獲取並設定當地語言問候語
            await generateAndDisplayMorningGreeting(cityData);
            
            // 設定座標資訊
            if (coordinateInfoEl) {
                coordinateInfoEl.textContent = 
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

    // 新增：生成並顯示早安問候語
    async function generateAndDisplayMorningGreeting(cityData) {
        console.log('🗣️ 正在生成當地語言早安問候...');
        
        try {
            // 調用新的問候語 API
            const greetingResponse = await fetch('/api/generateMorningGreeting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: cityData.name,
                    country: cityData.country,
                    countryCode: cityData.country_iso_code
                })
            });

            const greetingResult = await greetingResponse.json();
            console.log('🗣️ 問候語 API 回應:', greetingResult);

            if (greetingResult.success && greetingResult.data) {
                const greeting = greetingResult.data;
                
                // 顯示問候語
                if (greetingTextEl) {
                    greetingTextEl.innerHTML = `
                        <div class="greeting-main">${greeting.greeting}</div>
                        <div class="greeting-info">
                            ${greeting.language} - ${greeting.meaning}
                            ${greeting.pronunciation ? `<br><small>發音: ${greeting.pronunciation}</small>` : ''}
                        </div>
                    `;
                }

                // 語音播放問候語
                await speakGreeting(greeting);

                console.log(`✅ ${greeting.language}問候語顯示成功: ${greeting.greeting}`);
            } else {
                // 使用備用問候語
                console.warn('問候語 API 失敗，使用備用問候語');
                const fallbackGreeting = getLocalizedGreeting(cityData.country_iso_code);
                if (greetingTextEl) {
                    greetingTextEl.textContent = fallbackGreeting;
                }
                await speakGreeting({ greeting: fallbackGreeting, languageCode: 'zh-TW' });
            }

        } catch (error) {
            console.error('❌ 生成問候語失敗:', error);
            // 使用備用問候語
            const fallbackGreeting = getLocalizedGreeting(cityData.country_iso_code);
            if (greetingTextEl) {
                greetingTextEl.textContent = fallbackGreeting;
            }
            await speakGreeting({ greeting: fallbackGreeting, languageCode: 'zh-TW' });
        }
    }

    // 新增：語音播放問候語
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

            // 播放完成的回調
            utterance.onend = () => {
                console.log('🔊 語音播放完成');
            };

            utterance.onerror = (error) => {
                console.error('🔇 語音播放錯誤:', error);
            };

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
    }, 1000);
}); 
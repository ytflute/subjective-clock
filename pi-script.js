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
let currentGroupName = "Pi";  // 固定群組為 Pi
let initialLoadHandled = false;

// 主要互動地圖 (唯一地圖實例)
let mainInteractiveMap = null;
let dayCounter = 1; // Day 計數器

        // 軌跡線相關
let trajectoryLayer = null; // 軌跡線圖層
let trajectoryData = []; // 軌跡點數據
let historyMarkersLayer = null; // 歷史點位圖層

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

    // 🔧 日誌橋接函數：將前端日誌發送到後端日誌系統
    function logToBackend(level, message, data = null) {
        try {
            // 確保在HTML文檔載入後才操作DOM
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => logToBackend(level, message, data));
                return;
            }
            
            // 創建或更新隱藏的日誌元素供後端讀取
            let logElement = document.getElementById('frontend-log-bridge');
            if (!logElement) {
                logElement = document.createElement('div');
                logElement.id = 'frontend-log-bridge';
                logElement.style.cssText = 'display: none !important; position: absolute; left: -9999px;';
                document.body.appendChild(logElement);
                console.log('🔧 [日誌橋接] 創建日誌橋接元素');
            }
            
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                message,
                data: data ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2).substring(0, 500)) : null
            };
            
            // 保存最新的日誌條目供後端讀取
            logElement.textContent = JSON.stringify(logEntry);
            logElement.setAttribute('data-timestamp', timestamp);
            logElement.setAttribute('data-level', level);
            
            // 同時在瀏覽器console中顯示
            console.log(`🔗 [日誌橋接-${level}] ${message}`, data || '');
            
        } catch (error) {
            console.error('❌ 日誌橋接失敗:', error);
        }
    }

    // 將logToBackend設為全域函數，並立即測試
    window.logToBackend = logToBackend;
    
    // 🔧 立即測試日誌橋接功能
    setTimeout(() => {
        logToBackend('INFO', '🔧 [系統] 日誌橋接系統已初始化');
    }, 100);

// 🔧 重新啟用 piStoryReady 事件處理器，現在僅用於故事顯示
// 監聽樹莓派傳來的故事內容（Firebase上傳已由後端處理）
window.addEventListener('piStoryReady', (event) => {
    const message = '===== piStoryReady事件觸發！=====';
    logToBackend('INFO', '🎵 [故事事件] ' + message);
    logToBackend('INFO', '🎵 [故事事件] 收到樹莓派傳來的故事內容（僅用於顯示）', event.detail);
    
    console.log('🎵 [故事事件] ' + message);
    console.log('🎵 [故事事件] 收到樹莓派傳來的故事內容:', event.detail);
    console.log('🎵 [故事事件] 事件詳細數據:', JSON.stringify(event.detail, null, 2));
    
    // 🔍 詳細檢查故事內容
    if (event.detail && event.detail.story) {
        const storyLength = event.detail.story.length;
        const storyPreview = event.detail.story.substring(0, 100) + '...';
        logToBackend('INFO', `✅ [故事事件] 故事內容存在，長度: ${storyLength}`);
        logToBackend('INFO', `📖 [故事事件] 故事內容預覽: ${storyPreview}`);
        console.log('✅ [故事事件] 故事內容存在，長度:', storyLength);
        console.log('📖 [故事事件] 故事內容預覽:', storyPreview);
    } else {
        logToBackend('WARN', '⚠️ [故事事件] 故事內容不存在或為空！');
        console.warn('⚠️ [故事事件] 故事內容不存在或為空！');
    }
    
    if (event.detail && event.detail.greeting) {
        logToBackend('INFO', `✅ [故事事件] 問候語存在: ${event.detail.greeting}`);
        console.log('✅ [故事事件] 問候語存在:', event.detail.greeting);
    } else {
        logToBackend('WARN', '⚠️ [故事事件] 問候語不存在！');
        console.warn('⚠️ [故事事件] 問候語不存在！');
    }
    
    // 🔧 Firebase上傳已由後端audio_manager處理，前端僅負責顯示
    logToBackend('INFO', '📊 [故事顯示] Firebase上傳由後端處理，前端僅更新顯示');
    console.log('📊 [故事顯示] Firebase上傳由後端處理，前端僅更新顯示');
    
    // 🔧 前端僅負責故事內容顯示，不再處理Firebase上傳
    const storyData = event.detail;
    
    if (storyData && (storyData.fullContent || storyData.story)) {
        console.log('🔍 piStoryReady: 檢查 Firebase 狀態 - db:', !!db, 'rawUserDisplayName:', rawUserDisplayName);
        
        // 檢查 Firebase 是否已初始化，如果沒有就強制使用預設值
        if (!db || !window.firebaseSDK) {
            console.error('❌ piStoryReady: Firebase 未初始化，使用預設 Day 1 並顯示故事');
            console.log('🔍 當前 Firebase 狀態:', {
                db: !!db,
                firebaseSDK: !!window.firebaseSDK,
                firebaseConfig: !!window.firebaseConfig
            });
            
            // 直接使用預設值並顯示故事，優先使用樹莓派的 Day 值
            const finalDay = storyData.day || 1; // 優先使用樹莓派的 Day 值，否則預設為 1
            console.log('📊 Firebase 未初始化，Day 值決定: 樹莓派傳來:', storyData.day, '最終使用:', finalDay);
            
            const resultData = {
                city: storyData.city || 'Unknown City',
                country: storyData.country || 'Unknown Country',
                countryCode: storyData.countryCode || 'XX',
                latitude: storyData.latitude || 0,
                longitude: storyData.longitude || 0,
                greeting: storyData.greeting || 'Good Morning!',
                language: storyData.language || 'English',
                story: storyData.story || 'No story available',
                day: finalDay, // 優先使用樹莓派的 Day 值
                flag: storyData.countryCode ? `https://flagcdn.com/96x72/${storyData.countryCode.toLowerCase()}.png` : ''
            };
            
            console.log('📊 使用預設結果數據:', resultData);
            updateResultData(resultData);
            
            const storyTextEl = document.getElementById('storyText');
            if (storyTextEl) {
                storyTextEl.textContent = '剛起床，正在清喉嚨，準備為你朗誦你的甦醒日誌.....';
                setTimeout(() => {
                    console.log('🎬 開始打字機效果，內容:', storyData.fullContent || storyData.story);
                    startStoryTypewriter(storyData.fullContent || storyData.story);
                }, 1000);
            }
            return;
        }
        
        // 查詢當前的 Day 計數（完全從 Firebase 計算，忽略本地資料）
        const q = query(
            collection(db, 'wakeup_records'),
            where('userId', '==', rawUserDisplayName)
            // 移除 orderBy 避免索引需求，只需要數量
        );
        getDocs(q).then(querySnapshot => {
            const firebaseDay = querySnapshot.size; // 當前記錄數量就是 Day 數
            console.log('📊 piStoryReady: Firebase 查詢到記錄數量:', querySnapshot.size);
            
            // 完全使用 Firebase 計算的 Day 值，忽略樹莓派本地計數
            const finalDay = firebaseDay || 1; 
            console.log('📊 Day 值決定: 忽略樹莓派本地值:', storyData.day, 'Firebase 計算值:', firebaseDay, '最終使用:', finalDay);
            
            const resultData = {
                city: storyData.city || '',
                country: storyData.country || '',
                countryCode: storyData.countryCode || '',
                latitude: storyData.latitude || '',
                longitude: storyData.longitude || '',
                greeting: storyData.greeting || '',
                language: storyData.language || '',
                story: storyData.story || '',
                day: finalDay, // 優先使用樹莓派的 Day 值
                flag: storyData.countryCode ? `https://flagcdn.com/96x72/${storyData.countryCode.toLowerCase()}.png` : ''
            };
            updateResultData(resultData);

            // 🔧 修復：Firebase 查詢成功後顯示故事文字
            const storyElement = document.getElementById('storyText');
            if (storyElement) {
                storyElement.textContent = '剛起床，正在清喉嚨，準備為你朗誦你的甦醒日誌.....';
                setTimeout(() => {
                    console.log('🔧 Firebase查詢成功，開始顯示故事文字:', storyData.fullContent || storyData.story);
                    startStoryTypewriter(storyData.fullContent || storyData.story);
                }, 1000);
            } else {
                console.error('❌ Firebase查詢成功但找不到 #storyText 元素');
            }

            // 🔧 恢復：更新Firebase記錄添加故事內容
            if (storyData.story || storyData.greeting) {
                console.log('📖 [Firebase更新] 準備更新Firebase記錄中的故事內容...');
                
                if (window.currentRecordId) {
                    // 有記錄ID，更新現有記錄
                    console.log('📖 [Firebase更新] 使用記錄ID更新故事內容...');
                    updateFirebaseWithStory({
                        story: storyData.story || storyData.fullContent || '',
                        greeting: storyData.greeting || '',
                        language: storyData.language || '',
                        languageCode: storyData.languageCode || ''
                    }).then(success => {
                        if (success) {
                            console.log('✅ [Firebase更新] 故事資料更新成功');
                        } else {
                            console.warn('⚠️ [Firebase更新] 故事資料更新失敗');
                        }
                    });
                } else {
                    console.warn('⚠️ [Firebase更新] 沒有找到記錄ID，跳過更新');
                }
            }

            // 🔧 修復：Firebase 查詢成功後也要顯示故事文字
            // 開始打字機效果顯示故事
            const storyElem = document.getElementById('storyText');
            if (storyElem) {
                storyElem.textContent = '剛起床，正在清喉嚨，準備為你朗誦你的甦醒日誌.....';
                setTimeout(() => {
                    console.log('🔧 Firebase查詢成功後開始打字機效果，內容:', storyData.fullContent || storyData.story);
                    startStoryTypewriter(storyData.fullContent || storyData.story);
                }, 1000);
            } else {
                console.error('❌ Firebase查詢成功但找不到 #storyText 元素');
            }
        }).catch(error => {
            console.error('❌ piStoryReady: 查詢 Day 失敗:', error);
            // 如果查詢失敗，優先使用樹莓派的 Day 值
            const finalDay = storyData.day || 1; // 優先使用樹莓派的 Day 值，否則預設為 1
            console.log('📊 查詢失敗，Day 值決定: 樹莓派傳來:', storyData.day, '最終使用:', finalDay);
            
            const resultData = {
                city: storyData.city || '',
                country: storyData.country || '',
                countryCode: storyData.countryCode || '',
                latitude: storyData.latitude || '',
                longitude: storyData.longitude || '',
                greeting: storyData.greeting || '',
                language: storyData.language || '',
                story: storyData.story || '',
                day: finalDay, // 優先使用樹莓派的 Day 值
                flag: storyData.countryCode ? `https://flagcdn.com/96x72/${storyData.countryCode.toLowerCase()}.png` : ''
            };
            updateResultData(resultData);

            // 🔧 恢復：錯誤情況下也嘗試更新Firebase記錄
            if (storyData.story || storyData.greeting) {
                console.log('📖 [Firebase更新-錯誤恢復] 嘗試更新Firebase記錄...');
                
                if (window.currentRecordId) {
                    console.log('📖 [Firebase更新-錯誤恢復] 使用記錄ID更新故事內容...');
                    updateFirebaseWithStory({
                        story: storyData.story || storyData.fullContent || '',
                        greeting: storyData.greeting || '',
                        language: storyData.language || '',
                        languageCode: storyData.languageCode || ''
                    }).then(success => {
                        if (success) {
                            console.log('✅ [Firebase更新-錯誤恢復] 故事資料更新成功');
                        } else {
                            console.warn('⚠️ [Firebase更新-錯誤恢復] 故事資料更新失敗');
                        }
                    });
                } else {
                    console.warn('⚠️ [Firebase更新-錯誤恢復] 沒有找到記錄ID，跳過更新');
                }
            }

            // 開始打字機效果顯示故事
            const storyTextEl = document.getElementById('storyText');
            if (storyTextEl) {
                storyTextEl.textContent = '剛起床，正在清喉嚨，準備為你朗誦你的甦醒日誌.....';
                setTimeout(() => {
                    startStoryTypewriter(storyData.fullContent || storyData.story);
                }, 1000);
            }
        });
    }
});

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

                // 設定全域 Firebase 函數，供其他函數使用
            window.collection = collection;
            window.query = query;
            window.where = where;
            window.orderBy = orderBy;
            window.getDocs = getDocs;
            window.addDoc = addDoc;
            window.serverTimestamp = serverTimestamp;
            window.updateDoc = updateDoc;
            window.doc = doc;

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

            // 如果主地圖已存在，直接更新而不重新創建
            if (mainInteractiveMap) {
                console.log('🗺️ 使用現有主地圖實例更新位置');
                mainInteractiveMap.setView([latitude, longitude - 3], 3);  // 增加偏移量到-3
                clockLeafletMap = mainInteractiveMap; // 重用主地圖實例
            } else {
                // 創建新地圖（使用滿版容器）
                clockLeafletMap = L.map('mainMapContainer', {
                    zoomControl: false, // 禁用默認縮放控制，使用自定義按鈕
                    scrollWheelZoom: true,
                    doubleClickZoom: true,
                    boxZoom: true,
                    keyboard: true,
                    dragging: true,
                    attributionControl: true
                }).setView([latitude, longitude - 3], 3); // 增加偏移量到-3，大區域視角
                
                // 將時鐘地圖實例設為主地圖實例
                mainInteractiveMap = clockLeafletMap;
            }

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
                className: 'wake-up-popup'
            });

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
        // 立即設置調試標記
        window.debugStartTheDay = 'STARTED';
        
        console.log('🌅 開始這一天被呼叫 (完整版本)');
        console.log('🔍 當前狀態檢查:', {
            db: !!db,
            auth: !!auth,
            currentUser: !!auth?.currentUser,
            currentState: currentState,
            firebase: !!window.firebaseSDK
        });
        
        // 設置調試進度
        window.debugStartTheDay = 'CHECKING_STATE';
        
        // 檢查基本條件
        if (!db) {
            window.debugStartTheDay = 'ERROR_NO_DB';
            throw new Error('Firebase 資料庫未初始化');
        }
        
        if (!auth || !auth.currentUser) {
            window.debugStartTheDay = 'ERROR_NO_AUTH';
            throw new Error('Firebase 認證未完成');
        }
        
        window.debugStartTheDay = 'INITIALIZED';
        
        // 標記這是完整版本
        startTheDay.isFullVersion = true;
        
        try {
            console.log('🎯 準備設定載入狀態...');
            // 設定載入狀態
            setState('loading');
            console.log('✅ 載入狀態已設定');

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
                console.log('🎉 API 成功回應，準備處理城市資料:', data.city);
                
                // 🌍 設定全域變數供樹莓派提取使用 (修正時區欄位格式)
                window.currentCityData = {
                    ...data.city,
                    timezone: data.city.timezone?.timeZoneId || data.city.timezone || 'UTC'
                };
                console.log('🔗 已設定 window.currentCityData 供後端提取:', window.currentCityData);
                
                // 🔧 數據上傳已移至後端 audio_manager，前端僅負責顯示
                console.log('📊 Firebase 上傳已由後端 audio_manager 處理，前端等待故事內容');

                // 然後顯示結果 - 使用新的顯示元素
                console.log('🎨 開始顯示甦醒結果...');
                await displayAwakeningResult(data.city);
                console.log('✅ 結果顯示完成');

                console.log('✅ 甦醒城市尋找成功:', data.city);

            } else {
                console.error('❌ API 回應失敗:', data);
                throw new Error(data.error || '尋找城市失敗');
            }

        } catch (error) {
            console.error('❌ 開始這一天失敗:', error);
            console.error('❌ 錯誤堆疊:', error.stack);
            console.error('❌ 當前狀態:', {
                db: !!db,
                auth: !!auth.currentUser,
                firebase: !!window.firebaseSDK
            });
            setState('error', error.message || '發生未知錯誤');
            updateConnectionStatus(false);
            
            // 延長等待時間到10秒，讓用戶有時間看到錯誤
            setTimeout(() => {
                console.log('🔄 從錯誤狀態恢復到等待狀態');
                setState('waiting');
                updateConnectionStatus(true);
            }, 10000);
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

    // 只允許樹莓派內容，generateAndDisplayStoryAndGreeting 只等待 piStoryReady，不再 fallback
    async function generateAndDisplayStoryAndGreeting(cityData) {
        console.log('📖 等待樹莓派生成甦醒故事和問候語...');
        console.log('🔍 重要：畫面將只顯示樹莓派傳來的故事，與語音播放保持一致');
        
        try {
            let receivedPiStory = false;
            const waitForPiStory = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (!receivedPiStory) {
                        console.warn('⏱️ 等待樹莓派故事超時，但不使用備用方案');
                        console.warn('🔍 畫面將等待樹莓派故事，確保與語音播放一致');
                        reject(new Error('等待樹莓派故事超時'));
                    }
                }, 60000); // 延長到60秒，確保有足夠時間等待樹莓派
                
                const handlePiStory = (event) => {
                    receivedPiStory = true;
                    clearTimeout(timeout);
                    window.removeEventListener('piStoryReady', handlePiStory);
                    console.log('✅ 收到樹莓派故事，這將與語音播放內容一致');
                    resolve(event.detail);
                };
                
                window.addEventListener('piStoryReady', handlePiStory);
                
                // 檢查是否已經有故事內容
                if (window.piGeneratedStory) {
                    receivedPiStory = true;
                    clearTimeout(timeout);
                    console.log('✅ 使用已存在的樹莓派故事');
                    resolve(window.piGeneratedStory);
                }
            });
            
            const storyResult = await waitForPiStory;
            console.log('📖 收到樹莓派故事，與語音播放內容一致:', storyResult);
            
            // 獲取當前的 day 計數
            const q = query(
                collection(db, 'wakeup_records'),
                where('userId', '==', rawUserDisplayName)
            );
            const querySnapshot = await getDocs(q);
            const currentDay = querySnapshot.size;
            
            // 更新結果頁面數據 - 只使用樹莓派的故事
            const resultData = {
                city: cityData.name,
                country: cityData.country,
                countryCode: cityData.country_iso_code,
                latitude: cityData.latitude,
                longitude: cityData.longitude,
                greeting: storyResult.greeting,
                language: storyResult.language,
                story: storyResult.story,
                day: currentDay,
                flag: cityData.country_iso_code ? `https://flagcdn.com/96x72/${cityData.country_iso_code.toLowerCase()}.png` : ''
            };
            
            // 使用新的結果數據更新函數
            updateResultData(resultData);
            console.log('✅ 畫面顯示樹莓派故事，與語音播放一致');
            
        } catch (error) {
            console.error('❌ 未收到樹莓派故事內容，畫面將顯示等待狀態:', error);
            // 不再使用備用方案，保持與語音播放一致
            const storyTextEl = document.getElementById('storyText');
            if (storyTextEl) {
                storyTextEl.textContent = '等待樹莓派故事內容...與語音播放保持同步';
            }
        }
    }

    // === 所有備用故事生成函數已刪除 ===
    // 原因：確保畫面顯示與語音播放和 Firebase 存儲的故事完全一致
    // 現在只使用樹莓派傳來的故事內容，不再生成替代故事

    // 新增：初始化自定義縮放按鈕功能
    window.initCustomZoomControls = function initCustomZoomControls() {
        console.log('🔍 初始化自定義縮放按鈕');
        
        const zoomInButton = document.getElementById('zoomInButton');
        const zoomOutButton = document.getElementById('zoomOutButton');
        const zoomControls = document.querySelector('.map-zoom-controls');
        
        console.log('🔍 按鈕元素檢查:', {
            zoomInButton: !!zoomInButton,
            zoomOutButton: !!zoomOutButton,
            zoomControls: !!zoomControls
        });
        
        if (zoomControls) {
            console.log('🔍 縮放控制容器樣式:', {
                display: window.getComputedStyle(zoomControls).display,
                visibility: window.getComputedStyle(zoomControls).visibility,
                zIndex: window.getComputedStyle(zoomControls).zIndex,
                position: window.getComputedStyle(zoomControls).position,
                top: window.getComputedStyle(zoomControls).top,
                right: window.getComputedStyle(zoomControls).right
            });
        }
        
        if (!zoomInButton || !zoomOutButton) {
            console.warn('⚠️ 縮放按鈕元素未找到');
            return;
        }
        
        if (!mainInteractiveMap) {
            console.warn('⚠️ 主地圖實例未找到');
            return;
        }
        
        // 移除舊的事件監聽器
        const oldZoomIn = () => mainInteractiveMap.zoomIn();
        const oldZoomOut = () => mainInteractiveMap.zoomOut();
        zoomInButton.removeEventListener('click', oldZoomIn);
        zoomOutButton.removeEventListener('click', oldZoomOut);
        
        // 縮放按鈕事件監聽器 - 增強版本，強制綁定事件
        const handleZoomIn = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔍 縮放按鈕被點擊 (放大)');
            
            if (mainInteractiveMap) {
                const currentZoom = mainInteractiveMap.getZoom();
                const maxZoom = mainInteractiveMap.getMaxZoom();
                
                console.log('🔍 當前縮放:', currentZoom, '最大縮放:', maxZoom);
                
                if (currentZoom < maxZoom) {
                    mainInteractiveMap.zoomIn();
                    console.log('🔍 地圖放大，當前縮放級別:', currentZoom + 1);
                } else {
                    console.log('🔍 已達最大縮放級別');
                }
                
                if (typeof window.updateZoomButtonState === 'function') {
                    window.updateZoomButtonState();
                }
            } else {
                console.error('❌ 地圖實例不存在');
            }
        };
        
        const handleZoomOut = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔍 縮放按鈕被點擊 (縮小)');
            
            if (mainInteractiveMap) {
                const currentZoom = mainInteractiveMap.getZoom();
                const minZoom = mainInteractiveMap.getMinZoom();
                
                console.log('🔍 當前縮放:', currentZoom, '最小縮放:', minZoom);
                
                if (currentZoom > minZoom) {
                    mainInteractiveMap.zoomOut();
                    console.log('🔍 地圖縮小，當前縮放級別:', currentZoom - 1);
                } else {
                    console.log('🔍 已達最小縮放級別');
                }
                
                if (typeof window.updateZoomButtonState === 'function') {
                    window.updateZoomButtonState();
                }
            } else {
                console.error('❌ 地圖實例不存在');
            }
        };
        
        // 移除舊的事件監聽器並重新綁定
        zoomInButton.removeEventListener('click', handleZoomIn);
        zoomOutButton.removeEventListener('click', handleZoomOut);
        zoomInButton.addEventListener('click', handleZoomIn);
        zoomOutButton.addEventListener('click', handleZoomOut);
        
        // 也綁定觸摸事件，確保在觸控螢幕上也能工作
        zoomInButton.addEventListener('touchstart', handleZoomIn, { passive: false });
        zoomOutButton.addEventListener('touchstart', handleZoomOut, { passive: false });
        
        // 額外綁定 touchend 事件，提高觸控響應
        zoomInButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });
        zoomOutButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });
        
        // 監聽地圖縮放事件，更新按鈕狀態
        mainInteractiveMap.on('zoomend', window.updateZoomButtonState);
        
        // 初始更新按鈕狀態
        if (typeof window.updateZoomButtonState === 'function') {
            window.updateZoomButtonState();
        }
        
        console.log('✅ 自定義縮放按鈕初始化完成');
    }
    
    // 新增：更新縮放按鈕狀態
    window.updateZoomButtonState = function updateZoomButtonState() {
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
            // 故事內容已經包含當地語言的問候語
            const fullContent = storyData.story;
            const loadingText = '剛起床，正在清喉嚨，準備朗誦你的甦醒日誌......';

            // 檢查瀏覽器是否支援語音合成
            if (!('speechSynthesis' in window)) {
                console.warn('🔇 此瀏覽器不支援語音合成');
                await startStoryTypewriter(loadingText);
                await new Promise(resolve => setTimeout(resolve, 1500));
                await startStoryTypewriter(fullContent);
                return;
            }
            
            // 在黑色對話框中先打出 loading 文字
            await startStoryTypewriter(loadingText);

            // 停止任何正在播放的語音
            window.speechSynthesis.cancel();

            // 短暫延遲後開始播放
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

            // 語音開始播放時清除 loading 文字並啟動故事打字機效果
            utterance.onstart = () => {
                console.log('🎬 語音播放開始，啟動故事打字機效果');
                console.log('🌍 播放內容:', fullContent);
                
                speechStarted = true;
                if (!typewriterStarted) {
                    typewriterStarted = true;
                    // 清除 loading 文字，顯示故事內容
                    startStoryTypewriter(fullContent);
                }
            };

            // 播放完成的回調
            utterance.onend = () => {
                console.log('🔊 完整語音播放完成');
                hideVoiceLoading();
            };

            utterance.onerror = (error) => {
                console.error('🔇 語音播放錯誤:', error);
                hideVoiceLoading();
                stopTypeWriterEffect();
            };

            // 開始播放完整內容
            window.speechSynthesis.speak(utterance);
            console.log('🎬 開始播放故事');
            
            // 備用機制：如果 3 秒後語音還沒開始，強制啟動打字機效果
            setTimeout(() => {
                if (!speechStarted && !typewriterStarted) {
                    console.warn('⚠️ 語音播放可能被阻止，強制啟動打字機效果');
                    typewriterStarted = true;
                    startStoryTypewriter(fullContent);
                }
            }, 3000);

        } catch (error) {
            console.error('🔇 語音播放失敗:', error);
            hideVoiceLoading();
            stopTypeWriterEffect();
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
            'RU': 'ru', 'SA': 'ar', 'TH': 'th', 'VN': 'vi', 'IN': 'hi',
            'RE': 'fr' // 留尼汪 - 法語
        };
        
        const language = languageMap[countryCode] || 'en';
        return GREETINGS[language] || GREETINGS['default'];
    }

    // 儲存到 Firebase
    async function saveToFirebase(cityData, storyData = null) {
        try {
            if (!db || !auth.currentUser) {
                console.log('⚠️ Firebase 未就緒，跳過儲存');
                return null;
            }

            console.log('📊 開始計算 Day 計數...');
            console.log('📊 查詢用戶:', rawUserDisplayName);

            // 先獲取現有記錄數量
            const { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } = window.firebaseSDK;
            const q = query(
                collection(db, 'wakeup_records'),
                where('userId', '==', rawUserDisplayName)
            );
            const querySnapshot = await getDocs(q);
            const existingRecordsCount = querySnapshot.size;
            const currentDay = existingRecordsCount + 1;

            console.log('📊 現有記錄數量:', existingRecordsCount);
            console.log('📊 新的 Day 值:', currentDay);

            // 列出現有記錄
            console.log('📊 現有記錄詳情:');
            querySnapshot.forEach((doc, index) => {
                const data = doc.data();
                console.log(`  記錄 ${index + 1}: Day ${data.day}, 日期: ${data.date}, 城市: ${data.city}`);
            });

            const recordData = {
                userId: rawUserDisplayName,
                displayName: rawUserDisplayName,
                groupName: currentGroupName,
                city: cityData.name,
                country: cityData.country,
                countryIsoCode: cityData.country_iso_code,
                latitude: parseFloat(cityData.latitude),
                longitude: parseFloat(cityData.longitude),
                timezone: cityData.timezone || '',
                localTime: cityData.local_time || '',
                timestamp: serverTimestamp(),
                date: new Date().toISOString().split('T')[0],
                day: currentDay
            };

            // 如果有故事資料，加入記錄中
            if (storyData) {
                recordData.story = storyData.story || '';
                recordData.greeting = storyData.greeting || '';
                recordData.language = storyData.language || '';
                recordData.languageCode = storyData.languageCode || '';
                console.log('📖 包含故事和問候語資料');
            }

            console.log('📊 準備保存的記錄:', recordData);

            // 1. 儲存到 wakeup_records 集合（前端直寫）
            const docRef = await addDoc(collection(db, 'wakeup_records'), recordData);
            console.log('✅ 記錄已儲存至 wakeup_records 集合');
            console.log('✅ 文檔 ID:', docRef.id);
            
            // 儲存文檔 ID 以供後續更新使用
            window.currentRecordId = docRef.id;

            // 2. 🔧 重要：同時調用 /api/save-record API 儲存到 artifacts 集合
            // 這樣 index.html 才能查詢到 future 的資料！
            try {
                console.log('📡 同時儲存到 artifacts 集合，確保 index.html 可查詢...');
                
                // 🔧 檢查故事內容是否有效
                const hasValidStory = storyData && (storyData.story || storyData.greeting);
                console.log('🔍 故事內容檢查:', {
                    hasStoryData: !!storyData,
                    hasStory: !!(storyData && storyData.story),
                    hasGreeting: !!(storyData && storyData.greeting),
                    storyLength: storyData?.story?.length || 0,
                    greetingLength: storyData?.greeting?.length || 0
                });
                
                const apiData = {
                    userDisplayName: rawUserDisplayName,
                    dataIdentifier: rawUserDisplayName,
                    groupName: currentGroupName, // 🔧 確保 artifacts 集合包含 groupName: "Pi"
                    city: cityData.name,
                    country: cityData.country,
                    city_zh: cityData.name, // 可加入中文翻譯邏輯
                    country_zh: cityData.country,
                    country_iso_code: cityData.country_iso_code || '',
                    latitude: parseFloat(cityData.latitude) || 0,
                    longitude: parseFloat(cityData.longitude) || 0,
                    timezone: cityData.timezone || 'UTC',
                    localTime: cityData.local_time || new Date().toLocaleTimeString(),
                    targetUTCOffset: 8, // 台灣時區
                    matchedCityUTCOffset: 8,
                    source: 'raspberry_pi_frontend',
                    translationSource: 'frontend_api',
                    timeMinutes: new Date().getHours() * 60 + new Date().getMinutes(),
                    latitudePreference: parseFloat(cityData.latitude) || 0,
                    latitudeDescription: '',
                    deviceType: 'raspberry_pi_web',
                    story: (storyData && storyData.story) ? storyData.story : '', // 🔧 修復：確實檢查故事內容
                    greeting: (storyData && storyData.greeting) ? storyData.greeting : '', // 🔧 修復：確實檢查問候語內容
                    language: (storyData && storyData.language) ? storyData.language : '',
                    languageCode: (storyData && storyData.languageCode) ? storyData.languageCode : ''
                };

                const apiResponse = await fetch('/api/save-record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiData)
                });

                if (apiResponse.ok) {
                    const apiResult = await apiResponse.json();
                    console.log('✅ 資料已同步到 artifacts 集合，index.html 可查詢');
                    console.log('✅ artifacts ID:', apiResult.historyId);
                } else {
                    console.warn('⚠️ artifacts 同步失敗，但 wakeup_records 已儲存');
                }
            } catch (apiError) {
                console.error('❌ artifacts 同步錯誤:', apiError);
                console.log('⚠️ wakeup_records 已儲存，artifacts 同步失敗不影響主要功能');
            }
            
            // 更新軌跡線
            setTimeout(() => {
                loadAndDrawTrajectory();
            }, 500);

            return docRef.id;

        } catch (error) {
            console.error('❌ 儲存至 Firebase 失敗:', error);
            return null;
        }
    }

    // 新增：更新現有記錄的故事資料（同時更新 wakeup_records 和 artifacts）
    async function updateFirebaseWithStory(storyData) {
        try {
            if (!db || !auth.currentUser || !window.currentRecordId) {
                console.log('⚠️ Firebase 未就緒或沒有記錄 ID，跳過更新');
                console.log('🔍 調試檢查:', {
                    db: !!db,
                    currentUser: !!auth.currentUser,
                    currentRecordId: window.currentRecordId
                });
                return false;
            }

            const { doc, updateDoc } = window.firebaseSDK;
            
            const updateData = {
                story: storyData.story || '',
                greeting: storyData.greeting || '',
                language: storyData.language || '',
                languageCode: storyData.languageCode || ''
            };

            logToBackend('INFO', '📖 [故事更新] 開始更新 Firebase 記錄...');
            logToBackend('INFO', `📖 [故事更新] 記錄ID: ${window.currentRecordId}`);
            logToBackend('INFO', `📖 [故事更新] 故事內容長度: ${updateData.story.length}`);
            
            console.log('📖 [故事更新] 開始更新 Firebase 記錄...');
            console.log('📖 [故事更新] 記錄ID:', window.currentRecordId);
            console.log('📖 [故事更新] 更新資料:', updateData);
            console.log('📖 [故事更新] 故事內容長度:', updateData.story.length);

            // 1. 更新 wakeup_records 集合
            const docRef = doc(db, 'wakeup_records', window.currentRecordId);
            await updateDoc(docRef, updateData);
            
            logToBackend('INFO', '✅ [故事更新] wakeup_records 已更新');
            console.log('✅ [故事更新] wakeup_records 已更新');

            // 2. 同時調用 API 更新 artifacts 集合
            try {
                console.log('📡 [故事更新] 同時更新 artifacts 集合...');
                
                // 從當前城市數據獲取必要資訊
                const cityData = window.currentCityData || {};
                
                const apiData = {
                    userDisplayName: rawUserDisplayName,
                    dataIdentifier: rawUserDisplayName,
                    groupName: currentGroupName,
                    city: cityData.city || 'Unknown City',
                    country: cityData.country || 'Unknown Country',
                    story: updateData.story,
                    greeting: updateData.greeting,
                    language: updateData.language,
                    languageCode: updateData.languageCode,
                    updateExisting: true, // 標記這是更新操作
                    recordId: window.currentRecordId
                };

                const apiResponse = await fetch('/api/save-record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiData)
                });

                if (apiResponse.ok) {
                    logToBackend('INFO', '✅ [故事更新] artifacts 集合也已更新');
                    console.log('✅ [故事更新] artifacts 集合也已更新');
                } else {
                    logToBackend('WARN', '⚠️ [故事更新] artifacts 更新失敗，但 wakeup_records 已更新');
                    console.warn('⚠️ [故事更新] artifacts 更新失敗，但 wakeup_records 已更新');
                }
            } catch (apiError) {
                logToBackend('ERROR', '❌ [故事更新] artifacts 更新錯誤', apiError.message);
                console.error('❌ [故事更新] artifacts 更新錯誤:', apiError);
            }
            
            logToBackend('INFO', '✅ [故事更新] 故事資料更新完成');
            console.log('✅ [故事更新] 故事資料更新完成');
            return true;

        } catch (error) {
            console.error('❌ [故事更新] 更新 Firebase 故事資料失敗:', error);
            return false;
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
            // 優先使用提供的 day 值
            if (data.day) {
                console.log('📊 updateResultData: 使用提供的 day 值:', data.day);
                dayNumberEl.textContent = data.day;
            } else {
                // 如果沒有提供 day，從本地 Day 計數器獲取
                console.log('📊 updateResultData: 沒有提供 day 值，使用本地計數');
                // 使用預設 Day 計數 1
                console.log('📊 updateResultData: 沒有提供 day 值，使用預設值 1');
                dayNumberEl.textContent = '1';
            }
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
        
        // 🔧 修復：不清空故事文字，保持 piStoryReady 事件處理器設置的故事內容
        // 確保故事文字區域存在，但不清空內容
        const storyTextEl = document.getElementById('storyText');
        if (storyTextEl) {
            // 移除清空文字的代碼，保持現有故事內容
            // storyTextEl.textContent = '';
            storyTextEl.classList.remove('typing', 'completed');
            console.log('✅ 故事文字元素已找到，保持現有內容');
        } else {
            console.error('❌ 找不到故事文字元素 #storyText');
        }

        // 🎵 直接同步語音故事 - 使用generatePiStory API
        console.log('🎵 [同步] 直接使用generatePiStory與語音同步...');
        
        const storyEl = document.getElementById('storyText');
        if (storyEl) {
            storyEl.textContent = '正在生成與語音同步的故事...';
            console.log('🎵 [同步] 已設置loading文字');
            
            // 立即調用generatePiStory API
            setTimeout(async () => {
                try {
                    console.log('🎵 [同步] 調用generatePiStory API...');
                    const response = await fetch('/api/generatePiStory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            city: data.city || 'Unknown City',
                            country: data.country || 'Unknown Country'
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.story) {
                            console.log('✅ [同步] generatePiStory成功，故事內容:', result.story);
                            
                            // 直接開始打字機效果
                            if (window.startStoryTypewriter) {
                                console.log('🎬 [同步] 開始打字機效果...');
                                startStoryTypewriter(result.story);
                            } else {
                                console.error('❌ [同步] startStoryTypewriter函數不存在');
                                storyEl.textContent = result.story;
                            }
                            return;
                        }
                    }
                    
                    console.log('⚠️ [同步] API失敗，使用備案故事');
                    throw new Error('API失敗');
                    
                } catch (error) {
                    console.error('❌ [同步] generatePiStory失敗:', error);
                    
                    // 備案：簡單故事
                    const backupStory = `今天的你在${data.country || '未知國度'}的${data.city || '未知城市'}醒來。這是一個充滿希望的新開始！`;
                    console.log('📖 [同步] 使用備案故事:', backupStory);
                    
                    if (window.startStoryTypewriter) {
                        startStoryTypewriter(backupStory);
                    } else {
                        storyEl.textContent = backupStory;
                    }
                }
            }, 500);
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
        const storyTextEl = document.getElementById('storyText');
        if (storyTextEl) {
            storyTextEl.classList.remove('typing');
            storyTextEl.classList.remove('completed');
            storyTextEl.textContent = ''; // 清空文字
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

    // 開始語音播放時的打字機效果 - 增強版本
    function startStoryTypewriter(storyText) {
        console.log('🎬 startStoryTypewriter 被調用，故事內容:', storyText);
        
        const storyTextEl = document.getElementById('storyText');
        console.log('🎬 找到故事文字元素:', !!storyTextEl);
        
        if (!storyTextEl) {
            console.error('❌ 找不到 #storyText 元素');
            return Promise.resolve();
        }
        
        if (!storyText || storyText.trim() === '') {
            console.error('❌ 故事文字為空或未定義');
            storyTextEl.textContent = '故事內容載入中...';
            return Promise.resolve();
        }
        
        // 清除任何測試內容
        storyTextEl.style.display = 'block';
        storyTextEl.style.visibility = 'visible';
        
        // 儲存當前故事文字
        currentStoryText = storyText;
        
        // 使用固定的打字速度，讓效果更明顯
        const typeSpeed = 80; // 較快的打字速度
        
        console.log(`🎬 開始打字機效果 - 文字長度: ${storyText.length}, 打字速度: ${typeSpeed}ms/字`);
        console.log(`🎬 故事內容預覽: "${storyText.substring(0, 50)}..."`);
        
        // 開始打字機效果
        return typeWriterEffect(storyText, storyTextEl, typeSpeed);
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
    
    // 檢查故事文字元素是否正確載入
    setTimeout(() => {
        const storyTextEl = document.getElementById('storyText');
        if (storyTextEl) {
            console.log('✅ 故事文字元素檢查通過');
            // 添加測試內容，確保元素可見
            storyTextEl.textContent = '等待故事內容...';
            storyTextEl.style.display = 'block';
            storyTextEl.style.visibility = 'visible';
        } else {
            console.error('❌ 初始化後仍找不到故事文字元素');
        }
    }, 1000);
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
    // 如果地圖已存在且是時鐘地圖，不要移除，直接更新
    if (mainInteractiveMap && mainInteractiveMap === clockLeafletMap) {
        console.log('🗺️ 重用現有地圖實例，更新位置');
        // 🔧 修復：使用正確的偏移(-3)和縮放(3)設定
        mainInteractiveMap.setView([lat || 20, (lon || 0) - 3], 3);
    } else {
        if (mainInteractiveMap) {
            mainInteractiveMap.remove();
        }
        
        // 創建主要地圖實例 - 作為背景使用
        mainInteractiveMap = L.map('mainMapContainer', {
            center: [lat || 20, (lon || 0) - 3], // 🔧 修復：加入-3偏移
            zoom: 3, // 🔧 修復：統一使用縮放等級3
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
    }
    
    // 初始化軌跡線圖層
    if (trajectoryLayer) {
        mainInteractiveMap.removeLayer(trajectoryLayer);
    }
    trajectoryLayer = L.layerGroup().addTo(mainInteractiveMap);
    
    // 如果有具體位置，添加標記
    if (lat && lon && city && country) {
        // 創建自定義圖標 - 使用簡單的 "TODAY" 標籤
        const customIcon = L.divIcon({
            className: 'trajectory-marker current-location',
            html: `<div class="trajectory-day">TODAY</div>`,
            iconSize: [60, 24],
            iconAnchor: [30, 12]
        });

        const marker = L.marker([lat, lon], {
            icon: customIcon
        }).addTo(mainInteractiveMap);
        
        // 點擊顯示今日城市信息
        const cityNameEl = document.getElementById('cityName');
        const countryNameEl = document.getElementById('countryName');
        const todayCity = cityNameEl ? cityNameEl.textContent : '今日位置';
        const todayCountry = countryNameEl ? countryNameEl.textContent : '';
        
        marker.bindPopup(`
            <div style="text-align: center; font-family: 'Press Start 2P', monospace; font-size: 12px;">
                <strong style="color: #000000;">🌅 TODAY</strong><br>
                <span style="color: #333333; font-size: 14px;">${todayCity}</span><br>
                <span style="color: #666666; font-size: 12px;">${todayCountry}</span><br>
                <small style="color: #999999; font-size: 10px;">${lat.toFixed(4)}°, ${lon.toFixed(4)}°</small>
            </div>
        `, {
            offset: [0, -12],
            maxWidth: 200,
            className: 'today-popup'
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
    
    // 初始化縮放按鈕功能 - 增加重試確保成功
    setTimeout(() => {
        if (typeof window.initCustomZoomControls === 'function') {
            window.initCustomZoomControls();
        } else {
            console.warn('⚠️ initCustomZoomControls 函數未找到');
        }
        // 再次確保按鈕可見和可點擊
        const zoomControls = document.querySelector('.map-zoom-controls');
        if (zoomControls) {
            zoomControls.style.cssText = `
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                z-index: 9999999 !important;
                pointer-events: auto !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
            `;
        }
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
        
        // 讀取當前用戶的歷史記錄（暫時簡化查詢避免索引需求）
        const { collection, query, where, getDocs } = window.firebaseSDK;
        const q = query(
            collection(db, 'wakeup_records'),
            where('userId', '==', rawUserDisplayName)
            // 暫時移除 orderBy 避免索引需求，改為在客戶端排序
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
                    day: data.day || trajectoryData.length + 1,
                    timestamp: data.timestamp // 保留時間戳用於排序
                });
            }
        });
        
        // 在客戶端按時間排序（避免 Firebase 索引需求）
        trajectoryData.sort((a, b) => {
            const timeA = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : 0;
            return timeA - timeB; // 升序排列
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
        
        // 創建舊軌跡線 (除了最後一段)
        if (latlngs.length > 2) {
            const oldLatlngs = latlngs.slice(0, -1);
            const oldTrajectoryLine = L.polyline(oldLatlngs, {
                className: 'trajectory-line',
                color: '#999999',
                weight: 2,
                opacity: 0.6,
                dashArray: '5, 5'
            }).addTo(trajectoryLayer);
        }
        
        // 創建最新軌跡線 (最後一段)
        if (latlngs.length >= 2) {
            const lastTwoPoints = latlngs.slice(-2);
            const currentTrajectoryLine = L.polyline(lastTwoPoints, {
                className: 'trajectory-line current',
                color: '#FF4B4B',
                weight: 3,
                opacity: 0.8
            }).addTo(trajectoryLayer);
        }
        
        console.log(`🗺️ 軌跡線已繪製，連接 ${trajectoryData.length} 個點`);
    } else {
        console.log('📍 軌跡點少於2個，只顯示Day標記，不繪製連線');
    }
    
    // 添加軌跡點標記
    trajectoryData.forEach((point, index) => {
        const isCurrentLocation = index === trajectoryData.length - 1;
        
        // 創建自定義圖標 (顯示Day數字)
        const customIcon = L.divIcon({
            className: `trajectory-marker${isCurrentLocation ? ' current-location' : ''}`,
            html: `<div class="trajectory-day">Day ${point.day}</div>`,
            iconSize: [60, 24],
            iconAnchor: [30, 12]
        });
        
        const marker = L.marker([point.lat, point.lng], {
            icon: customIcon
        }).addTo(trajectoryLayer);
        
        // 點擊顯示城市和國家名字
        marker.bindPopup(`
            <div style="text-align: center; font-family: 'Press Start 2P', monospace; font-size: 12px;">
                <strong style="color: #000000;">Day ${point.day}</strong><br>
                <span style="color: #333333; font-size: 14px;">${point.city || '未知城市'}</span><br>
                <span style="color: #666666; font-size: 12px;">${point.country || '未知國家'}</span><br>
                <small style="color: #999999; font-size: 10px;">${point.date || ''}</small>
            </div>
        `, {
            offset: [0, -12],
            maxWidth: 200,
            className: 'trajectory-popup'
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

    // 載入歷史軌跡
    async function loadHistoryTrajectory() {
        if (!db || !auth.currentUser) {
            console.log('📍 載入歷史軌跡：Firebase 未就緒');
            return;
        }

        try {
            console.log('📍 開始載入歷史軌跡...');
            
            // 查詢 userHistory 中的歷史記錄（暫時簡化查詢避免索引需求）
            const historyQuery = query(
                collection(db, 'userHistory'),
                where('userDisplayName', '==', rawUserDisplayName)
                // 暫時移除 orderBy 避免索引需求，改為在客戶端排序
            );

            const querySnapshot = await getDocs(historyQuery);
            const historyPoints = [];

            querySnapshot.forEach((doc) => {
                const record = doc.data();
                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    
                    const timestamp = record.recordedAt?.toMillis?.() || Date.now();
                    const city = record.city || '未知城市';
                    const country = record.country || '未知國家';
                    
                    historyPoints.push({
                        lat: record.latitude,
                        lng: record.longitude,
                        city: city,
                        country: country,
                        timestamp: timestamp,
                        date: new Date(timestamp).toLocaleDateString('zh-TW'),
                        recordedAt: record.recordedAt // 保留原始時間戳用於排序
                    });
                }
            });

            // 在客戶端按時間排序（避免 Firebase 索引需求）
            historyPoints.sort((a, b) => {
                const timeA = a.recordedAt && a.recordedAt.toMillis ? a.recordedAt.toMillis() : a.timestamp;
                const timeB = b.recordedAt && b.recordedAt.toMillis ? b.recordedAt.toMillis() : b.timestamp;
                return timeA - timeB; // 升序排列
            });

            console.log(`📍 載入了 ${historyPoints.length} 個歷史點位`);
            
            if (historyPoints.length > 0 && mainInteractiveMap) {
                displayHistoryTrajectory(historyPoints);
            }

        } catch (error) {
            console.error('📍 載入歷史軌跡失敗:', error);
        }
    }

    // 顯示歷史軌跡
    function displayHistoryTrajectory(historyPoints) {
        if (!mainInteractiveMap) return;

        // 清除之前的歷史圖層
        if (historyMarkersLayer) {
            mainInteractiveMap.removeLayer(historyMarkersLayer);
        }
        if (trajectoryLayer) {
            mainInteractiveMap.removeLayer(trajectoryLayer);
        }

        // 創建新的圖層群組
        historyMarkersLayer = L.layerGroup().addTo(mainInteractiveMap);

        // 添加歷史點位標記
        historyPoints.forEach((point, index) => {
            const marker = L.circleMarker([point.lat, point.lng], {
                radius: 6,
                fillColor: index === historyPoints.length - 1 ? '#ff6b6b' : '#4ecdc4', // 最新點用紅色
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });

            // 設定點位說明
            const popupContent = `
                <div style="font-family: monospace; font-size: 12px;">
                    <strong>${point.date}</strong><br/>
                    📍 ${point.city}, ${point.country}<br/>
                    🌍 ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}
                </div>
            `;
            marker.bindPopup(popupContent);

            historyMarkersLayer.addLayer(marker);
        });

        // 如果有多個點，創建軌跡線
        if (historyPoints.length > 1) {
            const latlngs = historyPoints.map(point => [point.lat, point.lng]);
            
            trajectoryLayer = L.polyline(latlngs, {
                color: '#4ecdc4',
                weight: 3,
                opacity: 0.7,
                dashArray: '10, 5' // 虛線效果
            }).addTo(mainInteractiveMap);

            // 🔧 修復：使用今日位置（而非歷史最新點）加上偏移，保持與initMainInteractiveMap一致
            // 獲取今日位置信息
            const cityNameEl = document.getElementById('cityName');
            const coordinatesEl = document.getElementById('coordinates');
            
            if (coordinatesEl && coordinatesEl.textContent) {
                // 從座標顯示元素獲取今日位置
                const coordText = coordinatesEl.textContent;
                const [latStr, lonStr] = coordText.split(', ');
                const todayLat = parseFloat(latStr);
                const todayLon = parseFloat(lonStr);
                
                if (!isNaN(todayLat) && !isNaN(todayLon)) {
                    mainInteractiveMap.setView([todayLat, todayLon - 3], 3);
                    console.log('🗺️ 使用今日位置偏移而非歷史點:', todayLat, todayLon - 3);
                } else {
                    console.log('⚠️ 無法解析今日座標，使用歷史點位置');
                    if (historyPoints.length > 0) {
                        const latestPoint = historyPoints[historyPoints.length - 1];
                        mainInteractiveMap.setView([latestPoint.lat, latestPoint.lng - 3], 3);
                    }
                }
            } else if (historyPoints.length > 0) {
                // 備用方案：使用歷史最新點
                const latestPoint = historyPoints[historyPoints.length - 1];
                mainInteractiveMap.setView([latestPoint.lat, latestPoint.lng - 3], 3);
                console.log('🗺️ 備用方案：使用歷史點偏移:', latestPoint.lat, latestPoint.lng - 3);
            }
            // 移除原本的 fitBounds 調用，因為它會覆蓋偏移設定
            // mainInteractiveMap.fitBounds(group.getBounds().pad(0.1));
        }

        console.log('📍 歷史軌跡顯示完成');
    }

// ... existing code ...

            // 5. 地圖成功初始化，更新狀態
            mainInteractiveMap = clockLeafletMap;
            if (typeof window.updateZoomButtonState === 'function') {
                window.updateZoomButtonState();
            }
            
            // 載入歷史軌跡
            setTimeout(() => {
                loadHistoryTrajectory();
            }, 1000);

            // 設定完成狀態
            setState('result');
            
            // 等待地圖渲染完成後載入軌跡
            setTimeout(() => {
                loadHistoryTrajectory();
            }, 2000);

    // 新增：從Firebase直接讀取並顯示故事文字
    async function loadAndDisplayStoryFromFirebase() {
        try {
            // 🔧 修復：放寬認證檢查，只要Firebase已初始化就嘗試讀取
            if (!db) {
                console.log('⚠️ Firebase數據庫未初始化，無法讀取故事');
                return;
            }

            // 如果沒有認證，嘗試匿名登入
            if (!auth.currentUser) {
                console.log('🔑 用戶未認證，嘗試匿名登入...');
                try {
                    await signInAnonymously(auth);
                    console.log('✅ 匿名登入成功');
                } catch (authError) {
                    console.error('❌ 匿名登入失敗:', authError);
                    return;
                }
            }

            console.log('📖 從Firebase讀取最新故事內容...');
            
            // 查詢所有記錄（避免索引問題）
            const { collection, query, where, getDocs } = window.firebaseSDK;
            const q = query(
                collection(db, 'wakeup_records'),
                where('userId', '==', rawUserDisplayName)
            );

            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                // 客戶端排序獲取最新記錄
                const records = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.timestamp) {
                        records.push(data);
                    }
                });
                
                // 按timestamp排序，最新的在前
                records.sort((a, b) => {
                    const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                    const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                    return bTime - aTime;
                });
                
                if (records.length > 0) {
                    const latestRecord = records[0];
                    const storyText = latestRecord.story || latestRecord.greeting || '';
                    
                                         console.log('📖 從Firebase讀取到最新故事:', storyText);
                     console.log('📊 總記錄數:', records.length, '最新記錄時間:', latestRecord.timestamp);
                 
                     if (storyText) {
                         const storyTextEl = document.getElementById('storyText');
                         if (storyTextEl) {
                             storyTextEl.textContent = '剛起床，正在清喉嚨，準備為你朗誦你的甦醒日誌.....';
                             setTimeout(() => {
                                 console.log('🔧 開始顯示Firebase中的故事:', storyText);
                                 startStoryTypewriter(storyText);
                             }, 1000);
                         } else {
                             console.error('❌ 找不到 #storyText 元素');
                         }
                     } else {
                         console.warn('⚠️ Firebase記錄中沒有故事內容');
                     }
                 } else {
                     console.warn('⚠️ Firebase記錄中沒有有效的時間戳');
                 }
            } else {
                console.warn('⚠️ Firebase中沒有找到任何記錄');
            }

        } catch (error) {
            console.error('❌ 從Firebase讀取故事失敗:', error);
        }
    }

    // 將函數暴露給全域範圍
    window.loadAndDisplayStoryFromFirebase = loadAndDisplayStoryFromFirebase;

    // 強制顯示故事（用於處理載入用戶資料失敗的情況）
    async function forceDisplayStoryFromFirebase() {
        try {
            console.log('🔧 強制從Firebase讀取故事（忽略認證狀態）...');
            
            // 即使沒有認證也嘗試讀取（匿名訪問）
            if (!db) {
                console.error('❌ Firebase數據庫未初始化');
                return false;
            }

            // 強制設置用戶名稱為 "future"
            if (!rawUserDisplayName) {
                rawUserDisplayName = "future";
                console.log('🔧 強制設置用戶名稱為:', rawUserDisplayName);
            }

            // 查詢所有記錄（避免認證問題）
            const { collection, query, where, getDocs } = window.firebaseSDK;
            const q = query(
                collection(db, 'wakeup_records'),
                where('userId', '==', rawUserDisplayName)
            );

            console.log('📡 執行Firebase查詢，用戶:', rawUserDisplayName);
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                // 客戶端排序獲取最新記錄
                const records = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.timestamp) {
                        records.push(data);
                    }
                });
                
                console.log(`📊 找到 ${records.length} 筆記錄`);
                
                if (records.length > 0) {
                    // 按timestamp排序，最新的在前
                    records.sort((a, b) => {
                        const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                        const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                        return bTime - aTime;
                    });
                    
                    const latestRecord = records[0];
                    const storyText = latestRecord.story || latestRecord.greeting || '';
                    
                    console.log('📖 最新故事內容:', storyText);
                    
                    if (storyText) {
                        const storyTextEl = document.getElementById('storyText');
                        if (storyTextEl) {
                            storyTextEl.textContent = '正在為你朗誦你的甦醒日誌.....';
                            setTimeout(() => {
                                console.log('🎬 強制顯示故事:', storyText);
                                startStoryTypewriter(storyText);
                            }, 800);
                            return true;
                        } else {
                            console.error('❌ 找不到 #storyText 元素');
                        }
                    } else {
                        console.warn('⚠️ 記錄中沒有故事內容');
                    }
                } else {
                    console.warn('⚠️ 沒有有效的時間戳記錄');
                }
            } else {
                console.warn('⚠️ Firebase中沒有找到任何記錄');
            }

        } catch (error) {
            console.error('❌ 強制顯示故事失敗:', error);
        }
        return false;
    }

    // 將強制顯示函數暴露給全域範圍
    window.forceDisplayStoryFromFirebase = forceDisplayStoryFromFirebase;

    // 監控用戶資料載入失敗，自動嘗試強制顯示故事
    let userDataLoadAttempts = 0;
    const maxUserDataLoadAttempts = 3;
    
    function monitorUserDataLoad() {
        // 檢查是否載入成功
        if (rawUserDisplayName && rawUserDisplayName !== '') {
            console.log('✅ 用戶資料已載入:', rawUserDisplayName);
            return;
        }
        
        userDataLoadAttempts++;
        console.log(`⚠️ 用戶資料載入檢查第 ${userDataLoadAttempts} 次`);
        
        if (userDataLoadAttempts >= maxUserDataLoadAttempts) {
            console.log('🔧 用戶資料載入失敗，嘗試強制顯示故事...');
            // 強制設置用戶資料
            rawUserDisplayName = "future";
            if (currentUserIdSpan) currentUserIdSpan.textContent = rawUserDisplayName;
            if (currentUserDisplayNameSpan) currentUserDisplayNameSpan.textContent = rawUserDisplayName;
            
            // 嘗試強制顯示故事
            setTimeout(() => {
                if (window.forceDisplayStoryFromFirebase) {
                    forceDisplayStoryFromFirebase();
                }
            }, 2000);
        } else {
            // 繼續監控
            setTimeout(monitorUserDataLoad, 5000);
        }
    }

    // 啟動用戶資料載入監控
    setTimeout(monitorUserDataLoad, 10000); // 10秒後開始監控

    // ✨ 新增：簡化的故事顯示邏輯 - 直接從Firebase抓取future用戶的最新故事
    async function displayLatestStoryFromFirebase() {
        try {
            console.log('📖 [簡化邏輯] 直接從Firebase獲取future用戶的最新故事...');
            
            if (!db) {
                console.log('⚠️ Firebase數據庫未初始化');
                return false;
            }

            // 確保有認證
            if (!auth.currentUser) {
                try {
                    await signInAnonymously(auth);
                    console.log('✅ 匿名登入成功');
                } catch (authError) {
                    console.error('❌ 匿名登入失敗:', authError);
                    return false;
                }
            }

            // 查詢future用戶的最後一筆記錄（依照時間戳排序）
            if (!window.firebaseSDK) {
                console.error('❌ window.firebaseSDK 未初始化');
                return false;
            }
            
            const { collection, query, where, orderBy, limit, getDocs } = window.firebaseSDK;
            
            // 先嘗試無索引查詢作為備援
            let q;
            try {
                q = query(
                    collection(db, 'wakeup_records'),
                    where('userId', '==', 'future'),
                    orderBy('timestamp', 'desc'),  // 按時間戳降序排列
                    limit(1)  // 只取最新的一筆
                );
            } catch (indexError) {
                console.log('⚠️ 索引查詢失敗，使用簡單查詢:', indexError);
                q = query(
                    collection(db, 'wakeup_records'),
                    where('userId', '==', 'future')
                );
            }

            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                let latestRecord;
                
                // 如果是簡單查詢（無orderBy），需要客戶端排序
                if (q._query.orderBy.length === 0) {
                    console.log('🔄 [簡化邏輯] 執行客戶端排序');
                    const records = [];
                    querySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.timestamp) {
                            records.push(data);
                        }
                    });
                    
                    // 客戶端排序
                    records.sort((a, b) => {
                        const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                        const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                        return bTime - aTime;  // 降序
                    });
                    
                    latestRecord = records[0];
                } else {
                    // 如果有orderBy，直接取第一個
                    latestRecord = querySnapshot.docs[0].data();
                }
                
                const storyText = latestRecord.story || latestRecord.greeting || '';
                
                console.log('📖 [簡化邏輯] 找到最新故事:', storyText);
                
                if (storyText) {
                    const storyTextEl = document.getElementById('storyText');
                    if (storyTextEl) {
                        storyTextEl.textContent = '正在為你朗誦你的甦醒日誌.....';
                        setTimeout(() => {
                            console.log('🎬 [簡化邏輯] 開始顯示最新故事');
                            startStoryTypewriter(storyText);
                        }, 1000);
                        return true;
                    } else {
                        console.error('❌ 找不到 #storyText 元素');
                    }
                } else {
                    console.log('⚠️ 最新記錄中沒有故事內容');
                }
            } else {
                console.log('⚠️ 沒有找到future用戶的記錄');
            }

        } catch (error) {
            console.error('❌ [簡化邏輯] 獲取最新故事失敗:', error);
            
            // 備援：如果有索引問題，使用客戶端排序
            try {
                console.log('🔄 [簡化邏輯] 嘗試備援方案：客戶端排序');
                const { collection, query, where, getDocs } = window.firebaseSDK;
                const fallbackQuery = query(
                    collection(db, 'wakeup_records'),
                    where('userId', '==', 'future')
                );
                
                const fallbackSnapshot = await getDocs(fallbackQuery);
                
                if (!fallbackSnapshot.empty) {
                    const records = [];
                    fallbackSnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.timestamp) {
                            records.push(data);
                        }
                    });
                    
                    // 客戶端排序
                    records.sort((a, b) => {
                        const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                        const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                        return bTime - aTime;  // 降序
                    });
                    
                    if (records.length > 0) {
                        const latestRecord = records[0];
                        const storyText = latestRecord.story || latestRecord.greeting || '';
                        
                        if (storyText) {
                            const storyTextEl = document.getElementById('storyText');
                            if (storyTextEl) {
                                storyTextEl.textContent = '正在為你朗誦你的甦醒日誌.....';
                                setTimeout(() => {
                                    console.log('🎬 [備援] 開始顯示最新故事');
                                    startStoryTypewriter(storyText);
                                }, 1000);
                                return true;
                            }
                        }
                    }
                }
            } catch (fallbackError) {
                console.error('❌ [簡化邏輯] 備援方案也失敗:', fallbackError);
            }
        }
        
        return false;
    }

    // 將簡化邏輯暴露給全域，方便調用
    window.displayLatestStoryFromFirebase = displayLatestStoryFromFirebase;

    // 🔥 強壯的故事顯示機制 - 多層備援，確保一定有故事！
    async function guaranteedStoryDisplay(cityData) {
        console.log('🔥 [強壯備援] 啟動多層故事顯示機制...');
        
        const storyTextEl = document.getElementById('storyText');
        if (!storyTextEl) {
            console.error('❌ 找不到故事文字元素，放棄');
            return;
        }

        // 🔧 額外等待，確保Firebase寫入絕對完成
        console.log('⏰ [強壯備援] 額外等待2秒，確保Firebase寫入完成...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 第一層：嘗試從Firebase讀取最新記錄
        try {
            console.log('🔥 [備援1] 嘗試從Firebase讀取...');
            const success = await displayLatestStoryFromFirebase();
            if (success) {
                console.log('✅ [備援1] Firebase讀取成功');
                return;
            }
        } catch (error) {
            console.log('⚠️ [備援1] Firebase讀取失敗:', error);
        }

        // 第二層：最終備案 - 使用generatePiStory API
        try {
            console.log('🔥 [備援3] 使用generatePiStory API作為最終備案...');
            storyTextEl.textContent = '為你重新創作甦醒故事...';
            const localStory = await generateLocalStory(cityData);
            if (localStory) {
                setTimeout(() => {
                    startStoryTypewriter(localStory);
                }, 500);
                console.log('✅ [備援3] generatePiStory API備案成功');
                return;
            }
        } catch (error) {
            console.log('⚠️ [備援3] generatePiStory API備案也失敗:', error);
        }

        // 超級最終備案：確保一定有內容
        console.log('🔥 [超級備案] 確保基本內容顯示...');
        const city = cityData?.city || '未知之地';
        const country = cityData?.country || '神秘國度';
        const emergencyStory = `今天的你在${country}的${city}醒來。新的一天，新的開始！`;
        storyTextEl.textContent = '準備甦醒內容...';
        setTimeout(() => {
            startStoryTypewriter(emergencyStory);
        }, 500);
        console.log('✅ [超級備案] 緊急內容顯示完成');
    }

    // API重新生成故事
    async function generateFreshStory(cityData) {
        try {
            if (!cityData || !cityData.city || !cityData.country) {
                console.log('⚠️ 城市資料不完整，跳過API生成');
                return null;
            }

            const response = await fetch('/api/generatePiStory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: cityData.city,
                    country: cityData.country
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API重新生成故事成功:', data.story);
                return data.story;
            } else {
                console.log('⚠️ API回應失敗:', response.status);
                return null;
            }
        } catch (error) {
            console.error('❌ API重新生成故事失敗:', error);
            return null;
        }
    }

    // 最終備案故事生成 - 使用generatePiStory API
    async function generateLocalStory(cityData) {
        try {
            console.log('🔥 [最終備案] 使用generatePiStory API生成故事...');
            
            const city = cityData?.city || 'Unknown City';
            const country = cityData?.country || 'Unknown Country';
            
            const response = await fetch('/api/generatePiStory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: city,
                    country: country
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ [最終備案] generatePiStory API成功:', data.story);
                return data.story;
            } else {
                console.log('⚠️ [最終備案] API回應失敗，使用超級備案');
                throw new Error(`API失敗: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ [最終備案] generatePiStory API失敗:', error);
            
            // 超級最終備案：本地簡單故事
            const city = cityData?.city || '未知之地';
            const country = cityData?.country || '神秘國度';
            const fallbackStory = `今天的你在${country}的${city}醒來。這是一個充滿可能性的早晨，新的一天帶來新的希望。`;
            console.log('🔥 [超級備案] 使用本地故事:', fallbackStory);
            return fallbackStory;
        }
    }

    // 暴露強壯備援函數
    window.guaranteedStoryDisplay = guaranteedStoryDisplay;

    // 🚨 緊急故事生成 - 絕對會有結果的簡化版本
    async function emergencyStoryGeneration(cityData) {
        console.log('🚨 [緊急生成] 啟動絕對會成功的故事生成...');
        
        const storyTextEl = document.getElementById('storyText');
        if (!storyTextEl) {
            console.error('❌ [緊急生成] 找不到故事元素');
            return;
        }

        const city = cityData?.city || '未知城市';
        const country = cityData?.country || '未知國家';
        
        // 方案1：直接調用generatePiStory API
        try {
            console.log('🚨 [緊急] 嘗試generatePiStory API...');
            const response = await fetch('/api/generatePiStory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ city, country })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.story) {
                    console.log('✅ [緊急] generatePiStory成功:', data.story);
                    storyTextEl.textContent = '故事創作完成，開始朗誦...';
                    setTimeout(() => startStoryTypewriter(data.story), 800);
                    return;
                }
            }
            console.log('⚠️ [緊急] generatePiStory失敗');
        } catch (error) {
            console.log('⚠️ [緊急] generatePiStory錯誤:', error);
        }

        // 方案2：本地立即故事（絕對會執行）
        console.log('🚨 [緊急] 使用本地立即故事');
        const immediateStory = `Good Morning! 今天的你在${country}的${city}醒來。這是一個充滿希望的早晨，新的一天帶來無限可能。陽光透過窗戶灑進來，提醒你今天將是特別的一天。`;
        
        storyTextEl.textContent = '故事準備就緒...';
        setTimeout(() => {
            console.log('🎬 [緊急] 開始顯示立即故事');
            startStoryTypewriter(immediateStory);
        }, 500);
    }

    // 暴露緊急生成函數
    window.emergencyStoryGeneration = emergencyStoryGeneration;
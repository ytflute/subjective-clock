/**
 * 事件處理模組
 * 處理所有用戶互動事件
 */

import { Utils } from './utils.js';

export class EventHandler {
    constructor(uiManager, firebaseService, cityService, mapService) {
        this.ui = uiManager;
        this.firebase = firebaseService;
        this.cityService = cityService;
        this.mapService = mapService;
        this.currentUserName = '';
        this.currentGroupName = '';
        this.currentDataIdentifier = '';
        this.isProcessing = false;
    }
    
    /**
     * 初始化所有事件監聽器
     */
    initializeEventListeners() {
        this.setupFindCityButton();
        this.setupUserNameInput();
        this.setupHistoryButton();
        this.setupGlobalMapButton();
        this.setupTabButtons();
        this.setupGroupFilter();
        
        console.log('[EventHandler] 事件監聽器初始化完成');
    }
    
    /**
     * 設置找城市按鈕事件
     */
    setupFindCityButton() {
        const button = this.ui.elements.findCityButton;
        if (!button) return;
        
        this.ui.addEventListener(button, 'click', async (e) => {
            e.preventDefault();
            await this.handleFindCity();
        });
    }
    
    /**
     * 設置用戶名稱相關事件
     */
    setupUserNameInput() {
        const button = this.ui.elements.setUserNameButton;
        const input = this.ui.elements.userNameInput;
        
        if (!button || !input) return;
        
        // 點擊事件
        this.ui.addEventListener(button, 'click', async (e) => {
            e.preventDefault();
            await this.handleSetUserName();
        });
        
        // 觸控事件支援
        if (Utils.isMobileDevice()) {
            this.ui.addEventListener(button, 'touchstart', async (e) => {
                e.preventDefault();
                await this.handleSetUserName();
            }, { passive: false });
            
            this.ui.addEventListener(button, 'touchmove', (e) => {
                e.preventDefault();
            });
            
            this.ui.addEventListener(button, 'touchend', (e) => {
                e.preventDefault();
            });
        }
        
        // Enter 鍵支援
        this.ui.addEventListener(input, 'keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await this.handleSetUserName();
            }
        });
    }
    
    /**
     * 設置歷史按鈕事件
     */
    setupHistoryButton() {
        const button = this.ui.elements.refreshHistoryButton;
        if (!button) return;
        
        this.ui.addEventListener(button, 'click', async (e) => {
            e.preventDefault();
            await this.handleLoadHistory();
        });
    }
    
    /**
     * 設置全域地圖按鈕事件
     */
    setupGlobalMapButton() {
        const button = this.ui.elements.refreshGlobalMapButton;
        if (!button) return;
        
        this.ui.addEventListener(button, 'click', async (e) => {
            e.preventDefault();
            await this.handleLoadGlobalMap();
        });
    }
    
    /**
     * 設置分頁按鈕事件
     */
    setupTabButtons() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            const tabName = button.getAttribute('data-tab');
            if (!tabName) return;
            
            const handleTabClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleTabSwitch(tabName);
            };
            
            this.ui.addEventListener(button, 'click', handleTabClick);
            
            if (Utils.isMobileDevice()) {
                this.ui.addEventListener(button, 'touchstart', handleTabClick, { passive: false });
            }
        });
    }
    
    /**
     * 設置組別過濾器事件
     */
    setupGroupFilter() {
        const select = this.ui.elements.groupFilterSelect;
        if (!select) return;
        
        this.ui.addEventListener(select, 'change', async (e) => {
            await this.handleGroupFilterChange(e.target.value);
        });
    }
    
    /**
     * 處理找城市
     */
    async handleFindCity() {
        if (this.isProcessing) {
            console.log('[EventHandler] 正在處理中，忽略重複請求');
            return;
        }
        
        try {
            this.isProcessing = true;
            this.ui.setButtonState(this.ui.elements.findCityButton, 'loading');
            this.ui.clearPreviousResults();
            this.ui.showLoading('正在定位您的甦醒座標，請稍候...');
            
            // 檢查並更新用戶信息
            const currentUserName = this.ui.elements.userNameInput?.value.trim();
            const currentGroupName = this.ui.elements.groupNameInput?.value.trim();
            
            if (!currentUserName) {
                this.ui.showError('請先輸入您的顯示名稱');
                return;
            }
            
            // 更新當前用戶信息
            this.updateCurrentUser(currentUserName, currentGroupName);
            
            // 檢查 Firebase 會話
            if (!this.firebase.auth?.currentUser) {
                this.ui.showError('Firebase 會話未就緒，請稍候或刷新頁面');
                return;
            }
            
            // 獲取城市訪問統計
            const cityVisitStats = await this.firebase.getUserCityVisitStats(this.currentDataIdentifier);
            
            // 尋找匹配城市
            const cityResult = await this.cityService.findMatchingCity(this.currentDataIdentifier, cityVisitStats);
            
            // 獲取故事內容
            let storyData;
            if (cityResult.isUniverseTheme) {
                storyData = {
                    greeting: "Good morning", // [[memory:5363713]]
                    story: "在這無邊的宇宙中，您的意識如星辰般閃耀。今天，讓我們在星際間尋找新的可能性吧！",
                    translationSource: 'original',
                    success: true
                };
            } else {
                const { selectedCity } = cityResult;
                storyData = await this.cityService.fetchStoryFromAPI(
                    selectedCity.name,
                    selectedCity.countryName,
                    selectedCity.countryCode || selectedCity.timezone?.countryCode
                );
            }
            
            // 顯示結果
            this.ui.displayCityResult(cityResult, storyData);
            
            // 渲染地圖
            this.mapService.renderMainResultMap(
                cityResult,
                this.ui.elements.mapContainerDiv,
                this.ui.elements.debugInfoDiv
            );
            
            // 準備記錄數據
            const recordData = this.createRecordData(cityResult, storyData);
            
            // 儲存記錄
            const savedDocId = await this.saveRecord(recordData);
            
            // 顯示早餐按鈕
            this.showBreakfastButton(recordData, savedDocId);
            
            console.log('[EventHandler] 找城市流程完成');
            
        } catch (error) {
            console.error('[EventHandler] 找城市失敗:', error);
            this.ui.showError(`抱歉，尋找城市時發生錯誤：${error.message}`);
        } finally {
            this.isProcessing = false;
            this.ui.setButtonState(this.ui.elements.findCityButton, 'normal');
        }
    }
    
    /**
     * 處理設置用戶名稱
     */
    async handleSetUserName() {
        const userName = this.ui.elements.userNameInput?.value.trim();
        
        if (!userName) {
            alert('請輸入有效的顯示名稱');
            return;
        }
        
        try {
            this.updateCurrentUser(userName);
            
            // 顯示最後記錄
            await this.displayLastRecord();
            
            // 更新組別過濾器
            await this.updateGroupFilter();
            
            this.ui.showSuccess(`用戶名稱已設置為：${userName}`);
            
        } catch (error) {
            console.error('[EventHandler] 設置用戶名稱失敗:', error);
            this.ui.showError(`設置用戶名稱失敗：${error.message}`);
        }
    }
    
    /**
     * 處理載入歷史記錄
     */
    async handleLoadHistory() {
        if (!this.currentDataIdentifier) {
            this.ui.showError('請先設置用戶名稱', this.ui.elements.historyListUl);
            return;
        }
        
        try {
            this.ui.showLoading('載入歷史記錄中...', this.ui.elements.historyListUl);
            
            const records = await this.firebase.getUserHistory(this.currentDataIdentifier, 50);
            
            // 過濾組別
            const filteredRecords = this.filterRecordsByGroup(records);
            
            // 更新歷史列表
            this.ui.updateHistoryList(filteredRecords);
            
            // 渲染歷史地圖
            if (filteredRecords.length > 0) {
                const mapPoints = this.convertRecordsToMapPoints(filteredRecords);
                this.mapService.renderHistoryMap(
                    mapPoints,
                    this.ui.elements.historyMapContainerDiv,
                    this.ui.elements.historyDebugInfoDiv,
                    '歷史軌跡'
                );
            }
            
            console.log(`[EventHandler] 載入了 ${filteredRecords.length} 筆歷史記錄`);
            
        } catch (error) {
            console.error('[EventHandler] 載入歷史記錄失敗:', error);
            this.ui.showError(`載入歷史記錄失敗：${error.message}`, this.ui.elements.historyListUl);
        }
    }
    
    /**
     * 處理載入全域地圖
     */
    async handleLoadGlobalMap() {
        try {
            const dateInput = this.ui.elements.globalDateInput;
            const targetDate = dateInput?.value || null;
            
            this.ui.showLoading('載入全域地圖中...', this.ui.elements.globalTodayMapContainerDiv);
            
            const records = await this.firebase.getGlobalDailyRecords(targetDate);
            
            if (records.length > 0) {
                const mapPoints = this.convertRecordsToMapPoints(records);
                this.mapService.renderGlobalMap(
                    mapPoints,
                    this.ui.elements.globalTodayMapContainerDiv,
                    this.ui.elements.globalTodayDebugInfoDiv,
                    `全域地圖 (${targetDate || '今日'})`
                );
            } else {
                this.ui.elements.globalTodayMapContainerDiv.innerHTML = '<p>當日暫無全域記錄</p>';
            }
            
            console.log(`[EventHandler] 載入了 ${records.length} 筆全域記錄`);
            
        } catch (error) {
            console.error('[EventHandler] 載入全域地圖失敗:', error);
            this.ui.showError(`載入全域地圖失敗：${error.message}`, this.ui.elements.globalTodayMapContainerDiv);
        }
    }
    
    /**
     * 處理分頁切換
     */
    handleTabSwitch(tabName) {
        if (typeof window.openTab === 'function') {
            window.openTab(null, tabName);
        }
        console.log(`[EventHandler] 切換到分頁: ${tabName}`);
    }
    
    /**
     * 處理組別過濾器變更
     */
    async handleGroupFilterChange(selectedGroup) {
        console.log(`[EventHandler] 組別過濾器變更: ${selectedGroup || '所有組別'}`);
        
        // 重新載入歷史記錄
        await this.handleLoadHistory();
    }
    
    /**
     * 更新當前用戶信息
     */
    updateCurrentUser(userName, groupName = '') {
        this.currentUserName = userName;
        this.currentGroupName = groupName;
        this.currentDataIdentifier = Utils.sanitizeNameToFirestoreId(userName);
        
        // 更新 UI 顯示
        this.ui.updateUserDisplay(userName, groupName);
        
        console.log(`[EventHandler] 用戶信息已更新: ${userName} [${groupName || '無組別'}]`);
    }
    
    /**
     * 顯示最後記錄
     */
    async displayLastRecord() {
        try {
            const lastRecord = await this.firebase.getUserLastRecord(this.currentDataIdentifier);
            
            if (lastRecord) {
                // 創建城市結果數據
                const cityData = {
                    selectedCity: {
                        name: lastRecord.city,
                        countryName: lastRecord.country,
                        name_zh: lastRecord.city_zh,
                        countryName_zh: lastRecord.country_zh,
                        lat: lastRecord.latitude,
                        lng: lastRecord.longitude,
                        countryCode: lastRecord.timezone?.countryCode
                    },
                    isUniverseTheme: lastRecord.isUniverseTheme || false,
                    latitudeDescription: lastRecord.latitudeDescription || '',
                    // 添加缺少的屬性以避免 updateDebugInfo 錯誤
                    userLocalDate: lastRecord.recordedAt ? lastRecord.recordedAt.toDate() : new Date(),
                    requestBody: {
                        targetUTCOffset: lastRecord.targetUTCOffset || 0
                    }
                };
                
                const storyData = {
                    greeting: lastRecord.greeting || '',
                    story: lastRecord.story || '',
                    translationSource: 'original'
                };
                
                // 顯示結果
                this.ui.displayCityResult(cityData, storyData);
                
                // 渲染地圖
                this.mapService.renderMainResultMap(
                    cityData,
                    this.ui.elements.mapContainerDiv,
                    this.ui.elements.debugInfoDiv
                );
                
                // 處理早餐圖片
                if (lastRecord.imageUrl) {
                    const cityDisplayName = lastRecord.city_zh || lastRecord.city;
                    this.ui.showBreakfastImage(lastRecord.imageUrl, cityDisplayName, lastRecord.isUniverseTheme);
                } else {
                    // 顯示早餐按鈕
                    this.showBreakfastButton(lastRecord, null); // 沒有記錄ID，因為是顯示現有記錄
                }
                
            } else {
                this.ui.showWelcomeMessage(this.currentUserName);
            }
            
        } catch (error) {
            console.error('[EventHandler] 顯示最後記錄失敗:', error);
            this.ui.showWelcomeMessage(this.currentUserName);
        }
    }
    
    /**
     * 儲存記錄
     */
    async saveRecord(recordData) {
        try {
            // 儲存個人歷史記錄
            const docId = await this.firebase.saveHistoryRecord(recordData, this.currentDataIdentifier);
            
            // 儲存全域記錄
            await this.firebase.saveToGlobalDailyRecord({
                ...recordData,
                dataIdentifier: this.currentDataIdentifier,
                userDisplayName: this.currentUserName,
                groupName: this.currentGroupName
            });
            
            console.log('[EventHandler] 記錄儲存完成:', docId);
            return docId;
            
        } catch (error) {
            console.error('[EventHandler] 儲存記錄失敗:', error);
            throw error;
        }
    }
    
    /**
     * 創建記錄數據
     */
    createRecordData(cityResult, storyData) {
        const { selectedCity, requestBody, userLocalDate, latitudeDescription, isUniverseTheme } = cityResult;
        
        return {
            city: selectedCity.name,
            country: selectedCity.countryName,
            city_zh: selectedCity.name_zh || selectedCity.name,
            country_zh: selectedCity.countryName_zh || selectedCity.countryName,
            latitude: selectedCity.lat,
            longitude: selectedCity.lng,
            targetUTCOffset: requestBody.targetUTCOffset,
            timezone: selectedCity.timezone,
            greeting: storyData.greeting,
            story: storyData.story,
            translationSource: storyData.translationSource,
            userLocalTime: userLocalDate.toLocaleTimeString('en-US', { hour12: false }),
            targetLatitude: requestBody.targetLatitude || 0,
            latitudeDescription: latitudeDescription,
            isUniverseTheme: isUniverseTheme,
            groupName: this.currentGroupName
        };
    }
    
    /**
     * 顯示早餐按鈕
     */
    showBreakfastButton(recordData, recordId) {
        const cityDisplayName = recordData.city_zh || recordData.city;
        
        this.ui.showBreakfastButton(recordData, cityDisplayName, async () => {
            await this.handleGenerateBreakfast(recordData, cityDisplayName, recordId);
        });
    }
    
    /**
     * 處理生成早餐圖片
     */
    async handleGenerateBreakfast(recordData, cityDisplayName, recordId) {
        try {
            this.ui.showLoading('正在生成早餐圖片，請稍候...');
            
            const imageData = await this.cityService.generateBreakfastImage(recordData, cityDisplayName, recordId);
            
            // 顯示圖片
            this.ui.showBreakfastImage(imageData.imageUrl, cityDisplayName, recordData.isUniverseTheme);
            
            // 更新 Firebase 記錄
            if (recordId) {
                await this.firebase.updateRecord(this.currentDataIdentifier, recordId, {
                    imageUrl: imageData.imageUrl
                });
            }
            
            console.log('[EventHandler] 早餐圖片生成完成');
            
        } catch (error) {
            console.error('[EventHandler] 生成早餐圖片失敗:', error);
            this.ui.showError(`生成早餐圖片失敗：${error.message}`);
        }
    }
    
    /**
     * 更新組別過濾器
     */
    async updateGroupFilter() {
        try {
            const records = await this.firebase.getUserHistory(this.currentDataIdentifier, 100);
            const groups = [...new Set(records.filter(r => r.groupName).map(r => r.groupName))];
            
            this.ui.updateGroupFilter(groups);
            
        } catch (error) {
            console.error('[EventHandler] 更新組別過濾器失敗:', error);
        }
    }
    
    /**
     * 按組別過濾記錄
     */
    filterRecordsByGroup(records) {
        const selectedGroup = this.ui.elements.groupFilterSelect?.value;
        
        if (!selectedGroup) {
            return records;
        }
        
        return records.filter(record => record.groupName === selectedGroup);
    }
    
    /**
     * 轉換記錄為地圖點
     */
    convertRecordsToMapPoints(records) {
        return records.map(record => ({
            lat: record.latitude,
            lon: record.longitude,
            city: record.city,
            country: record.country,
            city_zh: record.city_zh,
            country_zh: record.country_zh,
            story: record.story,
            time: record.recordedAt ? record.recordedAt.toDate().toLocaleString('zh-TW') : '未知時間',
            timestamp: record.recordedAt ? record.recordedAt.toDate().getTime() : Date.now(),
            userDisplayName: record.userDisplayName || '未知用戶'
        }));
    }
}

/**
 * UI 管理模組
 * 處理所有用戶介面相關的操作
 */

import { Utils } from './utils.js';
import { TimeCalculator } from './time-calculator.js';

export class UIManager {
    constructor() {
        this.elements = {};
        this.eventListeners = new Map();
        this.initializeElements();
    }
    
    /**
     * 初始化 DOM 元素引用
     */
    initializeElements() {
        this.elements = {
            findCityButton: document.getElementById('findCityButton'),
            resultTextDiv: document.getElementById('resultText'),
            countryFlagImg: document.getElementById('countryFlag'),
            mapContainerDiv: document.getElementById('mapContainer'),
            debugInfoDiv: document.getElementById('debugInfo'),
            userNameInput: document.getElementById('userName'),
            setUserNameButton: document.getElementById('setUserNameButton'),
            currentUserIdSpan: document.getElementById('currentUserId'),
            currentUserDisplayNameSpan: document.getElementById('currentUserDisplayName'),
            historyListUl: document.getElementById('historyList'),
            historyMapContainerDiv: document.getElementById('historyMapContainer'),
            historyDebugInfoDiv: document.getElementById('historyDebugInfo'),
            refreshHistoryButton: document.getElementById('refreshHistoryButton'),
            globalDateInput: document.getElementById('globalDate'),
            refreshGlobalMapButton: document.getElementById('refreshGlobalMapButton'),
            globalTodayMapContainerDiv: document.getElementById('globalTodayMapContainer'),
            globalTodayDebugInfoDiv: document.getElementById('globalTodayDebugInfo'),
            groupNameInput: document.getElementById('groupName'),
            currentGroupNameSpan: document.getElementById('currentGroupName'),
            groupFilterSelect: document.getElementById('groupFilter')
        };
        
        console.log('[UIManager] DOM 元素初始化完成');
    }
    
    /**
     * 顯示載入狀態
     */
    showLoading(message = '載入中...', targetElement = null) {
        const element = targetElement || this.elements.resultTextDiv;
        if (element) {
            element.innerHTML = `<p><i class="loading-icon">⏳</i> ${message}</p>`;
        }
    }
    
    /**
     * 顯示錯誤訊息
     */
    showError(message, targetElement = null) {
        const element = targetElement || this.elements.resultTextDiv;
        if (element) {
            element.innerHTML = `<p style="color: red;">❌ ${message}</p>`;
        }
    }
    
    /**
     * 顯示成功訊息
     */
    showSuccess(message, targetElement = null) {
        const element = targetElement || this.elements.resultTextDiv;
        if (element) {
            element.innerHTML = `<p style="color: green;">✅ ${message}</p>`;
        }
    }
    
    /**
     * 顯示歡迎訊息
     */
    showWelcomeMessage(userName) {
        if (this.elements.resultTextDiv) {
            this.elements.resultTextDiv.innerHTML = `
                <p>歡迎，${userName}！此名稱尚無歷史記錄。</p>
                <p>按下「我在哪裡甦醒？」按鈕，開始您的主觀時間之旅吧！</p>
            `;
        }
    }
    
    /**
     * 更新用戶顯示信息
     */
    updateUserDisplay(userName, groupName = '') {
        if (this.elements.currentUserIdSpan) {
            this.elements.currentUserIdSpan.textContent = userName;
        }
        
        if (this.elements.currentUserDisplayNameSpan) {
            this.elements.currentUserDisplayNameSpan.textContent = userName;
        }
        
        if (this.elements.currentGroupNameSpan) {
            this.elements.currentGroupNameSpan.textContent = groupName ? `[${groupName}]` : '';
        }
    }
    
    /**
     * 顯示城市結果
     */
    displayCityResult(cityData, storyData) {
        const { selectedCity, isUniverseTheme, latitudeDescription } = cityData;
        
        let resultHTML = '';
        
        if (isUniverseTheme) {
            resultHTML = this.createUniverseResultHTML(storyData);
        } else {
            resultHTML = this.createCityResultHTML(selectedCity, storyData, latitudeDescription);
        }
        
        if (this.elements.resultTextDiv) {
            this.elements.resultTextDiv.innerHTML = resultHTML;
        }
        
        // 更新國家國旗
        this.updateCountryFlag(selectedCity, isUniverseTheme);
    }
    
    /**
     * 創建城市結果 HTML
     */
    createCityResultHTML(selectedCity, storyData, latitudeDescription) {
        const chineseCityName = selectedCity.name_zh || selectedCity.name;
        const chineseCountryName = selectedCity.countryName_zh || selectedCity.countryName;
        const translationSource = Utils.getTranslationSourceText(storyData.translationSource);
        
        return `
            <div class="result-content">
                <h2 style="color: #2c3e50; margin-bottom: 15px;">
                    🌅 您在 <span style="color: #e74c3c;">${chineseCityName}, ${chineseCountryName}</span> 甦醒了
                </h2>
                <div class="greeting-section" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h3 style="color: #495057; margin: 0 0 10px 0;">問候</h3>
                    <p style="font-size: 1.1em; color: #212529; margin: 0;">${storyData.greeting}</p>
                </div>
                <div class="story-section" style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h3 style="color: #1976d2; margin: 0 0 10px 0;">今日故事</h3>
                    <p style="line-height: 1.6; color: #424242; margin: 0;">${storyData.story}</p>
                    <small style="color: #666; font-style: italic;">內容來源: ${translationSource}</small>
                </div>
                <div class="info-section" style="background: #f1f8e9; padding: 10px; border-radius: 8px; font-size: 0.9em;">
                    <p style="margin: 0; color: #558b2f;">
                        <strong>緯度偏好:</strong> ${latitudeDescription}<br>
                        <strong>人口:</strong> ${selectedCity.population ? selectedCity.population.toLocaleString() : '未知'}
                    </p>
                </div>
            </div>
        `;
    }
    
    /**
     * 創建宇宙結果 HTML
     */
    createUniverseResultHTML(storyData) {
        return `
            <div class="universe-result-content" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; text-align: center;">
                <h2 style="color: #ffffff; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                    🌌 您在宇宙深處甦醒了
                </h2>
                <div class="cosmic-greeting" style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                    <h3 style="color: #e3f2fd; margin: 0 0 10px 0;">宇宙問候</h3>
                    <p style="font-size: 1.1em; margin: 0;">${storyData.greeting}</p>
                </div>
                <div class="cosmic-story" style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
                    <h3 style="color: #e3f2fd; margin: 0 0 10px 0;">星際故事</h3>
                    <p style="line-height: 1.6; margin: 0;">${storyData.story}</p>
                </div>
                <div style="margin-top: 15px; font-size: 0.9em; opacity: 0.8;">
                    ✨ 在這個特殊時刻，您的意識超越了地理的界限
                </div>
            </div>
        `;
    }
    
    /**
     * 更新國家國旗
     */
    updateCountryFlag(selectedCity, isUniverseTheme = false) {
        if (!this.elements.countryFlagImg) return;
        
        if (isUniverseTheme) {
            this.elements.countryFlagImg.style.display = 'none';
        } else {
            const countryCode = selectedCity.countryCode || selectedCity.timezone?.countryCode;
            if (countryCode && countryCode !== 'SPACE') {
                this.elements.countryFlagImg.src = `https://flagsapi.com/${countryCode}/flat/64.png`;
                this.elements.countryFlagImg.alt = `${selectedCity.countryName} 國旗`;
                this.elements.countryFlagImg.style.display = 'inline-block';
            } else {
                this.elements.countryFlagImg.style.display = 'none';
            }
        }
    }
    
    /**
     * 顯示早餐按鈕
     */
    showBreakfastButton(recordData, cityDisplayName, onClickCallback) {
        // 移除現有的早餐相關內容
        this.removeBreakfastContent();
        
        const breakfastContainer = document.createElement('div');
        breakfastContainer.id = 'breakfastButtonContainer';
        breakfastContainer.style.cssText = `
            margin-top: 20px;
            text-align: center;
            padding: 15px;
            background: #fff3cd;
            border-radius: 8px;
            border: 1px solid #ffeaa7;
        `;
        
        const displayName = recordData.isUniverseTheme ? '星際早餐' : `${cityDisplayName}的早餐`;
        const themeColor = recordData.isUniverseTheme ? '#6c5ce7' : '#fd79a8';
        
        breakfastContainer.innerHTML = `
            <button id="generateBreakfastBtn" style="
                background: ${themeColor};
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 25px;
                font-size: 1em;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-bottom: 10px;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                🍳 生成${displayName}
            </button>
            <div id="breakfastStatus" style="color: #856404; font-size: 0.9em;">
                <em>點擊按鈕生成專屬的早餐圖片</em>
            </div>
        `;
        
        // 插入到適當位置
        const debugInfo = this.elements.debugInfoDiv;
        if (debugInfo && debugInfo.parentNode) {
            debugInfo.parentNode.insertBefore(breakfastContainer, debugInfo);
        }
        
        // 綁定點擊事件
        const breakfastBtn = document.getElementById('generateBreakfastBtn');
        if (breakfastBtn && onClickCallback) {
            breakfastBtn.addEventListener('click', onClickCallback);
        }
    }
    
    /**
     * 顯示早餐圖片
     */
    showBreakfastImage(imageUrl, cityDisplayName, isUniverseTheme = false) {
        // 隱藏按鈕容器
        const buttonContainer = document.getElementById('breakfastButtonContainer');
        if (buttonContainer) {
            buttonContainer.style.display = 'none';
        }
        
        const breakfastContainer = document.createElement('div');
        breakfastContainer.id = 'breakfastImageContainer';
        breakfastContainer.style.cssText = `
            margin-top: 20px;
            text-align: center;
        `;
        
        const displayName = isUniverseTheme ? '星際早餐' : `${cityDisplayName}的早餐`;
        
        breakfastContainer.innerHTML = `
            <div class="postcard-image-container">
                <img src="${imageUrl}" alt="${displayName}" 
                     style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"
                     onerror="window.handleImageLoadError && window.handleImageLoadError(this, '${recordId}', '${userIdentifier}', '${cityDisplayName}')">
                <p style="font-size: 0.9em; color: #555; margin-top: 10px;">
                    <em>今日的${displayName}</em>
                </p>
            </div>
        `;
        
        // 插入圖片容器
        const debugInfo = this.elements.debugInfoDiv;
        if (debugInfo && debugInfo.parentNode) {
            debugInfo.parentNode.insertBefore(breakfastContainer, debugInfo);
        }
    }
    
    /**
     * 移除早餐相關內容
     */
    removeBreakfastContent() {
        ['#breakfastButtonContainer', '#breakfastImageContainer'].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.remove();
            }
        });
    }
    
    /**
     * 清除先前結果
     */
    clearPreviousResults() {
        if (this.elements.resultTextDiv) {
            this.elements.resultTextDiv.innerHTML = "";
        }
        
        if (this.elements.countryFlagImg) {
            this.elements.countryFlagImg.src = "";
            this.elements.countryFlagImg.alt = "國家國旗";
            this.elements.countryFlagImg.style.display = 'none';
        }
        
        if (this.elements.mapContainerDiv) {
            this.elements.mapContainerDiv.innerHTML = "";
            this.elements.mapContainerDiv.classList.remove('universe-message');
        }
        
        if (this.elements.debugInfoDiv) {
            this.elements.debugInfoDiv.innerHTML = "";
        }
        
        // 清除早餐相關內容
        this.removeBreakfastContent();
    }
    
    /**
     * 更新歷史列表
     */
    updateHistoryList(records) {
        if (!this.elements.historyListUl) return;
        
        this.elements.historyListUl.innerHTML = '';
        
        if (!records || records.length === 0) {
            this.elements.historyListUl.innerHTML = '<li>暫無歷史記錄</li>';
            return;
        }
        
        records.forEach((record, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'history-item';
            listItem.style.cssText = `
                padding: 10px;
                margin-bottom: 5px;
                background: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'};
                border-radius: 5px;
                border-left: 4px solid #007bff;
                cursor: pointer;
                transition: background-color 0.2s;
            `;
            
            const cityName = record.city_zh || record.city || '未知城市';
            const countryName = record.country_zh || record.country || '未知國家';
            const recordTime = record.recordedAt ? 
                TimeCalculator.formatDateTime(record.recordedAt.toDate()) : 
                '未知時間';
            
            listItem.innerHTML = `
                <div style="font-weight: bold; color: #495057;">${cityName}, ${countryName}</div>
                <div style="font-size: 0.9em; color: #6c757d;">${recordTime}</div>
                ${record.groupName ? `<div style="font-size: 0.8em; color: #28a745;">[${record.groupName}]</div>` : ''}
            `;
            
            // 添加懸停效果
            listItem.addEventListener('mouseenter', () => {
                listItem.style.backgroundColor = '#e3f2fd';
            });
            
            listItem.addEventListener('mouseleave', () => {
                listItem.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
            });
            
            this.elements.historyListUl.appendChild(listItem);
        });
    }
    
    /**
     * 更新組別過濾器
     */
    updateGroupFilter(groups) {
        if (!this.elements.groupFilterSelect) return;
        
        this.elements.groupFilterSelect.innerHTML = '<option value="">所有組別</option>';
        
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            this.elements.groupFilterSelect.appendChild(option);
        });
    }
    
    /**
     * 設置按鈕狀態
     */
    setButtonState(buttonElement, state) {
        if (!buttonElement) return;
        
        switch (state) {
            case 'loading':
                buttonElement.disabled = true;
                buttonElement.style.opacity = '0.6';
                buttonElement.style.cursor = 'not-allowed';
                break;
            case 'normal':
                buttonElement.disabled = false;
                buttonElement.style.opacity = '1';
                buttonElement.style.cursor = 'pointer';
                break;
            case 'error':
                buttonElement.disabled = false;
                buttonElement.style.opacity = '1';
                buttonElement.style.cursor = 'pointer';
                buttonElement.style.backgroundColor = '#dc3545';
                break;
        }
    }
    
    /**
     * 添加事件監聽器
     */
    addEventListener(element, event, handler) {
        if (!element) return;
        
        element.addEventListener(event, handler);
        
        // 儲存以便後續清理
        const key = `${element.id || 'unknown'}_${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        this.eventListeners.get(key).push({ element, event, handler });
    }
    
    /**
     * 清理事件監聽器
     */
    cleanup() {
        this.eventListeners.forEach(listeners => {
            listeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        this.eventListeners.clear();
    }
}

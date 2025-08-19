/**
 * 主應用程式類
 * 統籌管理所有模組的初始化和協調
 */

import { Config } from './config.js';
import { Utils } from './utils.js';
import { TimeCalculator } from './time-calculator.js';
import { FirebaseService } from './firebase-service.js';
import { CityService } from './city-service.js';
import { MapService } from './map-service.js';
import { UIManager } from './ui-manager.js';
import { EventHandler } from './event-handler.js';

export class SubjectiveClockApp {
    constructor() {
        this.initialized = false;
        this.services = {};
        this.startTime = Date.now();
        
        console.log('[SubjectiveClockApp] 應用程式實例已創建');
    }
    
    /**
     * 初始化應用程式
     */
    async initialize() {
        if (this.initialized) {
            console.log('[SubjectiveClockApp] 應用程式已初始化');
            return;
        }
        
        try {
            console.log('[SubjectiveClockApp] 開始初始化應用程式...');
            
            // 等待 Firebase 就緒
            await this.waitForFirebaseReady();
            
            // 初始化服務模組
            await this.initializeServices();
            
            // 設置全域函數
            this.setupGlobalFunctions();
            
            // 初始化事件監聽器
            this.initializeEventListeners();
            
            // 初始化 Firebase 認證
            await this.initializeAuth();
            
            // 初始化 Tab 系統
            this.initializeTabSystem();
            
            this.initialized = true;
            
            const initTime = Date.now() - this.startTime;
            console.log(`[SubjectiveClockApp] 應用程式初始化完成 (耗時: ${initTime}ms)`);
            
            // 觸發初始化完成事件
            this.dispatchEvent('app:initialized');
            
        } catch (error) {
            console.error('[SubjectiveClockApp] 應用程式初始化失敗:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }
    
    /**
     * 等待 Firebase 就緒
     */
    async waitForFirebaseReady() {
        return new Promise((resolve) => {
            const checkFirebase = () => {
                if (window.firebaseSDK && window.firebaseConfig) {
                    Config.setFirebaseConfig(window.firebaseConfig);
                    resolve();
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            checkFirebase();
        });
    }
    
    /**
     * 初始化服務模組
     */
    async initializeServices() {
        console.log('[SubjectiveClockApp] 初始化服務模組...');
        
        // 創建服務實例
        this.services.firebase = new FirebaseService();
        this.services.city = new CityService();
        this.services.map = new MapService();
        this.services.ui = new UIManager();
        this.services.events = new EventHandler(
            this.services.ui,
            this.services.firebase,
            this.services.city,
            this.services.map
        );
        
        // 初始化 Firebase 服務
        await this.services.firebase.initialize();
        
        console.log('[SubjectiveClockApp] 服務模組初始化完成');
    }
    
    /**
     * 設置全域函數
     */
    setupGlobalFunctions() {
        // 設置全域應用程式 ID
        window.appId = Config.getAppId();
        
        // 圖片錯誤處理函數
        window.handleImageLoadError = async (imgElement, recordId, userIdentifier, cityName) => {
            console.log(`[Global] 圖片載入失敗，嘗試刷新: ${recordId}`);
            
            if (imgElement.dataset.retryAttempted === 'true') {
                imgElement.parentElement.innerHTML = `
                    <p style="color: #888; font-style: italic;">
                        <em>${cityName}的早餐圖片暫時無法顯示</em><br>
                        <small>圖片可能已過期，請聯繫管理員</small>
                    </p>
                `;
                return;
            }
            
            imgElement.dataset.retryAttempted = 'true';
            
            try {
                const response = await fetch(Config.API_ENDPOINTS.refreshImageUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordId, userIdentifier })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.newImageUrl) {
                        const container = imgElement.parentElement;
                        container.innerHTML = `
                            <div class="postcard-image-container">
                                <img src="${result.newImageUrl}" alt="${cityName}的早餐" style="max-width: 100%; border-radius: 8px;">
                                <p style="font-size: 0.9em; color: #555;"><em>${cityName}的早餐</em></p>
                            </div>
                        `;
                        return;
                    }
                }
                
                throw new Error('刷新圖片 URL 失敗');
                
            } catch (error) {
                console.error('[Global] 刷新圖片 URL 失敗:', error);
                imgElement.parentElement.innerHTML = `
                    <p style="color: #888; font-style: italic;">
                        <em>${cityName}的早餐圖片暫時無法顯示</em><br>
                        <small>修復失敗: ${error.message}</small>
                    </p>
                `;
            }
        };
        
        // Tab 切換函數
        window.openTab = (evt, tabName) => {
            this.switchTab(evt, tabName);
        };
        
        console.log('[SubjectiveClockApp] 全域函數設置完成');
    }
    
    /**
     * 初始化事件監聽器
     */
    initializeEventListeners() {
        this.services.events.initializeEventListeners();
        
        // 設置頁面生命週期事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // 設置錯誤處理
        window.addEventListener('error', (event) => {
            console.error('[SubjectiveClockApp] 全域錯誤:', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[SubjectiveClockApp] 未處理的 Promise 拒絕:', event.reason);
        });
        
        console.log('[SubjectiveClockApp] 事件監聽器設置完成');
    }
    
    /**
     * 初始化 Firebase 認證
     */
    async initializeAuth() {
        try {
            console.log('[SubjectiveClockApp] 初始化 Firebase 認證...');
            
            const user = await this.services.firebase.authenticateUser();
            console.log('[SubjectiveClockApp] 用戶認證成功:', user.uid);
            
            // 觸發認證完成事件
            this.dispatchEvent('auth:ready', { user });
            
        } catch (error) {
            console.error('[SubjectiveClockApp] Firebase 認證失敗:', error);
            throw error;
        }
    }
    
    /**
     * 初始化 Tab 系統
     */
    initializeTabSystem() {
        // 設置預設活動 Tab
        const defaultTab = 'Clock';
        this.switchTab(null, defaultTab);
        
        console.log('[SubjectiveClockApp] Tab 系統初始化完成');
    }
    
    /**
     * Tab 切換邏輯
     */
    switchTab(evt, tabName) {
        // 隱藏所有 tab 內容
        const tabContents = document.getElementsByClassName('tab-content');
        Array.from(tabContents).forEach(content => {
            content.style.display = 'none';
        });
        
        // 移除所有 active 狀態
        const tabButtons = document.getElementsByClassName('tab-button');
        Array.from(tabButtons).forEach(button => {
            button.classList.remove('active');
        });
        
        // 顯示選中的 tab 內容
        const targetContent = document.getElementById(tabName);
        if (targetContent) {
            targetContent.style.display = 'block';
        }
        
        // 設置按鈕為 active 狀態
        if (evt && evt.currentTarget) {
            evt.currentTarget.classList.add('active');
        } else {
            // 如果沒有事件對象，手動找到對應按鈕
            const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
            if (targetButton) {
                targetButton.classList.add('active');
            }
        }
        
        console.log(`[SubjectiveClockApp] 切換到 Tab: ${tabName}`);
        
        // 觸發 Tab 切換事件
        this.dispatchEvent('tab:switched', { tabName });
    }
    
    /**
     * 處理初始化錯誤
     */
    handleInitializationError(error) {
        const errorMessage = `應用程式初始化失敗: ${error.message}`;
        
        // 在主要 UI 區域顯示錯誤
        const resultDiv = document.getElementById('resultText');
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div style="color: #dc3545; padding: 20px; border: 1px solid #dc3545; border-radius: 8px; background: #f8d7da;">
                    <h3>🚫 初始化錯誤</h3>
                    <p>${errorMessage}</p>
                    <button onclick="location.reload()" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        重新載入頁面
                    </button>
                </div>
            `;
        }
        
        // 觸發錯誤事件
        this.dispatchEvent('app:error', { error });
    }
    
    /**
     * 觸發自定義事件
     */
    dispatchEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
        console.log(`[SubjectiveClockApp] 事件觸發: ${eventName}`, data);
    }
    
    /**
     * 獲取服務實例
     */
    getService(serviceName) {
        return this.services[serviceName];
    }
    
    /**
     * 獲取應用程式狀態
     */
    getStatus() {
        return {
            initialized: this.initialized,
            services: Object.keys(this.services),
            startTime: this.startTime,
            uptime: Date.now() - this.startTime
        };
    }
    
    /**
     * 重新初始化
     */
    async reinitialize() {
        console.log('[SubjectiveClockApp] 開始重新初始化...');
        
        this.cleanup();
        this.initialized = false;
        this.startTime = Date.now();
        
        await this.initialize();
    }
    
    /**
     * 清理資源
     */
    cleanup() {
        console.log('[SubjectiveClockApp] 開始清理資源...');
        
        try {
            // 清理服務模組
            if (this.services.ui) {
                this.services.ui.cleanup();
            }
            
            if (this.services.map) {
                this.services.map.cleanup();
            }
            
            // 清理全域函數
            delete window.handleImageLoadError;
            delete window.openTab;
            
            console.log('[SubjectiveClockApp] 資源清理完成');
            
        } catch (error) {
            console.error('[SubjectiveClockApp] 清理資源時發生錯誤:', error);
        }
    }
}

// 全域應用程式實例
window.SubjectiveClockApp = SubjectiveClockApp;

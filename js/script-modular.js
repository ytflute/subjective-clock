/**
 * 主觀時鐘應用程式 - 模組化版本
 * 主入口文件
 * 
 * 這是原 script.js 的模組化重構版本，提供相同的功能但具有更好的代碼組織和可維護性。
 * 
 * 主要改進：
 * - 模組化架構：將功能分解為獨立的模組
 * - 更好的錯誤處理：統一的錯誤處理機制
 * - 可維護性：清晰的代碼結構和職責分離
 * - 可測試性：模組化的設計更易於單元測試
 * - 效能最佳化：懶載入和資源管理
 */

import { SubjectiveClockApp } from './modules/app.js';

// 全域變數
let app = null;

/**
 * 應用程式啟動函數
 */
async function startApp() {
    try {
        console.log('🚀 主觀時鐘應用程式啟動中...');
        
        // 創建應用程式實例
        app = new SubjectiveClockApp();
        
        // 將應用程式實例設為全域可存取
        window.subjectiveClockApp = app;
        
        // 初始化應用程式
        await app.initialize();
        
        console.log('✅ 主觀時鐘應用程式啟動完成！');
        
        // 顯示啟動成功訊息
        showStartupMessage();
        
    } catch (error) {
        console.error('❌ 應用程式啟動失敗:', error);
        showStartupError(error);
    }
}

/**
 * 顯示啟動成功訊息
 */
function showStartupMessage() {
    const status = app.getStatus();
    console.log('📊 應用程式狀態:', status);
    
    // 可選：在開發模式下顯示狀態信息
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            const originalContent = debugInfo.innerHTML;
            debugInfo.innerHTML = `
                <div style="background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.8em;">
                    🟢 模組化應用程式已載入 (${status.uptime}ms)
                    <br>服務模組: ${status.services.join(', ')}
                </div>
                ${originalContent}
            `;
            
            // 3秒後移除狀態訊息
            setTimeout(() => {
                debugInfo.innerHTML = originalContent;
            }, 3000);
        }
    }
}

/**
 * 顯示啟動錯誤
 */
function showStartupError(error) {
    const resultDiv = document.getElementById('resultText');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div style="color: #721c24; background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px;">
                <h3>🚫 應用程式啟動失敗</h3>
                <p><strong>錯誤:</strong> ${error.message}</p>
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #495057;">技術詳情</summary>
                    <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 0.8em; overflow-x: auto;">${error.stack || error.toString()}</pre>
                </details>
                <div style="margin-top: 15px;">
                    <button onclick="location.reload()" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        重新載入
                    </button>
                    <button onclick="startApp()" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        重試啟動
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * 設置全域錯誤處理
 */
function setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('🔥 全域錯誤:', event.error);
        
        // 在生產環境中，可以將錯誤發送到錯誤追蹤服務
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            // 這裡可以添加錯誤報告邏輯，例如發送到 Sentry 或其他錯誤追蹤服務
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('🔥 未處理的 Promise 拒絕:', event.reason);
        event.preventDefault(); // 防止在控制台顯示未處理的錯誤
    });
}

/**
 * 設置開發工具（僅限開發環境）
 */
function setupDevelopmentTools() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // 添加開發工具到全域
        window.devTools = {
            app: () => app,
            status: () => app?.getStatus(),
            reinit: () => app?.reinitialize(),
            services: () => app?.services,
            config: () => app?.getService('firebase')?.getFirebaseConfig?.(),
            
            // 快速測試函數
            testFindCity: async () => {
                const eventHandler = app?.getService('events');
                if (eventHandler) {
                    await eventHandler.handleFindCity();
                }
            },
            
            testLoadHistory: async () => {
                const eventHandler = app?.getService('events');
                if (eventHandler) {
                    await eventHandler.handleLoadHistory();
                }
            }
        };
        
        console.log('🛠️ 開發工具已載入。使用 window.devTools 存取。');
        console.log('📋 可用命令:');
        console.log('  - devTools.app() - 獲取應用程式實例');
        console.log('  - devTools.status() - 獲取應用程式狀態');
        console.log('  - devTools.reinit() - 重新初始化應用程式');
        console.log('  - devTools.testFindCity() - 測試尋找城市功能');
        console.log('  - devTools.testLoadHistory() - 測試載入歷史功能');
    }
}

/**
 * 主初始化邏輯
 */
function initialize() {
    console.log('🌟 主觀時鐘模組化版本初始化開始');
    
    // 設置全域錯誤處理
    setupGlobalErrorHandling();
    
    // 設置開發工具
    setupDevelopmentTools();
    
    // 等待 Firebase 準備就緒
    window.addEventListener('firebaseReady', async (event) => {
        console.log('🔥 Firebase SDK 已就緒，開始啟動應用程式');
        await startApp();
    });
    
    // 如果 Firebase 已經就緒，直接啟動
    if (window.firebaseSDK && window.firebaseConfig) {
        console.log('🔥 Firebase SDK 已存在，直接啟動應用程式');
        startApp();
    }
    
    console.log('⏳ 等待 Firebase SDK 載入...');
}

/**
 * DOMContentLoaded 事件處理
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM 內容已載入');
    
    // 初始化 Tab 按鈕（如果需要在 Firebase 之前設置）
    const tabButtons = document.getElementsByClassName('tab-button');
    if (tabButtons.length > 0) {
        console.log('🔄 初始化 Tab 按鈕');
        
        Array.from(tabButtons).forEach(button => {
            const tabName = button.getAttribute('data-tab');
            if (!tabName) return;
            
            const handleTabClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 如果應用程式已初始化，使用應用程式的 Tab 切換
                if (window.subjectiveClockApp && typeof window.openTab === 'function') {
                    window.openTab(e, tabName);
                } else {
                    // 回退到基本的 Tab 切換
                    console.log(`切換到 Tab: ${tabName} (回退模式)`);
                }
            };
            
            button.addEventListener('click', handleTabClick);
            button.addEventListener('touchstart', handleTabClick, { passive: false });
        });
    }
    
    // 開始初始化
    initialize();
});

/**
 * 頁面卸載時的清理
 */
window.addEventListener('beforeunload', () => {
    if (app) {
        app.cleanup();
    }
});

// 導出給全域使用（如果需要）
window.startApp = startApp;

console.log('📜 主觀時鐘模組化腳本已載入');

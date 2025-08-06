// 🔧 組件載入器 - 動態載入HTML組件
// 用於將分離的HTML組件注入到主頁面中

class ComponentLoader {
    constructor() {
        this.loadedComponents = new Set();
        this.loadingPromises = new Map();
    }
    
    /**
     * 載入單個組件
     * @param {string} componentPath - 組件文件路徑
     * @param {string} targetSelector - 目標容器選擇器
     * @param {boolean} append - 是否追加內容 (false = 替換)
     */
    async loadComponent(componentPath, targetSelector, append = true) {
        const cacheKey = `${componentPath}-${targetSelector}`;
        
        // 防止重複載入
        if (this.loadedComponents.has(cacheKey)) {
            console.log(`📦 組件已載入: ${componentPath}`);
            return true;
        }
        
        // 如果正在載入，返回現有的 Promise
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey);
        }
        
        const loadingPromise = this._doLoadComponent(componentPath, targetSelector, append, cacheKey);
        this.loadingPromises.set(cacheKey, loadingPromise);
        
        return loadingPromise;
    }
    
    async _doLoadComponent(componentPath, targetSelector, append, cacheKey) {
        try {
            console.log(`🔄 開始載入組件: ${componentPath}`);
            
            // 獲取目標容器
            const targetElement = document.querySelector(targetSelector);
            if (!targetElement) {
                throw new Error(`找不到目標容器: ${targetSelector}`);
            }
            
            // 載入組件HTML
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`載入失敗 (${response.status}): ${componentPath}`);
            }
            
            const componentHTML = await response.text();
            
            // 注入HTML內容
            if (append) {
                targetElement.insertAdjacentHTML('beforeend', componentHTML);
            } else {
                targetElement.innerHTML = componentHTML;
            }
            
            // 標記為已載入
            this.loadedComponents.add(cacheKey);
            this.loadingPromises.delete(cacheKey);
            
            console.log(`✅ 組件載入成功: ${componentPath}`);
            
            // 觸發組件載入完成事件
            const event = new CustomEvent('componentLoaded', {
                detail: {
                    path: componentPath,
                    target: targetSelector,
                    cacheKey: cacheKey
                }
            });
            document.dispatchEvent(event);
            
            return true;
            
        } catch (error) {
            console.error(`❌ 組件載入失敗: ${componentPath}`, error);
            this.loadingPromises.delete(cacheKey);
            return false;
        }
    }
    
    /**
     * 批量載入組件
     * @param {Array} components - 組件配置數組 [{path, target, append}]
     */
    async loadComponents(components) {
        console.log(`🚀 開始批量載入 ${components.length} 個組件`);
        
        const loadPromises = components.map(config => {
            const { path, target, append = true } = config;
            return this.loadComponent(path, target, append);
        });
        
        try {
            const results = await Promise.all(loadPromises);
            const successCount = results.filter(result => result === true).length;
            
            console.log(`📊 批量載入完成: ${successCount}/${components.length} 成功`);
            
            // 觸發批量載入完成事件
            const event = new CustomEvent('componentsLoaded', {
                detail: {
                    total: components.length,
                    success: successCount,
                    results: results
                }
            });
            document.dispatchEvent(event);
            
            return results;
            
        } catch (error) {
            console.error('❌ 批量載入失敗:', error);
            return [];
        }
    }
    
    /**
     * 檢查組件是否已載入
     * @param {string} componentPath - 組件路徑
     * @param {string} targetSelector - 目標選擇器
     */
    isLoaded(componentPath, targetSelector) {
        const cacheKey = `${componentPath}-${targetSelector}`;
        return this.loadedComponents.has(cacheKey);
    }
    
    /**
     * 重新載入組件
     * @param {string} componentPath - 組件路徑
     * @param {string} targetSelector - 目標選擇器
     */
    async reloadComponent(componentPath, targetSelector, append = true) {
        const cacheKey = `${componentPath}-${targetSelector}`;
        
        // 清除載入記錄
        this.loadedComponents.delete(cacheKey);
        this.loadingPromises.delete(cacheKey);
        
        // 重新載入
        return this.loadComponent(componentPath, targetSelector, append);
    }
    
    /**
     * 清理所有載入記錄
     */
    clearCache() {
        this.loadedComponents.clear();
        this.loadingPromises.clear();
        console.log('🧹 組件載入器快取已清理');
    }
}

// 全域組件載入器實例
window.componentLoader = new ComponentLoader();

// 便捷函數
window.loadComponent = (path, target, append) => {
    return window.componentLoader.loadComponent(path, target, append);
};

window.loadComponents = (components) => {
    return window.componentLoader.loadComponents(components);
};

console.log('🔧 組件載入器已初始化');

// 頁面載入完成後的自動載入配置
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM載入完成，開始自動載入組件');
    
    // 定義組件配置
    const componentConfigs = [
        {
            path: './components/waiting-state.html',
            target: '.main-display',
            append: true
        },
        {
            path: './components/loading-state.html', 
            target: '.main-display',
            append: true
        },
        {
            path: './components/result-state.html',
            target: '.main-display', 
            append: true
        }
    ];
    
    try {
        // 批量載入所有組件
        const results = await window.componentLoader.loadComponents(componentConfigs);
        
        const successCount = results.filter(r => r).length;
        console.log(`🎉 頁面組件載入完成: ${successCount}/${componentConfigs.length}`);
        
        // 觸發所有組件載入完成事件
        const event = new CustomEvent('allComponentsReady');
        document.dispatchEvent(event);
        
    } catch (error) {
        console.error('❌ 自動載入組件失敗:', error);
    }
});
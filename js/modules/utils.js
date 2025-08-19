/**
 * 工具函數模組
 * 提供常用的工具函數和輔助方法
 */

export class Utils {
    /**
     * 生成安全的 ID
     */
    static generateSafeId(originalName) {
        if (!originalName || typeof originalName !== 'string') {
            return 'unknown';
        }
        
        return originalName
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fff]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50);
    }
    
    /**
     * 清理名稱為 Firestore ID
     */
    static sanitizeNameToFirestoreId(name) {
        if (!name || typeof name !== 'string') {
            return 'user_anonymous';
        }
        
        const trimmedName = name.trim();
        if (trimmedName === '') {
            return 'user_anonymous';
        }
        
        return trimmedName
            .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 30) || 'user_anonymous';
    }
    
    /**
     * 格式化數字為指定小數位數
     */
    static formatNumber(num, decimals = 2) {
        if (typeof num !== 'number' || !isFinite(num)) {
            return 'N/A';
        }
        return num.toFixed(decimals);
    }
    
    /**
     * 安全地獲取巢狀屬性值
     */
    static safeGet(obj, path, defaultValue = null) {
        try {
            return path.split('.').reduce((current, key) => current[key], obj) || defaultValue;
        } catch {
            return defaultValue;
        }
    }
    
    /**
     * 延遲執行
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 防抖函數
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 節流函數
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 獲取翻譯來源文字
     */
    static getTranslationSourceText(source) {
        const sourceMap = {
            'ai_translate': 'AI翻譯',
            'manual_translate': '人工翻譯',
            'original': '原始內容'
        };
        return sourceMap[source] || '未知來源';
    }
    
    /**
     * 檢查是否為移動設備
     */
    static isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    /**
     * 複製文字到剪貼板
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('複製失敗:', err);
            return false;
        }
    }
}

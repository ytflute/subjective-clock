/**
 * 配置管理模組
 * 管理應用程式的全域配置和常數
 */

export class Config {
    static APP_ID = 'default-app-id-worldclock-history';
    static TARGET_LOCAL_HOUR = 8;
    static SPECIAL_TIME_START = { hour: 7, minute: 50 };
    static SPECIAL_TIME_END = { hour: 8, minute: 10 };
    static MAX_LATITUDE = 70;
    static MIN_LATITUDE = -70;
    
    // Firebase 配置
    static FIREBASE_CONFIG = null;
    
    // 地圖配置
    static MAP_CONFIG = {
        defaultZoom: 6,
        maxZoom: 18,
        tileLayerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    };
    
    // API 端點
    static API_ENDPOINTS = {
        findCity: '/api/find-city-geonames',
        generateStory: '/api/generateStory',
        generateImage: '/api/generateImage',
        refreshImageUrl: '/api/refreshImageUrl'
    };
    
    /**
     * 設置 Firebase 配置
     */
    static setFirebaseConfig(config) {
        this.FIREBASE_CONFIG = config;
    }
    
    /**
     * 獲取 Firebase 配置
     */
    static getFirebaseConfig() {
        return this.FIREBASE_CONFIG;
    }
    
    /**
     * 檢查是否為特例時間段 (7:50-8:10)
     */
    static isSpecialTimeRange(date = new Date()) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        
        return (hours === this.SPECIAL_TIME_START.hour && minutes >= this.SPECIAL_TIME_START.minute) ||
               (hours === this.SPECIAL_TIME_END.hour && minutes <= this.SPECIAL_TIME_END.minute);
    }
    
    /**
     * 獲取應用程式 ID
     */
    static getAppId() {
        return window.appId || (typeof __app_id !== 'undefined' ? __app_id : this.APP_ID);
    }
}

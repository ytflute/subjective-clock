/**
 * 時間計算模組
 * 處理時間相關的計算邏輯
 */

import { Config } from './config.js';

export class TimeCalculator {
    /**
     * 基於時間分鐘數計算目標緯度
     */
    static calculateTargetLatitudeFromTime(date = new Date()) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        
        // 檢查是否在特例時間段
        if (Config.isSpecialTimeRange(date)) {
            console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 特例時間段，將使用用戶當地位置`);
            return 'local';
        }
        
        // 修正後的線性映射：避免極地問題
        // 0分=北緯70度，30分≈赤道0度，59分=南緯70度
        const targetLatitude = Config.MAX_LATITUDE - (minutes * (Config.MAX_LATITUDE * 2) / 59);
        
        console.log(`時間: ${hours}:${minutes.toString().padStart(2, '0')} -> 目標緯度: ${targetLatitude.toFixed(2)}度`);
        
        return targetLatitude;
    }
    
    /**
     * 緯度偏好描述
     */
    static getLatitudePreferenceDescription(targetLatitude) {
        if (typeof targetLatitude === 'number') {
            let direction, region;
            
            if (targetLatitude > 0) {
                direction = '北緯';
            } else if (targetLatitude < 0) {
                direction = '南緯';
            } else {
                direction = '赤道';
            }
            
            // 根據緯度範圍描述地理區域
            const absLatitude = Math.abs(targetLatitude);
            if (absLatitude >= 60) {
                region = '極地區域';
            } else if (absLatitude >= 30) {
                region = '溫帶區域';
            } else if (absLatitude >= 23.5) {
                region = '亞熱帶區域';
            } else {
                region = '熱帶區域';
            }
            
            if (targetLatitude === 0) {
                return `${direction} (${region})`;
            } else {
                return `${direction}${Math.abs(targetLatitude).toFixed(1)}度 (${region})`;
            }
        } else if (targetLatitude === 'local') {
            return '當地位置 (特例時間段)';
        } else {
            return '未知偏好';
        }
    }
    
    /**
     * 計算所需的 UTC 偏移
     */
    static calculateRequiredUTCOffset(targetLocalHour = Config.TARGET_LOCAL_HOUR, userDate = new Date()) {
        const userUTCHours = userDate.getUTCHours();
        const userUTCMinutes = userDate.getUTCMinutes();
        const userUTCTime = userUTCHours + userUTCMinutes / 60;
        
        let requiredUTCOffset = targetLocalHour - userUTCTime;
        
        // 調整到有效時區範圍內
        while (requiredUTCOffset > 14) {
            requiredUTCOffset -= 24;
        }
        while (requiredUTCOffset < -12) {
            requiredUTCOffset += 24;
        }
        
        return requiredUTCOffset;
    }
    
    /**
     * 獲取用戶當前位置（Promise-based）
     */
    static async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('瀏覽器不支持地理定位'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }
    
    /**
     * 格式化時間為顯示字符串
     */
    static formatTime(date = new Date(), locale = 'zh-TW') {
        return date.toLocaleTimeString(locale, { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    /**
     * 格式化日期為顯示字符串
     */
    static formatDate(date = new Date(), locale = 'zh-TW') {
        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
    
    /**
     * 格式化日期時間為顯示字符串
     */
    static formatDateTime(date = new Date(), locale = 'zh-TW') {
        return date.toLocaleString(locale);
    }
}

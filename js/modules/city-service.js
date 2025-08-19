/**
 * 城市搜尋服務模組
 * 處理城市搜尋和匹配邏輯
 */

import { Config } from './config.js';
import { Utils } from './utils.js';
import { TimeCalculator } from './time-calculator.js';

export class CityService {
    constructor() {
        this.apiEndpoint = Config.API_ENDPOINTS.findCity;
    }
    
    /**
     * 尋找匹配的城市
     */
    async findMatchingCity(userIdentifier, cityVisitStats = {}) {
        console.log("--- 開始使用 GeoNames API 尋找匹配城市 ---");
        
        try {
            const userLocalDate = new Date();
            const requiredUTCOffset = TimeCalculator.calculateRequiredUTCOffset();
            const targetLatitude = TimeCalculator.calculateTargetLatitudeFromTime();
            
            let requestBody = {
                targetUTCOffset: requiredUTCOffset,
                timeMinutes: userLocalDate.getMinutes(),
                userCityVisitStats: cityVisitStats,
                userLocalTime: userLocalDate.toLocaleTimeString('en-US', { hour12: false })
            };
            
            let latitudeDescription;
            
            // 檢查是否為特例時間段
            if (targetLatitude === 'local') {
                console.log("特例時間段，正在獲取用戶地理位置...");
                latitudeDescription = "當地位置 (7:50-8:10特例時間段)";
                
                try {
                    const position = await TimeCalculator.getUserLocation();
                    const userLatitude = position.coords.latitude;
                    const userLongitude = position.coords.longitude;
                    
                    console.log(`用戶位置：緯度 ${userLatitude.toFixed(4)}°, 經度 ${userLongitude.toFixed(4)}°`);
                    
                    requestBody.useLocalPosition = true;
                    requestBody.userLatitude = userLatitude;
                    requestBody.userLongitude = userLongitude;
                    
                } catch (geoError) {
                    console.warn("無法獲取地理位置，回退到宇宙主題:", geoError.message);
                    return this.createUniverseThemeResult(requestBody, userLocalDate);
                }
            } else {
                // 一般情況
                latitudeDescription = TimeCalculator.getLatitudePreferenceDescription(targetLatitude);
                requestBody.targetLatitude = targetLatitude;
                requestBody.latitudeDescription = latitudeDescription;
            }
            
            console.log("發送請求到 GeoNames API:", requestBody);
            
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "無法解析 API 錯誤回應" }));
                throw new Error(`API 錯誤 ${response.status}: ${errorData.error || '未知錯誤'}`);
            }
            
            const data = await response.json();
            console.log("GeoNames API 回應:", data);
            
            if (!data.success) {
                throw new Error(data.error || '尋找城市失敗');
            }
            
            return this.processApiResponse(data, requestBody, userLocalDate, latitudeDescription);
            
        } catch (error) {
            console.error("使用 GeoNames API 尋找城市時發生錯誤:", error);
            throw error;
        }
    }
    
    /**
     * 處理 API 回應
     */
    processApiResponse(data, requestBody, userLocalDate, latitudeDescription) {
        const matchingCities = data.matchingCities || [];
        
        if (matchingCities.length === 0) {
            return this.createUniverseThemeResult(requestBody, userLocalDate);
        }
        
        const selectedCity = this.selectBestCity(matchingCities, requestBody.userCityVisitStats || {});
        
        return {
            success: true,
            selectedCity,
            requestBody,
            userLocalDate,
            latitudeDescription,
            isUniverseTheme: false
        };
    }
    
    /**
     * 選擇最佳城市
     */
    selectBestCity(matchingCities, cityVisitStats) {
        // 為每個城市添加訪問統計
        const citiesWithStats = matchingCities.map(city => {
            const cityKey = `${city.name}_${city.countryName}`;
            return {
                ...city,
                visitCount: cityVisitStats[cityKey] || 0
            };
        });
        
        // 找出最少訪問次數
        const minVisitCount = Math.min(...citiesWithStats.map(city => city.visitCount));
        
        // 篩選出訪問次數最少的城市
        const leastVisitedCities = citiesWithStats.filter(city => city.visitCount === minVisitCount);
        
        // 從最少訪問的城市中隨機選擇一個
        const selectedCity = leastVisitedCities[Math.floor(Math.random() * leastVisitedCities.length)];
        
        console.log(`選擇城市: ${selectedCity.name}, ${selectedCity.countryName} (訪問 ${selectedCity.visitCount} 次)`);
        
        return selectedCity;
    }
    
    /**
     * 創建宇宙主題結果
     */
    createUniverseThemeResult(requestBody, userLocalDate) {
        console.log("創建宇宙主題結果");
        
        return {
            success: true,
            selectedCity: {
                name: "Unknown Planet",
                countryName: "Cosmic Void",
                name_zh: "未知星球",
                countryName_zh: "宇宙虛空",
                lat: 0,
                lng: 0,
                timezone: {
                    timeZoneId: "UTC",
                    gmtOffset: 0,
                    countryCode: "SPACE"
                },
                population: 0
            },
            requestBody,
            userLocalDate,
            latitudeDescription: "宇宙深處",
            isUniverseTheme: true
        };
    }
    
    /**
     * 獲取故事內容
     */
    async fetchStoryFromAPI(city, country, countryCode) {
        console.log(`[fetchStoryFromAPI] 開始為 ${city}, ${country} 獲取故事`);
        
        try {
            const response = await fetch(Config.API_ENDPOINTS.generateStory, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: city,
                    country: country,
                    countryCode: countryCode
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "無法解析 API 錯誤回應" }));
                throw new Error(`故事 API 錯誤 ${response.status}: ${errorData.error || '未知錯誤'}`);
            }
            
            const data = await response.json();
            console.log(`[fetchStoryFromAPI] 故事 API 回應:`, data);
            
            if (!data.success) {
                throw new Error(data.error || '生成故事失敗');
            }
            
            // 返回包含故事、問候語和翻譯來源的對象
            return {
                greeting: data.greeting || '',
                story: data.story || '',
                translationSource: data.translationSource || 'original',
                success: true
            };
            
        } catch (error) {
            console.error(`[fetchStoryFromAPI] 獲取故事失敗:`, error);
            
            // 返回預設內容
            const defaultGreeting = "Good morning"; // [[memory:5363713]]
            const defaultStory = `您在 ${city}, ${country} 甦醒了。今天將是美好的一天！`;
            
            return {
                greeting: defaultGreeting,
                story: defaultStory,
                translationSource: 'original',
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 生成早餐圖片
     */
    async generateBreakfastImage(recordData, cityDisplayName, recordId) {
        console.log(`[generateBreakfastImage] 開始生成早餐圖片: ${cityDisplayName}`);
        
        try {
            const response = await fetch(Config.API_ENDPOINTS.generateImage, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: recordData.city,
                    country: recordData.country,
                    isUniverseTheme: recordData.isUniverseTheme || false,
                    recordId: recordId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "無法解析 API 錯誤回應" }));
                throw new Error(`圖片 API 錯誤 ${response.status}: ${errorData.error || '未知錯誤'}`);
            }
            
            const imageData = await response.json();
            console.log(`[generateBreakfastImage] 圖片 API 回應:`, imageData);
            
            if (!imageData.success || !imageData.imageUrl) {
                throw new Error('API 沒有返回圖片 URL');
            }
            
            console.log(`[generateBreakfastImage] 圖片生成成功: ${imageData.imageUrl}`);
            return imageData;
            
        } catch (error) {
            console.error('[generateBreakfastImage] 生成早餐圖片失敗:', error);
            throw error;
        }
    }
}

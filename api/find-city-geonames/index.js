import fs from 'fs';
import path from 'path';

// 讀取本地城市資料
let citiesData = [];
try {
    const filePath = path.join(process.cwd(), 'cities_data.json');
    console.log('嘗試讀取檔案:', filePath);
    
    if (!fs.existsSync(filePath)) {
        console.error('找不到 cities_data.json 檔案');
        throw new Error('找不到 cities_data.json 檔案');
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    citiesData = JSON.parse(fileContent);
    console.log(`成功讀取 ${citiesData.length} 個城市資料`);
} catch (error) {
    console.error('讀取 cities_data.json 失敗:', error);
    throw error;
}

// 輔助函數：根據緯度分類
function getLatitudeCategory(latitude) {
    const absLat = Math.abs(latitude);
    if (absLat >= 60) return 'high';
    if (absLat >= 45) return 'mid-high';
    if (absLat >= 30) return 'mid';
    return 'low';
}

// 輔助函數：獲取緯度分類名稱
function getLatitudeCategoryName(category) {
    const categories = {
        'high': '高緯度',
        'mid-high': '中高緯度',
        'mid': '中緯度',
        'low': '低緯度'
    };
    return categories[category] || category;
}

// 輔助函數：計算時區偏移
function calculateTimezoneOffset(longitude) {
    return Math.round(longitude / 15);
}

// 輔助函數：搜尋城市
function searchCities(targetOffset, targetLatitude, latitudePreference) {
    try {
        // 計算目標時區的經度範圍（粗略估算）
        const targetLongitude = targetOffset * 15;
        const longitudeRange = 5; // 經度範圍

        console.log(`搜尋條件: 目標經度=${targetLongitude}, 目標緯度=${targetLatitude}, 緯度偏好=${latitudePreference}`);

        // 過濾符合時區和緯度的城市
        let candidateCities = citiesData.filter(city => {
            try {
                // 檢查經度範圍 - 使用 longitude 而不是 lng
                const longitudeDiff = Math.abs(city.longitude - targetLongitude);
                if (longitudeDiff > longitudeRange) return false;

                // 如果有目標緯度，檢查緯度範圍 - 使用 latitude 而不是 lat
                if (targetLatitude !== null) {
                    const latitudeRange = 3; // 緯度範圍
                    const latitudeDiff = Math.abs(city.latitude - targetLatitude);
                    if (latitudeDiff > latitudeRange) return false;
                }

                // 檢查緯度偏好 - 使用 latitude 而不是 lat
                if (latitudePreference !== 'any') {
                    const category = getLatitudeCategory(city.latitude);
                    const hemisphere = city.latitude >= 0 ? 'north' : 'south';
                    
                    if (latitudePreference.includes('-')) {
                        const [prefCategory, prefHemisphere] = latitudePreference.split('-');
                        if (category !== prefCategory || hemisphere !== prefHemisphere) return false;
                    } else if (category !== latitudePreference) {
                        return false;
                    }
                }

                return true;
            } catch (error) {
                console.error('處理城市資料時發生錯誤:', error, '城市資料:', city);
                return false;
            }
        });

        console.log(`初步過濾後找到 ${candidateCities.length} 個城市`);

        // 移除人口排序，保持原始順序或隨機排序
        // candidateCities.sort((a, b) => b.population - a.population);

        // 只返回前 20 個城市
        const result = candidateCities.slice(0, 20);
        console.log(`最終返回 ${result.length} 個城市`);
        return result;
    } catch (error) {
        console.error('搜尋城市時發生錯誤:', error);
        throw error;
    }
}

export default async function handler(req, res) {
    // 設置 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 處理 OPTIONS 請求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允許 GET 和 POST 請求
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
        return;
    }

    try {
        // 檢查城市資料是否已載入
        if (!citiesData || citiesData.length === 0) {
            throw new Error('城市資料未正確載入');
        }

        let { targetUTCOffset, targetLatitude, latitudePreference, userCityVisitStats, userLocalTime } = req.method === 'GET' ? req.query : req.body;

        console.log('收到請求參數:', {
            targetUTCOffset,
            targetLatitude,
            latitudePreference,
            userLocalTime,
            method: req.method
        });

        // 驗證參數
        const targetOffset = parseFloat(targetUTCOffset);
        if (isNaN(targetOffset)) {
            return res.status(400).json({ 
                error: 'Invalid parameter. targetUTCOffset is required and must be a number.' 
            });
        }

        // 新參數：目標緯度
        let parsedTargetLatitude = null;
        if (targetLatitude !== undefined) {
            parsedTargetLatitude = parseFloat(targetLatitude);
            if (isNaN(parsedTargetLatitude) || parsedTargetLatitude < -90 || parsedTargetLatitude > 90) {
                return res.status(400).json({ 
                    error: 'Invalid targetLatitude. Must be between -90 and 90.' 
                });
            }
        }

        // 解析用戶城市訪問統計
        let cityVisitStats = {};
        if (userCityVisitStats) {
            try {
                cityVisitStats = typeof userCityVisitStats === 'string' ? 
                    JSON.parse(userCityVisitStats) : userCityVisitStats;
            } catch (e) {
                console.warn('解析用戶城市訪問統計失敗:', e);
                cityVisitStats = {};
            }
        }

        // 預設值
        latitudePreference = latitudePreference || 'any';

        console.log(`收到請求 - 目標偏移: ${targetOffset}, 目標緯度: ${parsedTargetLatitude}, 緯度偏好: ${latitudePreference}`);
        console.log(`用戶城市訪問統計:`, cityVisitStats);

        // 檢查用戶當地時間是否在7:55-8:05區間
        let isLocalTimeWindow = false;
        if (userLocalTime) {
            const [hours, minutes] = userLocalTime.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes;
            isLocalTimeWindow = (totalMinutes >= 475 && totalMinutes <= 485);
        }

        // 如果不是在指定時間區間，使用本地資料庫搜尋
        if (!isLocalTimeWindow) {
            try {
                // 使用本地資料庫搜尋城市
                const candidateCities = searchCities(targetOffset, parsedTargetLatitude, latitudePreference);
                console.log(`從本地資料庫找到 ${candidateCities.length} 個城市`);

                if (candidateCities.length === 0) {
                    // 如果沒有找到符合的城市，返回特殊的"宇宙"情況
                    return res.status(200).json({
                        isUniverseCase: true,
                        message: '沒有找到符合目標時區的地球城市',
                        targetUTCOffset: targetOffset
                    });
                }

                // 選擇城市
                let selectedCity;
                if (Object.keys(cityVisitStats).length > 0) {
                    // 為每個城市添加訪問次數信息
                    const citiesWithStats = candidateCities.map(city => ({
                        ...city,
                        visitCount: cityVisitStats[city.city] || 0
                    }));

                    // 找出訪問次數最少的次數
                    const minVisitCount = Math.min(...citiesWithStats.map(city => city.visitCount));
                    
                    // 篩選出訪問次數最少的城市
                    const leastVisitedCities = citiesWithStats.filter(city => city.visitCount === minVisitCount);

                    // 在訪問次數最少的城市中隨機選擇
                    const randomIndex = Math.floor(Math.random() * leastVisitedCities.length);
                    selectedCity = leastVisitedCities[randomIndex];
                } else {
                    // 如果沒有訪問歷史，隨機選擇城市
                    const randomIndex = Math.floor(Math.random() * candidateCities.length);
                    selectedCity = candidateCities[randomIndex];
                }

                console.log(`選擇城市: ${selectedCity.city} (${selectedCity.latitude}, ${selectedCity.longitude}) [${getLatitudeCategory(selectedCity.latitude)}緯度]`);

                // 直接返回城市資料
                const cityData = {
                    name: selectedCity.city,
                    name_zh: selectedCity.city_zh,
                    city: selectedCity.city,
                    city_zh: selectedCity.city_zh,
                    country: selectedCity.country,
                    country_zh: selectedCity.country_zh,
                    country_iso_code: selectedCity.country_iso_code,
                    lat: selectedCity.latitude,
                    lng: selectedCity.longitude,
                    latitude: selectedCity.latitude,
                    longitude: selectedCity.longitude,
                    population: selectedCity.population,
                    timezoneOffset: calculateTimezoneOffset(selectedCity.longitude),
                    timezone: {
                        timeZoneId: selectedCity.timezone || 'UTC',
                        dstOffset: 0,
                        gmtOffset: calculateTimezoneOffset(selectedCity.longitude) * 3600,
                        countryCode: selectedCity.country_iso_code || '',
                        countryName: selectedCity.country,
                        countryName_zh: selectedCity.country_zh
                    },
                    source: 'local_database',
                    latitudeCategory: getLatitudeCategoryName(getLatitudeCategory(selectedCity.latitude)),
                    latitudePreference: latitudePreference
                };

                console.log('返回的城市資料:', cityData);
                return res.status(200).json(cityData);

            } catch (error) {
                console.error('搜尋城市失敗:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: error.message || '搜尋城市時發生錯誤',
                    details: error.stack
                });
            }
        }
    } catch (error) {
        console.error('處理請求時發生錯誤:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message || '處理請求時發生錯誤',
            details: error.stack
        });
    }
} 
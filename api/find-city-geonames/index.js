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
        let { targetUTCOffset, targetLatitude, latitudePreference, userCityVisitStats, userLocalTime } = req.method === 'GET' ? req.query : req.body;

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

        // 如果不是在指定時間區間，使用動態搜尋邏輯
        if (!isLocalTimeWindow) {
            // GeoNames 用戶名
            const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'demo';

            try {
                // 使用 GeoNames 搜尋 API 獲取城市列表
                const candidateCities = await searchGeoNamesCities(targetOffset, parsedTargetLatitude, GEONAMES_USERNAME);
                console.log(`從 GeoNames 找到 ${candidateCities.length} 個城市`);

                if (candidateCities.length === 0) {
                    // 如果沒有找到符合的城市，返回特殊的"宇宙"情況
                    return res.status(200).json({
                        isUniverseCase: true,
                        message: '沒有找到符合目標時區的地球城市',
                        targetUTCOffset: targetOffset
                    });
                }

                // 直接選擇人口最多的城市
                const selectedCity = candidateCities[0];

                console.log(`選擇城市: ${selectedCity.name} (${selectedCity.lat}, ${selectedCity.lng}) [${selectedCity.category}緯度] - 人口: ${selectedCity.population}`);

                // 使用我們自己的 GeoNames 端點來獲取詳細資訊
                const geonamesUrl = `${req.headers.origin || 'http://localhost:3000'}/api/geonames-timezone`;
                const geonamesResponse = await fetch(geonamesUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        latitude: selectedCity.lat,
                        longitude: selectedCity.lng,
                        targetUTCOffset: targetOffset
                    })
                });

                if (!geonamesResponse.ok) {
                    throw new Error(`GeoNames API 調用失敗: ${geonamesResponse.status}`);
                }

                const cityData = await geonamesResponse.json();

                // 添加額外資訊
                cityData.population = selectedCity.population;
                cityData.source = 'geonames_search';
                cityData.latitudeCategory = getLatitudeCategoryName(selectedCity.category);
                cityData.latitudePreference = latitudePreference;

                return res.status(200).json(cityData);

            } catch (error) {
                console.error('GeoNames 搜尋失敗:', error);
                // 如果 GeoNames 搜尋失敗，回退到預定義城市列表
                console.log('回退到預定義城市列表');
                // ... existing fallback code with predefined cities ...
            }
        }
    } catch (error) {
        console.error('處理請求時發生錯誤:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// 輔助函數：根據緯度獲取分類
function getLatitudeCategory(latitude) {
    const absLat = Math.abs(latitude);
    if (absLat >= 60) return 'high';
    if (absLat >= 45) return 'mid-high';
    if (absLat >= 30) return 'mid';
    return 'low';
}

// 輔助函數：獲取緯度分類名稱
function getLatitudeCategoryName(category) {
    const names = {
        'high': '高緯度',
        'mid-high': '中高緯度',
        'mid': '中緯度',
        'low': '低緯度'
    };
    return names[category] || category;
}

// 輔助函數：搜尋 GeoNames 城市
async function searchGeoNamesCities(targetOffset, targetLatitude, username) {
    // 計算目標時區的經度範圍（粗略估算）
    const targetLongitude = targetOffset * 15;
    const longitudeRange = 5; // 減少經度範圍

    // 構建 GeoNames 搜尋 URL
    const searchUrl = `http://api.geonames.org/searchJSON?` +
        `username=${username}` +
        `&featureClass=P` + // 只搜尋城市、村莊等人口聚集地
        `&style=full` +
        `&maxRows=20` + // 大幅減少返回結果數量
        `&orderby=population` + // 按人口排序
        `&isNameRequired=true` + // 必須有名字
        `&cities=cities10000` + // 只搜尋人口超過10000的城市
        `&style=full`;

    // 如果有目標緯度，添加緯度範圍
    if (targetLatitude !== null) {
        const latitudeRange = 3; // 減少緯度範圍
        searchUrl += `&north=${targetLatitude + latitudeRange}` +
            `&south=${targetLatitude - latitudeRange}` +
            `&east=${targetLongitude + longitudeRange}` +
            `&west=${targetLongitude - longitudeRange}`;
    }

    console.log(`呼叫 GeoNames Search API: ${searchUrl}`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超時

        const searchResponse = await fetch(searchUrl, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!searchResponse.ok) {
            throw new Error(`GeoNames Search API failed: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        
        if (searchData.status) {
            throw new Error(`GeoNames Search API error: ${searchData.status.message}`);
        }

        // 過濾掉人口太少的城市
        const minPopulation = 50000; // 提高最小人口數
        const filteredCities = searchData.geonames.filter(city => 
            parseInt(city.population) >= minPopulation
        );

        return filteredCities.map(city => ({
            name: city.name,
            lat: parseFloat(city.lat),
            lng: parseFloat(city.lng),
            population: parseInt(city.population),
            countryCode: city.countryCode,
            countryName: city.countryName,
            timezone: city.timezone,
            expectedOffset: targetOffset,
            category: getLatitudeCategory(parseFloat(city.lat)),
            hemisphere: parseFloat(city.lat) >= 0 ? 'north' : 'south'
        }));
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('GeoNames API 呼叫超時');
            throw new Error('API 呼叫超時，請稍後再試');
        }
        throw error;
    }
} 
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
        let { latitude, longitude, targetUTCOffset } = req.method === 'GET' ? req.query : req.body;

        // 驗證參數
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const targetOffset = parseFloat(targetUTCOffset);

        if (isNaN(lat) || isNaN(lng) || isNaN(targetOffset)) {
            return res.status(400).json({ 
                error: 'Invalid parameters. latitude, longitude, and targetUTCOffset are required and must be numbers.' 
            });
        }

        if (lat < -90 || lat > 90) {
            return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
        }

        if (lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
        }

        // GeoNames 用戶名 - 您需要註冊一個免費帳戶
        // 請到 https://www.geonames.org/login 註冊帳戶，然後啟用 webservice
        const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'demo';

        // 建構時間戳記（當前時間）
        const timestamp = Math.floor(Date.now() / 1000);

        // 1. 先取得時區資訊
        const timezoneUrl = `http://api.geonames.org/timezoneJSON?lat=${lat}&lng=${lng}&username=${GEONAMES_USERNAME}`;
        
        console.log(`呼叫 GeoNames Timezone API: ${timezoneUrl}`);
        
        const timezoneResponse = await fetch(timezoneUrl);
        if (!timezoneResponse.ok) {
            throw new Error(`GeoNames Timezone API failed: ${timezoneResponse.status}`);
        }
        
        const timezoneData = await timezoneResponse.json();
        
        if (timezoneData.status) {
            throw new Error(`GeoNames Timezone API error: ${timezoneData.status.message}`);
        }

        // 2. 取得附近的地名資訊
        const nearbyUrl = `http://api.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lng}&maxRows=1&radius=50&username=${GEONAMES_USERNAME}`;
        
        console.log(`呼叫 GeoNames Nearby API: ${nearbyUrl}`);
        
        const nearbyResponse = await fetch(nearbyUrl);
        if (!nearbyResponse.ok) {
            throw new Error(`GeoNames Nearby API failed: ${nearbyResponse.status}`);
        }
        
        const nearbyData = await nearbyResponse.json();
        
        if (nearbyData.status) {
            throw new Error(`GeoNames Nearby API error: ${nearbyData.status.message}`);
        }

        // 3. 如果沒有找到附近的地名，嘗試取得國家資訊
        let cityInfo = null;
        if (nearbyData.geonames && nearbyData.geonames.length > 0) {
            cityInfo = nearbyData.geonames[0];
        }

        // 4. 取得國家資訊
        const countryUrl = `http://api.geonames.org/countryCodeJSON?lat=${lat}&lng=${lng}&username=${GEONAMES_USERNAME}`;
        
        console.log(`呼叫 GeoNames Country API: ${countryUrl}`);
        
        const countryResponse = await fetch(countryUrl);
        if (!countryResponse.ok) {
            throw new Error(`GeoNames Country API failed: ${countryResponse.status}`);
        }
        
        const countryData = await countryResponse.json();
        
        if (countryData.status) {
            console.warn(`GeoNames Country API warning: ${countryData.status.message}`);
        }

        // 5. 準備基本結果
        const cityName = cityInfo ? cityInfo.name : null;
        const countryName = countryData.countryName || (cityInfo ? cityInfo.countryName : null);
        const countryCode = countryData.countryCode || (cityInfo ? cityInfo.countryCode : null);

        // 6. 嘗試使用 ChatGPT 翻譯城市和國家名稱
        let city_zh = cityName;
        let country_zh = countryName;
        let translationSource = 'geonames'; // 預設來源

        if (cityName || countryName) {
            try {
                console.log('嘗試使用 ChatGPT 翻譯地名...');
                const translationUrl = `${req.headers.origin || req.url.split('/api')[0]}/api/translate-location`;
                
                const translationResponse = await fetch(translationUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        city: cityName,
                        country: countryName,
                        countryCode: countryCode
                    })
                });

                if (translationResponse.ok) {
                    const translationResult = await translationResponse.json();
                    if (translationResult.translated) {
                        city_zh = translationResult.city_zh || cityName;
                        country_zh = translationResult.country_zh || countryName;
                        translationSource = 'chatgpt';
                        console.log(`ChatGPT 翻譯成功: ${cityName} -> ${city_zh}, ${countryName} -> ${country_zh}`);
                    } else {
                        console.log('ChatGPT 翻譯失敗，使用原始名稱');
                    }
                } else {
                    console.log('翻譯服務調用失敗，使用原始名稱');
                }
            } catch (translationError) {
                console.warn('翻譯過程發生錯誤，使用原始名稱:', translationError.message);
            }
        }

        // 7. 組合最終結果
        const result = {
            city: cityName,
            city_zh: city_zh,
            country: countryName,
            country_zh: country_zh,
            country_iso_code: countryCode,
            latitude: lat,
            longitude: lng,
            timezone: timezoneData.timezoneId,
            rawOffset: timezoneData.rawOffset,
            dstOffset: timezoneData.dstOffset,
            timezoneOffset: timezoneData.rawOffset, // hours offset from UTC
            targetUTCOffset: targetOffset,
            distance: cityInfo ? cityInfo.distance : null,
            population: cityInfo ? cityInfo.population : null,
            geoNamesId: cityInfo ? cityInfo.geonameId : null,
            translationSource: translationSource // 標記翻譯來源
        };

        // 6. 檢查時區偏移是否接近目標
        const timeDifference = Math.abs(result.timezoneOffset - targetOffset);
        result.isGoodMatch = timeDifference <= 1.0; // 1 hour tolerance
        result.timeDifference = timeDifference;

        console.log(`GeoNames API 成功返回結果:`, result);

        res.status(200).json(result);

    } catch (error) {
        console.error('GeoNames API 調用失敗:', error);
        res.status(500).json({ 
            error: 'Failed to fetch location data from GeoNames',
            details: error.message 
        });
    }
} 
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
        let { targetUTCOffset, latitudePreference, mood, moodName, moodDescription } = req.method === 'GET' ? req.query : req.body;

        // 驗證參數
        const targetOffset = parseFloat(targetUTCOffset);

        if (isNaN(targetOffset)) {
            return res.status(400).json({ 
                error: 'Invalid parameter. targetUTCOffset is required and must be a number.' 
            });
        }

        // 預設值
        latitudePreference = latitudePreference || 'any';
        mood = mood || 'peaceful';
        moodName = moodName || '平靜溫和';
        moodDescription = moodDescription || '溫帶的舒適宜人';

        // 心情對應的顏色和表情符號（如果前端沒有傳遞）
        const moodStyles = {
            'happy': { emoji: '😊🌞', color: '#FF6B35' },
            'peaceful': { emoji: '😌🌱', color: '#4ECDC4' },
            'melancholy': { emoji: '🤔🍂', color: '#45B7D1' },
            'lonely': { emoji: '😔❄️', color: '#A8A8A8' }
        };

        const moodStyle = moodStyles[mood] || moodStyles['peaceful'];

        console.log(`收到請求 - 目標偏移: ${targetOffset}, 緯度偏好: ${latitudePreference}, 心情: ${moodName} (${moodDescription})`);

        // GeoNames 用戶名 - 您需要註冊一個免費帳戶
        const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'demo';

        // 預定義一些主要城市的經緯度，這些城市代表不同的時區和緯度
        const majorCitiesByTimezone = [
            // UTC-12 to UTC-8 (太平洋時區)
            { name: 'Honolulu', lat: 21.3099, lng: -157.8581, expectedOffset: -10, category: 'low' },
            { name: 'Anchorage', lat: 61.2181, lng: -149.9003, expectedOffset: -9, category: 'high' },
            { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, expectedOffset: -8, category: 'mid' },
            { name: 'Vancouver', lat: 49.2827, lng: -123.1207, expectedOffset: -8, category: 'mid-high' },
            
            // UTC-7 to UTC-5 (北美時區)
            { name: 'Denver', lat: 39.7392, lng: -104.9903, expectedOffset: -7, category: 'mid' },
            { name: 'Phoenix', lat: 33.4484, lng: -112.0740, expectedOffset: -7, category: 'mid' },
            { name: 'Chicago', lat: 41.8781, lng: -87.6298, expectedOffset: -6, category: 'mid' },
            { name: 'Mexico City', lat: 19.4326, lng: -99.1332, expectedOffset: -6, category: 'low' },
            { name: 'New York', lat: 40.7128, lng: -74.0060, expectedOffset: -5, category: 'mid' },
            { name: 'Toronto', lat: 43.6532, lng: -79.3832, expectedOffset: -5, category: 'mid' },
            
            // UTC-4 to UTC-1 (大西洋和南美時區)
            { name: 'Caracas', lat: 10.4806, lng: -66.9036, expectedOffset: -4, category: 'low' },
            { name: 'Santiago', lat: -33.4489, lng: -70.6693, expectedOffset: -4, category: 'mid' },
            { name: 'São Paulo', lat: -23.5558, lng: -46.6396, expectedOffset: -3, category: 'mid' },
            { name: 'Buenos Aires', lat: -34.6118, lng: -58.3960, expectedOffset: -3, category: 'mid' },
            
            // UTC+0 to UTC+3 (歐洲和非洲時區)
            { name: 'London', lat: 51.5074, lng: -0.1278, expectedOffset: 0, category: 'mid-high' },
            { name: 'Reykjavik', lat: 64.1466, lng: -21.9426, expectedOffset: 0, category: 'high' },
            { name: 'Paris', lat: 48.8566, lng: 2.3522, expectedOffset: 1, category: 'mid-high' },
            { name: 'Berlin', lat: 52.5200, lng: 13.4050, expectedOffset: 1, category: 'mid-high' },
            { name: 'Rome', lat: 41.9028, lng: 12.4964, expectedOffset: 1, category: 'mid' },
            { name: 'Cairo', lat: 30.0444, lng: 31.2357, expectedOffset: 2, category: 'mid' },
            { name: 'Athens', lat: 37.9838, lng: 23.7275, expectedOffset: 2, category: 'mid' },
            { name: 'Moscow', lat: 55.7558, lng: 37.6176, expectedOffset: 3, category: 'mid-high' },
            { name: 'Istanbul', lat: 41.0082, lng: 28.9784, expectedOffset: 3, category: 'mid' },
            
            // UTC+4 to UTC+6 (中東和中亞時區)
            { name: 'Dubai', lat: 25.2048, lng: 55.2708, expectedOffset: 4, category: 'low' },
            { name: 'Tehran', lat: 35.6892, lng: 51.3890, expectedOffset: 3.5, category: 'mid' },
            { name: 'Mumbai', lat: 19.0760, lng: 72.8777, expectedOffset: 5.5, category: 'low' },
            { name: 'New Delhi', lat: 28.6139, lng: 77.2090, expectedOffset: 5.5, category: 'mid' },
            { name: 'Almaty', lat: 43.2220, lng: 76.8512, expectedOffset: 6, category: 'mid' },
            
            // UTC+7 to UTC+9 (亞洲時區)
            { name: 'Bangkok', lat: 13.7563, lng: 100.5018, expectedOffset: 7, category: 'low' },
            { name: 'Jakarta', lat: -6.2088, lng: 106.8456, expectedOffset: 7, category: 'low' },
            { name: 'Singapore', lat: 1.3521, lng: 103.8198, expectedOffset: 8, category: 'low' },
            { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, expectedOffset: 8, category: 'low' },
            { name: 'Beijing', lat: 39.9042, lng: 116.4074, expectedOffset: 8, category: 'mid' },
            { name: 'Manila', lat: 14.5995, lng: 120.9842, expectedOffset: 8, category: 'low' },
            { name: 'Seoul', lat: 37.5665, lng: 126.9780, expectedOffset: 9, category: 'mid' },
            { name: 'Tokyo', lat: 35.6762, lng: 139.6503, expectedOffset: 9, category: 'mid' },
            
            // UTC+10 to UTC+12 (太平洋時區)
            { name: 'Sydney', lat: -33.8688, lng: 151.2093, expectedOffset: 10, category: 'mid' },
            { name: 'Melbourne', lat: -37.8136, lng: 144.9631, expectedOffset: 10, category: 'mid' },
            { name: 'Brisbane', lat: -27.4698, lng: 153.0251, expectedOffset: 10, category: 'mid' },
            { name: 'Auckland', lat: -36.8485, lng: 174.7633, expectedOffset: 12, category: 'mid' },
            { name: 'Suva', lat: -18.1248, lng: 178.4501, expectedOffset: 12, category: 'low' }
        ];

        // 找到最接近目標偏移的城市
        const tolerance = 1.0; // 1小時的容差
        let candidateCities = majorCitiesByTimezone.filter(city => {
            const diff = Math.abs(city.expectedOffset - targetOffset);
            return diff <= tolerance;
        });

        console.log(`尋找目標偏移 ${targetOffset} 的城市，找到 ${candidateCities.length} 個候選城市`);

        if (candidateCities.length === 0) {
            // 如果沒有找到符合的城市，返回特殊的"宇宙"情況
            return res.status(200).json({
                isUniverseCase: true,
                message: '沒有找到符合目標時區的地球城市',
                targetUTCOffset: targetOffset
            });
        }

        // 根據緯度偏好過濾城市
        if (latitudePreference !== 'any') {
            const filteredByLatitude = candidateCities.filter(city => city.category === latitudePreference);
            if (filteredByLatitude.length > 0) {
                candidateCities = filteredByLatitude;
                console.log(`根據緯度偏好 '${latitudePreference}' 過濾後，剩餘 ${candidateCities.length} 個候選城市`);
            } else {
                console.log(`沒有符合緯度偏好 '${latitudePreference}' 的城市，保留所有候選城市`);
            }
        }

        // 選擇最接近的城市（如果有多個候選）
        candidateCities.sort((a, b) => {
            const diffA = Math.abs(a.expectedOffset - targetOffset);
            const diffB = Math.abs(b.expectedOffset - targetOffset);
            return diffA - diffB;
        });

        const selectedCity = candidateCities[0];
        console.log(`選擇城市: ${selectedCity.name} (${selectedCity.lat}, ${selectedCity.lng}) [${selectedCity.category}緯度] - 心情: ${moodName}`);

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

        // 緯度分類對照表
        const latitudeCategoryNames = {
            'high': '高緯度',
            'mid-high': '中高緯度', 
            'mid': '中緯度',
            'low': '低緯度'
        };

        // 如果 GeoNames API 也失敗了，使用備用資料
        if (cityData.error) {
            console.warn('GeoNames API 失敗，使用備用資料:', cityData.error);
            
            // 根據城市推斷國家
            const cityToCountry = {
                'Honolulu': { country: 'United States', code: 'US' },
                'Anchorage': { country: 'United States', code: 'US' },
                'Los Angeles': { country: 'United States', code: 'US' },
                'Vancouver': { country: 'Canada', code: 'CA' },
                'Denver': { country: 'United States', code: 'US' },
                'Phoenix': { country: 'United States', code: 'US' },
                'Chicago': { country: 'United States', code: 'US' },
                'Mexico City': { country: 'Mexico', code: 'MX' },
                'New York': { country: 'United States', code: 'US' },
                'Toronto': { country: 'Canada', code: 'CA' },
                'Caracas': { country: 'Venezuela', code: 'VE' },
                'Santiago': { country: 'Chile', code: 'CL' },
                'São Paulo': { country: 'Brazil', code: 'BR' },
                'Buenos Aires': { country: 'Argentina', code: 'AR' },
                'London': { country: 'United Kingdom', code: 'GB' },
                'Reykjavik': { country: 'Iceland', code: 'IS' },
                'Paris': { country: 'France', code: 'FR' },
                'Berlin': { country: 'Germany', code: 'DE' },
                'Rome': { country: 'Italy', code: 'IT' },
                'Cairo': { country: 'Egypt', code: 'EG' },
                'Athens': { country: 'Greece', code: 'GR' },
                'Moscow': { country: 'Russia', code: 'RU' },
                'Istanbul': { country: 'Turkey', code: 'TR' },
                'Dubai': { country: 'United Arab Emirates', code: 'AE' },
                'Tehran': { country: 'Iran', code: 'IR' },
                'Mumbai': { country: 'India', code: 'IN' },
                'New Delhi': { country: 'India', code: 'IN' },
                'Almaty': { country: 'Kazakhstan', code: 'KZ' },
                'Bangkok': { country: 'Thailand', code: 'TH' },
                'Jakarta': { country: 'Indonesia', code: 'ID' },
                'Singapore': { country: 'Singapore', code: 'SG' },
                'Hong Kong': { country: 'Hong Kong', code: 'HK' },
                'Beijing': { country: 'China', code: 'CN' },
                'Manila': { country: 'Philippines', code: 'PH' },
                'Seoul': { country: 'South Korea', code: 'KR' },
                'Tokyo': { country: 'Japan', code: 'JP' },
                'Sydney': { country: 'Australia', code: 'AU' },
                'Melbourne': { country: 'Australia', code: 'AU' },
                'Brisbane': { country: 'Australia', code: 'AU' },
                'Auckland': { country: 'New Zealand', code: 'NZ' },
                'Suva': { country: 'Fiji', code: 'FJ' }
            };

            const countryInfo = cityToCountry[selectedCity.name] || { country: 'Unknown', code: 'XX' };

            // 嘗試使用 ChatGPT 翻譯備用資料
            let city_zh = selectedCity.name;
            let country_zh = countryInfo.country;
            let translationSource = 'fallback';

            try {
                console.log('嘗試為備用資料使用 ChatGPT 翻譯...');
                const translationUrl = `${req.headers.origin || req.url.split('/api')[0]}/api/translate-location`;
                
                const translationResponse = await fetch(translationUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        city: selectedCity.name,
                        country: countryInfo.country,
                        countryCode: countryInfo.code
                    })
                });

                if (translationResponse.ok) {
                    const translationResult = await translationResponse.json();
                    if (translationResult.translated) {
                        city_zh = translationResult.city_zh || selectedCity.name;
                        country_zh = translationResult.country_zh || countryInfo.country;
                        translationSource = 'chatgpt-fallback';
                        console.log(`ChatGPT 備用翻譯成功: ${selectedCity.name} -> ${city_zh}, ${countryInfo.country} -> ${country_zh}`);
                    }
                }
            } catch (translationError) {
                console.warn('備用資料翻譯失敗，使用預設翻譯:', translationError.message);
            }

            // 如果 ChatGPT 翻譯失敗，使用預設的中文翻譯
            if (translationSource === 'fallback') {
                const cityTranslations = {
                'Honolulu': '檀香山',
                'Anchorage': '安克拉治',
                'Los Angeles': '洛杉磯',
                'Vancouver': '溫哥華',
                'Denver': '丹佛',
                'Phoenix': '鳳凰城',
                'Chicago': '芝加哥',
                'Mexico City': '墨西哥城',
                'New York': '紐約',
                'Toronto': '多倫多',
                'Caracas': '卡拉卡斯',
                'Santiago': '聖地亞哥',
                'São Paulo': '聖保羅',
                'Buenos Aires': '布宜諾斯艾利斯',
                'London': '倫敦',
                'Reykjavik': '雷克雅維克',
                'Paris': '巴黎',
                'Berlin': '柏林',
                'Rome': '羅馬',
                'Cairo': '開羅',
                'Athens': '雅典',
                'Moscow': '莫斯科',
                'Istanbul': '伊斯坦堡',
                'Dubai': '杜拜',
                'Tehran': '德黑蘭',
                'Mumbai': '孟買',
                'New Delhi': '新德里',
                'Almaty': '阿拉木圖',
                'Bangkok': '曼谷',
                'Jakarta': '雅加達',
                'Singapore': '新加坡',
                'Hong Kong': '香港',
                'Beijing': '北京',
                'Manila': '馬尼拉',
                'Seoul': '首爾',
                'Tokyo': '東京',
                'Sydney': '雪梨',
                'Melbourne': '墨爾本',
                'Brisbane': '布里斯班',
                'Auckland': '奧克蘭',
                'Suva': '蘇瓦'
            };

            const countryTranslations = {
                'United States': '美國',
                'Canada': '加拿大',
                'Mexico': '墨西哥',
                'Venezuela': '委內瑞拉',
                'Chile': '智利',
                'Brazil': '巴西',
                'Argentina': '阿根廷',
                'United Kingdom': '英國',
                'Iceland': '冰島',
                'France': '法國',
                'Germany': '德國',
                'Italy': '意大利',
                'Egypt': '埃及',
                'Greece': '希臘',
                'Russia': '俄羅斯',
                'Turkey': '土耳其',
                'United Arab Emirates': '阿聯酋',
                'Iran': '伊朗',
                'India': '印度',
                'Kazakhstan': '哈薩克',
                'Thailand': '泰國',
                'Indonesia': '印尼',
                'Singapore': '新加坡',
                'Hong Kong': '香港',
                'China': '中國',
                'Philippines': '菲律賓',
                'South Korea': '南韓',
                'Japan': '日本',
                'Australia': '澳洲',
                'New Zealand': '紐西蘭',
                'Fiji': '斐濟'
            };

            // 根據城市推斷國家
            const cityToCountry = {
                'Honolulu': { country: 'United States', code: 'US' },
                'Anchorage': { country: 'United States', code: 'US' },
                'Los Angeles': { country: 'United States', code: 'US' },
                'Vancouver': { country: 'Canada', code: 'CA' },
                'Denver': { country: 'United States', code: 'US' },
                'Phoenix': { country: 'United States', code: 'US' },
                'Chicago': { country: 'United States', code: 'US' },
                'Mexico City': { country: 'Mexico', code: 'MX' },
                'New York': { country: 'United States', code: 'US' },
                'Toronto': { country: 'Canada', code: 'CA' },
                'Caracas': { country: 'Venezuela', code: 'VE' },
                'Santiago': { country: 'Chile', code: 'CL' },
                'São Paulo': { country: 'Brazil', code: 'BR' },
                'Buenos Aires': { country: 'Argentina', code: 'AR' },
                'London': { country: 'United Kingdom', code: 'GB' },
                'Reykjavik': { country: 'Iceland', code: 'IS' },
                'Paris': { country: 'France', code: 'FR' },
                'Berlin': { country: 'Germany', code: 'DE' },
                'Rome': { country: 'Italy', code: 'IT' },
                'Cairo': { country: 'Egypt', code: 'EG' },
                'Athens': { country: 'Greece', code: 'GR' },
                'Moscow': { country: 'Russia', code: 'RU' },
                'Istanbul': { country: 'Turkey', code: 'TR' },
                'Dubai': { country: 'United Arab Emirates', code: 'AE' },
                'Tehran': { country: 'Iran', code: 'IR' },
                'Mumbai': { country: 'India', code: 'IN' },
                'New Delhi': { country: 'India', code: 'IN' },
                'Almaty': { country: 'Kazakhstan', code: 'KZ' },
                'Bangkok': { country: 'Thailand', code: 'TH' },
                'Jakarta': { country: 'Indonesia', code: 'ID' },
                'Singapore': { country: 'Singapore', code: 'SG' },
                'Hong Kong': { country: 'Hong Kong', code: 'HK' },
                'Beijing': { country: 'China', code: 'CN' },
                'Manila': { country: 'Philippines', code: 'PH' },
                'Seoul': { country: 'South Korea', code: 'KR' },
                'Tokyo': { country: 'Japan', code: 'JP' },
                'Sydney': { country: 'Australia', code: 'AU' },
                'Melbourne': { country: 'Australia', code: 'AU' },
                'Brisbane': { country: 'Australia', code: 'AU' },
                'Auckland': { country: 'New Zealand', code: 'NZ' },
                'Suva': { country: 'Fiji', code: 'FJ' }
            };

                if (translationSource === 'fallback') {
                    city_zh = cityTranslations[selectedCity.name] || selectedCity.name;
                    country_zh = countryTranslations[countryInfo.country] || countryInfo.country;
                }
            }

            return res.status(200).json({
                city: selectedCity.name,
                city_zh: city_zh,
                country: countryInfo.country,
                country_zh: country_zh,
                country_iso_code: countryInfo.code,
                latitude: selectedCity.lat,
                longitude: selectedCity.lng,
                timezone: 'Unknown/Fallback',
                timezoneOffset: selectedCity.expectedOffset,
                targetUTCOffset: targetOffset,
                timeDifference: Math.abs(selectedCity.expectedOffset - targetOffset),
                isGoodMatch: Math.abs(selectedCity.expectedOffset - targetOffset) <= tolerance,
                isFallback: true,
                source: 'predefined',
                translationSource: translationSource,
                latitudeCategory: latitudeCategoryNames[selectedCity.category] || selectedCity.category,
                latitudePreference: latitudePreference,
                mood: mood,
                moodName: moodName,
                moodDescription: moodDescription,
                moodEmoji: moodStyle.emoji,
                moodColor: moodStyle.color
            });
        }

        // 返回從 GeoNames API 獲取的資料
        const result = {
            ...cityData,
            source: 'geonames',
            latitudeCategory: latitudeCategoryNames[selectedCity.category] || selectedCity.category,
            latitudePreference: latitudePreference,
            mood: mood,
            moodName: moodName,
            moodDescription: moodDescription,
            moodEmoji: moodStyle.emoji,
            moodColor: moodStyle.color
        };

        console.log(`成功返回城市資料:`, result);

        res.status(200).json(result);

    } catch (error) {
        console.error('查找城市失敗:', error);
        res.status(500).json({ 
            error: 'Failed to find matching city',
            details: error.message 
        });
    }
} 
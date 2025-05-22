document.addEventListener('DOMContentLoaded', () => {
    const findCityButton = document.getElementById('findCityButton');
    const resultDiv = document.getElementById('result');
    let citiesData = [];

    // 1. 載入城市數據
    fetch('cities_with_timezones.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            citiesData = data;
            findCityButton.disabled = false; // 數據載入完成後啟用按鈕
            console.log("城市數據已載入", citiesData.length, "筆");
        })
        .catch(e => {
            console.error("無法載入城市數據:", e);
            resultDiv.textContent = "錯誤：無法載入城市數據。請檢查 cities_with_timezones.json 檔案是否存在且格式正確。";
            findCityButton.disabled = true;
        });

    findCityButton.addEventListener('click', findMatchingCity);

    // 輔助函數：解析 "GMT+05:30" 或 "UTC-7:00" 這樣的偏移字串為小時數
    function parseOffsetString(offsetStr) {
        if (!offsetStr || typeof offsetStr !== 'string') return NaN;
        const cleaned = offsetStr.replace('GMT', '').replace('UTC', '').trim(); // e.g., "+05:30", "-07:00", "+5"
        
        const signMatch = cleaned.match(/^([+-])/);
        const sign = signMatch ? (signMatch[1] === '+' ? 1 : -1) : 1; // Assume positive if no sign and just numbers
        
        const numericPart = signMatch ? cleaned.substring(1) : cleaned;
        const parts = numericPart.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

        if (isNaN(hours) || isNaN(minutes)) return NaN;
        
        return sign * (hours + minutes / 60);
    }

    // 輔助函數：從 IANA 時區名稱獲取當前 UTC 偏移量 (小時)
    function getCityUTCOffsetHours(ianaTimeZone) {
        try {
            const now = new Date();
            // Intl.DateTimeFormat is the standard way, but its output for offset varies
            const formatter = new Intl.DateTimeFormat('en', {
                timeZone: ianaTimeZone,
                timeZoneName: 'longOffset', // Tries to get "GMT+X:XX" or "UTC+X:XX"
            });
            
            const parts = formatter.formatToParts(now);
            let offsetStringVal = "";

            for (const part of parts) {
                // Different browsers might put the offset string in different part types
                if (part.type === 'timeZoneName' || part.type === 'unknown' || part.type === 'literal') {
                     if ( (part.value.startsWith('GMT') || part.value.startsWith('UTC')) && (part.value.includes('+') || part.value.includes('-')) ) {
                        offsetStringVal = part.value;
                        break;
                     }
                }
            }
            
            // Fallback if formatToParts doesn't yield a clear offset string directly
            if (!offsetStringVal) {
                const formattedDateString = formatter.format(now); // e.g., "5/22/2025, GMT-07:00"
                const match = formattedDateString.match(/(GMT|UTC)([+-]\d{1,2}(:\d{2})?)/);
                if (match && match[0]) {
                    offsetStringVal = match[0]; 
                }
            }

            if (offsetStringVal) {
                return parseOffsetString(offsetStringVal);
            } else {
                // console.warn("Could not determine offset string for:", ianaTimeZone, "using Intl.DateTimeFormat parts. Parts:", parts);
                // As a very basic fallback, if the above fails, we might infer it based on toLocaleString difference (less reliable)
                // This is generally not recommended due to DST complexities and parsing instability.
                // For this project, if `longOffset` doesn't work, it might be better to show an error or simplify.
                // A robust solution often requires a library like moment-timezone.js if Intl isn't sufficient.
                return NaN; 
            }

        } catch (e) {
            // console.error("Error getting offset for timezone:", ianaTimeZone, e);
            return NaN;
        }
    }


    function findMatchingCity() {
            // 檢查時區是否匹配 (允許誤差以更容易找到城市)
            // 例如，放寬到約 ±30 分鐘
            if (Math.abs(cityUTCOffset - targetUTCOffsetHours) < 0.51) { 
                candidateCities.push(city);
            }

        // 2. 獲取用戶當前本地時間
        const userLocalDate = new Date();
        const userLocalHours = userLocalDate.getHours();
        const userLocalMinutes = userLocalDate.getMinutes();
        // getTimezoneOffset() 返回本地時間與 UTC 之間的分鐘差。
        // 如果本地時區在 UTC 之後 (例如 UTC-5)，則為正值。
        // 如果本地時區在 UTC 之前 (例如 UTC+8)，則為負值。
        const userTimezoneOffsetMinutes = userLocalDate.getTimezoneOffset(); 
        const userUTCOffsetHours = -userTimezoneOffsetMinutes / 60; // 轉換為我們通常理解的 UTC+X 或 UTC-X

        // 3. 計算目標時區的 UTC 偏移量 (使得該時區為早上 8:00)
        // 目標時間 Target_H = 8 (8:00 AM)
        // Target_UTC_Offset = Target_H - User_Local_H_Decimal + User_UTC_Offset_Hours
        const userLocalHoursDecimal = userLocalHours + userLocalMinutes / 60;
        const targetUTCOffsetHours = 8 - userLocalHoursDecimal + userUTCOffsetHours;
        
        // 4. 根據用戶本地時間的分鐘數計算目標緯度
        // 00分 -> 北緯90度, 29.5分 -> 0度 (赤道), 59分 -> 南緯90度
        // latitude = 90 - (minutes / 59) * 180
        const targetLatitude = 90 - (userLocalMinutes / 59) * 180;

        console.log(`用戶時間: ${userLocalHours}:${userLocalMinutes < 10 ? '0' : ''}${userLocalMinutes} (UTC${userUTCOffsetHours >= 0 ? '+' : ''}${userUTCOffsetHours})`);
        console.log(`尋找 UTC ${targetUTCOffsetHours.toFixed(2)} 且緯度接近 ${targetLatitude.toFixed(2)} 的城市`);

        let candidateCities = [];
        for (const city of citiesData) {
            const cityUTCOffset = getCityUTCOffsetHours(city.timezone);
            if (isNaN(cityUTCOffset)) {
                // console.warn(`無法獲取 ${city.city} (${city.timezone}) 的 UTC 偏移量`);
                continue;
            }

            // 檢查時區是否匹配 (允許微小誤差處理浮點數)
            if (Math.abs(cityUTCOffset - targetUTCOffsetHours) < 0.02) { // 0.02 約為1分鐘的誤差容忍
                candidateCities.push(city);
            }
        }

        if (candidateCities.length === 0) {
            resultDiv.textContent = `雖然你在當地 ${userLocalHours}:${userLocalMinutes < 10 ? '0' : ''}${userLocalMinutes} 起床，但抱歉，目前找不到世界上正好是 8:00 AM 且符合分鐘緯度對應的地區。`;
            return;
        }

        // 5. 從候選城市中找到緯度最接近的城市
        let bestMatchCity = null;
        let minLatDiff = Infinity;

        for (const city of candidateCities) {
            const latDiff = Math.abs(city.latitude - targetLatitude);
            if (latDiff < minLatDiff) {
                minLatDiff = latDiff;
                bestMatchCity = city;
            }
        }

        if (bestMatchCity) {
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            resultDiv.innerHTML = `你雖然在當地起床時間是 <strong>${userTimeFormatted}</strong>，<br>但是你的作息正好跟 <strong>${bestMatchCity.city} (${bestMatchCity.country})</strong> 的人 <strong>8:00 AM</strong> 一樣，<br>一起開啟了新的一天！<br><small>(目標城市緯度: ${bestMatchCity.latitude.toFixed(2)}°, 計算目標緯度: ${targetLatitude.toFixed(2)}°, 目標時區: UTC${targetUTCOffsetHours.toFixed(2)}, 城市時區: ${bestMatchCity.timezone} [實際UTC${getCityUTCOffsetHours(bestMatchCity.timezone).toFixed(2)}])</small>`;
        } else {
            // 理論上如果 candidateCities 有內容，這裡應該也會有 bestMatchCity
            resultDiv.textContent = `雖然你在當地 ${userLocalHours}:${userLocalMinutes < 10 ? '0' : ''}${userLocalMinutes} 起床，但抱歉，在符合時區的城市中，找不到緯度匹配的城市。`;
        }
    }
});

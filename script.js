document.addEventListener('DOMContentLoaded', () => {
    const findCityButton = document.getElementById('findCityButton');
    const resultDiv = document.getElementById('result');
    let citiesData = [];

    // 1. 載入城市數據 (更新檔案名稱)
    fetch('cities_data.json') // <--- 主要變更點：使用新的 JSON 檔案
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
            if (citiesData.length === 0) {
                resultDiv.textContent = "提示：載入的城市數據為空。請檢查 cities_data.json 檔案是否包含有效的城市資料。";
                findCityButton.disabled = true;
            }
        })
        .catch(e => {
            console.error("無法載入城市數據:", e);
            resultDiv.textContent = "錯誤：無法載入城市數據。請檢查 cities_data.json 檔案是否存在、格式正確且內容不為空。";
            findCityButton.disabled = true;
        });

    findCityButton.addEventListener('click', findMatchingCity);

    // 輔助函數：解析 "GMT+05:30" 或 "UTC-7:00" 這樣的偏移字串為小時數
    function parseOffsetString(offsetStr) {
        if (!offsetStr || typeof offsetStr !== 'string') return NaN;
        const cleaned = offsetStr.replace('GMT', '').replace('UTC', '').trim(); // e.g., "+05:30", "-07:00", "+5"

        const signMatch = cleaned.match(/^([+-])/);
        const sign = signMatch ? (signMatch[1] === '+' ? 1 : -1) : 1;

        const numericPart = signMatch ? cleaned.substring(1) : cleaned;
        const parts = numericPart.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

        if (isNaN(hours) || isNaN(minutes)) return NaN;

        return sign * (hours + minutes / 60);
    }

    // 輔助函數：從 IANA 時區名稱獲取當前 UTC 偏移量 (小時)
    // 這個函數對於處理夏令時 (DST) 很重要
    function getCityUTCOffsetHours(ianaTimeZone) {
        try {
            const now = new Date();
            // Intl.DateTimeFormat 是獲取帶有正確 DST 的時區偏移的標準方法
            const formatter = new Intl.DateTimeFormat('en', { // 'en' 確保 GMT/UTC 字串格式一致性
                timeZone: ianaTimeZone,
                timeZoneName: 'longOffset', // 嘗試獲取 "GMT+X:XX" 或 "UTC+X:XX"
            });

            const parts = formatter.formatToParts(now);
            let offsetStringVal = "";

            for (const part of parts) {
                // 不同瀏覽器和 Intl 版本可能將偏移量放在不同 type 的 part 中
                // 我們尋找包含 "GMT" 或 "UTC" 並帶有 "+" 或 "-" 的值
                if (part.type === 'timeZoneName' || part.type === 'unknown' || part.type === 'literal') {
                    if ((part.value.startsWith('GMT') || part.value.startsWith('UTC')) && (part.value.includes('+') || part.value.includes('-'))) {
                        offsetStringVal = part.value;
                        break;
                    }
                }
            }

            // 如果 formatToParts 沒有直接給出偏移字串，嘗試從完整格式化字串中提取
            if (!offsetStringVal) {
                const formattedDateString = formatter.format(now); // 例如 "5/22/2025, GMT-07:00"
                const match = formattedDateString.match(/(GMT|UTC)([+-]\d{1,2}(:\d{2})?)/);
                if (match && match[0]) {
                    offsetStringVal = match[0];
                }
            }

            if (offsetStringVal) {
                return parseOffsetString(offsetStringVal);
            } else {
                // console.warn("無法從 Intl.DateTimeFormat 獲取時區偏移字串:", ianaTimeZone, "Parts:", parts);
                // 如果 Intl.DateTimeFormat 失敗，這是一個重要的問題，因為時區偏移可能不正確
                // 為了避免應用程式出錯，返回 NaN
                return NaN;
            }

        } catch (e) {
            // console.error("獲取時區偏移時發生錯誤:", ianaTimeZone, e);
            // 無效的 IANA 時區名稱會導致錯誤
            return NaN;
        }
    }

    // 快取時區偏移量以提高效能
    const timezoneOffsetCache = new Map();

    function findMatchingCity() {
        if (citiesData.length === 0) {
            resultDiv.textContent = "錯誤：城市數據未載入或為空，無法尋找城市。";
            return;
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
        const userLocalHoursDecimal = userLocalHours + userLocalMinutes / 60;
        const targetUTCOffsetHours = 8 - userLocalHoursDecimal + userUTCOffsetHours;

        // 4. 根據用戶本地時間的分鐘數計算目標緯度
        // 00分 -> 北緯90度, 29.5分 -> 0度 (赤道), 59分 -> 南緯90度
        const targetLatitude = 90 - (userLocalMinutes / 59) * 180;

        console.log(`用戶時間: ${userLocalHours}:${userLocalMinutes < 10 ? '0' : ''}${userLocalMinutes} (UTC${userUTCOffsetHours >= 0 ? '+' : ''}${userUTCOffsetHours.toFixed(2)})`);
        console.log(`尋找目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}，目標緯度: ${targetLatitude.toFixed(2)}`);

        let candidateCities = [];
        for (const city of citiesData) {
            if (!city || !city.timezone || typeof city.latitude !== 'number') {
                // console.warn("跳過格式不正確的城市數據:", city);
                continue;
            }

            let cityUTCOffset;
            if (timezoneOffsetCache.has(city.timezone)) {
                cityUTCOffset = timezoneOffsetCache.get(city.timezone);
            } else {
                cityUTCOffset = getCityUTCOffsetHours(city.timezone);
                if (!isNaN(cityUTCOffset)) {
                    timezoneOffsetCache.set(city.timezone, cityUTCOffset);
                }
            }

            if (isNaN(cityUTCOffset)) {
                // console.warn(`無法獲取 ${city.city} (${city.timezone}) 的 UTC 偏移量`);
                continue;
            }

            // 檢查時區是否匹配 (允許微小誤差處理浮點數，約 1-2 分鐘)
            if (Math.abs(cityUTCOffset - targetUTCOffsetHours) < 0.03) {
                candidateCities.push(city);
            }
        }

        console.log("符合時區條件的候選城市數量:", candidateCities.length);

        if (candidateCities.length === 0) {
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            resultDiv.innerHTML = `雖然你在當地 <strong>${userTimeFormatted}</strong> 起床，<br>但抱歉，目前找不到世界上正好是 <strong>8:00 AM</strong> 且符合時區條件的地區。<br><small>(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)})</small>`;
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
            const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone); // 重新獲取以確保最新
            resultDiv.innerHTML = `你雖然在當地起床時間是 <strong>${userTimeFormatted}</strong>，<br>但是你的作息正好跟 <strong>${bestMatchCity.city} (${bestMatchCity.country})</strong> 的人 <strong>8:00 AM</strong> 一樣，<br>一起開啟了新的一天！<br><small>(目標城市緯度: ${bestMatchCity.latitude.toFixed(2)}°, 計算目標緯度: ${targetLatitude.toFixed(2)}°, 緯度差: ${minLatDiff.toFixed(2)}°)<br>(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 城市實際 UTC 偏移: ${isNaN(cityActualUTCOffset) ? 'N/A' : cityActualUTCOffset.toFixed(2)}, 時區: ${bestMatchCity.timezone})</small>`;
        } else {
            // 理論上如果 candidateCities 有內容，這裡應該也會有 bestMatchCity
            // 但以防萬一增加此提示
             const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            resultDiv.innerHTML = `雖然你在當地 <strong>${userTimeFormatted}</strong> 起床，<br>在符合時區的城市中，似乎找不到緯度匹配的城市。<br><small>(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 目標緯度: ${targetLatitude.toFixed(2)})</small>`;
        }
    }
});

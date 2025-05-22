document.addEventListener('DOMContentLoaded', () => {
    const findCityButton = document.getElementById('findCityButton');
    const resultDiv = document.getElementById('result');
    let citiesData = [];

    // 1. 載入城市數據
    // 請確保 cities_data.json 包含以下欄位:
    // city (英文城市名), country (英文國家名), timezone, latitude
    // city_zh (中文城市名, 可選), country_zh (中文國家名, 可選)
    fetch('cities_data.json') // 確保此檔案與 HTML 檔案在同一目錄，或路徑正確
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
        const cleaned = offsetStr.replace('GMT', '').replace('UTC', '').trim();
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
    function getCityUTCOffsetHours(ianaTimeZone) {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en', { // 'en' 確保 GMT/UTC 字串格式一致性
                timeZone: ianaTimeZone,
                timeZoneName: 'longOffset', // 嘗試獲取 "GMT+X:XX" 或 "UTC+X:XX"
            });
            const parts = formatter.formatToParts(now);
            let offsetStringVal = "";
            for (const part of parts) {
                if (part.type === 'timeZoneName' || part.type === 'unknown' || part.type === 'literal') {
                    if ((part.value.startsWith('GMT') || part.value.startsWith('UTC')) && (part.value.includes('+') || part.value.includes('-'))) {
                        offsetStringVal = part.value;
                        break;
                    }
                }
            }
            if (!offsetStringVal) {
                const formattedDateString = formatter.format(now);
                const match = formattedDateString.match(/(GMT|UTC)([+-]\d{1,2}(:\d{2})?)/);
                if (match && match[0]) {
                    offsetStringVal = match[0];
                }
            }
            if (offsetStringVal) {
                return parseOffsetString(offsetStringVal);
            } else {
                console.warn("無法從 Intl.DateTimeFormat 獲取時區偏移字串:", ianaTimeZone, "Parts:", parts);
                return NaN;
            }
        } catch (e) {
            console.error("獲取時區偏移時發生錯誤:", ianaTimeZone, e);
            return NaN;
        }
    }

    // 快取時區偏移量以提高效能
    const timezoneOffsetCache = new Map();

    function findMatchingCity() {
        console.log("--- 開始尋找匹配城市 ---");
        if (citiesData.length === 0) {
            resultDiv.textContent = "錯誤：城市數據未載入或為空，無法尋找城市。";
            console.log("錯誤：城市數據未載入或為空。");
            return;
        }

        const userLocalDate = new Date();
        const userLocalHours = userLocalDate.getHours();
        const userLocalMinutes = userLocalDate.getMinutes();
        const userTimezoneOffsetMinutes = userLocalDate.getTimezoneOffset();
        const userUTCOffsetHours = -userTimezoneOffsetMinutes / 60;

        // 將用戶分鐘數四捨五入到最近的15分鐘，用於計算目標UTC偏移
        let adjustedUserLocalHours = userLocalHours;
        let adjustedUserLocalMinutes = Math.round(userLocalMinutes / 15) * 15;

        if (adjustedUserLocalMinutes === 60) {
            adjustedUserLocalMinutes = 0;
            adjustedUserLocalHours = (adjustedUserLocalHours + 1) % 24;
        }
        // 用於計算目標UTC偏移的小時數（十進制）
        const userLocalHoursDecimalForTarget = adjustedUserLocalHours + adjustedUserLocalMinutes / 60;
        // 使用調整後的時間計算 targetUTCOffsetHours
        const targetUTCOffsetHours = 8 - userLocalHoursDecimalForTarget + userUTCOffsetHours;

        // 緯度計算仍使用原始的 userLocalMinutes
        const targetLatitude = 90 - (userLocalMinutes / 59) * 180;

        console.log(`用戶實際時間: ${userLocalHours}:${userLocalMinutes < 10 ? '0' : ''}${userLocalMinutes} (UTC${userUTCOffsetHours >= 0 ? '+' : ''}${userUTCOffsetHours.toFixed(2)})`);
        console.log(`用於計算目標偏移的調整後用戶時間: ${adjustedUserLocalHours}:${adjustedUserLocalMinutes < 10 ? '0' : ''}${adjustedUserLocalMinutes}`);
        console.log(`尋找目標 UTC 偏移 (targetUTCOffsetHours): ${targetUTCOffsetHours.toFixed(2)} (即 UTC ${targetUTCOffsetHours >= 0 ? '+' : ''}${targetUTCOffsetHours.toFixed(2)})`);
        console.log(`目標匹配範圍 (UTC): ${(targetUTCOffsetHours - 0.5).toFixed(2)} 至 ${(targetUTCOffsetHours + 0.5).toFixed(2)}`);
        console.log(`目標緯度 (targetLatitude): ${targetLatitude.toFixed(2)}`);

        let candidateCities = [];
        console.log(`開始遍歷 ${citiesData.length} 個城市數據...`);
        for (const city of citiesData) {
            if (!city || !city.timezone || typeof city.latitude !== 'number') {
                console.warn("跳過格式不正確或缺少必要資訊的城市數據:", city);
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

            // console.log(`正在處理城市: ${city.city}, 時區: ${city.timezone}, 計算出的 UTC 偏移: ${cityUTCOffset ? cityUTCOffset.toFixed(2) : 'N/A'}`);


            if (isNaN(cityUTCOffset)) {
                // console.warn(`無法獲取 ${city.city} (${city.timezone}) 的 UTC 偏移量，跳過此城市。`);
                continue;
            }

            // 檢查時區是否匹配 (容許誤差最多 30 分鐘)
            // 0.5 小時 = 30 分鐘
            if (Math.abs(cityUTCOffset - targetUTCOffsetHours) <= 0.5) {
                console.log(`城市 "${city.city}" (${city.timezone}) 的 UTC 偏移 ${cityUTCOffset.toFixed(2)} 符合目標範圍。加入候選。`);
                candidateCities.push(city);
            } else {
                // 可選：如果想看哪些城市因時差不符被排除，可以取消註解下面這行
                // console.log(`城市 "${city.city}" (${city.timezone}) 的 UTC 偏移 ${cityUTCOffset.toFixed(2)} 不符合目標範圍。`);
            }
        }

        console.log("符合時區條件的候選城市數量:", candidateCities.length);

        if (candidateCities.length === 0) {
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            resultDiv.innerHTML = `雖然你在當地 <strong>${userTimeFormatted}</strong> 起床，<br>但抱歉，目前找不到世界上當地時間約為 <strong>8:00 AM</strong> (與計算目標時區相差30分鐘內) 且符合時區條件的地區。<br><small>(嘗試尋找的目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)})</small>`;
            return;
        }

        let bestMatchCity = null;
        let minLatDiff = Infinity;
        console.log("從候選城市中尋找緯度最接近的城市...");
        for (const city of candidateCities) {
            const latDiff = Math.abs(city.latitude - targetLatitude);
            // console.log(`候選城市: ${city.city}, 緯度: ${city.latitude}, 與目標緯度差: ${latDiff.toFixed(2)}`);
            if (latDiff < minLatDiff) {
                minLatDiff = latDiff;
                bestMatchCity = city;
            }
        }

        if (bestMatchCity) {
            console.log("找到最佳匹配城市:", bestMatchCity.city);
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone); // 重新獲取以確保最新

            // 準備城市和國家的顯示名稱 (中英文)
            const finalCityName = bestMatchCity.city_zh && bestMatchCity.city_zh !== bestMatchCity.city ? `${bestMatchCity.city_zh} (${bestMatchCity.city})` : bestMatchCity.city;
            const finalCountryName = bestMatchCity.country_zh && bestMatchCity.country_zh !== bestMatchCity.country ? `${bestMatchCity.country_zh} (${bestMatchCity.country})` : bestMatchCity.country;

            // 計算目標城市的大約當地時間
            const bestCityCurrentUTCHours = userLocalHours + userLocalMinutes/60 - userUTCOffsetHours;
            let bestCityApproxLocalHour = bestCityCurrentUTCHours + cityActualUTCOffset;
            let bestCityApproxLocalMinute = (bestCityApproxLocalHour - Math.floor(bestCityApproxLocalHour)) * 60;
            bestCityApproxLocalHour = Math.floor(bestCityApproxLocalHour);

             // 處理跨日情況
            if (bestCityApproxLocalHour < 0) bestCityApproxLocalHour += 24;
            if (bestCityApproxLocalHour >= 24) bestCityApproxLocalHour -= 24;


            resultDiv.innerHTML = `你雖然在當地起床時間是 <strong>${userTimeFormatted}</strong>，<br>但是你的作息正好跟 <strong>${finalCityName} (${finalCountryName})</strong> 的人 (當地約 <strong>${String(bestCityApproxLocalHour).padStart(2, '0')}:${String(Math.round(bestCityApproxLocalMinute)).padStart(2, '0')}</strong>) 接近 <strong>8:00 AM</strong> 一樣，<br>一起開啟了新的一天！<br><small>(目標城市緯度: ${bestMatchCity.latitude.toFixed(2)}°, 計算目標緯度: ${targetLatitude.toFixed(2)}°, 緯度差: ${minLatDiff.toFixed(2)}°)<br>(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 城市實際 UTC 偏移: ${isNaN(cityActualUTCOffset) ? 'N/A' : cityActualUTCOffset.toFixed(2)}, 時區: ${bestMatchCity.timezone})</small>`;
        } else {
            console.log("在候選城市中未找到最佳緯度匹配。");
            const userTimeFormatted = userLocalDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            resultDiv.innerHTML = `雖然你在當地 <strong>${userTimeFormatted}</strong> 起床，<br>在符合時區的城市中，似乎找不到緯度匹配的城市。<br><small>(目標 UTC 偏移: ${targetUTCOffsetHours.toFixed(2)}, 目標緯度: ${targetLatitude.toFixed(2)})</small>`;
        }
        console.log("--- 尋找匹配城市結束 ---");
    }
});

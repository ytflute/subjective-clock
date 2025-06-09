# GeoNames API 設置說明

本專案已從使用本地的 `cities_data.json` 檔案改為使用 GeoNames Web Service API 來動態獲取城市和時區資訊。

## 設置步驟

### 1. 註冊 GeoNames 帳戶

1. 前往 [GeoNames 註冊頁面](https://www.geonames.org/login)
2. 點擊 "create a new user account"
3. 填寫註冊資訊並建立帳戶
4. 檢查您的電子郵件並點擊確認連結

### 2. 啟用 Web Service

1. 登入到您的 GeoNames 帳戶
2. 前往 [管理帳戶頁面](https://www.geonames.org/manageaccount)
3. 點擊 "Click here to enable" 啟用免費的 web service
4. 記下您的用戶名

### 3. 設置環境變數

在您的專案中設置環境變數：

```bash
# 在 .env 檔案中添加：
GEONAMES_USERNAME=your_geonames_username
```

或者在 Vercel、Netlify 等部署平台的環境變數設置中添加此變數。

## API 端點說明

### `/api/geonames-timezone`

根據經緯度獲取時區和城市資訊。

**參數：**
- `latitude` (number): 緯度 (-90 到 90)
- `longitude` (number): 經度 (-180 到 180) 
- `targetUTCOffset` (number): 目標UTC偏移

**回應範例：**
```json
{
  "city": "Hong Kong",
  "city_zh": "Hong Kong",
  "country": "Hong Kong",
  "country_zh": "Hong Kong", 
  "country_iso_code": "HK",
  "latitude": 22.3193,
  "longitude": 114.1694,
  "timezone": "Asia/Hong_Kong",
  "rawOffset": 8,
  "dstOffset": 8,
  "timezoneOffset": 8,
  "targetUTCOffset": 8,
  "distance": null,
  "population": null,
  "geoNamesId": null,
  "isGoodMatch": true,
  "timeDifference": 0
}
```

### `/api/find-city-geonames`

根據目標UTC偏移尋找匹配的城市。

**參數：**
- `targetUTCOffset` (number): 目標UTC偏移

**回應範例：**
```json
{
  "city": "Hong Kong",
  "city_zh": "香港",
  "country": "Hong Kong",
  "country_zh": "香港",
  "country_iso_code": "HK",
  "latitude": 22.3193,
  "longitude": 114.1694,
  "timezone": "Asia/Hong_Kong",
  "timezoneOffset": 8,
  "targetUTCOffset": 8,
  "timeDifference": 0,
  "isGoodMatch": true,
  "source": "geonames"
}
```

## 免費限制

GeoNames 免費帳戶有以下限制：

- 每日最多 1,000 個 API 請求
- 每小時最多 200 個請求
- 如果需要更多請求量，可以考慮升級到付費方案

## 備用機制

如果 GeoNames API 不可用，系統會自動切換到預定義的城市資料作為備用，確保服務的可用性。

## 優勢

相比使用本地 `cities_data.json` 檔案：

1. **實時資料**：獲取最新的時區和城市資訊
2. **較小的套件大小**：不需要載入大型的城市資料檔案
3. **準確性**：直接從權威的地理資料庫獲取資訊
4. **自動更新**：不需要手動更新城市資料

## 疑難排解

### 常見錯誤

1. **"demo" 帳戶限制**：不要在生產環境使用 "demo" 帳戶，請註冊自己的帳戶

2. **Web service 未啟用**：確保在 GeoNames 帳戶管理頁面啟用了 web service

3. **超過請求限制**：如果收到 HTTP 509 錯誤，表示已達到每日或每小時請求限制

4. **環境變數未設置**：確保 `GEONAMES_USERNAME` 環境變數正確設置

### 測試

您可以直接在瀏覽器中測試 GeoNames API：

```
http://api.geonames.org/timezoneJSON?lat=22.3&lng=114.1&username=YOUR_USERNAME
```

將 `YOUR_USERNAME` 替換為您的實際用戶名。 
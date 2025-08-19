# 主觀時鐘應用程式 - 模組化版本

## 📝 概述

這是原 `script.js` 的完全重構模組化版本，將原本 2900+ 行的巨大文件拆分為多個專職模組，提供更好的代碼組織、可維護性和可測試性。

## 🏗️ 模組架構

```
js/
├── script-modular.js          # 主入口文件
├── modules/
│   ├── config.js             # 配置管理
│   ├── utils.js              # 工具函數
│   ├── time-calculator.js    # 時間計算邏輯
│   ├── firebase-service.js   # Firebase 服務
│   ├── city-service.js       # 城市搜尋服務
│   ├── map-service.js        # 地圖渲染服務
│   ├── ui-manager.js         # UI 管理
│   ├── event-handler.js      # 事件處理
│   └── app.js               # 主應用程式類
└── README-MODULAR.md         # 本文檔
```

## 📦 模組詳細說明

### 1. `config.js` - 配置管理模組
**職責**: 管理應用程式的所有配置和常數
- Firebase 配置管理
- API 端點配置
- 地圖配置參數
- 時間相關常數
- 應用程式 ID 管理

**主要類別**: `Config`
**關鍵方法**:
- `setFirebaseConfig()` / `getFirebaseConfig()`
- `isSpecialTimeRange()` - 檢查特例時間段
- `getAppId()` - 獲取應用程式 ID

### 2. `utils.js` - 工具函數模組
**職責**: 提供通用的工具函數和輔助方法
- 字串處理和清理
- 數字格式化
- 安全屬性存取
- 防抖和節流函數
- 移動設備檢測

**主要類別**: `Utils`
**關鍵方法**:
- `generateSafeId()` - 生成安全的 ID
- `sanitizeNameToFirestoreId()` - 清理 Firestore ID
- `formatNumber()` - 格式化數字
- `safeGet()` - 安全取得巢狀屬性

### 3. `time-calculator.js` - 時間計算模組
**職責**: 處理所有時間相關的計算邏輯
- 基於分鐘數計算目標緯度
- UTC 偏移計算
- 地理位置獲取
- 時間格式化

**主要類別**: `TimeCalculator`
**關鍵方法**:
- `calculateTargetLatitudeFromTime()` - 計算目標緯度
- `getLatitudePreferenceDescription()` - 緯度偏好描述
- `calculateRequiredUTCOffset()` - 計算所需 UTC 偏移
- `getUserLocation()` - 獲取用戶位置

### 4. `firebase-service.js` - Firebase 服務模組
**職責**: 處理所有 Firebase 相關操作
- Firebase 初始化和認證
- 用戶歷史記錄管理
- 全域記錄管理
- 城市訪問統計

**主要類別**: `FirebaseService`
**關鍵方法**:
- `initialize()` - 初始化 Firebase
- `authenticateUser()` - 用戶認證
- `saveHistoryRecord()` - 儲存歷史記錄
- `getUserHistory()` - 獲取用戶歷史
- `getUserCityVisitStats()` - 獲取城市訪問統計

### 5. `city-service.js` - 城市搜尋服務模組
**職責**: 處理城市搜尋和匹配邏輯
- GeoNames API 整合
- 城市選擇演算法
- 故事內容獲取
- 早餐圖片生成

**主要類別**: `CityService`
**關鍵方法**:
- `findMatchingCity()` - 尋找匹配城市
- `selectBestCity()` - 選擇最佳城市
- `fetchStoryFromAPI()` - 獲取故事內容
- `generateBreakfastImage()` - 生成早餐圖片

### 6. `map-service.js` - 地圖渲染服務模組
**職責**: 處理所有地圖相關操作
- Leaflet 地圖實例管理
- 多種地圖類型渲染
- 標記和路線繪製
- 宇宙主題特效

**主要類別**: `MapService`
**關鍵方法**:
- `renderMainResultMap()` - 渲染主結果地圖
- `renderHistoryMap()` - 渲染歷史地圖
- `renderGlobalMap()` - 渲染全域地圖
- `renderUniverseTheme()` - 渲染宇宙主題

### 7. `ui-manager.js` - UI 管理模組
**職責**: 處理所有用戶介面相關操作
- DOM 元素管理
- 狀態顯示（載入、錯誤、成功）
- 結果展示
- 早餐功能 UI

**主要類別**: `UIManager`
**關鍵方法**:
- `showLoading()` / `showError()` / `showSuccess()`
- `displayCityResult()` - 顯示城市結果
- `updateUserDisplay()` - 更新用戶顯示
- `showBreakfastButton()` / `showBreakfastImage()`

### 8. `event-handler.js` - 事件處理模組
**職責**: 處理所有用戶互動事件
- 按鈕點擊事件
- 表單輸入事件
- Tab 切換事件
- 觸控支援

**主要類別**: `EventHandler`
**關鍵方法**:
- `handleFindCity()` - 處理找城市
- `handleSetUserName()` - 處理設置用戶名稱
- `handleLoadHistory()` - 處理載入歷史
- `handleLoadGlobalMap()` - 處理載入全域地圖

### 9. `app.js` - 主應用程式類
**職責**: 統籌管理所有模組的初始化和協調
- 服務模組初始化
- 全域函數設置
- 錯誤處理
- 生命週期管理

**主要類別**: `SubjectiveClockApp`
**關鍵方法**:
- `initialize()` - 初始化應用程式
- `getService()` - 獲取服務實例
- `switchTab()` - Tab 切換邏輯
- `cleanup()` - 清理資源

## 🚀 使用方式

### 1. 包含模組化版本
```html
<!-- 使用模組化版本的 HTML 文件 -->
<script type="module" src="js/script-modular.js"></script>
```

### 2. 開發工具
在開發環境中，可以使用以下工具進行除錯：
```javascript
// 獲取應用程式實例
const app = window.devTools.app();

// 獲取應用程式狀態
const status = window.devTools.status();

// 重新初始化
await window.devTools.reinit();

// 測試功能
await window.devTools.testFindCity();
await window.devTools.testLoadHistory();
```

## 📊 對比原版的改進

| 方面 | 原版 script.js | 模組化版本 |
|------|----------------|------------|
| **文件大小** | 單一文件 2913 行 | 9 個模組，平均 300 行 |
| **可維護性** | ❌ 難以維護 | ✅ 模組化，易於維護 |
| **可測試性** | ❌ 難以測試 | ✅ 每個模組可獨立測試 |
| **可讀性** | ❌ 代碼混雜 | ✅ 職責分離，清晰易讀 |
| **可擴展性** | ❌ 難以擴展 | ✅ 模組化設計，易於擴展 |
| **錯誤處理** | ⚠️ 分散的錯誤處理 | ✅ 統一的錯誤處理機制 |
| **依賴管理** | ❌ 全域變數污染 | ✅ 明確的依賴關係 |
| **重複使用** | ❌ 代碼重複 | ✅ 模組重複使用 |

## 🛠️ 開發指南

### 添加新功能
1. 確定功能歸屬的模組
2. 在相應模組中添加方法
3. 在事件處理器中添加相應的處理邏輯
4. 更新 UI 管理器（如需要）

### 修改現有功能
1. 找到對應的模組
2. 修改相應的方法
3. 確保不破壞其他模組的依賴關係
4. 測試相關功能

### 除錯技巧
1. 使用瀏覽器的開發者工具
2. 利用 `window.devTools` 進行除錯
3. 查看控制台的模組載入日誌
4. 使用 `app.getStatus()` 檢查應用程式狀態

## 🔧 配置選項

模組化版本支援多種配置選項：

```javascript
// 在 config.js 中調整配置
Config.TARGET_LOCAL_HOUR = 8;  // 目標本地時間
Config.MAX_LATITUDE = 70;      // 最大緯度
Config.API_ENDPOINTS.findCity = '/api/find-city-geonames';  // API 端點
```

## 📱 瀏覽器支援

模組化版本需要支援 ES6 模組的現代瀏覽器：
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 16+

對於不支援的瀏覽器，請使用原版 `script.js`。

## 🎯 未來改進方向

1. **TypeScript 遷移**: 添加類型安全
2. **單元測試**: 為每個模組添加測試
3. **效能最佳化**: 懶載入和代碼分割
4. **離線支援**: Service Worker 和快取策略
5. **國際化**: 多語言支援
6. **主題系統**: 可自訂的 UI 主題

## 🐛 已知問題

1. 模組載入順序可能影響初始化
2. 某些瀏覽器的模組快取問題
3. 開發工具僅在 localhost 環境可用

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支
3. 遵循模組化架構原則
4. 添加適當的註釋和文檔
5. 測試新功能
6. 提交 Pull Request

---

**注意**: 這是一個實驗性的模組化重構，與原版功能完全相容，但使用了現代的 JavaScript 模組系統。如遇到問題，可以回退到原版 `script.js`。

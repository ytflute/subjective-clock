# 甦醒地圖模組化架構 v4.0.0

## 📋 概述

這是甦醒地圖樹莓派版本的重構版本，採用模組化設計，將各功能分離成獨立模組，並透過主控檔案統一管理。

## 🏗️ 架構設計

### 檔案結構
```
raspberrypi-dsi/
├── main_controller.py          # 主控檔案
├── run_modular.py             # 啟動腳本
├── modules/                   # 功能模組目錄
│   ├── __init__.py
│   ├── button_handler.py      # 按鈕處理模組
│   ├── audio_manager.py       # 音頻管理模組
│   ├── display_manager.py     # 螢幕顯示模組
│   ├── api_client.py         # API通訊模組
│   ├── firebase_sync.py      # Firebase同步模組
│   └── config_manager.py     # 配置管理模組
├── utils/                    # 工具函數
│   ├── __init__.py
│   ├── logger.py            # 日誌工具
│   └── helpers.py           # 輔助函數
├── config.py                # 配置檔案
└── requirements_modular.txt # 依賴清單
```

## 🔧 模組功能

### 1. 主控制器 (main_controller.py)
- **職責**：統一管理所有功能模組
- **功能**：初始化、事件協調、生命週期管理
- **優點**：單一入口點，清晰的控制流程

### 2. 按鈕處理模組 (button_handler.py)
- **職責**：GPIO按鈕事件處理
- **功能**：短按/長按檢測、事件回調
- **特色**：支援模擬模式，便於開發測試

### 3. 音頻管理模組 (audio_manager.py)
- **職責**：TTS語音生成和音頻播放
- **功能**：Festival/OpenAI TTS、音量控制
- **特色**：自動降級機制，確保穩定性

### 4. 顯示管理模組 (display_manager.py)
- **職責**：網頁顯示和狀態管理
- **功能**：Webview控制、JavaScript互動
- **特色**：支援模擬模式，無GUI環境也能運行

### 5. API客戶端模組 (api_client.py)
- **職責**：與後端API通訊
- **功能**：城市搜尋、記錄保存、故事生成
- **特色**：異步HTTP客戶端、自動重試

### 6. Firebase同步模組 (firebase_sync.py)
- **職責**：Firebase資料同步
- **功能**：記錄保存、歷史查詢
- **特色**：可選依賴，支援離線模式

### 7. 配置管理模組 (config_manager.py)
- **職責**：統一配置管理
- **功能**：配置載入、預設值處理
- **特色**：動態配置更新

## 🚀 使用方法

### 安裝依賴
```bash
pip install -r requirements_modular.txt

# 系統依賴（Ubuntu/Raspberry Pi OS）
sudo apt install festival alsa-utils
```

### 啟動程式
```bash
# 標準啟動
python3 run_modular.py

# 或直接啟動主控制器
python3 main_controller.py
```

### 配置設定
編輯 `config.py` 檔案：
```python
# 按鈕配置
BUTTON_CONFIG = {
    'pin': 18,
    'pull_up': True,
    'bounce_time': 300,
    'long_press_time': 2.0
}

# 音頻配置
AUDIO_CONFIG = {
    'enabled': True,
    'volume': 95,
    'output_device': 'default'
}

# TTS配置
TTS_CONFIG = {
    'engine': 'festival',
    'nova_integrated_mode': False  # 設為True啟用OpenAI TTS
}
```

## 🔍 測試和調試

### 模擬模式運行
當以下依賴不可用時，程式會自動進入模擬模式：
- RPi.GPIO → 使用模擬按鈕
- pywebview → 使用控制台輸出
- firebase-admin → 使用記憶體存儲

### 日誌系統
- **控制台輸出**：即時查看運行狀態
- **檔案日誌**：存儲在 `logs/` 目錄
- **分級日誌**：DEBUG、INFO、WARNING、ERROR

### 手動測試
```python
# 測試按鈕模組
from modules.button_handler import ButtonHandler
from modules.config_manager import ConfigManager

config = ConfigManager()
button = ButtonHandler(config, lambda x: print(f"按鈕: {x}"))
await button.initialize()
await button.simulate_button_press("short")
```

## 🔧 開發指南

### 添加新模組
1. 在 `modules/` 目錄創建新檔案
2. 繼承 `LoggerMixin` 類
3. 實現 `initialize()` 和 `cleanup()` 方法
4. 在主控制器中註冊模組

### 模組間通訊
- 透過主控制器協調
- 使用 asyncio 事件機制
- 避免模組間直接依賴

### 錯誤處理
- 每個模組獨立處理錯誤
- 提供降級和備用方案
- 記錄詳細錯誤日誌

## 📊 效能優化

### 異步設計
- 所有I/O操作使用 asyncio
- 非阻塞的事件處理
- 並發的API請求

### 資源管理
- 自動清理資源
- 記憶體使用優化
- 錯誤恢復機制

## 🔄 遷移指南

### 從舊版本遷移
1. 備份現有配置
2. 安裝新依賴
3. 更新配置格式
4. 測試功能正常

### 配置遷移
```bash
# 自動遷移腳本（待開發）
python3 migrate_config.py --from old_config.py --to config.py
```

## 🎯 優點總結

### ✅ 模組化設計
- 功能清晰分離
- 易於維護和擴展
- 獨立測試和調試

### ✅ 穩定性提升
- 多重錯誤處理
- 自動降級機制
- 完整的日誌系統

### ✅ 開發友好
- 支援模擬模式
- 清晰的API設計
- 詳細的文檔說明

### ✅ 部署靈活
- 可選依賴支援
- 多環境適配
- 簡化的配置管理

---

**這個模組化版本為甦醒地圖帶來了更好的可維護性和擴展性！** 🚀✨
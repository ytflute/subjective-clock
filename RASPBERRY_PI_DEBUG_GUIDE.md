# 🛠️ Raspberry Pi DSI 調試完整指南

## 📋 問題解決方案總覽

**你的問題**: 觸摸螢幕沒有觸發調試面板，需要通過 SSH remote shell 查看信息流

**解決方案**: 我們提供了 **6種不同的方法** 來觸發調試，並且 **3種方式** 通過 SSH 監控！

---

## 🚀 方法一：更新代碼並測試自動調試

### 1. 更新代碼
```bash
cd /path/to/your/subjective-clock02
git pull origin main
```

### 2. 運行正常程式
```bash
cd raspberrypi-dsi
python3 main_web_dsi.py
```

### 3. 觀察自動調試
⏰ **等待 6 秒** - 調試面板會**自動出現**在右上角！
- 黑底綠字的調試信息
- 實時顯示系統狀態

### 4. 多重觸發方式
- 🟢 **點擊螢幕 3 次** (降低了門檻)
- 🔵 **DEBUG 按鈕** (5秒後出現在左下角)
- 🟡 **STATUS 按鈕** (3秒後出現在DEBUG上方)
- ⌨️ **按鍵 Ctrl+D** (如果有鍵盤)

---

## 🖥️ 方法二：SSH Remote Shell 監控 (推薦)

### 1. SSH 連接到 Raspberry Pi
```bash
ssh pi@你的Pi的IP地址
```

### 2. 進入項目目錄
```bash
cd /path/to/your/subjective-clock02/raspberrypi-dsi
```

### 3. 運行 SSH 調試監控
```bash
python3 debug_monitor.py
```

#### 可用的監控命令：
- **`check`** - 完整系統診斷
- **`logs`** - 檢查系統進程
- **`chrome`** - Chrome 瀏覽器狀態  
- **`web`** - 網站訪問狀態
- **`Enter`** - 快速狀態檢查
- **`quit`** - 退出監控

#### 預期輸出範例：
```
2024-01-20 10:30:15 - INFO - 發現 Chrome 進程: ['1234', '5678']
2024-01-20 10:30:15 - INFO - 主程式正在運行
2024-01-20 10:30:16 - INFO - 網站可正常訪問
2024-01-20 10:30:16 - INFO - 發現 2 個瀏覽器標籤頁
2024-01-20 10:30:16 - INFO - 找到目標頁面: 甦醒地圖
```

---

## 🔧 方法三：調試模式控制器 (詳細信息)

### 1. 關閉正常程式 (如果正在運行)
```bash
# 找到並關閉 main_web_dsi.py
ps aux | grep main_web_dsi
kill [PID]
```

### 2. 運行調試模式
```bash
python3 web_controller_dsi_debug.py
```

### 3. 調試控制器功能
- 🖼️ **窗口模式**: 不是全屏，可以看到開發者工具
- 🔍 **自動開啟**: 開發者控制台自動顯示
- 📱 **強制觸發**: 自動嘗試顯示調試面板
- 💬 **交互命令**: 支援多種調試命令

#### 可用命令：
```bash
Enter        # 觸發按鈕 (startTheDay)
debug        # 強制顯示調試面板
state        # 檢查當前狀態
elements     # 檢查DOM元素數量
logs         # 查看瀏覽器控制台日誌
clear        # 清空控制台
help         # 顯示幫助
quit         # 退出
```

#### 預期日誌輸出：
```
2024-01-20 10:30:20 - INFO - 瀏覽器啟動成功 (調試模式)
2024-01-20 10:30:22 - INFO - 網站載入成功
2024-01-20 10:30:25 - INFO - 已嘗試強制顯示調試面板
2024-01-20 10:30:30 - INFO - 觸發 startTheDay 函數
2024-01-20 10:30:30 - INFO - startTheDay 函數執行結果: undefined
```

---

## 📱 觸發測試流程

### 步驟 1: 運行正常程式
```bash
cd raspberrypi-dsi
python3 main_web_dsi.py
```

### 步驟 2: 觀察自動觸發 (6秒內)
應該看到：
1. **初始載入畫面** - Leaflet 地圖背景
2. **6秒後** - 右上角自動出現調試面板
3. **3秒後** - 左下角出現藍色 STATUS 按鈕
4. **5秒後** - 左下角出現橘色 DEBUG 按鈕

### 步驟 3: 按下實體按鈕
觀察調試面板中的信息流：
```
[時間] 📘 狀態切換完成: loading
[時間] 🔍 updateResultData 被調用  
[時間] ✅ Day 計數器已更新: 1
[時間] ✅ 狀態切換完成: result
```

### 步驟 4: 檢查錯誤信息
如果有問題，會顯示：
```
[時間] ❌ 關鍵問題: result-info-panel 元素未找到!
[時間] ❌ dayNumber 元素未找到
```

---

## 🆘 故障排除

### 如果調試面板沒有出現：
1. **點擊 STATUS 按鈕** (左下角藍色)
2. **點擊 DEBUG 按鈕** (左下角橘色)  
3. **嘗試點擊螢幕 3 次**
4. **使用 SSH 調試監控**

### 如果按鈕無反應：
```bash
# SSH 連接，運行監控
python3 debug_monitor.py
# 然後輸入 'check' 檢查系統狀態
```

### 如果網頁不載入：
```bash
# 檢查網路連線
ping google.com

# 檢查網站可訪問性
curl -I https://subjective-clock.vercel.app/pi.html
```

---

## 📞 請回報以下信息

執行完上述步驟後，請告訴我：

### 1. 自動調試面板
- [ ] 6秒後是否出現綠色調試面板？
- [ ] STATUS 和 DEBUG 按鈕是否出現？

### 2. SSH 監控結果
從 `python3 debug_monitor.py` 的輸出：
- Chrome 進程狀態？
- 主程式運行狀態？
- 網站訪問狀態？

### 3. 按鈕測試結果
按下實體按鈕後：
- 調試面板中的信息流？
- 有沒有紅色錯誤信息？
- 當前狀態是什麼？

### 4. 如果仍有問題
使用調試模式控制器：
```bash
python3 web_controller_dsi_debug.py
# 按 Enter 觸發按鈕
# 輸入 'elements' 檢查元素
# 輸入 'state' 查看狀態
```

---

## 🎯 預期成功結果

**正常流程應該是**：
1. ✅ 6秒後自動顯示調試面板
2. ✅ 按鈕出現在左下角
3. ✅ 按下實體按鈕後看到狀態切換信息
4. ✅ 看到 "Day 計數器已更新" 的成功信息
5. ✅ 最終狀態切換到 "result"

有了這些調試工具，我們一定能找到問題並修復它！🚀 
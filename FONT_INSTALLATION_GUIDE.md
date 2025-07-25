# 🔤 字體安裝指南

## 📋 **需要安裝的字體**

### **1. ByteBounce**（英文像素字體）
- **用途**：英文文字顯示
- **風格**：像素藝術風格，適合復古遊戲界面

### **2. GB18030 Bitmap**（中文點陣字體）
- **用途**：中文文字顯示  
- **風格**：點陣字體，清晰的中文顯示

## 🛠️ **安裝方法**

### **Windows 系統**
1. 下載字體檔案（.ttf 或 .otf）
2. 右鍵點擊字體檔案 → 選擇「安裝」
3. 或者複製到 `C:\Windows\Fonts\` 資料夾

### **macOS 系統**
1. 下載字體檔案
2. 雙擊字體檔案
3. 點擊「安裝字體」按鈕
4. 或者複製到 `~/Library/Fonts/` 資料夾

### **Linux 系統**
1. 下載字體檔案
2. 複製到 `~/.fonts/` 資料夾
3. 執行 `fc-cache -fv` 重新載入字體快取

### **樹莓派 (Raspberry Pi OS)**
```bash
# 創建字體目錄
mkdir -p ~/.fonts

# 將字體檔案複製到字體目錄
cp ByteBounce.ttf ~/.fonts/
cp "GB18030 Bitmap.ttf" ~/.fonts/

# 更新字體快取
fc-cache -fv

# 驗證字體安裝
fc-list | grep -i bytebounce
fc-list | grep -i gb18030
```

## 🔍 **字體下載來源**

### **ByteBounce**
- 搜尋 "ByteBounce pixel font"
- 檢查 Google Fonts、DaFont、1001Fonts 等字體網站

### **GB18030 Bitmap**
- 搜尋 "GB18030 bitmap font" 或 "中文點陣字體"
- 可能需要從專門的中文字體資源網站下載

## 📱 **備用字體方案**

如果無法安裝指定字體，系統會自動使用備用字體：

### **英文備用順序**
1. `ByteBounce` （主要）
2. `Press Start 2P` （Google Fonts 備用）
3. `Courier New` （系統備用）
4. `monospace` （通用備用）

### **中文備用順序**
1. `GB18030 Bitmap` （主要）
2. `Microsoft YaHei` / `微軟雅黑` （現代備用）
3. `SimHei` / `黑體` （經典備用）
4. `sans-serif` （通用備用）

## ✅ **驗證字體是否正確載入**

1. 開啟甦醒地圖網頁
2. 檢查文字顯示是否為像素風格
3. 開啟瀏覽器開發者工具（F12）
4. 在 Console 中執行：
   ```javascript
   document.fonts.check('16px ByteBounce')
   document.fonts.check('16px "GB18030 Bitmap"')
   ```
5. 如果返回 `true` 表示字體已正確載入

## 🔧 **疑難排解**

### **字體顯示不正確**
1. 確認字體檔案已正確安裝
2. 重新啟動瀏覽器
3. 清除瀏覽器快取
4. 檢查字體檔名是否與 CSS 中的名稱一致

### **中文顯示異常**
1. 確認字體支援繁體中文
2. 檢查字體編碼是否為 GB18030
3. 嘗試使用其他中文點陣字體

## 📞 **技術支援**

如果遇到字體安裝問題，請提供：
1. 作業系統版本
2. 瀏覽器版本
3. 字體檔案來源
4. 錯誤截圖

---

**注意**：字體的版權歸原作者所有，請確保從合法來源下載並遵循授權條款。 
# LCD ST7920 故障排除指南

## LCD ST7920 運行需求

### 硬體連接檢查清單

#### 電源連接
- ✅ VCC → 5V (Pin 2)
- ✅ GND → GND (Pin 6)
- ✅ 確認電源穩定，建議使用品質良好的5V 3A電源

#### 控制信號連接
- ✅ RS → GPIO 26 (Pin 37)
- ✅ E → GPIO 19 (Pin 35)  
- ✅ RST → GPIO 20 (Pin 38)
- ✅ PSB → GPIO 21 (Pin 40) **重要：必須接HIGH選擇並行模式**

#### 資料線連接
- ✅ D4 → GPIO 13 (Pin 33)
- ✅ D5 → GPIO 6 (Pin 31)
- ✅ D6 → GPIO 5 (Pin 29)
- ✅ D7 → GPIO 11 (Pin 23)

### 軟體需求

#### 系統套件
```bash
# 已包含在 install.sh 中
sudo apt install -y python3-rpi.gpio i2c-tools build-essential
```

#### Python套件
```bash
# 已包含在 requirements.txt 中
RPi.GPIO==0.7.1
```

#### GPIO權限設定
```bash
# 已包含在 install.sh 中
sudo usermod -a -G gpio pi
```

## 常見問題與解決方案

### 1. LCD沒有顯示任何內容

**可能原因和解決方案：**

#### 檢查電源
```bash
# 檢查5V電源電壓
sudo apt install -y wiringpi
gpio readall  # 查看GPIO狀態
```

#### 檢查連接
```bash
# 測試GPIO輸出
python3 -c "
import RPi.GPIO as GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup(26, GPIO.OUT)  # RS pin
GPIO.output(26, GPIO.HIGH)
print('RS pin set to HIGH')
GPIO.cleanup()
"
```

#### 檢查PSB針腳
PSB針腳必須連接到HIGH (3.3V或5V) 來選擇並行模式：
```bash
# 確認PSB設定
python3 -c "
import RPi.GPIO as GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup(21, GPIO.OUT)  # PSB pin
GPIO.output(21, GPIO.HIGH)
print('PSB set to HIGH for parallel mode')
GPIO.cleanup()
"
```

### 2. LCD顯示亂碼或不穩定

#### 降低時鐘頻率
如果顯示不穩定，可能需要降低通信速度：

編輯 `lcd_driver.py` 中的延遲時間：
```python
def write_8_bits(self, value):
    # 增加延遲時間
    time.sleep(0.001)  # 從0.0001增加到0.001
```

#### 檢查電源穩定性
```bash
# 檢查電源電壓
vcgencmd measure_volts core
vcgencmd measure_volts sdram_c
```

### 3. 權限錯誤

#### GPIO權限問題
```bash
# 檢查當前用戶群組
groups

# 如果沒有gpio群組，手動添加
sudo usermod -a -G gpio $USER

# 登出並重新登入，或重新啟動
sudo reboot
```

#### 執行權限
```bash
# 確保腳本有執行權限
chmod +x test_hardware.py
chmod +x main.py
```

### 4. 系統服務問題

#### 檢查服務狀態
```bash
# 查看服務狀態
sudo systemctl status subjective-clock.service

# 查看詳細日誌
sudo journalctl -u subjective-clock.service -f

# 重新啟動服務
sudo systemctl restart subjective-clock.service
```

## 測試步驟

### 1. 基本GPIO測試
```bash
cd raspberrypi
source venv/bin/activate
python3 -c "
import RPi.GPIO as GPIO
print('GPIO module imported successfully')
GPIO.setmode(GPIO.BCM)
print('GPIO mode set to BCM')
GPIO.cleanup()
print('GPIO test completed')
"
```

### 2. LCD硬體測試
```bash
# 執行LCD專用測試
python3 test_hardware.py lcd
```

### 3. 完整系統測試
```bash
# 執行所有硬體測試
python3 test_hardware.py
```

## LCD規格和限制

### ST7920 技術規格
- **解析度**: 128x64 像素
- **字符模式**: 16x4 字符 (每行16個字符，共4行)
- **電源**: 5V (3.3V也可工作但可能亮度較低)
- **介面**: 並行 8位/4位 或 串行 SPI
- **字符集**: 主要支援ASCII字符

### 顯示限制
- **中文支援**: 有限，ST7920內建的中文字型庫有限
- **自訂字符**: 支援8個自訂字符
- **更新頻率**: 建議不要過於頻繁更新以避免閃爍

## 進階配置

### 啟用SPI (如果需要改為串行模式)
```bash
sudo raspi-config
# 選擇 Interfacing Options → SPI → Enable
```

### 設定開機自動執行
```bash
# 啟用系統服務
sudo systemctl enable subjective-clock.service

# 檢查服務是否正確啟用
sudo systemctl is-enabled subjective-clock.service
```

## 替代方案

### 如果ST7920有問題，可考慮使用：

1. **I2C LCD (如HD44780 + PCF8574)**
   - 只需要2根線 (SDA, SCL)
   - 更簡單的連接
   - 豐富的Python庫支援

2. **SPI LCD**
   - 3-4根線連接
   - 更快的更新速度
   - 支援彩色顯示

3. **OLED顯示器**
   - 更好的對比度
   - 內建字型支援
   - I2C或SPI介面

## 聯繫支援

如果上述解決方案都無法解決問題，請提供以下資訊：

1. Raspberry Pi型號和作業系統版本
2. 錯誤訊息完整輸出
3. `sudo journalctl -u subjective-clock.service` 的輸出
4. 硬體連接的照片
5. `gpio readall` 的輸出 
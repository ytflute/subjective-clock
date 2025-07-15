#!/usr/bin/env python3
"""
甦醒地圖 - 網頁控制器
透過 Selenium 控制瀏覽器開啟甦醒地圖網站
"""

import os
import sys
import time
import threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, WebDriverException

# 載入環境變數
def load_env():
    """載入 .env 檔案中的環境變數"""
    env_vars = {}
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except FileNotFoundError:
        print("警告：找不到 .env 檔案，使用預設設定")
    return env_vars

class WebController:
    def __init__(self, lcd_display=None):
        """
        初始化網頁控制器
        
        Args:
            lcd_display: LCD 顯示器物件，用於顯示狀態訊息
        """
        self.lcd = lcd_display
        self.driver = None
        self.env_vars = load_env()
        
        # 從環境變數或使用預設值
        self.website_url = self.env_vars.get('WEBSITE_URL', 'https://subjective-clock.vercel.app/')
        self.user_name = self.env_vars.get('USER_NAME', 'future')
        self.browser_command = self.env_vars.get('BROWSER_COMMAND', 'chromium-browser')
        
        print(f"使用瀏覽器：{self.browser_command}")
        print(f"目標網站：{self.website_url}")
        print(f"使用者名稱：{self.user_name}")
    
    def _setup_chrome_options(self):
        """設定 Chrome/Chromium 選項"""
        options = Options()
        
        # 基本選項
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-web-security')
        options.add_argument('--allow-running-insecure-content')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-plugins')
        options.add_argument('--disable-images')  # 加快載入速度
        options.add_argument('--disable-javascript-harmony-shipping')
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-backgrounding-occluded-windows')
        options.add_argument('--disable-renderer-backgrounding')
        
        # 全螢幕模式
        options.add_argument('--start-maximized')
        options.add_argument('--kiosk')  # 無邊框全螢幕
        
        # 自動播放音頻
        options.add_argument('--autoplay-policy=no-user-gesture-required')
        
        # 設定使用者資料目錄
        options.add_argument('--user-data-dir=/tmp/chrome-data')
        
        # 根據瀏覽器類型設定二進位檔案路徑
        if 'chromium' in self.browser_command.lower():
            # Chromium 可能的路徑
            chromium_paths = [
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/snap/bin/chromium'
            ]
            for path in chromium_paths:
                if os.path.exists(path):
                    options.binary_location = path
                    break
        else:
            # Google Chrome 可能的路徑
            chrome_paths = [
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/opt/google/chrome/chrome'
            ]
            for path in chrome_paths:
                if os.path.exists(path):
                    options.binary_location = path
                    break
        
        return options
    
    def start_browser(self):
        """啟動瀏覽器"""
        try:
            if self.lcd:
                self.lcd.display_message("正在啟動瀏覽器...", "請稍候")
            
            options = self._setup_chrome_options()
            
            # 設定 ChromeDriver
            service_args = ['--verbose', '--log-path=/tmp/chromedriver.log']
            
            self.driver = webdriver.Chrome(options=options, service_args=service_args)
            self.driver.set_page_load_timeout(30)
            
            print("瀏覽器啟動成功")
            return True
            
        except WebDriverException as e:
            error_msg = f"瀏覽器啟動失敗：{str(e)}"
            print(error_msg)
            if self.lcd:
                self.lcd.display_message("瀏覽器啟動失敗", "請檢查設定")
            return False
        except Exception as e:
            error_msg = f"未預期的錯誤：{str(e)}"
            print(error_msg)
            if self.lcd:
                self.lcd.display_message("啟動錯誤", "請重試")
            return False
    
    def open_website(self):
        """開啟甦醒地圖網站"""
        try:
            if not self.driver:
                print("瀏覽器尚未啟動")
                return False
            
            if self.lcd:
                self.lcd.display_message("正在載入網站...", self.website_url.split('//')[1][:16])
            
            print(f"正在開啟網站：{self.website_url}")
            self.driver.get(self.website_url)
            
            # 等待頁面載入
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            print("網站載入成功")
            return True
            
        except TimeoutException:
            error_msg = "網站載入逾時"
            print(error_msg)
            if self.lcd:
                self.lcd.display_message("載入逾時", "請檢查網路")
            return False
        except Exception as e:
            error_msg = f"載入網站錯誤：{str(e)}"
            print(error_msg)
            if self.lcd:
                self.lcd.display_message("載入失敗", "請重試")
            return False
    
    def fill_username(self):
        """填入使用者名稱"""
        try:
            if self.lcd:
                self.lcd.display_message("正在填入名稱...", f"使用者：{self.user_name}")
            
            # 等待使用者名稱輸入框出現
            username_input = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "userName"))
            )
            
            # 清除並輸入使用者名稱
            username_input.clear()
            username_input.send_keys(self.user_name)
            
            print(f"已填入使用者名稱：{self.user_name}")
            return True
            
        except TimeoutException:
            print("找不到使用者名稱輸入框")
            if self.lcd:
                self.lcd.display_message("找不到輸入框", "請檢查網頁")
            return False
        except Exception as e:
            print(f"填入使用者名稱錯誤：{str(e)}")
            if self.lcd:
                self.lcd.display_message("填入失敗", "請重試")
            return False
    
    def click_start_button(self):
        """點擊開始按鈕"""
        try:
            if self.lcd:
                self.lcd.display_message("正在啟動...", "開始這一天")
            
            # 等待開始按鈕出現並可點擊
            start_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "startButton"))
            )
            
            # 點擊開始按鈕
            start_button.click()
            
            print("已點擊開始按鈕")
            
            # 等待一下讓頁面反應
            time.sleep(2)
            
            if self.lcd:
                self.lcd.display_message("甦醒地圖已啟動", "請查看瀏覽器")
            
            return True
            
        except TimeoutException:
            print("找不到開始按鈕")
            if self.lcd:
                self.lcd.display_message("找不到按鈕", "請檢查網頁")
            return False
        except Exception as e:
            print(f"點擊開始按鈕錯誤：{str(e)}")
            if self.lcd:
                self.lcd.display_message("點擊失敗", "請重試")
            return False
    
    def run_full_sequence(self):
        """執行完整的自動化序列"""
        try:
            # 1. 啟動瀏覽器
            if not self.start_browser():
                return False
            
            time.sleep(2)
            
            # 2. 開啟網站
            if not self.open_website():
                return False
            
            time.sleep(3)
            
            # 3. 填入使用者名稱
            if not self.fill_username():
                return False
            
            time.sleep(1)
            
            # 4. 點擊開始按鈕
            if not self.click_start_button():
                return False
            
            print("自動化序列完成！")
            return True
            
        except Exception as e:
            print(f"自動化序列錯誤：{str(e)}")
            if self.lcd:
                self.lcd.display_message("執行失敗", "請重試")
            return False
    
    def close_browser(self):
        """關閉瀏覽器"""
        try:
            if self.driver:
                self.driver.quit()
                self.driver = None
                print("瀏覽器已關閉")
        except Exception as e:
            print(f"關閉瀏覽器錯誤：{str(e)}")
    
    def keep_alive(self):
        """保持程式運行"""
        try:
            while self.driver:
                time.sleep(10)
                # 檢查瀏覽器是否還在運行
                try:
                    self.driver.current_url
                except:
                    print("瀏覽器已關閉")
                    break
        except KeyboardInterrupt:
            print("收到中斷訊號，正在關閉...")
        finally:
            self.close_browser()

def main():
    """主程式 - 測試用"""
    print("甦醒地圖網頁控制器測試")
    
    controller = WebController()
    
    try:
        success = controller.run_full_sequence()
        if success:
            print("測試成功！按 Ctrl+C 結束程式")
            controller.keep_alive()
        else:
            print("測試失敗")
    except KeyboardInterrupt:
        print("程式被中斷")
    finally:
        controller.close_browser()

if __name__ == "__main__":
    main() 
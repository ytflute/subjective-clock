#!/usr/bin/env python3
"""
甦醒地圖 - DSI版本網頁控制器
透過 Selenium 控制瀏覽器開啟甦醒地圖網站，整合 DSI 螢幕顯示
"""

import os
import sys
import time
import threading
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, WebDriverException

# 導入配置
from config import API_ENDPOINTS, USER_CONFIG

logger = logging.getLogger(__name__)

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
        logger.warning("找不到 .env 檔案，使用預設設定")
    return env_vars

class WebControllerDSI:
    def __init__(self, display_manager=None):
        """
        初始化 DSI 版本網頁控制器
        
        Args:
            display_manager: DSI 顯示管理器物件
        """
        self.display = display_manager
        self.driver = None
        self.env_vars = load_env()
        
        # 從環境變數或使用預設值
        self.website_url = self.env_vars.get('WEBSITE_URL', 'https://subjective-clock.vercel.app/')
        self.user_name = self.env_vars.get('USER_NAME', USER_CONFIG['display_name'])
        self.browser_command = self.env_vars.get('BROWSER_COMMAND', 'chromium-browser')
        
        logger.info(f"使用瀏覽器：{self.browser_command}")
        logger.info(f"目標網站：{self.website_url}")
        logger.info(f"使用者名稱：{self.user_name}")
    
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
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-backgrounding-occluded-windows')
        options.add_argument('--disable-renderer-backgrounding')
        
        # DSI 螢幕優化設定
        options.add_argument('--window-size=800,480')  # DSI 螢幕解析度
        options.add_argument('--start-maximized')
        options.add_argument('--kiosk')  # 無邊框全螢幕
        
        # 自動播放音頻
        options.add_argument('--autoplay-policy=no-user-gesture-required')
        
        # 設定使用者資料目錄
        options.add_argument('--user-data-dir=/tmp/chrome-data-dsi')
        
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
            if self.display:
                self.display.show_loading_screen("正在啟動瀏覽器...")
            
            options = self._setup_chrome_options()
            
            # 設定 ChromeDriver Service (Selenium 4.x 方式)
            service = Service()
            service.log_path = "/tmp/chromedriver-dsi.log"
            
            self.driver = webdriver.Chrome(service=service, options=options)
            self.driver.set_page_load_timeout(30)
            
            logger.info("瀏覽器啟動成功")
            return True
            
        except WebDriverException as e:
            error_msg = f"瀏覽器啟動失敗：{str(e)}"
            logger.error(error_msg)
            if self.display:
                self.display.show_error_screen('display_error')
            return False
        except Exception as e:
            error_msg = f"未預期的錯誤：{str(e)}"
            logger.error(error_msg)
            if self.display:
                self.display.show_error_screen('unknown_error')
            return False
    
    def open_website(self):
        """開啟甦醒地圖網站"""
        try:
            if not self.driver:
                logger.error("瀏覽器尚未啟動")
                return False
            
            if self.display:
                self.display.show_loading_screen("正在載入甦醒地圖...")
            
            logger.info(f"正在開啟網站：{self.website_url}")
            self.driver.get(self.website_url)
            
            # 等待頁面載入
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            logger.info("網站載入成功")
            return True
            
        except TimeoutException:
            error_msg = "網站載入逾時"
            logger.error(error_msg)
            if self.display:
                self.display.show_error_screen('network_error')
            return False
        except Exception as e:
            error_msg = f"載入網站錯誤：{str(e)}"
            logger.error(error_msg)
            if self.display:
                self.display.show_error_screen('api_error')
            return False
    
    def fill_username(self):
        """填入使用者名稱"""
        try:
            if self.display:
                self.display.show_loading_screen(f"正在設定使用者：{self.user_name}")
            
            # 等待使用者名稱輸入框出現
            username_input = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "userName"))
            )
            
            # 清除並輸入使用者名稱
            username_input.clear()
            username_input.send_keys(self.user_name)
            
            logger.info(f"已填入使用者名稱：{self.user_name}")
            return True
            
        except TimeoutException:
            logger.error("找不到使用者名稱輸入框")
            if self.display:
                self.display.show_error_screen('api_error')
            return False
        except Exception as e:
            logger.error(f"填入使用者名稱錯誤：{str(e)}")
            if self.display:
                self.display.show_error_screen('unknown_error')
            return False
    
    def click_start_button(self):
        """點擊開始按鈕"""
        try:
            if self.display:
                self.display.show_loading_screen("正在啟動甦醒地圖...")
            
            # 等待開始按鈕出現並可點擊
            start_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "startButton"))
            )
            
            # 點擊開始按鈕
            start_button.click()
            
            logger.info("已點擊開始按鈕")
            
            # 等待一下讓頁面反應
            time.sleep(2)
            
            # 顯示成功訊息
            if self.display:
                # 創建假的城市資料來顯示成功畫面
                success_data = {
                    'city': '甦醒地圖',
                    'country': '已在瀏覽器中開啟',
                    'country_iso_code': 'web',
                    'latitude': 0,
                    'longitude': 0,
                    'local_time': time.strftime("%H:%M:%S")
                }
                self.display.show_result_screen(success_data)
            
            return True
            
        except TimeoutException:
            logger.error("找不到開始按鈕")
            if self.display:
                self.display.show_error_screen('api_error')
            return False
        except Exception as e:
            logger.error(f"點擊開始按鈕錯誤：{str(e)}")
            if self.display:
                self.display.show_error_screen('unknown_error')
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
            
            logger.info("甦醒地圖網頁模式啟動成功！")
            return True
            
        except Exception as e:
            logger.error(f"自動化序列錯誤：{str(e)}")
            if self.display:
                self.display.show_error_screen('unknown_error')
            return False
    
    def close_browser(self):
        """關閉瀏覽器"""
        try:
            if self.driver:
                self.driver.quit()
                self.driver = None
                logger.info("瀏覽器已關閉")
        except Exception as e:
            logger.error(f"關閉瀏覽器錯誤：{str(e)}")
    
    def keep_alive(self):
        """保持程式運行，監控瀏覽器狀態"""
        try:
            while self.driver:
                time.sleep(10)
                # 檢查瀏覽器是否還在運行
                try:
                    self.driver.current_url
                    # 瀏覽器正常運行，可以在這裡添加其他監控邏輯
                except:
                    logger.info("瀏覽器已關閉")
                    break
        except KeyboardInterrupt:
            logger.info("收到中斷訊號")
        finally:
            self.close_browser()

def main():
    """主程式 - 測試用"""
    print("甦醒地圖 DSI 版本網頁控制器測試")
    
    # 設定日誌
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    controller = WebControllerDSI()
    
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
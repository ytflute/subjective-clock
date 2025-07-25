#!/usr/bin/env python3
"""
甦醒地圖 - 網頁控制器 (調試版本)
透過 Selenium 控制瀏覽器開啟甦醒地圖網站
啟用開發者工具，方便調試
"""

import os
import time
import logging
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    WebDriverException, TimeoutException, 
    NoSuchElementException, ElementNotInteractableException
)
import subprocess
import platform

logger = logging.getLogger(__name__)

# 配置常數
WEBSITE_URL = "https://subjective-clock.vercel.app/pi.html"
USER_NAME = "future"
WAIT_TIMEOUT = 30
LOAD_DELAY = 2

def get_chromedriver_path():
    """自動偵測 ChromeDriver 路徑"""
    possible_paths = [
        "/usr/bin/chromedriver",
        "/usr/local/bin/chromedriver", 
        "/opt/homebrew/bin/chromedriver",
        "/snap/bin/chromium.chromedriver",
        "chromedriver"
    ]
    
    for path in possible_paths:
        if os.path.exists(path) or subprocess.run(['which', path], 
                                                capture_output=True).returncode == 0:
            logger.info(f"找到 ChromeDriver: {path}")
            return path
    
    logger.warning("未找到 ChromeDriver，嘗試讓 Selenium 自動處理")
    return None

class WebControllerDSIDebug:
    def __init__(self):
        """
        初始化網頁控制器 (調試版本)
        """
        self.driver = None
        self.user_name = USER_NAME
        self.website_url = WEBSITE_URL
        self.wait = None
        self.logger = logging.getLogger(self.__class__.__name__)
        
        self.logger.info("甦醒地圖網頁控制器初始化 (調試模式)")

    def _setup_chrome_options(self):
        """設定 Chrome 瀏覽器選項 (調試版本)"""
        options = Options()
        
        # 基本設定
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-extensions')
        
        # 窗口模式設定 (不使用kiosk模式，方便調試)
        options.add_argument('--window-size=800,480')
        options.add_argument('--window-position=100,100')
        
        # 啟用開發者工具
        options.add_argument('--auto-open-devtools-for-tabs')
        
        # 用戶資料目錄
        options.add_argument('--user-data-dir=/tmp/chrome-data-debug')
        
        # 自動播放政策
        options.add_argument('--autoplay-policy=no-user-gesture-required')
        
        # 啟用遠程調試
        options.add_argument('--remote-debugging-port=9222')
        
        return options

    def start_browser(self):
        """啟動瀏覽器 (調試版本)"""
        try:
            # 終止現有的 Chrome 進程
            subprocess.run(['pkill', '-f', 'chrome'], capture_output=True)
            time.sleep(2)
            
            # 設定 ChromeDriver
            chromedriver_path = get_chromedriver_path()
            service = Service(chromedriver_path) if chromedriver_path else Service()
            
            # 創建瀏覽器實例
            options = self._setup_chrome_options()
            self.driver = webdriver.Chrome(service=service, options=options)
            self.wait = WebDriverWait(self.driver, WAIT_TIMEOUT)
            
            self.logger.info("瀏覽器啟動成功 (調試模式)")
            return True
            
        except Exception as e:
            self.logger.error(f"瀏覽器啟動失敗: {e}")
            return False

    def open_website(self):
        """開啟甦醒地圖網站"""
        try:
            self.logger.info(f"正在開啟網站: {self.website_url}")
            self.driver.get(self.website_url)
            
            # 等待頁面載入
            time.sleep(LOAD_DELAY)
            
            # 檢查頁面是否載入成功
            if "甦醒地圖" in self.driver.title or "pi.html" in self.driver.current_url:
                self.logger.info("網站載入成功")
                return True
            else:
                self.logger.warning("網站載入狀態不明確，但繼續執行")
                return True
                
        except Exception as e:
            self.logger.error(f"開啟網站失敗: {e}")
            return False

    def click_start_button(self):
        """點擊開始按鈕"""
        try:
            self.logger.info("觸發 startTheDay 函數")
            
            # 直接執行 JavaScript 函數
            result = self.driver.execute_script("return startTheDay();")
            self.logger.info(f"startTheDay 函數執行結果: {result}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"點擊開始按鈕失敗: {e}")
            return False

    def run_debug_session(self):
        """運行調試會話"""
        if not self.start_browser():
            return False
            
        if not self.open_website():
            return False
            
        self.logger.info("調試模式準備就緒!")
        self.logger.info("瀏覽器開發者工具已自動開啟")
        self.logger.info("可以使用以下方式觸發按鈕:")
        self.logger.info("1. 調用 click_start_button() 方法")
        self.logger.info("2. 在開發者控制台執行 startTheDay()")
        self.logger.info("3. 在網頁上快速點擊5次顯示調試面板")
        
        return True

    def close(self):
        """關閉瀏覽器"""
        try:
            if self.driver:
                self.driver.quit()
                self.logger.info("瀏覽器已關閉")
        except Exception as e:
            self.logger.error(f"關閉瀏覽器時發生錯誤: {e}")

if __name__ == "__main__":
    # 設定日誌
    logging.basicConfig(level=logging.INFO, 
                       format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    controller = WebControllerDSIDebug()
    
    try:
        if controller.run_debug_session():
            print("\n=== 調試模式啟動成功 ===")
            print("瀏覽器和開發者工具已開啟")
            print("按 Enter 鍵觸發按鈕，或輸入 'quit' 退出")
            
            while True:
                command = input("輸入命令 (Enter=觸發按鈕, quit=退出): ").strip()
                
                if command.lower() == 'quit':
                    break
                elif command == '':
                    controller.click_start_button()
                else:
                    print("未知命令")
                    
    except KeyboardInterrupt:
        print("\n用戶中斷")
    finally:
        controller.close() 
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time
import logging
import subprocess
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from config import USER_CONFIG, DEBUG_MODE

# 設定日誌
if DEBUG_MODE:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

class WebController:
    """網頁控制器：讓樹莓派控制甦醒地圖網頁"""
    
    def __init__(self, website_url="https://subjective-clock.vercel.app"):
        self.website_url = website_url
        self.driver = None
        self.setup_browser()
        
    def setup_browser(self):
        """設定瀏覽器"""
        try:
            # Chrome 瀏覽器選項
            chrome_options = Options()
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-web-security')
            chrome_options.add_argument('--allow-running-insecure-content')
            chrome_options.add_argument('--autoplay-policy=no-user-gesture-required')
            
            # 全螢幕模式（適合樹莓派）
            chrome_options.add_argument('--start-fullscreen')
            chrome_options.add_argument('--kiosk')
            
            # 啟動瀏覽器
            self.driver = webdriver.Chrome(options=chrome_options)
            logger.info("瀏覽器初始化成功")
            
        except Exception as e:
            logger.error(f"瀏覽器初始化失敗: {e}")
            raise
    
    def open_website(self):
        """打開甦醒地圖網站"""
        try:
            logger.info(f"正在打開網站: {self.website_url}")
            self.driver.get(self.website_url)
            
            # 等待頁面載入
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            logger.info("網站載入完成")
            return True
            
        except Exception as e:
            logger.error(f"打開網站失敗: {e}")
            return False
    
    def setup_user_info(self):
        """設定使用者資訊"""
        try:
            logger.info("正在設定使用者資訊...")
            
            # 等待並填入顯示名稱
            display_name_input = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "displayName"))
            )
            
            # 清除並輸入使用者名稱
            display_name_input.clear()
            display_name_input.send_keys(USER_CONFIG['display_name'])
            
            # 如果有組別選擇，也可以設定
            try:
                group_input = self.driver.find_element(By.ID, "groupName")
                group_input.clear()
                group_input.send_keys("樹莓派裝置")
            except:
                logger.debug("未找到組別輸入框")
            
            logger.info(f"使用者設定完成: {USER_CONFIG['display_name']}")
            return True
            
        except Exception as e:
            logger.error(f"設定使用者資訊失敗: {e}")
            return False
    
    def trigger_wake_up(self):
        """觸發「開始這一天」按鈕"""
        try:
            logger.info("正在觸發「開始這一天」...")
            
            # 等待並點擊「開始這一天」按鈕
            wake_up_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "findCityButton"))
            )
            
            # 點擊按鈕
            wake_up_button.click()
            logger.info("✅ 「開始這一天」已觸發")
            
            # 等待結果顯示
            self.wait_for_result()
            return True
            
        except Exception as e:
            logger.error(f"觸發甦醒失敗: {e}")
            return False
    
    def wait_for_result(self):
        """等待並監控結果顯示"""
        try:
            logger.info("等待甦醒結果...")
            
            # 等待結果區域出現內容
            WebDriverWait(self.driver, 30).until(
                lambda driver: len(driver.find_element(By.ID, "resultText").text) > 10
            )
            
            # 獲取結果文字
            result_text = self.driver.find_element(By.ID, "resultText").text
            logger.info(f"甦醒結果: {result_text[:100]}...")
            
            # 等待語音播放完成（估計時間）
            time.sleep(5)
            
        except Exception as e:
            logger.warning(f"等待結果時發生錯誤: {e}")
    
    def perform_wake_up_sequence(self):
        """執行完整的甦醒序列"""
        try:
            # 1. 打開網站
            if not self.open_website():
                return False
                
            # 2. 設定使用者資訊
            if not self.setup_user_info():
                return False
                
            # 短暫等待確保設定生效
            time.sleep(1)
            
            # 3. 觸發甦醒
            if not self.trigger_wake_up():
                return False
                
            logger.info("🎉 完整甦醒序列執行成功！")
            return True
            
        except Exception as e:
            logger.error(f"甦醒序列執行失敗: {e}")
            return False
    
    def cleanup(self):
        """清理資源"""
        try:
            if self.driver:
                self.driver.quit()
                logger.info("瀏覽器已關閉")
        except Exception as e:
            logger.error(f"清理瀏覽器失敗: {e}")
    
    def is_browser_alive(self):
        """檢查瀏覽器是否仍在運行"""
        try:
            if self.driver:
                self.driver.current_url
                return True
            return False
        except:
            return False

# 測試程式
if __name__ == "__main__":
    web_controller = WebController()
    
    try:
        success = web_controller.perform_wake_up_sequence()
        if success:
            print("✅ 甦醒序列測試成功")
        else:
            print("❌ 甦醒序列測試失敗")
            
        # 保持瀏覽器開啟一段時間查看結果
        input("按 Enter 鍵關閉瀏覽器...")
        
    finally:
        web_controller.cleanup() 
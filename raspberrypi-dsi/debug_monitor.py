#!/usr/bin/env python3
"""
甦醒地圖 - SSH 調試監控工具
通過 SSH 遠程監控網頁調試信息
"""

import subprocess
import time
import json
import requests
import logging
from pathlib import Path

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DebugMonitor:
    def __init__(self):
        self.chrome_debug_port = 9222
        self.debug_log_file = "/tmp/subjective_clock_debug.log"
        
    def check_chrome_debug_port(self):
        """檢查 Chrome 調試端口是否可用"""
        try:
            response = requests.get(f"http://localhost:{self.chrome_debug_port}/json", timeout=2)
            if response.status_code == 200:
                tabs = response.json()
                logger.info(f"發現 {len(tabs)} 個瀏覽器標籤頁")
                for tab in tabs:
                    if 'pi.html' in tab.get('url', ''):
                        logger.info(f"找到目標頁面: {tab['title']}")
                        return tab['webSocketDebuggerUrl']
                return tabs[0]['webSocketDebuggerUrl'] if tabs else None
            return None
        except Exception as e:
            logger.error(f"無法連接到 Chrome 調試端口: {e}")
            return None
    
    def get_browser_logs(self):
        """獲取瀏覽器控制台日誌"""
        try:
            # 嘗試通過 Chrome DevTools Protocol 獲取日誌
            # 這需要 websocket 連接，暫時簡化處理
            pass
        except Exception as e:
            logger.error(f"獲取瀏覽器日誌失敗: {e}")
    
    def monitor_system_logs(self):
        """監控系統相關日誌"""
        try:
            # 檢查是否有 Chrome 進程
            result = subprocess.run(['pgrep', '-f', 'chrome'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                chrome_pids = result.stdout.strip().split('\n')
                logger.info(f"發現 Chrome 進程: {chrome_pids}")
            else:
                logger.warning("未發現 Chrome 進程")
                
            # 檢查是否有 Python 主程式運行
            result = subprocess.run(['pgrep', '-f', 'main_web_dsi.py'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                logger.info("主程式正在運行")
            else:
                logger.warning("主程式未運行")
                
        except Exception as e:
            logger.error(f"監控系統日誌失敗: {e}")
    
    def check_website_accessibility(self):
        """檢查網站是否可訪問"""
        try:
            response = requests.get("https://subjective-clock.vercel.app/pi.html", timeout=10)
            if response.status_code == 200:
                logger.info("網站可正常訪問")
                return True
            else:
                logger.warning(f"網站返回狀態碼: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"網站訪問失敗: {e}")
            return False
    
    def run_diagnostic(self):
        """運行完整診斷"""
        logger.info("=== 開始系統診斷 ===")
        
        # 檢查網站可訪問性
        self.check_website_accessibility()
        
        # 檢查系統狀態
        self.monitor_system_logs()
        
        # 檢查調試端口
        debug_url = self.check_chrome_debug_port()
        if debug_url:
            logger.info(f"Chrome 調試端口可用: {debug_url}")
        
        logger.info("=== 診斷完成 ===")
    
    def interactive_monitor(self):
        """交互式監控"""
        logger.info("=== SSH 調試監控啟動 ===")
        logger.info("可用命令:")
        logger.info("  check - 運行系統診斷")
        logger.info("  logs - 檢查系統日誌")
        logger.info("  chrome - 檢查 Chrome 狀態")
        logger.info("  web - 檢查網站狀態")
        logger.info("  help - 顯示幫助")
        logger.info("  quit - 退出")
        
        while True:
            try:
                command = input("\n監控命令: ").strip().lower()
                
                if command == 'quit':
                    break
                elif command == 'check':
                    self.run_diagnostic()
                elif command == 'logs':
                    self.monitor_system_logs()
                elif command == 'chrome':
                    self.check_chrome_debug_port()
                elif command == 'web':
                    self.check_website_accessibility()
                elif command == 'help':
                    logger.info("=== 命令幫助 ===")
                    logger.info("check: 完整系統診斷")
                    logger.info("logs: 檢查系統日誌")
                    logger.info("chrome: Chrome 瀏覽器狀態")
                    logger.info("web: 網站訪問狀態")
                elif command == '':
                    # Enter 鍵 - 快速檢查
                    self.monitor_system_logs()
                else:
                    logger.warning(f"未知命令: {command}")
                    
            except KeyboardInterrupt:
                logger.info("用戶中斷監控")
                break
            except Exception as e:
                logger.error(f"執行命令時發生錯誤: {e}")

def main():
    monitor = DebugMonitor()
    
    try:
        monitor.interactive_monitor()
    except KeyboardInterrupt:
        logger.info("監控已停止")
    except Exception as e:
        logger.error(f"監控程序錯誤: {e}")

if __name__ == "__main__":
    main() 
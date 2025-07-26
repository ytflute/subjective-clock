#!/usr/bin/env python3
"""
Firebase 同步測試工具
測試本地儲存和 Firebase 同步功能
"""

import logging
import sys
from pathlib import Path

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def test_firebase_sync():
    """測試 Firebase 同步功能"""
    try:
        # 導入模組
        from local_storage import LocalStorage
        from firebase_sync import FirebaseSync
        from config import USER_CONFIG
        
        logger.info("🧪 開始 Firebase 同步測試...")
        
        # 初始化本地儲存
        logger.info("1️⃣ 初始化本地儲存...")
        local_storage = LocalStorage()
        stats = local_storage.get_storage_stats()
        logger.info(f"   本地儲存狀態: {stats}")
        
        # 初始化 Firebase 同步
        logger.info("2️⃣ 初始化 Firebase 同步...")
        firebase_sync = FirebaseSync(local_storage)
        sync_status = firebase_sync.get_sync_status()
        logger.info(f"   同步狀態: {sync_status}")
        
        # 測試 Firebase 連接
        logger.info("3️⃣ 測試 Firebase 連接...")
        connection_ok = firebase_sync.test_firebase_connection()
        if connection_ok:
            logger.info("   ✅ Firebase 連接成功")
        else:
            logger.warning("   ❌ Firebase 連接失敗")
            return False
        
        # 檢查本地記錄
        logger.info("4️⃣ 檢查本地記錄...")
        records = local_storage.get_all_records()
        logger.info(f"   本地記錄數量: {len(records)}")
        
        if records:
            latest_record = local_storage.get_latest_record()
            logger.info(f"   最新記錄: Day {latest_record.get('day')}, 城市: {latest_record.get('city')}")
            
            # 測試同步最新記錄
            logger.info("5️⃣ 測試同步最新記錄...")
            sync_success = firebase_sync.sync_latest_record()
            if sync_success:
                logger.info("   ✅ 最新記錄同步成功")
            else:
                logger.warning("   ⚠️ 最新記錄同步失敗")
        else:
            logger.info("   沒有本地記錄，創建測試記錄...")
            
            # 創建測試記錄
            test_record = {
                "city": "Test City",
                "country": "Test Country", 
                "countryCode": "TC",
                "latitude": 25.0330,
                "longitude": 121.5654,
                "timezone": "Asia/Taipei"
            }
            
            # 增加 Day 計數
            current_day = local_storage.increment_day_counter()
            logger.info(f"   Day 計數更新為: {current_day}")
            
            # 保存測試記錄
            save_success = local_storage.save_wakeup_record(test_record)
            if save_success:
                logger.info("   ✅ 測試記錄保存成功")
                
                # 同步測試記錄
                logger.info("5️⃣ 測試同步測試記錄...")
                sync_success = firebase_sync.sync_latest_record()
                if sync_success:
                    logger.info("   ✅ 測試記錄同步成功")
                else:
                    logger.warning("   ⚠️ 測試記錄同步失敗")
            else:
                logger.error("   ❌ 測試記錄保存失敗")
                return False
        
        logger.info("🎉 Firebase 同步測試完成！")
        return True
        
    except Exception as e:
        logger.error(f"❌ Firebase 同步測試失敗: {e}")
        return False

def show_storage_info():
    """顯示儲存資訊"""
    try:
        from local_storage import LocalStorage
        from config import USER_CONFIG
        
        logger.info("📊 儲存資訊報告...")
        
        local_storage = LocalStorage()
        stats = local_storage.get_storage_stats()
        
        print("\n" + "="*50)
        print("📁 本地儲存資訊")
        print("="*50)
        print(f"儲存目錄: {stats['storage_dir']}")
        print(f"當前 Day: {stats['current_day']}")
        print(f"總記錄數: {stats['total_records']}")
        print(f"最後更新: {stats['last_updated']}")
        print(f"記錄檔案存在: {stats['records_file_exists']}")
        print(f"計數檔案存在: {stats['day_counter_file_exists']}")
        
        print("\n" + "="*50)
        print("👤 用戶配置")
        print("="*50)
        print(f"用戶 ID: {USER_CONFIG['identifier']}")
        print(f"顯示名稱: {USER_CONFIG['display_name']}")
        print(f"群組名稱: {USER_CONFIG['group_name']}")
        print(f"設備類型: {USER_CONFIG['device_type']}")
        
        records = local_storage.get_all_records()
        if records:
            print("\n" + "="*50)
            print("📝 記錄歷史")
            print("="*50)
            for i, record in enumerate(records[-5:], 1):  # 顯示最後 5 筆
                print(f"{i}. Day {record.get('day', '?')} - {record.get('city', '?')}, {record.get('country', '?')} ({record.get('timestamp', '?')[:10]})")
        
        print("="*50)
        
    except Exception as e:
        logger.error(f"顯示儲存資訊失敗: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "info":
        show_storage_info()
    else:
        test_firebase_sync() 
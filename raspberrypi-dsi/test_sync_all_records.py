#!/usr/bin/env python3
"""
手動同步所有本地記錄到 Firebase 的測試腳本
"""

import logging
from local_storage import LocalStorage
from firebase_sync import FirebaseSync

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    """測試同步所有記錄"""
    
    print("=" * 50)
    print("📋 手動同步所有本地記錄到 Firebase")
    print("=" * 50)
    
    try:
        # 初始化本地儲存
        print("1️⃣ 初始化本地儲存...")
        local_storage = LocalStorage()
        print(f"   本地記錄數量: {local_storage.get_records_count()}")
        print(f"   當前 Day: {local_storage.get_current_day_number()}")
        
        # 顯示所有記錄
        all_records = local_storage.get_all_records()
        print(f"\n📝 本地記錄詳情:")
        for i, record in enumerate(all_records, 1):
            print(f"   {i}. Day {record.get('day')}: {record.get('city')}, {record.get('country')} ({record.get('timestamp', 'No timestamp')})")
        
        # 初始化 Firebase 同步
        print("\n2️⃣ 初始化 Firebase 同步...")
        firebase_sync = FirebaseSync(local_storage)
        
        # 測試連接
        print("3️⃣ 測試 Firebase 連接...")
        if firebase_sync.test_firebase_connection():
            print("   ✅ Firebase 連接成功")
        else:
            print("   ❌ Firebase 連接失敗")
            return
        
        # 同步所有記錄
        print("\n4️⃣ 開始同步所有記錄...")
        result = firebase_sync.sync_all_records()
        
        print(f"\n📊 同步結果:")
        print(f"   總計記錄: {result.get('total', 0)}")
        print(f"   成功同步: {result.get('synced', 0)}")
        print(f"   同步失敗: {result.get('failed', 0)}")
        
        if result.get('success'):
            print("   ✅ 同步任務完成")
        else:
            print(f"   ❌ 同步任務失敗: {result.get('error', 'Unknown error')}")
        
        print("\n5️⃣ 請在網頁上檢查資料：")
        print("   🌐 https://subjective-clock.vercel.app/")
        print("   👤 使用者名稱: future")
        
    except Exception as e:
        print(f"❌ 測試失敗: {e}")

if __name__ == "__main__":
    main() 
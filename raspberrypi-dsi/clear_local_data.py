#!/usr/bin/env python3
"""
清理 Raspberry Pi 本地資料工具
用於刪除本地儲存的甦醒記錄和 Day 計數資料
"""

import os
import sys
import shutil
import logging
from pathlib import Path
from typing import Optional
import argparse

# 導入本地儲存模組
try:
    from local_storage import LocalStorage
except ImportError:
    print("❌ 無法導入 local_storage 模組，請確保在正確的目錄執行此腳本")
    sys.exit(1)

class LocalDataCleaner:
    def __init__(self, storage_dir: Optional[str] = None):
        """
        初始化清理工具
        
        Args:
            storage_dir: 儲存目錄，預設為 ~/.wakeup_data
        """
        self.storage_dir = Path(storage_dir) if storage_dir else Path.home() / ".wakeup_data"
        self.local_storage = LocalStorage(str(self.storage_dir))
        
        # 設定日誌
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def show_current_data(self):
        """顯示當前本地資料狀況"""
        print("📊 當前本地資料狀況:")
        print("=" * 50)
        
        try:
            stats = self.local_storage.get_storage_stats()
            
            print(f"📁 儲存目錄: {stats['storage_dir']}")
            print(f"📅 當前 Day: {stats['current_day']}")
            print(f"📝 記錄總數: {stats['total_records']}")
            print(f"📅 最後更新: {stats['last_updated']}")
            print(f"📄 記錄檔案存在: {'✅' if stats['records_file_exists'] else '❌'}")
            print(f"📄 Day 計數檔案存在: {'✅' if stats['day_counter_file_exists'] else '❌'}")
            
            # 顯示具體記錄內容
            if stats['total_records'] > 0:
                print("\n📋 記錄詳情:")
                records = self.local_storage.get_all_records()
                for i, record in enumerate(records, 1):
                    date = record.get('date', '未知日期')
                    city = record.get('city', '未知城市')
                    country = record.get('country', '未知國家')
                    day = record.get('day', '?')
                    print(f"  {i:2d}. Day {day:2} - {date} - {city}, {country}")
            
        except Exception as e:
            print(f"❌ 讀取資料失敗: {e}")
            return False
        
        return True
    
    def clear_records_only(self):
        """只清除記錄資料，保留 Day 計數器"""
        try:
            # 只清除記錄檔案
            records_file = self.storage_dir / "wakeup_records.json"
            if records_file.exists():
                records_file.unlink()
                self.logger.info("📝 記錄檔案已刪除")
            
            # 重新初始化空的記錄檔案
            self.local_storage._save_json(records_file, [])
            
            print("✅ 記錄資料已清除，Day 計數器保留")
            return True
            
        except Exception as e:
            self.logger.error(f"清除記錄失敗: {e}")
            return False
    
    def clear_day_counter_only(self):
        """只重置 Day 計數器，保留記錄資料"""
        try:
            day_data = {
                "current_day": 0,
                "last_updated": None,
                "total_records": 0
            }
            
            day_counter_file = self.storage_dir / "day_counter.json"
            self.local_storage._save_json(day_counter_file, day_data)
            
            print("✅ Day 計數器已重置，記錄資料保留")
            return True
            
        except Exception as e:
            self.logger.error(f"重置 Day 計數器失敗: {e}")
            return False
    
    def clear_all_data(self):
        """清除所有本地資料"""
        try:
            success = self.local_storage.clear_all_data()
            if success:
                print("✅ 所有本地資料已清除")
            else:
                print("❌ 清除資料失敗")
            return success
            
        except Exception as e:
            self.logger.error(f"清除所有資料失敗: {e}")
            return False
    
    def delete_storage_directory(self):
        """完全刪除儲存目錄"""
        try:
            if self.storage_dir.exists():
                shutil.rmtree(self.storage_dir)
                self.logger.info(f"📁 儲存目錄已完全刪除: {self.storage_dir}")
                print(f"✅ 儲存目錄已完全刪除: {self.storage_dir}")
                return True
            else:
                print(f"⚠️  儲存目錄不存在: {self.storage_dir}")
                return True
                
        except Exception as e:
            self.logger.error(f"刪除儲存目錄失敗: {e}")
            return False
    
    def backup_data(self, backup_path: str):
        """備份當前資料到指定路徑"""
        try:
            backup_dir = Path(backup_path)
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            # 複製儲存目錄到備份位置
            if self.storage_dir.exists():
                backup_target = backup_dir / f"wakeup_data_backup_{int(time.time())}"
                shutil.copytree(self.storage_dir, backup_target)
                self.logger.info(f"📦 資料已備份到: {backup_target}")
                print(f"✅ 資料已備份到: {backup_target}")
                return str(backup_target)
            else:
                print("⚠️  沒有資料需要備份")
                return None
                
        except Exception as e:
            self.logger.error(f"備份失敗: {e}")
            return None

def main():
    parser = argparse.ArgumentParser(
        description="清理 Raspberry Pi 本地甦醒記錄資料",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用範例:
  python3 clear_local_data.py --show              # 顯示當前資料
  python3 clear_local_data.py --clear-records     # 只清除記錄
  python3 clear_local_data.py --clear-day         # 只重置Day計數
  python3 clear_local_data.py --clear-all         # 清除所有資料
  python3 clear_local_data.py --delete-all        # 完全刪除目錄
  python3 clear_local_data.py --backup ~/backup   # 先備份再操作
        """
    )
    
    parser.add_argument('--show', action='store_true', help='顯示當前資料狀況')
    parser.add_argument('--clear-records', action='store_true', help='只清除記錄資料')
    parser.add_argument('--clear-day', action='store_true', help='只重置 Day 計數器')
    parser.add_argument('--clear-all', action='store_true', help='清除所有資料')
    parser.add_argument('--delete-all', action='store_true', help='完全刪除儲存目錄')
    parser.add_argument('--backup', type=str, help='備份資料到指定目錄')
    parser.add_argument('--storage-dir', type=str, help='指定儲存目錄路徑')
    parser.add_argument('--force', action='store_true', help='強制執行，不要確認提示')
    
    args = parser.parse_args()
    
    # 如果沒有指定任何操作，顯示幫助
    if not any([args.show, args.clear_records, args.clear_day, args.clear_all, args.delete_all, args.backup]):
        parser.print_help()
        return
    
    # 初始化清理工具
    cleaner = LocalDataCleaner(args.storage_dir)
    
    # 顯示當前資料
    if args.show or not args.force:
        if not cleaner.show_current_data():
            return
    
    # 備份資料
    if args.backup:
        backup_path = cleaner.backup_data(args.backup)
        if not backup_path:
            print("❌ 備份失敗，停止後續操作")
            return
    
    # 確認操作
    if not args.force:
        if args.delete_all:
            confirm = input("\n⚠️  確定要完全刪除儲存目錄嗎？這將無法復原！(yes/no): ")
        elif args.clear_all:
            confirm = input("\n⚠️  確定要清除所有本地資料嗎？(yes/no): ")
        elif args.clear_records:
            confirm = input("\n⚠️  確定要清除所有記錄資料嗎？(yes/no): ")
        elif args.clear_day:
            confirm = input("\n⚠️  確定要重置 Day 計數器嗎？(yes/no): ")
        else:
            confirm = "yes"
        
        if confirm.lower() not in ['yes', 'y']:
            print("🚫 操作已取消")
            return
    
    # 執行操作
    success = False
    
    if args.delete_all:
        success = cleaner.delete_storage_directory()
    elif args.clear_all:
        success = cleaner.clear_all_data()
    elif args.clear_records:
        success = cleaner.clear_records_only()
    elif args.clear_day:
        success = cleaner.clear_day_counter_only()
    
    if success:
        print("\n🎉 操作完成！")
        if args.show:
            print("\n📊 操作後的資料狀況:")
            print("=" * 50)
            cleaner.show_current_data()
    else:
        print("\n❌ 操作失敗！")
        sys.exit(1)

if __name__ == "__main__":
    import time
    main() 
#!/usr/bin/env python3
"""
本地儲存管理模組
用於管理 Day 計數和甦醒記錄的本地儲存
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

class LocalStorage:
    def __init__(self, storage_dir: str = None):
        """
        初始化本地儲存管理器
        
        Args:
            storage_dir: 儲存目錄，預設為 ~/.wakeup_data
        """
        self.logger = logging.getLogger(__name__)
        
        # 設定儲存目錄
        if storage_dir is None:
            storage_dir = os.path.expanduser("~/.wakeup_data")
        
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        
        # 儲存檔案路徑
        self.records_file = self.storage_dir / "wakeup_records.json"
        self.day_counter_file = self.storage_dir / "day_counter.json"
        
        # 初始化檔案
        self._init_files()
        
        self.logger.info(f"本地儲存初始化完成，儲存目錄: {self.storage_dir}")
    
    def _init_files(self):
        """初始化儲存檔案"""
        # 初始化記錄檔案
        if not self.records_file.exists():
            self._save_json(self.records_file, [])
            self.logger.info("建立新的記錄檔案")
        
        # 初始化 Day 計數檔案
        if not self.day_counter_file.exists():
            day_data = {
                "current_day": 0,
                "last_updated": None,
                "total_records": 0
            }
            self._save_json(self.day_counter_file, day_data)
            self.logger.info("建立新的 Day 計數檔案")
    
    def _load_json(self, file_path: Path) -> Any:
        """載入 JSON 檔案"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"載入 JSON 檔案失敗 {file_path}: {e}")
            return None
    
    def _save_json(self, file_path: Path, data: Any) -> bool:
        """儲存 JSON 檔案"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            self.logger.error(f"儲存 JSON 檔案失敗 {file_path}: {e}")
            return False
    
    def get_next_day_number(self) -> int:
        """
        獲取下一個 Day 編號
        
        Returns:
            int: 下一個 Day 編號
        """
        day_data = self._load_json(self.day_counter_file)
        if day_data is None:
            self.logger.warning("無法載入 Day 計數，使用預設值 1")
            return 1
        
        next_day = day_data.get("current_day", 0) + 1
        self.logger.info(f"下一個 Day 編號: {next_day}")
        return next_day
    
    def get_current_day_number(self) -> int:
        """
        獲取當前 Day 編號
        
        Returns:
            int: 當前 Day 編號
        """
        day_data = self._load_json(self.day_counter_file)
        if day_data is None:
            return 0
        
        return day_data.get("current_day", 0)
    
    def increment_day_counter(self) -> int:
        """
        增加 Day 計數並返回新的 Day 編號
        
        Returns:
            int: 新的 Day 編號
        """
        day_data = self._load_json(self.day_counter_file)
        if day_data is None:
            day_data = {"current_day": 0, "last_updated": None, "total_records": 0}
        
        # 增加計數
        day_data["current_day"] += 1
        day_data["last_updated"] = datetime.now().isoformat()
        day_data["total_records"] = day_data["current_day"]
        
        # 儲存更新
        if self._save_json(self.day_counter_file, day_data):
            new_day = day_data["current_day"]
            self.logger.info(f"Day 計數已更新為: {new_day}")
            return new_day
        else:
            self.logger.error("Day 計數更新失敗")
            return day_data.get("current_day", 1)
    
    def save_wakeup_record(self, record_data: Dict[str, Any]) -> bool:
        """
        儲存甦醒記錄到本地
        
        Args:
            record_data: 記錄資料
            
        Returns:
            bool: 儲存是否成功
        """
        try:
            # 載入現有記錄
            records = self._load_json(self.records_file)
            if records is None:
                records = []
            
            # 添加時間戳記
            record_data["timestamp"] = datetime.now().isoformat()
            record_data["day"] = self.get_current_day_number()
            
            # 添加到記錄列表
            records.append(record_data)
            
            # 儲存記錄
            if self._save_json(self.records_file, records):
                self.logger.info(f"甦醒記錄已儲存: Day {record_data['day']}, 城市: {record_data.get('city', 'Unknown')}")
                return True
            else:
                return False
                
        except Exception as e:
            self.logger.error(f"儲存甦醒記錄失敗: {e}")
            return False
    
    def get_all_records(self) -> List[Dict[str, Any]]:
        """
        獲取所有甦醒記錄
        
        Returns:
            List[Dict]: 所有記錄列表
        """
        records = self._load_json(self.records_file)
        if records is None:
            return []
        
        return records
    
    def get_records_count(self) -> int:
        """
        獲取記錄總數
        
        Returns:
            int: 記錄總數
        """
        records = self.get_all_records()
        return len(records)
    
    def get_latest_record(self) -> Optional[Dict[str, Any]]:
        """
        獲取最新的記錄
        
        Returns:
            Dict: 最新記錄，如果沒有記錄則返回 None
        """
        records = self.get_all_records()
        if not records:
            return None
        
        return records[-1]
    
    def clear_all_data(self) -> bool:
        """
        清除所有本地資料（僅用於測試）
        
        Returns:
            bool: 清除是否成功
        """
        try:
            self._save_json(self.records_file, [])
            day_data = {
                "current_day": 0,
                "last_updated": None,
                "total_records": 0
            }
            self._save_json(self.day_counter_file, day_data)
            self.logger.info("所有本地資料已清除")
            return True
        except Exception as e:
            self.logger.error(f"清除本地資料失敗: {e}")
            return False
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """
        獲取儲存統計資訊
        
        Returns:
            Dict: 儲存統計資訊
        """
        day_data = self._load_json(self.day_counter_file)
        records_count = self.get_records_count()
        
        return {
            "storage_dir": str(self.storage_dir),
            "current_day": day_data.get("current_day", 0) if day_data else 0,
            "total_records": records_count,
            "last_updated": day_data.get("last_updated") if day_data else None,
            "records_file_exists": self.records_file.exists(),
            "day_counter_file_exists": self.day_counter_file.exists()
        } 
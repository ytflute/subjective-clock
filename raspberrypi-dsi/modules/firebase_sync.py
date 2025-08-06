"""
Firebase同步模組
處理與Firebase的資料同步
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Optional

from utils.logger import LoggerMixin

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

class FirebaseSync(LoggerMixin):
    """Firebase同步管理器"""
    
    def __init__(self, config_manager):
        self.config = config_manager
        self.firebase_config = config_manager.get('FIREBASE_CONFIG', {})
        
        self.db = None
        self.initialized = False
        self.user_id = "future"  # 預設用戶ID
    
    async def initialize(self):
        """初始化Firebase連接"""
        try:
            if not FIREBASE_AVAILABLE:
                self.logger.warning("⚠️ Firebase SDK 不可用，使用模擬模式")
                self.initialized = True
                return True
            
            # 檢查是否已經初始化
            if not firebase_admin._apps:
                # 從配置獲取憑證路徑
                cred_path = self.firebase_config.get('credentials_path')
                if cred_path:
                    cred = credentials.Certificate(cred_path)
                else:
                    # 使用默認憑證
                    cred = credentials.ApplicationDefault()
                
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            self.logger.info("✅ Firebase連接初始化完成")
            self.initialized = True
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Firebase初始化失敗: {e}")
            self.initialized = True  # 允許繼續運行，但使用模擬模式
            return False
    
    async def save_record(self, city_data: Dict) -> bool:
        """保存甦醒記錄"""
        try:
            if not self.db:
                self.logger.info("🔄 模擬Firebase記錄保存")
                return True
            
            record_data = {
                'userId': self.user_id,
                'displayName': self.user_id,
                'city': city_data.get('name', ''),
                'country': city_data.get('country', ''),
                'latitude': float(city_data.get('latitude', 0)),
                'longitude': float(city_data.get('longitude', 0)),
                'timezone': city_data.get('timezone', {}).get('timeZoneId', ''),
                'timestamp': firestore.SERVER_TIMESTAMP,
                'date': datetime.now().strftime('%Y-%m-%d'),
                'deviceType': 'raspberry_pi_dsi'
            }
            
            # 保存到 wakeup_records 集合
            doc_ref = self.db.collection('wakeup_records').add(record_data)
            
            self.logger.info(f"✅ Firebase記錄保存成功: {doc_ref[1].id}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Firebase記錄保存失敗: {e}")
            return False
    
    async def get_user_history(self, limit: int = 50) -> List[Dict]:
        """獲取用戶歷史記錄"""
        try:
            if not self.db:
                return []
            
            # 查詢用戶的歷史記錄
            docs = self.db.collection('wakeup_records')\
                          .where('userId', '==', self.user_id)\
                          .order_by('timestamp', direction=firestore.Query.DESCENDING)\
                          .limit(limit)\
                          .stream()
            
            history = []
            for doc in docs:
                data = doc.to_dict()
                history.append(data)
            
            self.logger.info(f"✅ 獲取歷史記錄: {len(history)} 筆")
            return history
            
        except Exception as e:
            self.logger.error(f"❌ 獲取歷史記錄失敗: {e}")
            return []
    
    async def get_record_count(self) -> int:
        """獲取用戶記錄總數"""
        try:
            if not self.db:
                return 0
            
            docs = self.db.collection('wakeup_records')\
                          .where('userId', '==', self.user_id)\
                          .stream()
            
            count = sum(1 for _ in docs)
            self.logger.info(f"✅ 用戶記錄總數: {count}")
            return count
            
        except Exception as e:
            self.logger.error(f"❌ 獲取記錄數量失敗: {e}")
            return 0
    
    async def update_record_with_story(self, record_id: str, story_data: Dict) -> bool:
        """更新記錄中的故事資料"""
        try:
            if not self.db:
                self.logger.info("🔄 模擬故事資料更新")
                return True
            
            doc_ref = self.db.collection('wakeup_records').document(record_id)
            doc_ref.update({
                'story': story_data.get('story', ''),
                'greeting': story_data.get('greeting', ''),
                'language': story_data.get('language', ''),
                'story_updated_at': firestore.SERVER_TIMESTAMP
            })
            
            self.logger.info(f"✅ 故事資料更新成功: {record_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 故事資料更新失敗: {e}")
            return False
    
    def is_ready(self) -> bool:
        """檢查Firebase是否就緒"""
        return self.initialized
    
    async def cleanup(self):
        """清理Firebase資源"""
        try:
            # Firebase SDK會自動處理清理
            self.logger.info("✅ Firebase同步清理完成")
            self.initialized = False
        except Exception as e:
            self.logger.error(f"❌ Firebase清理失敗: {e}")

class MockFirebaseSync(FirebaseSync):
    """模擬Firebase同步（用於測試）"""
    
    def __init__(self, config_manager):
        super().__init__(config_manager)
        self.mock_records = []  # 模擬記錄存儲
    
    async def initialize(self):
        """模擬初始化"""
        self.logger.info("✅ 模擬Firebase同步初始化完成")
        self.initialized = True
        return True
    
    async def save_record(self, city_data: Dict) -> bool:
        """模擬記錄保存"""
        record = {
            'userId': self.user_id,
            'city': city_data.get('name', ''),
            'country': city_data.get('country', ''),
            'timestamp': datetime.now().isoformat(),
            'id': f"mock_{len(self.mock_records)}"
        }
        self.mock_records.append(record)
        self.logger.info(f"🔄 模擬記錄保存: {record['city']}, {record['country']}")
        return True
    
    async def get_user_history(self, limit: int = 50) -> List[Dict]:
        """模擬歷史記錄獲取"""
        return self.mock_records[-limit:] if limit else self.mock_records
    
    async def get_record_count(self) -> int:
        """模擬記錄計數"""
        return len(self.mock_records)
    
    async def cleanup(self):
        """模擬清理"""
        self.logger.info("✅ 模擬Firebase同步清理完成")
        self.initialized = False
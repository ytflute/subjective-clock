"""
日誌工具模組
統一的日誌配置和格式
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    設定統一的日誌格式
    
    Args:
        name: 日誌器名稱
        level: 日誌級別
    
    Returns:
        配置好的日誌器
    """
    logger = logging.getLogger(name)
    
    # 避免重複設定
    if logger.handlers:
        return logger
    
    logger.setLevel(level)
    
    # 建立格式器
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 控制台處理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 檔案處理器（可選）
    try:
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        log_file = log_dir / f"wakeupmap_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
    except Exception as e:
        # 如果檔案日誌失敗，只用控制台日誌
        logger.warning(f"檔案日誌設定失敗: {e}")
    
    return logger

class LoggerMixin:
    """日誌混合類，為其他類提供日誌功能"""
    
    @property
    def logger(self):
        """獲取日誌器"""
        if not hasattr(self, '_logger'):
            self._logger = setup_logger(self.__class__.__name__)
        return self._logger
#!/usr/bin/env python3
"""
甦醒地圖模組化版本啟動腳本
"""

import asyncio
import sys
from pathlib import Path

# 添加當前目錄到路徑
sys.path.append(str(Path(__file__).parent))

from main_controller import WakeUpMapController

async def main():
    """主函數"""
    print("🚀 啟動甦醒地圖模組化版本...")
    
    controller = WakeUpMapController()
    await controller.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 程式已停止")
    except Exception as e:
        print(f"❌ 程式錯誤: {e}")
        sys.exit(1)
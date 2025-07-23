#!/usr/bin/env python3
"""
🔧 配置導入問題診斷和修復工具
解決 TTS_CONFIG 導入錯誤
"""

import sys
from pathlib import Path

def check_config_file():
    """檢查 config.py 文件"""
    print("🔍 檢查 config.py 文件...")
    
    config_file = Path(__file__).parent / 'config.py'
    
    if not config_file.exists():
        print("❌ config.py 文件不存在！")
        return False
    
    print("✅ config.py 文件存在")
    
    # 檢查文件內容
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'TTS_CONFIG' not in content:
            print("❌ config.py 中沒有找到 TTS_CONFIG")
            return False
        
        if 'openai_api_key' not in content:
            print("❌ config.py 中沒有找到 openai_api_key 配置")
            return False
        
        print("✅ config.py 內容結構正確")
        return True
        
    except Exception as e:
        print(f"❌ 讀取 config.py 失敗: {e}")
        return False

def test_config_import():
    """測試配置導入"""
    print("\n🧪 測試配置導入...")
    
    try:
        # 嘗試導入配置
        from config import TTS_CONFIG
        print("✅ TTS_CONFIG 導入成功")
        
        # 檢查關鍵配置
        print(f"   引擎: {TTS_CONFIG.get('engine', '未設定')}")
        print(f"   API 金鑰: {'已設定' if TTS_CONFIG.get('openai_api_key') else '未設定'}")
        print(f"   語音: {TTS_CONFIG.get('openai_voice', '未設定')}")
        
        return True
        
    except ImportError as e:
        print(f"❌ 導入失敗: {e}")
        return False
    except Exception as e:
        print(f"❌ 配置錯誤: {e}")
        return False

def test_audio_manager_import():
    """測試音頻管理器導入"""
    print("\n🔊 測試音頻管理器導入...")
    
    try:
        from audio_manager import AudioManager
        print("✅ AudioManager 導入成功")
        return True
    except ImportError as e:
        print(f"❌ AudioManager 導入失敗: {e}")
        return False
    except Exception as e:
        print(f"❌ AudioManager 錯誤: {e}")
        return False

def check_openai_library():
    """檢查 OpenAI 庫"""
    print("\n🤖 檢查 OpenAI 庫...")
    
    try:
        import openai
        print("✅ OpenAI 庫已安裝")
        print(f"   版本: {openai.__version__}")
        return True
    except ImportError:
        print("❌ OpenAI 庫未安裝")
        print("   請執行: pip3 install openai --user")
        return False

def fix_python_path():
    """修復 Python 路徑問題"""
    print("\n🛠️  檢查 Python 路徑...")
    
    current_dir = Path(__file__).parent
    if str(current_dir) not in sys.path:
        sys.path.insert(0, str(current_dir))
        print("✅ 已添加當前目錄到 Python 路徑")
        return True
    else:
        print("✅ Python 路徑正確")
        return True

def main():
    """主診斷程序"""
    print("🔧 配置診斷和修復工具")
    print("=" * 40)
    
    # 修復 Python 路徑
    fix_python_path()
    
    # 檢查步驟
    checks = [
        ("配置文件", check_config_file),
        ("OpenAI 庫", check_openai_library),
        ("配置導入", test_config_import),
        ("音頻管理器", test_audio_manager_import)
    ]
    
    results = []
    
    for check_name, check_func in checks:
        print(f"\n{'='*20}")
        try:
            result = check_func()
            results.append((check_name, result))
        except Exception as e:
            print(f"💥 {check_name} 檢查出錯: {e}")
            results.append((check_name, False))
    
    # 總結
    print(f"\n📊 診斷結果總結")
    print("=" * 40)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for check_name, result in results:
        status = "✅ 通過" if result else "❌ 失敗"
        print(f"{status} {check_name}")
    
    print(f"\n🎯 總計: {passed}/{total} 檢查通過")
    
    if passed == total:
        print("\n🎉 所有檢查通過！")
        print("現在可以執行:")
        print("  python3 setup_openai_tts.py")
        return True
    else:
        print("\n⚠️  發現問題，建議修復：")
        
        if not any(name == "OpenAI 庫" and result for name, result in results):
            print("  1. 安裝 OpenAI 庫: pip3 install openai --user")
        
        if not any(name == "配置導入" and result for name, result in results):
            print("  2. 檢查 config.py 文件語法")
            print("  3. 確認當前目錄正確")
        
        print("  4. 重新執行此診斷工具")
        return False

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  診斷被用戶中斷")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 診斷過程發生錯誤: {e}")
        sys.exit(1) 
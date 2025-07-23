#!/bin/bash
"""
🚀 OpenAI 庫快速安裝腳本
解決 Raspberry Pi OS 的 Python 環境管理問題
"""

echo "🤖 OpenAI 庫快速安裝工具"
echo "================================"

# 檢查是否已安裝
echo "🔍 檢查 OpenAI 庫..."
if python3 -c "import openai" 2>/dev/null; then
    echo "✅ OpenAI 庫已安裝！"
    python3 -c "import openai; print(f'版本: {openai.__version__}')"
    exit 0
fi

echo "📦 OpenAI 庫未安裝，開始安裝..."

# 方法 1: --user 安裝（推薦）
echo -e "\n🔄 嘗試用戶級安裝 (推薦)..."
if pip3 install openai --user; then
    echo "✅ 用戶級安裝成功！"
    echo "📝 請將以下路徑添加到 PATH（如果需要）："
    echo "   export PATH=\$PATH:\$HOME/.local/bin"
    exit 0
fi

# 方法 2: --break-system-packages（備用）
echo -e "\n🔄 嘗試系統級安裝..."
echo "⚠️  此方法會繞過系統保護，但通常安全"
read -p "是否繼續？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if pip3 install openai --break-system-packages; then
        echo "✅ 系統級安裝成功！"
        exit 0
    fi
fi

# 方法 3: 手動指導
echo -e "\n❌ 自動安裝失敗，請手動執行："
echo "=================================="
echo "選項 1 (推薦):"
echo "  pip3 install openai --user"
echo ""
echo "選項 2 (如果選項1不行):"
echo "  pip3 install openai --break-system-packages"
echo ""
echo "選項 3 (最安全):"
echo "  python3 -m venv ~/openai_venv"
echo "  source ~/openai_venv/bin/activate"
echo "  pip install openai"
echo ""
echo "安裝完成後，重新執行："
echo "  python3 setup_openai_tts.py"

exit 1 
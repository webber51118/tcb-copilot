"""
pytest 設定：確保專案根目錄在 sys.path 中，
讓 src.main.python.* 的絕對路徑 import 正常運作。
"""

import sys
import os

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

"""
INPUT:  region（縣市名稱）、building_type（建物類型）、property_age（屋齡）、
        floor（樓層）、layout（格局）、has_parking（是否有車位）、area_ping（坪數）
OUTPUT: base_value（基準估值，單位：元）
POS:    鑑價工具層，提供台灣22縣市的基準單價查詢與調整係數計算
"""

from typing import Tuple

# ────────────────────────────────────────────────
# 台灣22縣市基準單價（大樓，萬/坪）
# ────────────────────────────────────────────────
REGION_BASE_PRICE: dict[str, float] = {
    # 六都
    "台北市":   160.0,
    "新北市":    65.0,
    "桃園市":    35.0,
    "台中市":    42.0,
    "台南市":    30.0,
    "高雄市":    28.0,
    # 準直轄市 / 重要城市
    "新竹市":    45.0,
    "新竹縣":    32.0,
    "基隆市":    22.0,
    "苗栗縣":    16.0,
    "彰化縣":    18.0,
    "南投縣":    12.0,
    "雲林縣":    12.0,
    "嘉義市":    18.0,
    "嘉義縣":    14.0,
    "屏東縣":    14.0,
    "宜蘭縣":    20.0,
    "花蓮縣":    18.0,
    "台東縣":    10.0,
    "澎湖縣":    12.0,
    "金門縣":    11.0,
    "連江縣":    10.0,
}

# 建物類型乘數（以大樓=1.0為基準）
BUILDING_TYPE_MULTIPLIER: dict[str, float] = {
    "大樓":   1.00,
    "華廈":   0.95,
    "公寓":   0.88,
    "透天":   0.90,
    "別墅":   1.10,
}

# 車位加成（台北市特別高，其他縣市依房價分層）
PARKING_PREMIUM: dict[str, float] = {
    "台北市":  3_000_000.0,
    "新北市":  1_500_000.0,
    "新竹市":  1_200_000.0,
    "桃園市":  1_000_000.0,
    "台中市":  1_000_000.0,
    "台南市":    800_000.0,
    "高雄市":    800_000.0,
}
DEFAULT_PARKING_PREMIUM = 500_000.0  # 其他縣市預設車位加成


def age_depreciation_factor(property_age: int) -> float:
    """
    屋齡折舊係數（線性遞減，最低保留 0.5）

    Args:
        property_age: 屋齡（年）

    Returns:
        折舊係數 [0.50, 1.00]
    """
    if property_age <= 0:
        return 1.00
    elif property_age <= 5:
        return 1.00 - property_age * 0.01          # 新屋：每年折1%
    elif property_age <= 20:
        return 0.95 - (property_age - 5) * 0.02    # 中古屋：每年折2%
    elif property_age <= 40:
        return 0.65 - (property_age - 20) * 0.005  # 老屋：每年折0.5%
    else:
        return 0.55                                  # 超過40年最低保留55%


def floor_adjustment_factor(floor: int, building_type: str) -> float:
    """
    樓層調整係數

    - 透天/別墅：樓層無明顯影響
    - 大樓/華廈：高樓層溢價，頂樓微折、一樓大折

    Args:
        floor:         樓層
        building_type: 建物類型

    Returns:
        樓層係數 [0.85, 1.10]
    """
    if building_type in ("透天", "別墅"):
        return 1.00

    if floor == 1:
        return 0.88    # 一樓（採光差、噪音）
    elif floor <= 3:
        return 0.95    # 低樓層
    elif floor <= 7:
        return 1.00    # 中樓層（基準）
    elif floor <= 15:
        return 1.05    # 高樓層溢價
    elif floor <= 25:
        return 1.08    # 超高樓層
    else:
        return 1.10    # 頂樓豪宅溢價


def layout_efficiency_factor(layout: str) -> float:
    """
    格局效率係數（用坪效衡量空間配置合理性）

    Args:
        layout: 格局描述（例：「2房1廳」「3房2廳」「4房2廳2衛」）

    Returns:
        格局效率係數 [0.90, 1.05]
    """
    layout_lower = layout.strip()

    if "4房" in layout_lower:
        return 0.97    # 大坪數格局，效率略低
    elif "3房2廳" in layout_lower or "3房" in layout_lower:
        return 1.02    # 主流格局溢價
    elif "2房" in layout_lower:
        return 1.05    # 小資族最愛，需求高
    elif "1房" in layout_lower or "套房" in layout_lower:
        return 0.95    # 套房流動性較差
    else:
        return 1.00    # 其他格局基準


def calculate_base_value(
    region: str,
    building_type: str,
    property_age: int,
    floor: int,
    layout: str,
    has_parking: bool,
    area_ping: float,
) -> Tuple[float, dict]:
    """
    計算基準估值

    公式：
        base_value = 縣市單價(萬/坪) × 坪數 × 建物乘數 × 屋齡折舊
                     × 樓層係數 × 格局效率 × 10000
                     + 車位加成

    Args:
        region:        縣市名稱（例：「台北市」）
        building_type: 建物類型（例：「大樓」）
        property_age:  屋齡（年）
        floor:         樓層
        layout:        格局（例：「3房2廳」）
        has_parking:   是否有車位
        area_ping:     坪數

    Returns:
        Tuple[base_value（元）, breakdown（各係數明細 dict）]
    """
    # 查詢縣市基準單價（找不到時用最低價 10 萬/坪）
    unit_price = REGION_BASE_PRICE.get(region, 10.0)

    # 各調整係數
    bldg_mult   = BUILDING_TYPE_MULTIPLIER.get(building_type, 1.00)
    age_factor  = age_depreciation_factor(property_age)
    flr_factor  = floor_adjustment_factor(floor, building_type)
    layout_eff  = layout_efficiency_factor(layout)

    # 主體估值（元）
    main_value = unit_price * area_ping * bldg_mult * age_factor * flr_factor * layout_eff * 10_000

    # 車位加成
    parking_premium = 0.0
    if has_parking:
        parking_premium = PARKING_PREMIUM.get(region, DEFAULT_PARKING_PREMIUM)

    base_value = main_value + parking_premium

    breakdown = {
        "unit_price_per_ping":  unit_price,
        "area_ping":            area_ping,
        "building_multiplier":  bldg_mult,
        "age_depreciation":     round(age_factor, 4),
        "floor_factor":         round(flr_factor, 4),
        "layout_efficiency":    round(layout_eff, 4),
        "main_value":           round(main_value, 0),
        "parking_premium":      parking_premium,
    }

    return round(base_value, 0), breakdown

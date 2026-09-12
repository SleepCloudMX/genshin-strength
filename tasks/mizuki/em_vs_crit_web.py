"""把 `em_vs_crit` 的常数与配色注入 HTML 模板，生成可交互的页面。

**数学在模板的 JS 里重写了一份** —— 页面要能实时重算，所以 `crit_zone_at` /
`damage` / `best_split` / `plateau` 必须存在于浏览器里。改公式时
`em_vs_crit.py` 与 `em_vs_crit_web.html` 里的 JS 要同时改。

常数与配色不重写：从这里注入，只有一份来源。
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt

import em_vs_crit as task
from genshin_strength.stellar_swirl import EM_COEFFICIENT, EM_OFFSET

TEMPLATE = Path(__file__).with_suffix(".html")
OUT_PATH = task.OUT_DIR / "interactive.html"

#: 色带在 viridis_r 上的采样起点，与静态图保持一致（避开最浅的亮黄）。
COLOR_FROM = 0.28
#: 注入给 JS 的色带采样点数。
RAMP_STEPS = 33

PLACEHOLDER = "/*__CONFIG__*/"


def viridis_r_samples(count: int) -> list[list[int]]:
    cmap = plt.get_cmap("viridis_r")
    return [
        [round(255 * channel) for channel in cmap(i / (count - 1))[:3]]
        for i in range(count)
    ]


def build_config() -> dict:
    return {
        "em": task.EM_BASE,
        "cr": task.CRIT_RATE_BASE,
        "cd": task.CRIT_DMG_BASE,
        "bonus": task.SWIRL_BONUS,
        "ns": list(task.N_CURVES),
        "level": task.PLATEAU_LEVEL,
        "coef": {
            "emPerRoll": task.EM_PER_ROLL,
            "crPerRoll": task.CRIT_RATE_PER_ROLL,
            "cdPerRoll": task.CRIT_DMG_PER_ROLL,
            "em": EM_COEFFICIENT,
            "emOffset": EM_OFFSET,
        },
        "colorFrom": COLOR_FROM,
        "viridisR": viridis_r_samples(RAMP_STEPS),
    }


def main() -> None:
    template = TEMPLATE.read_text(encoding="utf-8")
    if PLACEHOLDER not in template:
        raise SystemExit(f"模板里没有找到占位符 {PLACEHOLDER}")

    payload = json.dumps(build_config(), ensure_ascii=False, indent=2)
    html = template.replace(PLACEHOLDER, payload)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(html, encoding="utf-8")
    print(f"输出 -> {OUT_PATH}")


if __name__ == "__main__":
    main()

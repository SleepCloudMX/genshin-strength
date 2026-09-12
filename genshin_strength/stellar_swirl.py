"""星扩散（Stellar Swirl）伤害计算中共用的游戏规则。

机制与公式的来源：docs/ai-output/0-mechanism/1-星扩散伤害机制.md
"""

import numpy as np

#: 元素精通对星扩散的加成系数。传统剧变反应是 16，星扩散是 6 —— 别写错。
EM_COEFFICIENT = 6.0

#: 精通项 ``6·EM / (EM + 2000)`` 分母里的常数。
EM_OFFSET = 2000.0

#: 90 级剧变反应等级基数，用于「反应星扩散」。星扩散直伤不用它。
REACTION_BASE_90 = 1446.85


def em_term(em: float) -> float:
    """元素精通区的加成 ``6·EM/(EM+2000)``。

    它与「星扩散增伤%」加在同一个括号内，两者互相稀释。
    """
    return EM_COEFFICIENT * em / (em + EM_OFFSET)


def crit_zone(crit_budget: float, extra_crit_rate: float = 0.0) -> float:
    """双爆词条预算下的最大期望暴击区 ``1 + 暴击率 × 暴伤``。

    词条预算 ``crit_budget = 暴击率 + 暴伤/2``，依据是 1 词条 = 3.3% 暴击 = 6.6% 暴伤，
    即 1 暴击等效 2 暴伤。

    在 ``暴击率 : 暴伤 = 1 : 2`` 时 ``暴击率 × 暴伤`` 取最大值；暴击率触及 100% 上限后，
    剩余预算全部给暴伤（星扩散的暴击率溢出后不转暴伤）。

    ``extra_crit_rate`` 是套装等提供的固定暴击率，它同样计入预算 ——
    因为 ``crit_budget`` 里的暴击率与暴伤可以重新配平，凭空多出的暴击率等价于预算增加。
    """
    budget = crit_budget + extra_crit_rate
    crit_rate = np.minimum(budget / 2, 1.0)
    crit_dmg = 2 * (budget - crit_rate)  # 由 暴击率 + 暴伤/2 = 预算 解出
    return 1 + crit_rate * crit_dmg

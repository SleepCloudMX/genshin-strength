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


def crit_zone(crit_score: float, extra_crit_rate: float = 0.0) -> float:
    """双暴分下的最大期望暴击区 ``1 + 暴击率 × 暴伤``。

    双暴分 ``crit_score = 2 × 暴击率 + 暴伤``（等效暴伤），依据是 1 词条 = 3.3% 暴击
    = 6.6% 暴伤，即 1 暴击等效 2 暴伤。

    在 ``暴击率 : 暴伤 = 1 : 2`` 时 ``暴击率 × 暴伤`` 取最大值。暴击率触及 100% 后
    不再增加（游戏中溢出的暴击率是浪费掉的），剩下的分数全部改投暴伤。

    ``extra_crit_rate`` 是套装等提供的固定暴击率，它按 ``+2 × 暴击率`` 计入双暴分 ——
    因为 ``crit_score`` 里的暴击率与暴伤可以重新配平，凭空多出的暴击率等价于分数增加。
    """
    score = crit_score + 2 * extra_crit_rate
    crit_rate = np.minimum(score / 4, 1.0)
    crit_dmg = score - 2 * crit_rate  # 由 2 × 暴击率 + 暴伤 = 双暴分 解出
    return 1 + crit_rate * crit_dmg

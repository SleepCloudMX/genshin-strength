"""血红之证 4 件套 vs 精通 2+2：固定双爆词条预算下的星扩散直伤比。

对应 Mathematica 原稿 `docs/ai-ref/瑞希/代码.txt`，
评审与重构说明见 `docs/ai-output/1-Mizuki/1-code-review.md`。

在「同队伍、只换套装」的前提下，伤害公式里下列项两套方案完全相同，可直接约掉：

    倍率 · (1 + 基础提升%) · 抗性系数 · 擢升 · 精通/1000 的归一化

留下的只有三个随套装变化的因子：

    元素精通 × (1 + 6·EM/(EM+2000) + 星扩散增伤) × 暴击区
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import partial
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import TwoSlopeNorm
from matplotlib.ticker import FuncFormatter
from scipy.optimize import brentq

from genshin_strength.stellar_swirl import crit_zone, em_term

matplotlib.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
matplotlib.rcParams["axes.unicode_minus"] = False

TASK = "scarlet_vs_2+2"
OUT_DIR = Path(__file__).resolve().parents[2] / "output" / "Mizuki" / TASK

EM_RANGE = (0.0, 2000.0)
BUDGET_RANGE = (0.0, 2.0)
GRID_N = 400

#: 参考配装：(双爆词条预算, 图上标注)。25/50 是低配，60/120 是高配。
REFERENCE_BUILDS = ((0.5, "25/50"), (1.2, "60/120"))


@dataclass(frozen=True)
class Build:
    """一套圣遗物方案在三个相关乘区上的贡献。"""

    name: str
    em: float = 0.0
    crit_rate: float = 0.0
    swirl_bonus: float = 0.0


@dataclass(frozen=True)
class Team:
    """队伍提供的星扩散增伤。

    迪奥娜与七七的触发条件实战几乎全覆盖，统一按常驻处理（见机制文档 §5）。
    """

    key: str
    members: tuple[tuple[str, float], ...]

    @property
    def swirl_bonus(self) -> float:
        return sum(bonus for _, bonus in self.members)

    @property
    def label(self) -> str:
        return "+".join(f"{name}{bonus * 100:.0f}" for name, bonus in self.members)


SCARLET = Build(name="血红之证", crit_rate=0.16, swirl_bonus=0.40)
EM_2P2 = Build(name="精通 2+2", em=160.0)

TEAMS = (
    Team(key="furnace_qiqi", members=(("炉火", 0.50), ("七七", 0.50))),
    Team(
        key="furnace_diona_traveler",
        members=(("炉火", 0.50), ("猫猫", 0.40), ("冰主", 0.40)),
    ),
)


def damage_ratio(em_base, crit_budget, team, *, a=SCARLET, b=EM_2P2):
    """固定双爆词条预算下，方案 a 与方案 b 的期望伤害比。大于 1 表示 a 更优。

    `em_base` 是两套方案共有的元素精通（武器、主词条、副词条、队友给的）；
    套装本身提供的精通由 `Build.em` 叠加。支持 numpy 数组以做二维扫描。
    """

    def expected_damage(build):
        em = em_base + build.em
        return (
            em
            * (1 + em_term(em) + team.swirl_bonus + build.swirl_bonus)
            * crit_zone(crit_budget, build.crit_rate)
        )

    return expected_damage(a) / expected_damage(b)


def break_even(ratio, crit_budget, em_range=EM_RANGE):
    """该词条预算下，比值为 1 的精通分界点。区间内无解时返回 None。"""
    lo, hi = em_range
    if (ratio(lo, crit_budget) - 1) * (ratio(hi, crit_budget) - 1) > 0:
        return None
    return brentq(lambda em: ratio(em, crit_budget) - 1, lo, hi)


def plot_ratio_field(ratio, team, out_path):
    em = np.linspace(*EM_RANGE, GRID_N)
    budget = np.linspace(*BUDGET_RANGE, GRID_N)
    field = ratio(em[:, None], budget[None, :])

    # 以 1.0 为中心做分段归一化。这个比值极度不对称（2+2 最多赢一倍以上，
    # 血红最多只赢约 8%），线性色标会让「血红赢」的窄带淹没在无关的渐变里，
    # 读不出方向。分段归一化牺牲了两侧的量级对比，换取方向的准确 ——
    # 量级由色条上的 1.0 刻度线与黑色分界线共同交代。
    fig, ax = plt.subplots(figsize=(7.8, 6.6), layout="constrained")
    norm = TwoSlopeNorm(vmin=float(field.min()), vcenter=1.0, vmax=float(field.max()))
    mesh = ax.pcolormesh(em, budget, field.T, cmap="RdBu_r", norm=norm, shading="auto")

    # 分界线与十字准线共用同一个求根结果，避免两套数值路径画出来对不上
    budgets = np.linspace(*BUDGET_RANGE, GRID_N // 2)
    # 预算很小（b < 0.1）时两套没有交点，留空而不是画一条假线
    roots = np.array([
        np.nan if (root := break_even(ratio, b)) is None else root for b in budgets
    ])
    ax.plot(
        roots, budgets, color="black", lw=2.2, zorder=3,
        label="两套等效（分界线）",
    )

    for b, label in REFERENCE_BUILDS:
        root = break_even(ratio, b)
        if root is None:
            continue
        ax.plot([EM_RANGE[0], root], [b, b], ":", color="purple", lw=1.8, zorder=4)
        ax.plot([root, root], [BUDGET_RANGE[0], b], ":", color="purple", lw=1.8, zorder=4)
        ax.text(
            EM_RANGE[0] + 0.03 * (EM_RANGE[1] - EM_RANGE[0]), b + 0.05, label,
            color="purple", fontsize=12, fontweight="bold",
        )
        ax.text(
            root, 0.05, f"{root / 1000:.3f}", color="purple",
            fontsize=11, fontweight="bold", ha="center",
        )

    ax.set_xlabel("元素精通 / 1000")
    ax.set_ylabel("暴击 + 暴伤 / 2  （双爆词条预算）")
    ax.set_title(f"血红之证 vs 精通 2+2\n星扩散增伤来源：{team.label}", fontsize=12)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v / 1000:g}"))
    ax.set_xlim(*EM_RANGE)
    ax.set_ylim(*BUDGET_RANGE)
    ax.set_axisbelow(False)
    ax.grid(color="white", alpha=0.35, lw=0.6)
    ax.legend(loc="upper right", fontsize=10, framealpha=0.9)

    bar = fig.colorbar(mesh, ax=ax, pad=0.02)
    bar.set_label("血红之证 / 精通 2+2 的期望伤害比")

    fig.savefig(out_path, dpi=160)
    plt.close(fig)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for team in TEAMS:
        ratio = partial(damage_ratio, team=team)
        out_path = OUT_DIR / f"{team.key}.png"
        plot_ratio_field(ratio, team, out_path)

        print(f"{team.label}  ->  {out_path}")
        for b, label in REFERENCE_BUILDS:
            root = break_even(ratio, b)
            if root is None:
                print(f"    b={b:<4} ({label})  该区间内两套无交点")
            else:
                print(f"    b={b:<4} ({label})  分界精通 = {root:,.0f}   越高越倾向血红")


if __name__ == "__main__":
    main()

"""精通 vs 双爆：固定等效词条总数下，星扩散直伤的最优分配。

**算的是「星扩散直伤」**（瑞希天赋「廓然梦生」的「元素精通 1000%」倍率伤害），
不是「反应星扩散」（占比很小）。所以公式里没有 1446.85，属性是元素精通而非攻击力。

只讨论**圣遗物副词条**的分配：主词条、武器、天赋、队友给的量都是固定值，
「等效词条」只在副词条场景成立，不能拿去换算那些固定来源。

1 等效词条 = 20 精通 = 3.3% 暴击 = 6.6% 暴伤。
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import matplotlib
import matplotlib.patheffects as path_effects
import matplotlib.pyplot as plt
import numpy as np
from scipy.optimize import minimize_scalar

from genshin_strength.stellar_swirl import em_term

matplotlib.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
matplotlib.rcParams["axes.unicode_minus"] = False

TASK = "em_vs_crit"
OUT_DIR = Path(__file__).resolve().parents[2] / "output" / "Mizuki" / TASK

# 上完 buff、不含副词条的面板。只有副词条参与分配。
EM_BASE = 951.0        # 自身 115 + 天光的纺琴 200 + 昼想夜梦 100 + 沙杯主词条 187×2 + 砂糖 162
CRIT_RATE_BASE = 36.0  # 自身 5 + 血红之证 4 件套 16 + 双冰共鸣 15
CRIT_DMG_BASE = 112.2  # 自身 50 + 冠主词条 62.2
SWIRL_BONUS = 1.40     # 炉火 4 件套 50 + 七七 50 + 血红之证 4 件套 40

EM_PER_ROLL = 20.0
CRIT_RATE_PER_ROLL = 3.3
CRIT_DMG_PER_ROLL = 6.6

#: 1:2 配平所需的最少双爆词条数。低于它时 暴击率 词条数会算成负数，不成立。
BALANCED_FROM = CRIT_DMG_BASE / CRIT_DMG_PER_ROLL - CRIT_RATE_BASE / CRIT_RATE_PER_ROLL

N_CURVES = (15, 20, 25, 30, 35)
N_RANGE = (10.0, 40.0)
PLATEAU_LEVEL = 0.99


def crit_zone_at(b):
    """b 个双爆词条在暴击率与暴伤之间最优分配后的暴击区 ``1 + 暴击率 × 暴伤``。

    最大化 ``(c0 + r·a)(d0 + s·(b−a))`` 对 `a` 求导，得

        a* = b/2 + (d0/s − c0/r)/2

    `a` 有两个上下界：词条数不能为负、不能超过 `b`，另外暴击率不能超过 100%。
    在 ``b < d0/s − c0/r`` 时 ``a* > b``，只能把词条全投暴击率，此时 c:d ≠ 1:2 ——
    简化的 ``1 + (3.3b + 92.1)²/20000`` 会高估，`b = 0` 时高约 5%。
    """
    b = np.asarray(b, dtype=float)
    a = b / 2 + (CRIT_DMG_BASE / CRIT_DMG_PER_ROLL - CRIT_RATE_BASE / CRIT_RATE_PER_ROLL) / 2
    a = np.clip(a, 0.0, b)
    a = np.minimum(a, (100.0 - CRIT_RATE_BASE) / CRIT_RATE_PER_ROLL)
    crit_rate = CRIT_RATE_BASE + CRIT_RATE_PER_ROLL * a
    crit_dmg = CRIT_DMG_BASE + CRIT_DMG_PER_ROLL * (b - a)
    return 1 + (crit_rate / 100) * (crit_dmg / 100)


def damage(n, b):
    """`n` 个等效词条中给双爆 `b` 个时的星扩散直伤（任意单位，只用于比较）。"""
    em = EM_PER_ROLL * (n - b) + EM_BASE
    return em * (1 + SWIRL_BONUS + em_term(em)) * crit_zone_at(b)


def best_split(n):
    """最优双爆词条数 `b*` 与该 `n` 下的最大伤害。"""
    result = minimize_scalar(lambda b: -damage(n, b), bounds=(0.0, n), method="bounded")
    return float(result.x), float(-result.fun)


def plateau(n, f_max, level=PLATEAU_LEVEL):
    """伤害不低于 `level × f_max` 的双爆词条数区间。假定曲线单峰。"""
    grid = np.linspace(0.0, n, 4001)
    within = grid[damage(n, grid) >= level * f_max]
    return (float(within.min()), float(within.max())) if within.size else (np.nan, np.nan)


def sweep(ns: Iterable[float]):
    """对一串 `n` 求最优解，返回若干等长数组。"""
    ns = np.asarray(list(ns), dtype=float)
    bs = np.empty_like(ns)
    fmax = np.empty_like(ns)
    lo = np.empty_like(ns)
    hi = np.empty_like(ns)
    for i, n in enumerate(ns):
        bs[i], fmax[i] = best_split(n)
        lo[i], hi[i] = plateau(n, fmax[i])
    return ns, bs, fmax, lo, hi


def plot_relative_damage():
    """图 A：相对「该 n 下词条全给精通」的伤害倍数，看形状与平台宽度。"""
    fig, ax = plt.subplots(figsize=(9.2, 7.2), layout="constrained")
    # viridis_r：词条越多颜色越深。但从 0.28 起采样，避开最浅的黄 ——
    # n = 15 用满量程的起点会是亮黄色，白底上看不清。
    cmap = plt.get_cmap("viridis_r")
    first, last = 0.28, 1.0

    # 标注文字用曲线色 + 白色描边：既能和曲线对上，压线时也不会被曲线笔画切断
    def halo(width):
        return [path_effects.withStroke(linewidth=width, foreground="white")]

    for i, n in enumerate(N_CURVES):
        base = damage(n, 0.0)

        def at(x, n=n, base=base):
            return damage(n, x) / base

        b = np.linspace(0.0, n, 601)
        color = cmap(first + (last - first) * i / max(len(N_CURVES) - 1, 1))
        ax.plot(b, at(b), lw=2.0, color=color, label=f"共 {n} 词条")

        b_star, f_max = best_split(n)
        lo, hi = plateau(n, f_max)

        # 最优：菱形标记 + 「×最优词条数 (纵轴值)」；99% 平台：两端圆点 + 虚线弦
        ax.plot([b_star], [at(b_star)], marker="D", ms=5.5, color=color,
                markeredgecolor="white", markeredgewidth=0.9, zorder=6)
        # 标注紧贴在菱形的右上方 —— 只抬几个点，靠描边与曲线脱开
        ax.annotate(f"×{b_star:.1f} ({at(b_star):.3f})", (b_star, at(b_star)),
                    textcoords="offset points", xytext=(5, 0),
                    ha="left", va="bottom", fontsize=9.5, zorder=10,
                    color=color, fontweight="bold", path_effects=halo(3.0))

        ax.plot([lo, hi], [at(lo), at(hi)], ls="--", lw=1.2, color=color,
                alpha=0.85, zorder=4)
        ax.plot([lo, hi], [at(lo), at(hi)], "o", ms=5.5, color=color,
                markeredgecolor="white", markeredgewidth=0.9, zorder=5)
        for x in (lo, hi):
            ax.annotate(f"{x:.1f} 词", (x, at(x)), textcoords="offset points",
                        xytext=(0, -17), ha="center", fontsize=8.5, zorder=10,
                        color=color, path_effects=halo(2.5))

    ax.axhline(1.0, ls="--", lw=1.2, color="grey", zorder=1)
    ax.set_xlabel("给双爆的等效词条数（其余给精通）")
    ax.set_ylabel("星扩散直伤，相对「该曲线词条全部给精通」的倍数")
    ax.set_title("星扩散直伤：精通和双爆的词条分配", fontsize=13)
    ax.grid(alpha=0.3, lw=0.6)
    ax.legend(loc="upper left", fontsize=10, framealpha=0.92)

    fig.supxlabel(
        "基准：上完 buff、不含副词条的面板 —— 精通 951，双暴分 92.1。\n"
        "菱形点及其「×词条数 (纵轴值)」为该 n 下的最优；虚线弦代表这段区间内伤害仍在最大值的 99% 以上。",
        fontsize=9, color="#555555",
    )
    fig.savefig(OUT_DIR / "relative_damage.png", dpi=160)
    plt.close(fig)


def plot_optimal_split():
    """图 B：最优分配规则 —— 分多少给双爆，容错多大，分完面板长什么样。"""
    ns, bs, _, lo, hi = sweep(np.linspace(*N_RANGE, 121))

    fig, (top, bottom) = plt.subplots(
        2, 1, figsize=(8.6, 8.2), layout="constrained", sharex=True,
        height_ratios=[1.15, 1.0],
    )

    top.fill_between(ns, lo, hi, color="crimson", alpha=0.18,
                     label=f"{PLATEAU_LEVEL:.0%} 平台（伤害差 <1% 的范围）")
    top.plot(ns, bs, lw=2.4, color="black", label="最优双爆词条数（图 A 的 ×）")
    top.plot(ns, ns, ls="--", lw=1.4, color="grey", label="全部词条给双爆")
    top.axhline(0.0, ls=":", lw=1.2, color="grey")
    top.set_ylabel("给双爆的等效词条数")
    top.set_title("星扩散直伤：最优分配规则", fontsize=13)
    top.grid(alpha=0.3, lw=0.6)
    top.legend(loc="upper left", fontsize=10, framealpha=0.92)

    em = EM_PER_ROLL * (ns - bs) + EM_BASE
    # 最优点处暴击率与暴伤的实际配比：a* = b/2 + (d0/s − c0/r)/2，同样受 [0, b] 约束
    a = bs / 2 + (CRIT_DMG_BASE / CRIT_DMG_PER_ROLL - CRIT_RATE_BASE / CRIT_RATE_PER_ROLL) / 2
    a = np.clip(a, 0.0, bs)
    crit_rate = CRIT_RATE_BASE + CRIT_RATE_PER_ROLL * a
    crit_dmg = CRIT_DMG_BASE + CRIT_DMG_PER_ROLL * (bs - a)

    bottom.plot(ns, em, lw=2.2, color="tab:green")
    bottom.set_ylabel("元素精通", color="tab:green")
    bottom.tick_params(axis="y", labelcolor="tab:green")
    bottom.grid(alpha=0.3, lw=0.6)

    twin = bottom.twinx()
    twin.plot(ns, crit_rate, lw=2.2, ls="-", color="tab:red", label="暴击率")
    twin.plot(ns, crit_dmg, lw=2.2, ls="--", color="tab:orange", label="暴伤")
    twin.set_ylabel("暴击率 / 暴伤 (%)")
    twin.legend(loc="lower right", fontsize=10, framealpha=0.92)

    bottom.set_xlabel("等效词条总数 n")
    bottom.set_title("最优点对应的面板", fontsize=11)

    fig.supxlabel(
        "基准：上完 buff、不含副词条的面板 —— 精通 951，双暴分 92.1。\n"
        "n 为副词条中落在精通或双爆上的等效词条总数；只有副词条参与分配。",
        fontsize=9, color="#555555",
    )

    fig.savefig(OUT_DIR / "optimal_split.png", dpi=160)
    plt.close(fig)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 简化的暴击区公式（假定 1:2 恒成立）与本实现的差异
    for b in (0.0, 3.0, 6.0, 10.0, 20.0):
        equiv = CRIT_RATE_BASE + CRIT_DMG_BASE / 2 + CRIT_RATE_PER_ROLL * b
        simplified = 1 + equiv**2 / 20000
        exact = crit_zone_at(b)
        print(f"  b={b:<5} 简化 {simplified:.4f}  实际 {exact:.4f}  差 {(simplified/exact-1)*100:+.2f}%")
    print(f"（b >= {BALANCED_FROM:.1f} 时两者一致）\n")

    print(f"{'n':>4} {'b*':>7} {'b*/n':>7} {'峰值/0词条':>11} {'99% 平台':>18}")
    for n in N_CURVES:
        b_star, f_max = best_split(n)
        lo, hi = plateau(n, f_max)
        print(f"{n:>4} {b_star:>7.1f} {b_star / n:>7.2f} {f_max / damage(n, 0.0):>11.4f} "
              f"{f'[{lo:.1f}, {hi:.1f}]':>18}")

    plot_relative_damage()
    plot_optimal_split()
    print(f"\n输出 -> {OUT_DIR}")


if __name__ == "__main__":
    main()

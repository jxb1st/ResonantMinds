import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# Talking-head / audio-video quality comparison (raw values from the paper table).
methods = ["SadTalker", "Hallo3", "EDTalk", "Sonic", "DICE-Talk", "Ours"]

# metric: (title, arrow_note, values aligned with `methods`; None = not reported)
metrics = [
    ("Open-D",    "higher is better", [48.50, 55.00, 57.83, 53.08, 54.11, 61.00]),
    ("Emo-Acc",   "higher is better", [58.00, 65.00, 75.11, 65.56, 57.25, 91.92]),
    ("LipLMD",    "lower is better",  [26.50, 32.00, 21.91, 28.01, 28.47, 22.39]),
    ("AVOffset",  "close to 0 is better", [-37.18, -31.44, -31.54, -33.94, -44.47, -33.96]),
    ("AVConf",    "higher is better", [2.45, 2.76, 2.49, 2.66, 2.85, 2.50]),
    ("Emo Score", "higher is better", [0.28, 0.30, None, None, 0.3057, 0.3604]),
]

c_base   = "#F2D6A2"   # sand (baselines)
c_ours   = "#5E8FD0"   # blue (Ours, hero)

def bar_colors():
    cols = [c_base] * 5 + [c_ours]
    return cols

fig, axes = plt.subplots(2, 3, figsize=(14.5, 7.6), dpi=150)
axes = axes.ravel()
x = np.arange(len(methods))

for ax, (title, note, vals) in zip(axes, metrics):
    plotted = [(v if v is not None else 0) for v in vals]
    bars = ax.bar(x, plotted, 0.66, color=bar_colors(), edgecolor="#9aa0a6", linewidth=0.5)

    # value labels
    vmax = max(abs(v) for v in plotted) or 1
    for rect, v in zip(bars, vals):
        if v is None:
            ax.text(rect.get_x() + rect.get_width()/2, 0.02*vmax, "–",
                    ha="center", va="bottom", fontsize=8, color="#aaa")
            continue
        off = 0.02*vmax if v >= 0 else -0.02*vmax
        ax.text(rect.get_x() + rect.get_width()/2, v + off, f"{v:.2f}".rstrip("0").rstrip(".") if title=="Emo Score" else f"{v:.1f}",
                ha="center", va=("bottom" if v >= 0 else "top"), fontsize=7, color="#555")

    ax.set_title(f"{title}  ({note})", fontsize=11.5, pad=8, color="#333")
    ax.set_xticks(x)
    ax.set_xticklabels(methods, fontsize=7.6)
    ax.tick_params(axis="x", length=0)
    ax.tick_params(axis="y", labelsize=8)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_color("#cccccc")
    ax.spines["bottom"].set_color("#cccccc")
    ax.set_axisbelow(True)
    ax.yaxis.grid(True, color="#eeeeee", linewidth=0.9)

    vmin = min(plotted); vmaxv = max(plotted)
    if vmin >= 0:
        ax.set_ylim(0, vmaxv * 1.18)
    else:
        pad = (vmaxv - vmin) * 0.18
        ax.set_ylim(vmin - pad, max(vmaxv, 0) + pad)

from matplotlib.patches import Patch
handles = [
    Patch(facecolor=c_base, edgecolor="#9aa0a6", linewidth=0.5, label="Baselines"),
    Patch(facecolor=c_ours, edgecolor="#9aa0a6", linewidth=0.5, label="Ours"),
]
fig.legend(handles=handles, loc="upper center", ncol=3, frameon=False,
           fontsize=11, bbox_to_anchor=(0.5, 1.005))

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig("assets/images/talking_head_eval.png", bbox_inches="tight", facecolor="white")
print("saved assets/images/talking_head_eval.png")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# All dialogue-evaluation metrics, grouped by evaluator.
# Each entry: (label, lo, hi, agent_raw, ours_raw, script_raw). Heights normalized to % of [lo,hi].
panels = {
    "Sotopia-Eval": [
        ("Believability", 0, 10, 8.17, 9.19, 8.95),
        ("Goal",          0, 10, 6.54, 7.92, 8.87),
        ("Secret",      -10,  0, -1.77, -1.01, -2.33),
        ("Social Rules",-10,  0, -0.07, -0.04, -0.09),
    ],
    "LLM-Eval": [
        ("Content",       0, 100, 82.98, 88.23, 89.49),
        ("Grammar",       0, 100, 98.11, 97.13, 97.65),
        ("Relevance",     0, 100, 89.11, 94.25, 94.72),
        ("Appropriate.",  0, 100, 88.29, 94.98, 93.26),
    ],
    "GPT-Score": [
        ("Fluency",       0, 100, 87.26, 96.71, 98.55),
        ("Consistency",   0, 100, 85.23, 97.51, 96.91),
        ("Coherence",     0, 100, 97.49, 98.53, 98.29),
        ("Depth",         0, 100, 51.40, 57.30, 55.85),
        ("Diversity",     0, 100, 73.20, 96.33, 93.88),
        ("Likeability",   0, 100, 66.93, 90.72, 91.02),
    ],
    "G-Eval": [
        ("Relevance", 1, 5, 3.52, 3.95, 3.98),
        ("Fluency",   1, 3, 2.38, 2.48, 2.52),
        ("Coherent",  1, 5, 4.79, 4.85, 4.89),
    ],
}

def norm(v, lo, hi):
    return (v - lo) / (hi - lo) * 100.0

def fmt(v, lo, hi):
    return f"{v:.2f}" if (hi - lo) <= 10 else f"{v:.1f}"

# soft pastel palette matching the dataset pie figures
c_agent  = "#F2D6A2"   # sand
c_ours   = "#9CC0E6"   # soft blue (hero)
c_script = "#ECE5F3"   # very light lavender (reference)
w = 0.27

fig, axes = plt.subplots(2, 2, figsize=(14.5, 7.4), dpi=150)
axes = axes.ravel()

for ax, (title, rows) in zip(axes, panels.items()):
    def rng(lo, hi):
        return f"[{lo:g},{hi:g}]"
    labels = [f"{r[0]} {rng(r[1], r[2])}" for r in rows]
    x = np.arange(len(labels))
    series = [
        (c_agent,  [norm(r[3], r[1], r[2]) for r in rows], [fmt(r[3], r[1], r[2]) for r in rows], None),
        (c_ours,   [norm(r[4], r[1], r[2]) for r in rows], [fmt(r[4], r[1], r[2]) for r in rows], None),
        (c_script, [norm(r[5], r[1], r[2]) for r in rows], [fmt(r[5], r[1], r[2]) for r in rows], None),
    ]
    for k, (color, vals, texts, hatch) in enumerate(series):
        offs = (k - 1) * w
        is_script = (k == 2)
        bars = ax.bar(x + offs, vals, w, color=color,
                      edgecolor=("#9b8fb0" if is_script else "#9aa0a6"),
                      linewidth=(1.1 if is_script else 0.5),
                      linestyle=("--" if is_script else "-"),
                      hatch=hatch)
        for rect, t in zip(bars, texts):
            ax.text(rect.get_x() + rect.get_width()/2, rect.get_height() + 1.2, t,
                    ha="center", va="bottom", fontsize=5.6, color="#555", rotation=0)

    ax.set_title(title, fontsize=12.5, pad=8, color="#333")
    ax.set_ylim(0, 122)
    ax.set_yticks([0, 25, 50, 75, 100])
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=(8.3 if len(labels) <= 4 else 7.2))
    ax.tick_params(axis="x", length=0)
    ax.tick_params(axis="y", labelsize=8.5)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_color("#cccccc")
    ax.spines["bottom"].set_color("#cccccc")
    ax.set_axisbelow(True)
    ax.yaxis.grid(True, color="#eeeeee", linewidth=0.9)

from matplotlib.patches import Patch
handles = [
    Patch(facecolor=c_agent,  edgecolor="#9aa0a6", linewidth=0.5, label="Agent"),
    Patch(facecolor=c_ours,   edgecolor="#9aa0a6", linewidth=0.5, label="Ours"),
    Patch(facecolor=c_script, edgecolor="#9b8fb0", linewidth=1.1, linestyle="--",
          label="Script (Full-info reference; unrealistic)"),
]
fig.legend(handles=handles, loc="upper center", ncol=3, frameon=False,
           fontsize=11, bbox_to_anchor=(0.5, 1.005))
plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig("assets/images/llm_social_sim.png", bbox_inches="tight", facecolor="white")
print("saved assets/images/llm_social_sim.png")

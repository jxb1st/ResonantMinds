(function (window) {
  "use strict";

  if (window.SeQuantCharts && window.SeQuantCharts.version === "1") return;

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function pick(array, index, fallback) {
    return Array.isArray(array) && array[index] !== undefined ? array[index] : fallback;
  }

  function labelText(label) {
    return Array.isArray(label) ? label.join(" ") : String(label);
  }

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value)) return "n/a";
    var fixed = value.toFixed(decimals);
    if (fixed.indexOf(".") === -1) return fixed;
    return fixed.replace(/0+$/, "").replace(/\.$/, "");
  }

  function niceAutoRange(chart) {
    var values = [];
    (chart.series || []).forEach(function (series) {
      (series.values || []).forEach(function (value) {
        if (Number.isFinite(value)) values.push(value);
      });
    });

    if (!values.length) return { yMin: 0, yMax: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };

    var min = Math.min.apply(Math, values);
    var max = Math.max.apply(Math, values);

    if (Number.isFinite(chart.yMin) && Number.isFinite(chart.yMax)) {
      return { yMin: chart.yMin, yMax: chart.yMax, ticks: chart.ticks || [] };
    }

    var yMin, yMax;
    if (min >= 0) {
      yMin = 0;
      yMax = max * 1.18;
    } else if (max <= 0) {
      yMax = 0;
      yMin = min * 1.18;
    } else {
      var pad = Math.max((max - min) * 0.16, Math.abs(max) * 0.04, Math.abs(min) * 0.04, 1e-6);
      yMin = min - pad;
      yMax = max + pad;
    }

    if (Math.abs(yMax - yMin) < 1e-9) {
      yMax += 1;
      yMin -= 1;
    }

    return { yMin: yMin, yMax: yMax, ticks: chart.ticks || [] };
  }

  function autoTicks(yMin, yMax, count) {
    var span = yMax - yMin;
    if (!Number.isFinite(span) || span <= 0) return [yMin, yMax];

    var raw = span / Math.max(1, count - 1);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    var start = Math.ceil(yMin / step) * step;
    var ticks = [];
    for (var v = start; v <= yMax + step * 0.25; v += step) {
      ticks.push(Number(v.toPrecision(12)));
      if (ticks.length > 12) break;
    }
    return ticks;
  }

  function roundRect(ctx, x, y, w, h, roundTop, roundBottom) {
    if (h <= 0.4 || w <= 0.4) return;
    var r = Math.min(3, w / 2, h / 2);
    var tl = roundTop ? r : 0;
    var tr = roundTop ? r : 0;
    var br = roundBottom ? r : 0;
    var bl = roundBottom ? r : 0;

    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - br);
    if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + bl, y + h);
    if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + tl);
    if (tl) ctx.quadraticCurveTo(x, y, x + tl, y);
    else ctx.lineTo(x, y);
    ctx.closePath();
  }

  function drawWrappedText(ctx, value, x, y, maxWidth, lineHeight, maxLines) {
    var lines;
    if (Array.isArray(value)) {
      lines = value.map(String);
    } else {
      var words = String(value).replace(/([/-])/g, "$1 ").split(/\s+/).filter(Boolean);
      lines = [];
      var current = "";
      words.forEach(function (word) {
        var test = current ? current + " " + word : word;
        if (ctx.measureText(test).width <= maxWidth || !current) {
          current = test;
        } else {
          lines.push(current);
          current = word;
        }
      });
      if (current) lines.push(current);
    }

    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[lines.length - 1];
      while (last.length > 1 && ctx.measureText(last + "...").width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = last + "...";
    }

    lines.forEach(function (line, idx) {
      ctx.fillText(line, x, y + idx * lineHeight);
    });
  }

  function makeCanvasChart(canvas, chart) {
    var ctx = canvas.getContext("2d");
    var state = { progress: 0, finished: false, hoverGroup: -1, bars: [] };
    var raf = null;

    function measure() {
      var wrap = canvas.parentElement;
      var rect = wrap.getBoundingClientRect();
      var width = Math.max(260, Math.floor(rect.width || 360));
      var height = Math.max(230, Math.floor(rect.height || chart.height || 300));
      var dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: width, height: height };
    }

    function drawTooltip(layout, groupIndex) {
      if (groupIndex < 0 || groupIndex >= chart.labels.length) return;
      var label = labelText(chart.labels[groupIndex]);
      var lines = [label];
      (chart.series || []).forEach(function (series) {
        var value = pick(series.values, groupIndex, null);
        var display = pick(series.tooltipValues, groupIndex, pick(series.displayValues, groupIndex, null));
        if (display === null || display === undefined) display = formatNumber(value, chart.valueDecimals || 2);
        if (chart.tooltipSuffix && Number.isFinite(value)) {
          display += " (" + formatNumber(value, chart.tooltipDecimals || 1) + chart.tooltipSuffix + ")";
        }
        lines.push(series.name + ": " + display);
      });

      ctx.font = "9px Inter, sans-serif";
      var textWidth = 0;
      lines.forEach(function (line) {
        textWidth = Math.max(textWidth, ctx.measureText(line).width);
      });

      var w = textWidth + 16;
      var h = lines.length * 14 + 8;
      var group = layout.groups[groupIndex];
      var x = group.center - w / 2;
      var y = layout.top + 10;

      if (state.bars.length) {
        var groupBars = state.bars.filter(function (bar) { return bar.group === groupIndex; });
        if (groupBars.length) {
          var top = Math.min.apply(Math, groupBars.map(function (bar) { return bar.y; }));
          y = top - h - 8;
        }
      }

      x = Math.max(3, Math.min(x, layout.width - w - 3));
      y = Math.max(3, Math.min(y, layout.height - h - 3));

      ctx.save();
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = "#1f2937";
      roundRect(ctx, x, y, w, h, true, true);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
      lines.forEach(function (line, idx) {
        ctx.font = idx === 0 ? "700 9px Inter, sans-serif" : "9px Inter, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText(line, x + 8, y + 15 + idx * 14);
      });
      ctx.restore();
    }

    function render(progress) {
      state.progress = progress;
      var size = measure();
      var width = size.width;
      var height = size.height;
      ctx.clearRect(0, 0, width, height);

      var range = niceAutoRange(chart);
      var yMin = range.yMin;
      var yMax = range.yMax;
      var ticks = range.ticks.length ? range.ticks : autoTicks(yMin, yMax, chart.tickCount || 5);
      var labelCount = (chart.labels || []).length;
      var seriesCount = Math.max(1, (chart.series || []).length);

      var pad = {
        top: chart.padTop || 16,
        right: chart.padRight || 8,
        bottom: chart.padBottom || (labelCount > 4 ? 64 : 56),
        left: chart.padLeft || 42
      };
      var plotW = Math.max(1, width - pad.left - pad.right);
      var plotH = Math.max(1, height - pad.top - pad.bottom);
      var bottom = pad.top + plotH;
      var baseValue;
      if (Number.isFinite(chart.baseline)) {
        baseValue = chart.baseline;
      } else if (yMax <= 0 || chart.bottomBaseline) {
        baseValue = yMin;
      } else if (yMin < 0 && yMax > 0) {
        baseValue = 0;
      } else {
        baseValue = yMin;
      }
      var yOf = function (v) {
        return pad.top + plotH - (v - yMin) / (yMax - yMin) * plotH;
      };

      ctx.save();
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "right";
      ticks.forEach(function (tick) {
        if (tick < yMin - 1e-9 || tick > yMax + 1e-9) return;
        var y = yOf(tick);
        ctx.strokeStyle = "#e8e8e8";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#9ca3af";
        ctx.fillText(formatNumber(tick, chart.tickDecimals || 0), pad.left - 5, y + 3);
      });
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top);
      ctx.lineTo(pad.left, bottom);
      ctx.lineTo(pad.left + plotW, bottom);
      ctx.stroke();
      ctx.restore();

      if (chart.yLabel) {
        ctx.save();
        ctx.translate(10, pad.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#777";
        ctx.font = "9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(chart.yLabel, 0, 0);
        ctx.restore();
      }

      state.bars = [];
      var groupW = plotW / Math.max(1, labelCount);
      var inner = groupW * (seriesCount === 1 ? 0.58 : 0.74);
      var gap = Math.min(5, inner * 0.08);
      var barW = Math.max(5, Math.min(chart.maxBarWidth || 28, (inner - gap * (seriesCount - 1)) / seriesCount));
      var groups = [];

      for (var i = 0; i < labelCount; i += 1) {
        var groupCenter = pad.left + i * groupW + groupW / 2;
        groups.push({ center: groupCenter });
        var startX = groupCenter - (seriesCount * barW + (seriesCount - 1) * gap) / 2;

        (chart.series || []).forEach(function (series, sIndex) {
          var value = pick(series.values, i, null);
          var x = startX + sIndex * (barW + gap);
          var color = pick(series.colors, i, series.color || "rgba(148,163,184,0.82)");
          var borderColor = pick(series.borderColors, i, series.borderColor || "rgba(100,116,139,0.55)");

          if (!Number.isFinite(value)) {
            ctx.save();
            ctx.fillStyle = "#aaa";
            ctx.font = "10px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("n/a", x + barW / 2, yOf(baseValue) - 4);
            ctx.restore();
            return;
          }

          var current = baseValue + (value - baseValue) * progress;
          var yBase = yOf(baseValue);
          var yCurrent = yOf(current);
          var y = Math.min(yBase, yCurrent);
          var h = Math.abs(yBase - yCurrent);
          var positive = value >= baseValue;

          ctx.save();
          ctx.fillStyle = color;
          roundRect(ctx, x, y, barW, h, positive || y <= yBase, !positive || y >= yBase);
          ctx.fill();
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = series.borderWidth || 0.7;
          if (series.dashed) ctx.setLineDash([3, 3]);
          roundRect(ctx, x, y, barW, h, positive || y <= yBase, !positive || y >= yBase);
          ctx.stroke();
          ctx.restore();

          state.bars.push({ group: i, series: sIndex, x: x, y: y, w: barW, h: h, value: value });
        });

        ctx.save();
        ctx.fillStyle = "#888";
        ctx.font = (chart.xFontSize || (labelCount > 4 ? 8 : 9)) + "px Inter, sans-serif";
        ctx.textAlign = "center";
        drawWrappedText(ctx, chart.labels[i], groupCenter, bottom + 14, Math.max(42, groupW - 8), 11, chart.xMaxLines || 3);
        ctx.restore();
      }

      var labelAlpha = Math.max(0, Math.min(1, (progress - 0.82) / 0.18));
      if (labelAlpha > 0) {
        state.bars.forEach(function (bar) {
          var series = chart.series[bar.series];
          var text = pick(series.displayValues, bar.group, formatNumber(bar.value, chart.valueDecimals || 1));
          var baseY = yOf(baseValue);
          var valueY = yOf(bar.value);
          var above = valueY <= baseY;
          var y = above ? valueY - 5 : valueY + 12;
          ctx.save();
          ctx.globalAlpha = labelAlpha;
          ctx.fillStyle = pick(series.labelColors, bar.group, series.labelColor || "#555");
          ctx.font = (series.labelWeight || "600") + " " + (chart.valueFontSize || 8) + "px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(text, bar.x + bar.w / 2, y);
          ctx.restore();
        });
      }

      if (state.hoverGroup >= 0) {
        drawTooltip({ width: width, height: height, top: pad.top, groups: groups }, state.hoverGroup);
      }
    }

    function play() {
      cancelAnimationFrame(raf);
      var start = null;
      var duration = chart.duration || 1600;
      function frame(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        render(eased);
        if (t < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          state.finished = true;
          render(1);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    // hover tooltips disabled

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        render(state.finished ? 1 : state.progress);
      }, 80);
    });

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      state.finished = true;
      render(1);
    } else if ("IntersectionObserver" in window) {
      render(0);
      var observer = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        play();
      }, { threshold: 0.12 });
      observer.observe(canvas);
    } else {
      play();
    }
  }

  function init(payload) {
    (payload.charts || []).forEach(function (chart) {
      var canvas = document.getElementById(chart.canvasId);
      if (canvas) makeCanvasChart(canvas, chart);
    });
  }

  window.SeQuantCharts = { version: "1", init: init };
})(window);

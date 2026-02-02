import { useEffect, useMemo, useRef, useState } from 'react';
import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import styles from './SeasonReviewBarRace.module.css';

export interface SeasonReviewBarRaceProps {
  labels: string[]; // "Game 1"..."Game N"
  datasets: {
    label: string;
    data: number[];
    avatarUrl?: string;
    playerSlug?: string;
  }[];
  initialIndex?: number; // default 0
  topN?: number; // optional limit (default show all)
}

type TooltipThis = {
  key?: string | number;
  y?: number;
};

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default function SeasonReviewBarRace({
  labels,
  datasets,
  initialIndex = 0,
  topN,
}: SeasonReviewBarRaceProps) {
  const maxIdx = Math.max(0, labels.length - 1);
  const [idx, setIdx] = useState(Math.min(Math.max(initialIndex, 0), maxIdx));
  const [playing, setPlaying] = useState(false);

  const chartRef = useRef<any>(null);

  const avatarByName = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    datasets.forEach((d) => (m[d.label] = d.avatarUrl));
    return m;
  }, [datasets]);

  // Which names to show (all by default, or topN for the current frame)
  const visibleNames = useMemo(() => {
    if (!topN) return new Set(datasets.map((d) => d.label));

    const ranked = datasets
      .map((d) => ({ name: d.label, value: d.data[idx] ?? 0 }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, topN);

    return new Set(ranked.map((r) => r.name));
  }, [datasets, idx, topN]);

  // IMPORTANT: Keep data in a stable order (datasets order).
  // Let dataSorting handle the reordering animation.
  const frameData = useMemo(() => {
    return datasets
      .filter((d) => visibleNames.has(d.label))
      .map((d) => [d.label, d.data[idx] ?? 0] as [string, number]);
  }, [datasets, idx, visibleNames]);

  // Lock yAxis max to final frame so it doesn't rescale every step (looks smoother).
  const finalMax = useMemo(() => {
    let m = 0;
    for (const ds of datasets) {
      const v = ds.data[maxIdx] ?? 0;
      if (v > m) m = v;
    }
    return Math.ceil(m / 10) * 10 + 10;
  }, [datasets, maxIdx]);

  // Smooth update between frames:
  // updatePoints=true prevents "all bars drop" redraw behaviour.
  useEffect(() => {
    const chart: Highcharts.Chart | undefined = chartRef.current?.chart;
    if (!chart || !chart.series?.[0]) return;

    // Keep subtitle in sync without full chart.update jitter
    chart.setTitle(
      undefined,
      { text: labels[idx] ?? `Game ${idx + 1}` },
      false,
    );

    // setData(data, redraw, animation, updatePoints)
    // animation=false here is OK: dataSorting provides the motion.
    (chart.series[0] as any).setData(frameData, true, { duration: 550 }, true);
  }, [frameData, idx, labels]);

  // Play loop
  useEffect(() => {
    if (!playing) return;

    const t = window.setInterval(() => {
      setIdx((cur) => (cur >= maxIdx ? cur : cur + 1));
    }, 750);

    return () => window.clearInterval(t);
  }, [playing, maxIdx]);

  // Stop at end
  useEffect(() => {
    if (playing && idx >= maxIdx) setPlaying(false);
  }, [playing, idx, maxIdx]);

  const options: Highcharts.Options = {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      animation: { duration: 900 },
      marginRight: 18,
      height: Math.max(420, 34 * frameData.length),
    },
    title: { text: undefined },
    subtitle: {
      text: labels[idx] ?? `Game ${idx + 1}`,
      floating: true,
      align: 'right',
      verticalAlign: 'top',
      y: 0,
      x: 0,
      style: { fontSize: '12px', opacity: 0.8 } as any,
    },
    credits: { enabled: false },
    legend: { enabled: false },

    xAxis: {
      type: 'category',
      labels: {
        useHTML: true,
        style: { fontSize: '12px' } as any,
        formatter: function (
          this: Highcharts.AxisLabelsFormatterContextObject,
        ) {
          const name = String(this.value ?? '');
          const avatar = avatarByName[name];
          const img = avatar
            ? `<img src="${avatar}" alt="" style="width:18px;height:18px;border-radius:999px;vertical-align:middle;margin-left:8px" />`
            : '';
          // avatar to the RIGHT of the name
          return `<span style="display:inline-flex;align-items:center;white-space:nowrap;">${escapeHtml(
            name,
          )}${img}</span>`;
        },
      },
    },

    yAxis: {
      opposite: true,
      title: { text: null },
      min: 0,
      max: finalMax,
      tickPixelInterval: 120,
      labels: { style: { fontSize: '12px' } as any },
    },

    plotOptions: {
      series: {
        // demo-style: let dataSorting do the movement
        animation: false,
        groupPadding: 0,
        pointPadding: 0.12,
        borderWidth: 0,
        colorByPoint: true,
        dataSorting: {
          enabled: true,
          matchByName: true,
        },
        dataLabels: {
          enabled: true,
          style: { fontSize: '12px', fontWeight: '600' } as any,
        },
      },
    },

    tooltip: {
      useHTML: true,
      formatter: function (this: TooltipThis) {
        const name = String(this.key ?? '');
        const val = Number(this.y ?? 0);
        const avatar = avatarByName[name];
        const img = avatar
          ? `<img src="${avatar}" alt="" style="width:18px;height:18px;border-radius:999px;vertical-align:middle;margin-right:8px" />`
          : '';
        const label = labels[idx] ?? '';
        return `<div>${img}<b>${escapeHtml(
          name,
        )}</b><br/>${escapeHtml(label)}: <b>${val}</b> pts</div>`;
      },
    },

    series: [
      {
        type: 'bar',
        name: 'Points',
        data: frameData as any,
      },
    ],
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setPlaying((p) => !p)}
          disabled={labels.length <= 1}
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <div className={styles.meta}>
          <div className={styles.gameLabel}>
            {labels[idx] ?? `Game ${idx + 1}`}
          </div>
          <div className={styles.small}>
            {idx + 1} / {labels.length}
          </div>
        </div>
      </div>

      <input
        className={styles.slider}
        type="range"
        min={0}
        max={maxIdx}
        value={idx}
        onChange={(e) => {
          setIdx(Number(e.target.value));
          setPlaying(false);
        }}
      />

      <div className={styles.chartScroll}>
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          options={options}
        />
      </div>
    </div>
  );
}

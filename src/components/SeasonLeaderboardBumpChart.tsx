import { useEffect, useMemo, useRef, useState } from 'react';
import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';

export interface SeasonLeaderboardBumpChartProps {
  labels: string[];
  datasets: { label: string; data: number[] }[];
  avatarByLabel?: Record<string, string | undefined>;
}

const HOVER_PLOTLINE_ID = 'hover-final-rank-line';

export default function SeasonLeaderboardBumpChart({
  labels,
  datasets,
  avatarByLabel = {},
}: SeasonLeaderboardBumpChartProps) {
  const [themeReady, setThemeReady] = useState(false);
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  useEffect(() => {
    import('highcharts/themes/brand-light')
      .then(() => setThemeReady(true))
      .catch((err) => console.error('Error loading Highcharts theme:', err));
  }, []);

  const { rankSeries } = useMemo(() => {
    const numGames = labels.length;

    const pbg: Array<Array<{ label: string; points: number }>> = Array.from(
      { length: numGames },
      () => [],
    );

    datasets.forEach((ds) => {
      for (let i = 0; i < numGames; i++) {
        pbg[i].push({ label: ds.label, points: ds.data[i] ?? 0 });
      }
    });

    const ranksByLabel: Record<string, number[]> = {};
    datasets.forEach(
      (ds) => (ranksByLabel[ds.label] = Array(numGames).fill(0)),
    );

    for (let i = 0; i < numGames; i++) {
      const sorted = pbg[i]
        .slice()
        .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));

      sorted.forEach((item, idx) => {
        ranksByLabel[item.label][i] = idx + 1;
      });
    }

    const series = datasets.map((ds) => {
      const data = ranksByLabel[ds.label].map((rank, x) => ({
        x,
        y: rank,
        custom: { points: ds.data[x] ?? 0 },
      }));

      return {
        type: 'spline' as const,
        name: ds.label,
        data,
        marker: { enabled: false },
        custom: { avatarUrl: avatarByLabel[ds.label] },

        // NEW: hover the series => highlight the player's FINAL rank (last point)
        events: {
          mouseOver: function (this: any) {
            const chart = chartRef.current?.chart;
            const yAxis = chart?.yAxis?.[0];
            if (!chart || !yAxis) return;

            const pts = this.points || this.data || [];
            const lastPoint = pts[pts.length - 1];
            const finalRank = lastPoint?.y;

            if (typeof finalRank !== 'number') return;

            yAxis.removePlotLine(HOVER_PLOTLINE_ID);
            yAxis.addPlotLine({
              id: HOVER_PLOTLINE_ID,
              value: finalRank,
              width: 2,
              color: 'rgba(0,0,0,0.35)',
              zIndex: 5,
            });
          },
          mouseOut: function () {
            const chart = chartRef.current?.chart;
            const yAxis = chart?.yAxis?.[0];
            yAxis?.removePlotLine(HOVER_PLOTLINE_ID);
          },
        },
      };
    });

    return { rankSeries: series };
  }, [datasets, labels.length, avatarByLabel]);

  if (!themeReady) return null;

  const options: Highcharts.Options = {
    chart: { type: 'spline', backgroundColor: 'transparent' },
    title: { text: undefined },

    xAxis: {
      categories: labels,
      tickmarkPlacement: 'on',
    },

    yAxis: {
      title: { text: null },
      reversed: true,
      min: 1,
      max: datasets.length,
      tickInterval: 1,
    },

    legend: {
      useHTML: true,
      labelFormatter: function () {
        const s: any = this as any;
        const avatar = s?.options?.custom?.avatarUrl;
        const img = avatar
          ? `<img src="${avatar}" alt="" style="width:18px;height:18px;border-radius:999px;vertical-align:middle;margin-right:8px" />`
          : '';
        return `${img}${s.name}`;
      },
    },

    tooltip: {
      shared: false,
      formatter: function (this: any) {
        const gameIdx = (this.x ?? 0) as number;
        const rank = this.y;
        const pts = this.point?.custom?.points ?? 0;
        return `<b>${this.series.name}</b><br/>Game ${gameIdx + 1}: Rank ${rank}, Points ${pts}`;
      },
    },

    plotOptions: {
      spline: { marker: { enabled: false } },
      series: {
        // helps ensure line hover is responsive
        stickyTracking: true,
      },
    },

    series: rankSeries as any,
    credits: { enabled: false },
  };

  return (
    <div style={{ height: '650px' }}>
      <HighchartsReact
        ref={chartRef as any}
        highcharts={Highcharts}
        options={options}
        containerProps={{ style: { height: '100%', width: '100%' } }}
      />
    </div>
  );
}

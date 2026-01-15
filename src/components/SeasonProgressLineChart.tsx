import { useEffect, useMemo, useState } from 'react';
import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';

export interface SeasonLineChartProps {
  labels: string[];
  datasets: { label: string; data: number[]; avatarUrl?: string }[];
}

export default function SeasonLineChart({
  labels,
  datasets,
}: SeasonLineChartProps) {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    import('highcharts/themes/brand-light')
      .then(() => setThemeReady(true))
      .catch((err) => console.error('Error loading Highcharts theme:', err));
  }, []);

  const avatarByLabel = useMemo(() => {
    const map: Record<string, string> = {};
    datasets.forEach((d) => {
      if (d.avatarUrl) map[d.label] = d.avatarUrl;
    });
    return map;
  }, [datasets]);

  if (!themeReady) return null;

  const series: Highcharts.SeriesSplineOptions[] = datasets.map((ds) => ({
    type: 'spline',
    name: ds.label,
    data: ds.data,
    marker: { enabled: false },
    lineWidth: 2,
    pointPlacement: 'on',
    // store avatar on the series options so legend/tooltip can access it
    custom: { avatarUrl: ds.avatarUrl },
  })) as any;

  const options: Highcharts.Options = {
    chart: {
      type: 'spline',
      marginRight: 40,
      backgroundColor: 'transparent',
    },
    title: { text: undefined },
    xAxis: {
      categories: labels,
      tickmarkPlacement: 'on',
      labels: {
        useHTML: true,
        formatter: function () {
          return `<div>Game ${this.pos! + 1}</div>`;
        },
      },
    },
    yAxis: {
      title: { text: null },
      min: 0,
    },
    legend: {
      align: 'center',
      verticalAlign: 'bottom',
      layout: 'horizontal',
      useHTML: true,
      labelFormatter: function () {
        const s: any = this as any;
        const avatar = s?.options?.custom?.avatarUrl || avatarByLabel[s.name];
        const img = avatar
          ? `<img src="${avatar}" alt="" style="width:18px;height:18px;border-radius:999px;vertical-align:middle;margin-right:8px" />`
          : '';
        return `${img}${s.name}`;
      },
    },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function (this: any) {
        const pts = (this.points ?? [])
          .slice()
          .sort((a: any, b: any) => b.y! - a.y!);

        let s = `<div style="margin-bottom:4px"><b>Game ${this.x + 1}</b><br />${this.category}</div><table>`;

        pts.forEach((p: any) => {
          const avatar =
            p.series?.options?.custom?.avatarUrl ||
            avatarByLabel[p.series.name];
          const img = avatar
            ? `<img src="${avatar}" alt="" style="width:18px;height:18px;border-radius:999px;vertical-align:middle;margin-right:8px" />`
            : '';

          s +=
            `<tr>` +
            `<td style="padding-right:6px">${img}</td>` +
            `<td style="color:${p.series.color};padding-right:4px">\u25CF</td>` +
            `<td>${p.series.name}:</td>` +
            `<td style="padding-left:4px"><b>${p.y}</b></td>` +
            `</tr>`;
        });

        s += `</table>`;
        return s;
      },
    },
    plotOptions: {
      spline: {
        marker: { enabled: false },
        lineWidth: 2,
      },
    },
    series,
    responsive: {
      rules: [
        {
          condition: { maxWidth: 500 },
          chartOptions: { legend: { enabled: false } },
        },
      ],
    },
    credits: { enabled: false },
  };

  return (
    <div style={{ height: '600px' }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        containerProps={{ style: { height: '100%', width: '104%' } }}
      />
    </div>
  );
}

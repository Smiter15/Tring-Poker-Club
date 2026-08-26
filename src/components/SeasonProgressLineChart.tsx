import { useEffect, useMemo, useState } from 'react';
import type * as HighchartsType from 'highcharts';
import { getGeneratedAvatarDetails, isPlaceholderAvatar } from './PlayerAvatar';

export interface SeasonLineChartProps {
  labels: string[];
  datasets: { label: string; data: number[]; avatarUrl?: string }[];
}

type LoadedChartLibs = {
  Highcharts: typeof HighchartsType;
  HighchartsReact: any;
};

export default function SeasonLineChart({
  labels,
  datasets,
}: SeasonLineChartProps) {
  const [libs, setLibs] = useState<LoadedChartLibs | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChartLibs() {
      try {
        const hcMod = await import('highcharts');
        const Highcharts = (hcMod as any).default ?? hcMod;
        await import('highcharts/modules/accessibility');

        const reactMod = await import('highcharts-react-official');
        const HighchartsReact =
          (reactMod as any).HighchartsReact ??
          (reactMod as any).default?.HighchartsReact ??
          (reactMod as any).default;

        if (!cancelled) {
          setLibs({ Highcharts, HighchartsReact });
        }
      } catch (err) {
        console.error('Error loading Highcharts line chart libs:', err);
      }
    }

    loadChartLibs();

    return () => {
      cancelled = true;
    };
  }, []);

  const avatarByLabel = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    datasets.forEach((d) => {
      map[d.label] = isPlaceholderAvatar(d.avatarUrl) ? undefined : d.avatarUrl;
    });
    return map;
  }, [datasets]);

  if (!libs) return null;

  const { Highcharts, HighchartsReact } = libs;

  const series: HighchartsType.SeriesSplineOptions[] = datasets.map((ds) => ({
    type: 'spline',
    name: ds.label,
    data: ds.data,
    marker: { enabled: false },
    lineWidth: 2,
    pointPlacement: 'on',
    custom: {
      avatarUrl: isPlaceholderAvatar(ds.avatarUrl) ? undefined : ds.avatarUrl,
    } as any,
  }));

  const options: HighchartsType.Options = {
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
      title: { text: undefined },
      min: 0,
    },
    legend: {
      align: 'center',
      verticalAlign: 'bottom',
      layout: 'horizontal',
      useHTML: true,
      labelFormatter: function () {
        const s: any = this;
        const avatar = s?.options?.custom?.avatarUrl || avatarByLabel[s.name];
        const { scheme, initials } = getGeneratedAvatarDetails(s.name);
        const avatarMarkup = avatar
          ? `<span aria-hidden="true" style="display:inline-flex;width:18px;height:18px;flex:0 0 18px;border-radius:5px;vertical-align:middle;margin-right:8px;background-image:url('${avatar}');background-size:cover;background-position:center"></span>`
          : `<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;vertical-align:middle;margin-right:8px;background:${scheme.background};color:${scheme.foreground};font-size:8px;font-weight:800">${initials}</span>`;
        return `${avatarMarkup}${s.name}`;
      },
    },
    tooltip: {
      shared: true,
      useHTML: true,
      outside: true,
      stickOnContact: true,
      hideDelay: 200,
      formatter: function (this: any) {
        const pts = (this.points ?? [])
          .slice()
          .sort((a: any, b: any) => b.y! - a.y!);

        let s = `<div style="margin-bottom:4px"><b>Game ${this.x + 1}</b><br />${this.category}</div><table>`;

        pts.forEach((p: any) => {
          const avatar =
            p.series?.options?.custom?.avatarUrl ||
            avatarByLabel[p.series.name];
          const { scheme, initials } = getGeneratedAvatarDetails(p.series.name);
          const avatarMarkup = avatar
            ? `<span aria-hidden="true" style="display:inline-flex;width:18px;height:18px;flex:0 0 18px;border-radius:5px;vertical-align:middle;margin-right:8px;background-image:url('${avatar}');background-size:cover;background-position:center"></span>`
            : `<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;vertical-align:middle;margin-right:8px;background:${scheme.background};color:${scheme.foreground};font-size:8px;font-weight:800">${initials}</span>`;

          s +=
            `<tr>` +
            `<td style="padding-right:6px">${avatarMarkup}</td>` +
            `<td style="color:${p.series.color};padding-right:4px">●</td>` +
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

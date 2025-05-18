import { useMemo, useEffect, useState } from 'react';
import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';

type KOEvent = {
  killerName: string;
  killerImage: string | null;
  victimName: string;
  victimImage: string | null;
};

interface Props {
  events: KOEvent[];
}

export default function GameKnockoutNetworkGraph({ events }: Props) {
  const [hcLoaded, setHcLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('highcharts/modules/networkgraph').then(() => setHcLoaded(true));
  }, []);

  const { nodes, links } = useMemo(() => {
    // 1) Build maps & tallies
    const nodesMap: Record<
      string,
      { id: string; name: string; imageUrl?: string }
    > = {};
    const killCounts: Record<string, number> = {};
    const linkCounts: Record<string, number> = {};

    events.forEach(({ killerName, killerImage, victimName, victimImage }) => {
      if (!nodesMap[killerName]) {
        nodesMap[killerName] = {
          id: killerName,
          name: killerName,
          imageUrl: killerImage || undefined,
        };
      }
      if (!nodesMap[victimName]) {
        nodesMap[victimName] = {
          id: victimName,
          name: victimName,
          imageUrl: victimImage || undefined,
        };
      }
      killCounts[killerName] = (killCounts[killerName] || 0) + 1;

      const key = `${killerName}|${victimName}`;
      linkCounts[key] = (linkCounts[key] || 0) + 1;
    });

    // 2) Identify top‐3 killers
    const sorted = Object.entries(killCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
    const top3 = sorted.slice(0, 3);

    // 3) Compute sizes
    const BASE = 48;
    const multipliers = [1.5, 1.25, 1.1];
    const sizeMap: Record<string, number> = {};
    top3.forEach((name, idx) => {
      sizeMap[name] = Math.round(BASE * multipliers[idx]);
    });

    const [iconW, iconH, , , svgPathData] = faUserCircle.icon;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${iconW} ${iconH}">
  <path fill="#666" d="${svgPathData}"/>
</svg>`;

    // encode, but don't wrap in quotes:
    const encoded = encodeURIComponent(svg);
    const fallbackUri = `data:image/svg+xml;utf8,${encoded}`;

    // 4) Build nodes array
    const nodes = Object.values(nodesMap).map((n) => {
      const isImage = !!n.imageUrl;
      if (isImage) {
        const size = sizeMap[n.id] || BASE;
        return {
          id: n.id,
          name: n.name,
          marker: {
            symbol: `url(${n.imageUrl})`,
            width: size,
            height: size,
            lineWidth: 2,
            lineColor: '#fff',
          },
        };
      }
      return {
        id: n.id,
        name: n.name,
        marker: { radius: 12 },
      };
    });

    // 5) Build links array
    const links = Object.entries(linkCounts).map(([key, weight]) => {
      const [from, to] = key.split('|');
      return { from, to, weight };
    });

    return { nodes, links };
  }, [events]);

  if (!hcLoaded) return null;

  const options: Highcharts.Options = {
    chart: {
      type: 'networkgraph',
      marginTop: 40,
      backgroundColor: 'transparent',
    },
    title: { text: undefined },
    plotOptions: {
      networkgraph: {
        keys: ['from', 'to', 'weight'],
        layoutAlgorithm: {
          enableSimulation: true,
          friction: -0.9,
        },
      },
      series: {
        dataLabels: { enabled: true },
      },
    },
    tooltip: {
      formatter(this: any) {
        const pt = this.point;
        if (pt.fromNode) {
          return `<b>${pt.fromNode.name}</b> → <b>${
            pt.toNode.name
          }</b><br/>KOs: ${pt.weight}`;
        }
        return `<b>${pt.name}</b>`;
      },
    },
    series: [
      {
        type: 'networkgraph',
        data: links,
        nodes,
      },
    ],
    credits: { enabled: false },
  };

  return (
    <div className="KnockoutGraph" style={{ width: '100%', height: 500 }}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

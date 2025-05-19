import { useMemo, useEffect, useState } from 'react';
import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';

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
    const multipliers = [1.8, 1.5, 1.25];
    const sizeMap: Record<string, number> = {};
    top3.forEach((name, idx) => {
      sizeMap[name] = Math.round(BASE * multipliers[idx]);
    });

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

  const BASE = 48;

  const options: Highcharts.Options = {
    chart: {
      type: 'networkgraph',
      marginTop: 40,
      backgroundColor: 'transparent',
      height: 500,
      events: {
        load(this: Highcharts.Chart) {
          const H: any = Highcharts;
          H.wrap(
            H.seriesTypes.networkgraph.prototype.pointClass.prototype,
            'getLinkPath',
            function (this: any) {
              const from = this.fromNode;
              const to = this.toNode;

              // compute angle & radius
              const dx = to.plotX - from.plotX;
              const dy = to.plotY - from.plotY;
              const angle = Math.atan2(dy, dx);
              const m = to.marker || {};
              const r = m.width ? m.width / 2 : m.radius ? m.radius : 12;

              // arrowhead dimensions
              const len = 12;
              const wid = 6;

              // tip of arrow (just outside the node)
              const tx = to.plotX - Math.cos(angle) * r;
              const ty = to.plotY - Math.sin(angle) * r;
              // base of the arrow
              const bx = tx - Math.cos(angle) * len;
              const by = ty - Math.sin(angle) * len;

              // wings
              const wx1 = bx + Math.sin(angle) * wid;
              const wy1 = by - Math.cos(angle) * wid;
              const wx2 = bx - Math.sin(angle) * wid;
              const wy2 = by + Math.cos(angle) * wid;

              // return SVG commands: line + two wing lines
              return [
                ['M', from.plotX, from.plotY],
                ['L', tx, ty],
                ['M', tx, ty],
                ['L', wx1, wy1],
                ['M', tx, ty],
                ['L', wx2, wy2],
              ];
            },
          );

          // force a redraw so that our patch takes effect immediately
          this.series.forEach((s: any) => s.redraw());
        },
      },
    },
    title: { text: undefined },
    plotOptions: {
      networkgraph: {
        keys: ['from', 'to', 'weight'],
        layoutAlgorithm: {
          enableSimulation: true,
          friction: -0.9,
          linkLength: 35,
          maxIterations: 300,
        },
        dataLabels: {
          enabled: true,
          useHTML: true,
          allowOverlap: true,
          formatter(this: any) {
            const m = this.point.marker || {};
            const diameter =
              (m.width ?? (m.radius ? m.radius * 2 : BASE)) || BASE;
            const offset = diameter / 2;
            return `<div style="
            display:inline-block;
            margin-top:${offset}px;
            width:fit-content;
            text-align:center;
            font-size:11px;
            font-weight:bold;
            color:#333;
          ">${this.point.name}</div>`;
          },
          align: 'center',
          verticalAlign: 'top',
        },
      },
    },
    tooltip: {
      formatter(this: any) {
        const pt = this.point;
        if (pt.fromNode) {
          return `<b>${pt.fromNode.name}</b> → <b>${pt.toNode.name}</b><br/>KOs: ${pt.weight}`;
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
    <div className="KnockoutGraph" style={{ width: '100%' }}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

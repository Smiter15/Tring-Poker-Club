import { useMemo, useEffect, useState } from 'react';
import type Highcharts from 'highcharts';

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
  const [HC, setHC] = useState<any>(null);
  const [HCReact, setHCReact] = useState<any>(null);
  const [windowWidth, setWindowWidth] = useState(1024);

  useEffect(() => {
    let cancelled = false;

    async function loadChartLibs() {
      if (typeof window === 'undefined') return;

      const [hcMod, reactMod] = await Promise.all([
        import('highcharts'),
        import('highcharts-react-official'),
      ]);

      await import('highcharts/modules/networkgraph');

      if (cancelled) return;

      setHC(hcMod.default ?? hcMod);
      setHCReact(() => reactMod.default ?? (reactMod as any).HighchartsReact);
      setWindowWidth(window.innerWidth);
    }

    loadChartLibs();

    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isMobile = windowWidth < 768;

  const { nodes, links } = useMemo(() => {
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

    const BASE = 48;
    const sizeMap: Record<string, number> = {};

    Object.entries(killCounts).forEach(([name, count]) => {
      const originalSize = Math.round(BASE * (1 + count * 0.25));
      sizeMap[name] = isMobile ? Math.round(originalSize / 2) : originalSize;
    });

    const nodesArr = Object.values(nodesMap).map((n) => {
      if (n.imageUrl) {
        const size = sizeMap[n.id] || (isMobile ? BASE / 2 : BASE);
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
        marker: { radius: isMobile ? 6 : 12 },
      };
    });

    const linksArr = Object.entries(linkCounts).map(([key, weight]) => {
      const [from, to] = key.split('|');
      return { from, to, weight };
    });

    return { nodes: nodesArr, links: linksArr };
  }, [events, isMobile]);

  const chartHeight = useMemo(() => {
    const MIN_HEIGHT = 400;
    const PER_NODE = 30;
    const THRESHOLD = 10;
    const extra = Math.max(0, nodes.length - THRESHOLD) * PER_NODE;
    return MIN_HEIGHT + extra;
  }, [nodes]);

  if (!HC || !HCReact) return null;

  const HighchartsReact = HCReact;
  const arrowLen = isMobile ? 6 : 12;
  const linkLen = isMobile ? 17.5 : 35;

  const options: Highcharts.Options = {
    chart: {
      type: 'networkgraph',
      marginTop: 40,
      backgroundColor: 'transparent',
      height: isMobile ? chartHeight / 2 + 200 : chartHeight + 200,
      events: {
        load(this: Highcharts.Chart) {
          const H: any = HC;

          H.wrap(
            H.seriesTypes.networkgraph.prototype.pointClass.prototype,
            'getLinkPath',
            function (this: any) {
              const from = this.fromNode;
              const to = this.toNode;

              const dx = to.plotX - from.plotX;
              const dy = to.plotY - from.plotY;
              const angle = Math.atan2(dy, dx);
              const m = to.marker || {};
              const r = m.width ? m.width / 2 : m.radius ? m.radius : 12;

              const len = arrowLen;
              const wid = 6;

              const tx = to.plotX - Math.cos(angle) * r;
              const ty = to.plotY - Math.sin(angle) * r;
              const bx = tx - Math.cos(angle) * len;
              const by = ty - Math.sin(angle) * len;

              const wx1 = bx + Math.sin(angle) * wid;
              const wy1 = by - Math.cos(angle) * wid;
              const wx2 = bx - Math.sin(angle) * wid;
              const wy2 = by + Math.cos(angle) * wid;

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
          linkLength: linkLen,
          maxIterations: 300,
        },
        dataLabels: {
          enabled: true,
          useHTML: true,
          allowOverlap: true,
          formatter(this: any) {
            const m = this.point.marker || {};
            const diameter = (m.width ?? (m.radius ? m.radius * 2 : 48)) || 48;
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
    <div
      className="KnockoutGraph"
      style={{
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}
    >
      <HighchartsReact highcharts={HC} options={options} />
    </div>
  );
}

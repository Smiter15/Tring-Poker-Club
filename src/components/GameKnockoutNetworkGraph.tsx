import { useMemo, useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

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
    import('highcharts/modules/networkgraph').then(() => {
      setHcLoaded(true);
    });
  }, []);

  // Build unique nodes+links
  const { nodes, links } = useMemo(() => {
    const nodesMap: Record<
      string,
      { id: string; name: string; imageUrl?: string }
    > = {};
    const linkCounts: Record<string, number> = {};

    events.forEach(({ killerName, killerImage, victimName, victimImage }) => {
      // register killer node
      if (!nodesMap[killerName]) {
        nodesMap[killerName] = {
          id: killerName,
          name: killerName,
          imageUrl: killerImage || undefined,
        };
      }
      // register victim node
      if (!nodesMap[victimName]) {
        nodesMap[victimName] = {
          id: victimName,
          name: victimName,
          imageUrl: victimImage || undefined,
        };
      }

      // count link weight
      const key = `${killerName}|${victimName}`;
      linkCounts[key] = (linkCounts[key] || 0) + 1;
    });

    // turn nodesMap → array, injecting each node’s marker
    const nodes = Object.values(nodesMap).map((n) => ({
      id: n.id,
      name: n.name,
      marker: {
        symbol: n.imageUrl ? `url(${n.imageUrl})` : undefined,
        radius: n.imageUrl ? 24 : 12,
      },
    }));

    // build link array
    const links = Object.entries(linkCounts).map(([key, weight]) => {
      const [from, to] = key.split('|');
      return { from, to, weight };
    });

    return { nodes, links };
  }, [events]);

  if (!hcLoaded) return null;

  const options: Highcharts.Options = {
    chart: { type: 'networkgraph', marginTop: 40 },
    title: { text: 'Knockouts Network' },
    plotOptions: {
      networkgraph: {
        keys: ['from', 'to', 'weight'],
        layoutAlgorithm: { enableSimulation: true, friction: -0.9 },
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
        nodes: nodes,
        // remove the global marker.default; each node uses its own marker
      },
    ],
  };

  return (
    <div style={{ width: '100%', height: 500 }}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

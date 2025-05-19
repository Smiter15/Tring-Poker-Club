import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';

interface OpponentStat {
  opponentName: string;
  kills: number;
  deaths: number;
}

interface Props {
  data: OpponentStat[];
}

export default function PlayerKnockoutChart({ data }: Props) {
  const categories = data.map((d) => d.opponentName);
  const killsSeries = data.map((d) => d.kills);
  const deathsSeries = data.map((d) => d.deaths);

  const options: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: undefined },
    xAxis: { categories, title: { text: 'Players' } },
    yAxis: {
      min: 0,
      title: { text: 'Count' },
      allowDecimals: false,
      tickInterval: 1,
    },
    plotOptions: {
      column: { grouping: true, pointPadding: 0.1, borderWidth: 0 },
    },
    series: [
      { name: 'Kills', data: killsSeries, color: '#16a34a', type: 'column' },
      { name: 'Deaths', data: deathsSeries, color: '#ff4c4e', type: 'column' },
    ],
    tooltip: {
      shared: true,
      headerFormat: '<b>{point.key}</b><br/>',
      pointFormat: '{series.name}: {point.y}<br/>',
    },
    credits: { enabled: false },
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

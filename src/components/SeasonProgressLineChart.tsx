import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

const BASE_PALETTE = [
  '#FF0000', // red
  '#FF7F00', // orange
  '#FFFF00', // yellow
  '#00FF00', // lime
  '#0000FF', // blue
  '#4B0082', // indigo
  '#8F00FF', // violet
  '#FF00FF', // magenta
  '#00FFFF', // cyan
  '#FF1493', // deep pink
  '#00FF7F', // spring green
  '#FFD700', // gold
  '#FF4500', // orange red
  '#00BFFF', // deep sky blue
  '#ADFF2F', // green yellow
  '#DC143C', // crimson
  '#8B0000', // dark red
  '#008080', // teal
  '#800080', // purple
  '#808000', // olive
  '#FFA500', // orange
  '#FF69B4', // hot pink
  '#1E90FF', // dodger blue
  '#32CD32', // lime green
  '#BA55D3', // medium orchid
];

export interface SeasonLineChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
}

export default function SeasonLineChart({
  labels,
  datasets,
}: SeasonLineChartProps) {
  const coloredDatasets = datasets.map((ds, i) => {
    const base = BASE_PALETTE[i % BASE_PALETTE.length];
    const withAlpha = `${base}99`; // 99 hex ≈ 153/255 ≈ 0.6 opacity

    return {
      ...ds,
      tension: 0.3,
      borderColor: withAlpha,
      backgroundColor: withAlpha,
    };
  });

  const data = { labels, datasets: coloredDatasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
      title: { display: true, text: 'Cumulative Points' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  return (
    <div style={{ height: '400px' }}>
      <Line data={data} options={options} />
    </div>
  );
}

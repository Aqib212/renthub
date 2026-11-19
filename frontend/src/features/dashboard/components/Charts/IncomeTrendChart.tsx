import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from "chart.js";
import type { MonthlyDataPoint } from "@/types/dashboard";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  data: MonthlyDataPoint[];
}

export const IncomeTrendChart = ({ data }: Props) => {
  const labels = data.map((d) => MONTHS[d.month - 1]);
  const amounts = data.map((d) => d.amount);

  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "Income",
            data: amounts,
            borderColor: "#1976d2",
            backgroundColor: "rgba(25, 118, 210, 0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `৳${(v as number).toLocaleString()}` },
          },
        },
      }}
      height={260}
    />
  );
};

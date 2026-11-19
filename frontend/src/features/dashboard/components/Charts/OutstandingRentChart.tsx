import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from "chart.js";
import type { OutstandingRentItem } from "@/types/dashboard";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface Props {
  data: OutstandingRentItem[];
}

export const OutstandingRentChart = ({ data }: Props) => {
  return (
    <Bar
      data={{
        labels: data.map((d) => d.flatName),
        datasets: [
          {
            label: "Due Amount",
            data: data.map((d) => d.dueAmount),
            backgroundColor: "#ef5350",
            borderRadius: 4,
          },
        ],
      }}
      options={{
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { callback: (v) => `৳${(v as number).toLocaleString()}` },
          },
        },
      }}
      height={200}
    />
  );
};

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import type { MonthlyCollectionPoint } from "@/types/dashboard";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  data: MonthlyCollectionPoint[];
}

export const MonthlyCollectionChart = ({ data }: Props) => {
  const labels = data.map((d) => MONTHS[d.month - 1]);
  const collected = data.map((d) => d.collected);
  const due = data.map((d) => d.due);

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: "Collected",
            data: collected,
            backgroundColor: "#1976d2",
            borderRadius: 4,
          },
          {
            label: "Due",
            data: due,
            backgroundColor: "#ff7043",
            borderRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" as const },
          title: { display: false },
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

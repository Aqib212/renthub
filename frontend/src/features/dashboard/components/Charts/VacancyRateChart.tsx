import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  occupied: number;
  vacant: number;
}

export const VacancyRateChart = ({ occupied, vacant }: Props) => {
  return (
    <Doughnut
      data={{
        labels: ["Occupied", "Vacant"],
        datasets: [
          {
            data: [occupied, vacant],
            backgroundColor: ["#1976d2", "#ff7043"],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" as const },
        },
        cutout: "70%",
      }}
      height={260}
    />
  );
};

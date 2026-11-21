import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@mui/material";
import { agreementApi } from "@/api/agreement";
import { buildingApi } from "@/api/building";
import { useCurrentMembership } from "@/store/authStore";
import { AgreementDeed } from "./AgreementDeed";

/** Staff view of the printable agreement. */
export const AgreementDeedPage = () => {
  const { id } = useParams();
  const org = useCurrentMembership();
  const { data: a } = useQuery({ queryKey: ["agreement", id], queryFn: () => agreementApi.get(id!) });
  const { data: building } = useQuery({
    queryKey: ["building", a?.unit?.building.id],
    queryFn: async () => (await buildingApi.getById(a!.unit!.building.id)).data.data as { name: string; address: string | null; holdingNumber: string | null },
    enabled: !!a?.unit,
  });
  if (!a) return <Typography>Loading…</Typography>;
  return <AgreementDeed a={a} building={building} landlordName={org?.orgName ?? ""} />;
};

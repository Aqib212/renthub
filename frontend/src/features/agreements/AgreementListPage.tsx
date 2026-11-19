import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { AddOutlined, AccountBalanceOutlined } from "@mui/icons-material";
import { PageHeader } from "@/components/ui/PageHeader";
import { agreementApi, AGREEMENT_STATUS, fmtDate, type AgreementStatus } from "@/api/agreement";
import { formatBDT } from "@/utils/format";

type Filter = "LIVE" | AgreementStatus | "ALL";

export const AgreementListPage = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("LIVE");
  const { data = [], isLoading } = useQuery({
    queryKey: ["agreements", filter],
    queryFn: () => agreementApi.list(filter === "ALL" ? undefined : { status: filter }),
  });

  return (
    <Box>
      <PageHeader
        title="Agreements"
        subtitle="Who rents which unit, on what terms. Rent, deposit and notice all live here."
        actions={<Button variant="contained" startIcon={<AddOutlined />} onClick={() => navigate("/agreements/new")}>New agreement</Button>}
      />
      <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v) => v && setFilter(v)} sx={{ mb: 2, flexWrap: "wrap" }} aria-label="Filter agreements">
        <ToggleButton value="LIVE">Running</ToggleButton>
        <ToggleButton value="NOTICE">On notice</ToggleButton>
        <ToggleButton value="DRAFT">Drafts</ToggleButton>
        <ToggleButton value="ENDED">Ended</ToggleButton>
        <ToggleButton value="ALL">All</ToggleButton>
      </ToggleButtonGroup>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tenant</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Rent</TableCell>
              <TableCell align="right">Deposit held</TableCell>
              <TableCell>From – to</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>}
            {!isLoading && !data.length && (
              <TableRow><TableCell colSpan={6}><Typography color="text.secondary" sx={{ py: 2 }}>No agreements here yet.</Typography></TableCell></TableRow>
            )}
            {data.map((a) => (
              <TableRow key={a.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/agreements/${a.id}`)}>
                <TableCell>
                  <Typography fontWeight={600}>{a.tenant.firstName} {a.tenant.lastName}</Typography>
                  <Typography variant="body2" color="text.secondary">{a.tenant.phone ?? ""}</Typography>
                </TableCell>
                <TableCell>{a.unit ? `${a.unit.building.name} · ${a.unit.name}` : "–"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                    {a.bankOnly && <AccountBalanceOutlined fontSize="small" titleAccess="Paid through a bank (rent above ৳25,000)" sx={{ color: "text.secondary" }} />}
                    <span>{formatBDT(a.rate)}</span>
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatBDT(a.depositBalance)}</TableCell>
                <TableCell>{fmtDate(a.startDate)} – {a.endDate ? fmtDate(a.endDate) : "open"}</TableCell>
                <TableCell><Chip size="small" color={AGREEMENT_STATUS[a.status].color} label={AGREEMENT_STATUS[a.status].label} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

import { Box, Chip } from "@mui/material";
import { CATEGORY_TONES } from "@/types/expense";
import type { ExpenseCategory } from "@/types/expense";
import type { MessageKey } from "@/i18n/en";

export const catKey = (c: ExpenseCategory) => `exp.cat.${c}` as MessageKey;

export const CategoryChip = ({ c, label, onClick, selected }: { c: ExpenseCategory; label: string; onClick?: () => void; selected?: boolean }) => {
  const tone = CATEGORY_TONES[c];
  return (
    <Chip
      size="small" label={label} onClick={onClick}
      icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: selected ? "#fff" : tone.fg, ml: "8px !important" }} />}
      sx={{ bgcolor: selected ? tone.fg : tone.bg, color: selected ? "#fff" : tone.fg, fontWeight: 600, "&:hover": onClick ? { bgcolor: selected ? tone.fg : tone.bg, filter: "brightness(0.96)" } : undefined }}
    />
  );
};

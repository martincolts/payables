import { useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Popover,
  Stack,
  TextField,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarTodayOutlined";
import ClearIcon from "@mui/icons-material/Close";
import { formatDate } from "../lib/format";

type Props = {
  label: string;
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  minWidth?: number;
};

function summarize(from: string, to: string): string {
  if (from && to) return `${formatDate(from)} → ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Until ${formatDate(to)}`;
  return "";
}

export function DateRangeField({ label, from, to, onChange, minWidth = 180 }: Props) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const display = summarize(from, to);
  const hasValue = Boolean(from || to);

  return (
    <>
      <TextField
        label={label}
        size="small"
        value={display}
        placeholder="Any"
        ref={anchorRef}
        onClick={() => setOpen(true)}
        slotProps={{
          input: {
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                {hasValue ? (
                  <IconButton
                    size="small"
                    aria-label={`Clear ${label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange({ from: "", to: "" });
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ) : (
                  <CalendarTodayIcon fontSize="small" color="action" />
                )}
              </InputAdornment>
            ),
          },
          inputLabel: { shrink: true },
        }}
        sx={{ minWidth, flexGrow: { xs: 1, sm: 0 }, cursor: "pointer" }}
      />
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 240 }}>
          <Stack spacing={1.5}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={from}
              onChange={(e) => onChange({ from: e.target.value, to })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={to}
              onChange={(e) => onChange({ from, to: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
              <Button
                size="small"
                onClick={() => onChange({ from: "", to: "" })}
                disabled={!hasValue}
              >
                Clear
              </Button>
              <Button size="small" variant="contained" onClick={() => setOpen(false)}>
                Done
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

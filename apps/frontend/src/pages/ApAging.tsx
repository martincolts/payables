import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import type { ApAgingBucket, ApAgingBucketAmounts } from "@payables/shared";
import { useApAging } from "../queries/useApAging";
import { formatMoney } from "../lib/format";

type BucketDef = {
  key: ApAgingBucket;
  label: string;
  /** Builds the search params for the /bills drill-down. */
  range: (asOf: string) => { dueAfter?: string; dueBefore?: string };
};

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const BUCKETS: readonly BucketDef[] = [
  {
    key: "current",
    label: "Current",
    range: (asOf) => ({ dueAfter: asOf }),
  },
  {
    key: "d1_30",
    label: "1–30",
    range: (asOf) => ({ dueAfter: shiftDays(asOf, -30), dueBefore: shiftDays(asOf, -1) }),
  },
  {
    key: "d31_60",
    label: "31–60",
    range: (asOf) => ({ dueAfter: shiftDays(asOf, -60), dueBefore: shiftDays(asOf, -31) }),
  },
  {
    key: "d61_90",
    label: "61–90",
    range: (asOf) => ({ dueAfter: shiftDays(asOf, -90), dueBefore: shiftDays(asOf, -61) }),
  },
  {
    key: "d90_plus",
    label: "90+",
    range: (asOf) => ({ dueBefore: shiftDays(asOf, -91) }),
  },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildBillsLink(
  vendorId: string,
  asOf: string,
  bucket: BucketDef,
): string {
  const params = new URLSearchParams({ vendorId });
  const range = bucket.range(asOf);
  if (range.dueAfter) params.set("dueAfter", range.dueAfter);
  if (range.dueBefore) params.set("dueBefore", range.dueBefore);
  return `/bills?${params.toString()}`;
}

function MoneyCell({
  amount,
  href,
}: {
  amount: string;
  href?: string;
}) {
  const isZero = Number(amount) === 0;
  if (isZero || !href) {
    return (
      <TableCell align="right" sx={{ color: isZero ? "text.disabled" : undefined }}>
        {formatMoney(amount)}
      </TableCell>
    );
  }
  return (
    <TableCell align="right" sx={{ p: 0 }}>
      <Box
        component={RouterLink}
        to={href}
        sx={{
          display: "block",
          px: 2,
          py: 1.75,
          color: "primary.main",
          textDecoration: "none",
          "&:hover": { textDecoration: "underline", bgcolor: "action.hover" },
        }}
      >
        {formatMoney(amount)}
      </Box>
    </TableCell>
  );
}

export function ApAging() {
  const [asOf, setAsOf] = useState<string>(todayIso());
  const { data, isLoading, error } = useApAging(asOf);
  const [downloading, setDownloading] = useState(false);

  const hasRows = (data?.rows.length ?? 0) > 0;

  async function downloadCsv() {
    setDownloading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `/api/stats/ap-aging.csv?asOf=${encodeURIComponent(asOf)}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `ap-aging-${asOf}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toast.error("Couldn't export CSV");
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    toast.error("Couldn't load AP Aging");
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            AP Aging
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Outstanding payables bucketed by days past due.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <TextField
            label="As of"
            type="date"
            size="small"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value || todayIso())}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={downloadCsv}
            disabled={!hasRows || downloading}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined">
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
            <CircularProgress />
          </Box>
        ) : !hasRows ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No outstanding payables as of {asOf}.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vendor</TableCell>
                  {BUCKETS.map((b) => (
                    <TableCell key={b.key} align="right">
                      {b.label}
                    </TableCell>
                  ))}
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data!.rows.map((row) => (
                  <TableRow key={row.vendorId} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{row.vendorName}</TableCell>
                    {BUCKETS.map((b) => (
                      <MoneyCell
                        key={b.key}
                        amount={row.buckets[b.key]}
                        href={buildBillsLink(row.vendorId, asOf, b)}
                      />
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatMoney(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow
                  sx={{
                    "& td": {
                      borderTop: 2,
                      borderTopColor: "divider",
                      fontWeight: 700,
                    },
                  }}
                >
                  <TableCell>Total</TableCell>
                  {BUCKETS.map((b) => (
                    <TableCell key={b.key} align="right">
                      {formatMoney(data!.totals.buckets[b.key as keyof ApAgingBucketAmounts])}
                    </TableCell>
                  ))}
                  <TableCell align="right">{formatMoney(data!.totals.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

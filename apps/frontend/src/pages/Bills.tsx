import { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { billStatuses, type BillStatus } from "@payables/shared";
import { useBills } from "../queries/useBills";
import { StatusChip } from "../components/StatusChip";
import { formatDate, formatMoney, isOverdue } from "../lib/format";

const STATUS_LABELS: Record<BillStatus, string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  approved: "Aprobada",
  rejected: "Rechazada",
  scheduled: "Programada",
  paid: "Pagada",
};

export function Bills() {
  const [page, setPage] = useState(0); // TablePagination is 0-based
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<BillStatus | "">("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useBills({
    page: page + 1,
    pageSize,
    status: status || undefined,
    search: search || undefined,
  });

  useEffect(() => {
    if (isError) toast.error("No se pudieron cargar los comprobantes");
  }, [isError]);

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Bills
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Buscar por proveedor o N° de factura"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ flexGrow: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="status-filter-label">Estado</InputLabel>
          <Select
            labelId="status-filter-label"
            label="Estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as BillStatus | "");
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {billStatuses.map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Cargando comprobantes" />
        </Box>
      ) : data && data.items.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Proveedor</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell>Vencimiento</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((bill) => {
                const overdue = isOverdue(bill.dueDate, bill.status);
                return (
                  <TableRow key={bill.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {bill.vendorName}
                      </Typography>
                      {bill.invoiceNumber && (
                        <Typography variant="caption" color="text.secondary">
                          {bill.invoiceNumber}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={bill.status} />
                    </TableCell>
                    <TableCell align="right">{formatMoney(bill.amount)}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={overdue ? "error.main" : "text.primary"}
                        sx={{ fontWeight: overdue ? 600 : 400 }}
                      >
                        {formatDate(bill.dueDate)}
                        {overdue && " · Vencida"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={data.total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          />
        </TableContainer>
      ) : (
        <Typography color="text.secondary">No hay comprobantes para mostrar.</Typography>
      )}
    </Box>
  );
}

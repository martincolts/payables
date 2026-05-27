import { useEffect } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import type { PaymentMethod } from "@payables/shared";
import { useVendors } from "../queries/useVendors";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ach: "ACH",
  wire: "Wire transfer",
  check: "Check",
};

export function Vendors() {
  const { data, isLoading, isError } = useVendors();

  useEffect(() => {
    if (isError) toast.error("Couldn't load vendors");
  }, [isError]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading vendors" />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Vendors
      </Typography>
      {data && data.items.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Payment method</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {v.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{v.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={PAYMENT_METHOD_LABELS[v.paymentMethod]}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="text.secondary">No vendors yet.</Typography>
      )}
    </Box>
  );
}

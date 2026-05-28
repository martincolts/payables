import {
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Typography,
  type CardHeaderProps,
} from "@mui/material";
import type { ReactNode } from "react";

export function ChartCard({
  title,
  subheader,
  action,
  loading,
  loadingLabel,
  empty,
  emptyMessage,
  children,
}: {
  title: string;
  subheader: string;
  action?: CardHeaderProps["action"];
  loading: boolean;
  loadingLabel: string;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardHeader
        title={title}
        subheader={subheader}
        action={action}
        titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
        subheaderTypographyProps={{ variant: "caption" }}
        sx={{ flexWrap: "wrap", gap: 1, "& .MuiCardHeader-action": { m: 0 } }}
      />
      <CardContent sx={{ pt: 0 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} aria-label={loadingLabel} />
          </Box>
        ) : empty ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            {emptyMessage}
          </Typography>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

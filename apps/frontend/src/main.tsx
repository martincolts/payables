import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: "#f6f7f9" },
    primary: { main: "#1a1a1a" },
  },
  shape: { borderRadius: 10 },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
        <ToastContainer position="top-right" autoClose={4000} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);

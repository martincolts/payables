import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../auth/AuthContext";
import { useLogin } from "../queries/useAuth";

export function Login() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: (res) => {
          setSession(res);
          toast.success(`¡Hola de nuevo, ${res.user.name}!`);
          navigate("/", { replace: true });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent>
          <Typography variant="h5" component="h1" gutterBottom>
            Payables
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Iniciá sesión para continuar.
          </Typography>
          <Box component="form" onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Correo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                fullWidth
              />
              <TextField
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={login.isPending}
              >
                {login.isPending ? "Ingresando…" : "Ingresar"}
              </Button>
            </Stack>
          </Box>
          <Typography variant="body2" sx={{ mt: 3 }}>
            ¿No tenés cuenta?{" "}
            <MuiLink component={RouterLink} to="/signup">
              Crear cuenta
            </MuiLink>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type Props = {
  cartButton?: ReactNode;
  adminLink?: boolean;
  onSignedOut?: () => void;
};
type AuthMode = "sign-in" | "sign-up";

const profileFieldLabels = {
  nombre: "nombre",
  apellido: "apellido",
  phone: "teléfono",
  address: "dirección",
} as const;

async function syncProfile(accessToken: string) {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "No se pudieron guardar los datos de tu cuenta.";
    throw new Error(message);
  }

  if (
    typeof result !== "object" ||
    result === null ||
    !("missingFields" in result) ||
    !Array.isArray(result.missingFields) ||
    !result.missingFields.every(
      (field): field is keyof typeof profileFieldLabels =>
        typeof field === "string" &&
        Object.prototype.hasOwnProperty.call(profileFieldLabels, field),
    )
  ) {
    throw new Error("No se pudieron verificar los datos de tu cuenta.");
  }

  if (result.missingFields.length > 0) {
    const missingLabels = result.missingFields.map((field) => profileFieldLabels[field]);
    return `Iniciaste sesión, pero tu perfil tiene datos faltantes o inválidos: ${missingLabels.join(", ")}. Podés continuar usando tu cuenta.`;
  }

  return "";
}

export default function AuthButton({
  cartButton,
  adminLink = false,
  onSignedOut,
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setUser(data.session?.user ?? null);
      }).catch((sessionError: unknown) => {
        if (!active) return;
        setError(sessionError instanceof Error ? sessionError.message : "No se pudo recuperar la sesión.");
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (clientError) {
      if (clientError instanceof Error) setError(clientError.message);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalOpen]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const { data, error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });

      if (!data.session) {
        setError(signInError?.message ?? "No se pudo iniciar sesión. Probá de nuevo.");
        return;
      }

      let notice = "";
      try {
        notice = await syncProfile(data.session.access_token);
      } catch {
        notice = "Iniciaste sesión, pero no se pudieron verificar los datos de tu perfil. Intentá nuevamente más tarde.";
      }
      setPassword("");
      setLoginNotice(notice);
      setModalOpen(false);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            phone: phone.trim(),
            address: address.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setPassword("");
      if (data.session) {
        let notice = "";
        try {
          notice = await syncProfile(data.session.access_token);
        } catch {
          notice = "Creaste tu cuenta, pero no se pudieron verificar los datos de tu perfil. Intentá nuevamente más tarde.";
        }
        setLoginNotice(notice);
        setModalOpen(false);
      }
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : "No se pudo crear la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  function openModal(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setLoginNotice("");
    setModalOpen(true);
  }

  async function signOut() {
    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      setLoginNotice("");
      onSignedOut?.();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "No se pudo cerrar sesión.");
      setModalOpen(true);
    }
  }

  return (
    <div className="topbar-actions">
      {cartButton}
      {adminLink && (
        <a className="admin-nav-link" href="/admin">
          Administración
        </a>
      )}
      {user && (
        <a className="admin-nav-link" href="/perfil">
          Mi perfil
        </a>
      )}
      <button
        className="auth-trigger"
        onClick={() => (user ? signOut() : openModal("sign-in"))}
        type="button"
        aria-label={user ? `Cerrar sesión de ${user.email ?? "tu cuenta"}` : undefined}
      >
        {user ? "Cerrar sesión" : "Inicio de sesión"}
      </button>

      {loginNotice && (
        <p className="auth-notice" role="status">
          {loginNotice}
          <button
            aria-label="Cerrar aviso"
            onClick={() => setLoginNotice("")}
            type="button"
          >
            ×
          </button>
        </p>
      )}

      {modalOpen && (
        <div
          className="auth-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section
            aria-labelledby="auth-modal-title"
            aria-modal="true"
            className="auth-modal"
            role="dialog"
          >
            <button
              aria-label="Cerrar"
              className="auth-modal-close"
              onClick={() => setModalOpen(false)}
              type="button"
            >
              ×
            </button>
            <span className="eyebrow">QUÉ BUENO VERTE</span>
            <h2 id="auth-modal-title">{mode === "sign-in" ? "Iniciá sesión" : "Creá tu cuenta"}</h2>
            <p className="auth-modal-description">
              {mode === "sign-in" ? "Ingresá a tu cuenta para continuar." : "Registrate para crear tu cuenta."}
            </p>
            <form className="auth-form" onSubmit={mode === "sign-in" ? signIn : signUp}>
              <label className="field-label">
                Correo electrónico
                <input
                  autoComplete="email"
                  autoFocus
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="field-label">
                Contraseña
                <input
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  minLength={mode === "sign-up" ? 6 : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                  required
                  type="password"
                  value={password}
                />
              </label>
              {mode === "sign-up" && (
                <>
                  <label className="field-label">
                    Nombre
                    <input
                      autoComplete="given-name"
                      maxLength={100}
                      minLength={2}
                      onChange={(event) => setNombre(event.target.value)}
                      placeholder="Tu nombre"
                      required
                      value={nombre}
                    />
                  </label>
                  <label className="field-label">
                    Apellido
                    <input
                      autoComplete="family-name"
                      maxLength={100}
                      minLength={2}
                      onChange={(event) => setApellido(event.target.value)}
                      placeholder="Tu apellido"
                      required
                      value={apellido}
                    />
                  </label>
                  <label className="field-label">
                    Teléfono
                    <input
                      autoComplete="tel"
                      minLength={6}
                      maxLength={24}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Tu teléfono de contacto"
                      required
                      type="tel"
                      value={phone}
                    />
                  </label>
                  <label className="field-label">
                    Dirección
                    <input
                      autoComplete="street-address"
                      maxLength={200}
                      minLength={5}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Calle, número y barrio"
                      required
                      value={address}
                    />
                  </label>
                </>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-order" disabled={submitting} type="submit">
                {submitting
                  ? mode === "sign-in" ? "Ingresando..." : "Creando cuenta..."
                  : mode === "sign-in" ? "Iniciar sesión" : "Registrarse"}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>
            <p className="auth-switch">
              {mode === "sign-in" ? "¿No tenés cuenta?" : "¿Ya tenés una cuenta?"}{" "}
              <button
                onClick={() => openModal(mode === "sign-in" ? "sign-up" : "sign-in")}
                type="button"
              >
                {mode === "sign-in" ? "Registrate" : "Iniciá sesión"}
              </button>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

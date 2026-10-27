"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type Props = { cartButton: ReactNode };
type AuthMode = "sign-in" | "sign-up";

export default function AuthButton({ cartButton }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setPassword("");
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
    setSuccess("");

    try {
      const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setPassword("");
      if (data.session) {
        setModalOpen(false);
      } else {
        setSuccess("Revisá tu correo para confirmar la creación de tu cuenta.");
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
    setSuccess("");
    setModalOpen(true);
  }

  async function signOut() {
    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "No se pudo cerrar sesión.");
      setModalOpen(true);
    }
  }

  return (
    <div className="topbar-actions">
      {cartButton}
      <button
        className="auth-trigger"
        onClick={() => (user ? signOut() : openModal("sign-in"))}
        type="button"
        aria-label={user ? `Cerrar sesión de ${user.email ?? "tu cuenta"}` : undefined}
      >
        {user ? "Cerrar sesión" : "Inicio de sesión"}
      </button>

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
              {error && <p className="form-error" role="alert">{error}</p>}
              {success && <p className="auth-success" role="status">{success}</p>}
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

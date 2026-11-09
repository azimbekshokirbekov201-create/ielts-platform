"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api, RequestError, type Me } from "@/lib/api";
import { type Language } from "@/lib/i18n";
type Context = {
  me: Me | null;
  lang: Language;
  theme: string;
  setTheme: (value: "light" | "dark") => Promise<void>;
  setLang: (l: Language) => void;
  t: (k: string) => string;
  notify: (k: string) => void;
  refresh: () => Promise<void>;
  run: <T>(job: () => Promise<T>) => Promise<T | undefined>;
};
export const AcademyContext = createContext<Context>(null!);
export const useApp = () => useContext(AcademyContext);
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof RequestError ? e.code : "server_error");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, load };
}
export function ResourceState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: React.ReactNode;
}) {
  const { t } = useApp();
  if (loading) return <p role="status">{t("loading")}</p>;
  if (error)
    return (
      <p className="notice" role="alert">
        {t(error)}
      </p>
    );
  return <>{children}</>;
}
export function Empty() {
  return <p className="notice">{useApp().t("empty")}</p>;
}
export function PageControls({
  page,
  onChange,
  count,
  size = 20,
}: {
  page: number;
  onChange: (value: number) => void;
  count: number;
  size?: number;
}) {
  const { t } = useApp();
  return (
    <div className="live-actions">
      <button
        className="button outline"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        {t("back")}
      </button>
      <span>{page + 1}</span>
      <button
        className="button outline"
        disabled={count < size}
        onClick={() => onChange(page + 1)}
      >
        {t("next")}
      </button>
    </div>
  );
}

"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api, noticeOf, type Me } from "@/lib/api";
import { type Language, translationKeys } from "@/lib/i18n";
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
/**
 * Turns "code" or "code::detail" into readable text. The detail is either
 * "fields:a,b" (invalid fields) or "reason_x[:extra]" (a business rule); when the
 * detail can be explained it replaces the generic message.
 */
export function describeNotice(t: (k: string) => string, notice: string) {
  const at = notice.indexOf("::");
  const code = at < 0 ? notice : notice.slice(0, at);
  const detail = at < 0 ? "" : notice.slice(at + 2);
  const label = (k: string) => (translationKeys.includes(k) ? t(k) : k);
  if (detail.startsWith("fields:"))
    return (
      t("check_fields") +
      ": " +
      detail
        .slice(7)
        .split(",")
        .map((f) => label(f))
        .join(", ")
    );
  const colon = detail.indexOf(":");
  const reason = colon < 0 ? detail : detail.slice(0, colon);
  if (reason && translationKeys.includes(reason)) {
    const extra = colon < 0 ? "" : detail.slice(colon + 1).trim();
    return t(reason) + (extra ? ": " + label(extra) : "");
  }
  return t(code);
}
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
      setError(noticeOf(e));
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
        {describeNotice(t, error)}
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

import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">IELTS ACADEMY</p>
      <h1>A little off course.</h1>
      <p>This page could not be found. Your next chapter is still waiting.</p>
      <Link className="button primary" href="/dashboard">
        Back to dashboard
      </Link>
    </main>
  );
}

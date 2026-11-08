import { notFound } from "next/navigation";
import { Platform } from "@/features/platform";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const route = "/" + slug.join("/");
  if (
    ![
      "/dashboard",
      "/onboarding",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/practice/listening",
      "/practice/reading",
      "/practice/writing",
      "/practice/speaking",
      "/mock-exams",
      "/courses",
      "/progress",
      "/teacher",
      "/admin",
      "/settings",
    ].includes(route)
  )
    notFound();
  return <Platform route={route} />;
}

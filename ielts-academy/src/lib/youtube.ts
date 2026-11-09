export function youtubeId(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (/^\/(shorts|embed)\//.test(u.pathname))
        id = u.pathname.split("/")[2];
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function isYouTube(input: string) {
  try {
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(new URL(input).hostname);
  } catch {
    return false;
  }
}

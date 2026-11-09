import { it, expect } from "vitest";
import { youtubeId } from "@/lib/youtube";
it("accepts validated watch, short and privacy-enhanced YouTube URLs", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=AbCdEf123_-",
    "https://youtu.be/AbCdEf123_-?t=1",
    "https://youtube.com/shorts/AbCdEf123_-",
    "https://www.youtube-nocookie.com/embed/AbCdEf123_-",
  ])
    expect(youtubeId(url)).toBe("AbCdEf123_-");
});
it("rejects arbitrary iframe hosts, scripts, invalid IDs and deceptive domains", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=AbCdEf123_-",
    "https://youtu.be/short",
    "http://youtube.com/watch?v=AbCdEf123_-",
    "https://evil.test/embed/AbCdEf123_-",
  ])
    expect(youtubeId(url)).toBeNull();
});

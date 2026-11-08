export function matchesFileType(type: string, data: Uint8Array): boolean {
  const text = (start: number, end: number) =>
    new TextDecoder().decode(data.slice(start, end));
  switch (type) {
    case "image/jpeg":
      return data[0] === 255 && data[1] === 216 && data[2] === 255;
    case "image/png":
      return data.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    case "image/webp":
      return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
    case "application/pdf":
      return text(0, 5) === "%PDF-";
    case "audio/webm":
      return data.slice(0, 4).join(",") === "26,69,223,163";
    case "audio/ogg":
      return text(0, 4) === "OggS";
    case "audio/wav":
      return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
    case "audio/mpeg":
      return (
        text(0, 3) === "ID3" || (data[0] === 255 && (data[1] & 224) === 224)
      );
    case "audio/mp4":
    case "video/mp4":
      return text(4, 8) === "ftyp";
    default:
      return false;
  }
}

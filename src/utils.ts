export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function daysAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "今日";
  if (diff === 1) return "昨日";
  return `${diff}日前`;
}

/**
 * Generate an SVG badge in shields.io style showing pass rate.
 * Green (#4E9363) for >=80%, Yellow (#D97706) for 60-80%, Red (#dc2626) for <60%.
 */

export function getBadgeColor(passRate: number): string {
  if (passRate >= 80) return "#4E9363";
  if (passRate >= 60) return "#D97706";
  return "#dc2626";
}

export function getBadgeLabel(passRate: number): string {
  if (passRate >= 80) return "passing";
  if (passRate >= 60) return "partial";
  return "failing";
}

export function generateBadgeSVG(passRate: number | null, label?: string): string {
  const rate = passRate ?? 0;
  const color = getBadgeColor(rate);
  const displayLabel = label || "EvalDesk";
  const displayValue = passRate !== null ? `${rate}% pass` : "no data";

  // Measure text widths (approximate for sans-serif at 11px)
  const charWidth = 6.5;
  const leftPad = 6;
  const rightPad = 6;
  const leftText = displayLabel;
  const rightText = displayValue;
  const leftWidth = Math.round(leftText.length * charWidth + leftPad * 2);
  const rightWidth = Math.round(rightText.length * charWidth + rightPad * 2);
  const totalWidth = leftWidth + rightWidth;
  const height = 20;

  const noDataColor = "#555";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="${displayLabel}: ${displayValue}">
  <title>${displayLabel}: ${displayValue}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
    <stop offset="1" stop-opacity=".12"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${height}" fill="#333"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${passRate !== null ? color : noDataColor}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" text-anchor="middle">
    <text x="${leftWidth / 2}" y="14" fill="#fff" fill-opacity=".9">${escapeXml(leftText)}</text>
    <text x="${leftWidth + rightWidth / 2}" y="14" fill="#fff">${escapeXml(rightText)}</text>
  </g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

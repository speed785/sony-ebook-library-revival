export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export function breadcrumbParts(
  path: string,
): Array<{ label: string; path: string }> {
  const segments = path.split("/").filter(Boolean);
  const breadcrumbs = [{ label: "Reader", path: "" }];

  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    breadcrumbs.push({ label: segment, path: current });
  }

  return breadcrumbs;
}

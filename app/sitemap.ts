import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { getNewsData } from "@/lib/kv";

export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getNewsData();
  const lastModified = data.updatedAt ? new Date(data.updatedAt) : new Date();

  return [
    {
      url: getSiteUrl(),
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}

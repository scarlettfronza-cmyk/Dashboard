import { getDb } from "../server/db";
import { integrations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const integ = await db.select().from(integrations)
    .where(and(eq(integrations.clientId, 1), eq(integrations.provider, "meta_token")))
    .then(r => r[0]);

  if (!integ) { console.log("No integration"); process.exit(1); }
  const token = integ.accessToken;
  const igId = integ.metaIgUserId;

  // Get media list with more fields
  const mediaUrl = `https://graph.facebook.com/v19.0/${igId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=12&access_token=${token}`;
  const mediaRes = await fetch(mediaUrl);
  const mediaData = await mediaRes.json() as any;
  const items = mediaData.data || [];
  console.log(`Found ${items.length} posts`);

  // Get insights for first post with correct metrics
  const firstId = items[0].id;
  const mediaType = items[0].media_type;
  console.log("First post type:", mediaType);

  // Different metrics for different media types
  let metrics = "impressions,reach,saved,likes,comments,shares,total_interactions";
  if (mediaType === "VIDEO" || mediaType === "REEL") {
    metrics += ",views,ig_reels_avg_watch_time";
  }

  const insightsUrl = `https://graph.facebook.com/v19.0/${firstId}/insights?metric=${metrics}&access_token=${token}`;
  const insRes = await fetch(insightsUrl);
  const insData = await insRes.json() as any;
  console.log("\n=== INSIGHTS ===");
  if (insData.error) {
    console.log("Error:", insData.error.message);
    // Try with just basic metrics
    const basicUrl = `https://graph.facebook.com/v19.0/${firstId}/insights?metric=impressions,reach,saved,likes,comments,shares&access_token=${token}`;
    const basicRes = await fetch(basicUrl);
    const basicData = await basicRes.json() as any;
    console.log("Basic insights:", JSON.stringify(basicData, null, 2));
  } else {
    insData.data?.forEach((m: any) => console.log(`${m.name}: ${m.values?.[0]?.value ?? m.period}`));
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

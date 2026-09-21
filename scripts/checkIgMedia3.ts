import { getDb } from "../server/db";
import { integrations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function getInsights(mediaId: string, metrics: string, token: string) {
  const url = `https://graph.facebook.com/v19.0/${mediaId}/insights?metric=${metrics}&access_token=${token}`;
  const res = await fetch(url);
  return res.json() as any;
}

async function main() {
  const db = await getDb();
  const integ = await db.select().from(integrations)
    .where(and(eq(integrations.clientId, 1), eq(integrations.provider, "meta_token")))
    .then(r => r[0]);

  if (!integ) { console.log("No integration"); process.exit(1); }
  const token = integ.accessToken;
  const igId = integ.metaIgUserId;

  // Get media list
  const mediaUrl = `https://graph.facebook.com/v19.0/${igId}/media?fields=id,media_type,permalink,timestamp,like_count,comments_count&limit=6&access_token=${token}`;
  const mediaRes = await fetch(mediaUrl);
  const mediaData = await mediaRes.json() as any;
  const items = mediaData.data || [];

  for (const item of items.slice(0, 3)) {
    console.log(`\n=== ${item.media_type} - ${item.id} ===`);
    console.log(`Permalink: ${item.permalink}`);
    console.log(`Likes: ${item.like_count}, Comments: ${item.comments_count}`);

    // Try REEL/VIDEO metrics
    if (item.media_type === "VIDEO") {
      const reelMetrics = "views,total_interactions,likes,comments,shares,saved,ig_reels_avg_watch_time";
      const ins = await getInsights(item.id, reelMetrics, token);
      if (ins.error) {
        console.log("REEL metrics error:", ins.error.message);
        // Try basic
        const basic = await getInsights(item.id, "total_interactions,likes,comments,shares,saved", token);
        if (basic.error) console.log("Basic error:", basic.error.message);
        else basic.data?.forEach((m: any) => console.log(`  ${m.name}: ${m.values?.[0]?.value ?? JSON.stringify(m.values)}`));
      } else {
        ins.data?.forEach((m: any) => console.log(`  ${m.name}: ${m.values?.[0]?.value ?? JSON.stringify(m.values)}`));
      }
    } else {
      // IMAGE / CAROUSEL
      const imgMetrics = "impressions,reach,saved,likes,comments,shares,total_interactions";
      const ins = await getInsights(item.id, imgMetrics, token);
      if (ins.error) {
        console.log("IMG metrics error:", ins.error.message);
        const basic = await getInsights(item.id, "total_interactions,likes,comments,shares,saved", token);
        if (basic.error) console.log("Basic error:", basic.error.message);
        else basic.data?.forEach((m: any) => console.log(`  ${m.name}: ${m.values?.[0]?.value ?? JSON.stringify(m.values)}`));
      } else {
        ins.data?.forEach((m: any) => console.log(`  ${m.name}: ${m.values?.[0]?.value ?? JSON.stringify(m.values)}`));
      }
    }
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

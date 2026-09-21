import { getDb } from "../server/db";
import { integrations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const db = await getDb();
  // Get Dr Mario's meta_token
  const integ = await db.select().from(integrations)
    .where(and(eq(integrations.clientId, 1), eq(integrations.provider, "meta_token")))
    .then(r => r[0]);

  if (!integ) { console.log("No integration"); process.exit(1); }
  const token = integ.accessToken;
  const igId = integ.metaIgUserId;
  console.log("IG ID:", igId);

  // Get media list with insights
  const mediaUrl = `https://graph.facebook.com/v19.0/${igId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=10&access_token=${token}`;
  const mediaRes = await fetch(mediaUrl);
  const mediaData = await mediaRes.json() as any;
  
  if (mediaData.error) {
    console.log("Media error:", JSON.stringify(mediaData.error));
    process.exit(1);
  }
  
  console.log("\n=== MEDIA LIST ===");
  const items = mediaData.data || [];
  console.log(`Found ${items.length} posts`);
  
  if (items.length > 0) {
    // Get insights for first post
    const firstId = items[0].id;
    const insightsUrl = `https://graph.facebook.com/v19.0/${firstId}/insights?metric=impressions,reach,engagement,saved,video_views&access_token=${token}`;
    const insRes = await fetch(insightsUrl);
    const insData = await insRes.json() as any;
    console.log("\n=== FIRST POST INSIGHTS ===");
    console.log(JSON.stringify(insData, null, 2));
    
    // Show first post data
    console.log("\n=== FIRST POST ===");
    console.log(JSON.stringify(items[0], null, 2));
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

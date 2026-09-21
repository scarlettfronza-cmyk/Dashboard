export type BeforeAfterBriefInput = {
  title: string;
  hook: string;
  angle: string;
  coreMessage: string;
  visualDirection: string;
  format: string;
};

export function buildBeforeAfterCreativePrompt(brief: BeforeAfterBriefInput, aspectRatio: "4:5" | "9:16") {
  const layout = aspectRatio === "9:16" ? "vertical 9:16 story/reel advertising layout" : "vertical 4:5 Meta feed advertising layout";
  return `Create a polished ${layout} using the two supplied authorized patient photos as the factual before and after visual reference.

Creative brief title: ${brief.title}
Hook: ${brief.hook}
Angle: ${brief.angle}
Core message: ${brief.coreMessage}
Visual direction: ${brief.visualDirection}
Brief format: ${brief.format}

Composition: make a clean, premium split-screen or editorial comparison layout that preserves the supplied before and after photos faithfully. Use the original subjects exactly as shown, maintain their identity, anatomy, hair, skin tone, and genuine treatment outcome. Add tasteful clinical context, neutral premium background accents, and visual hierarchy with empty space reserved for a designer to add approved copy later.

Constraints: do not invent a new person, do not alter the medical or aesthetic result, do not enhance the result beyond the supplied photos, do not add readable text, logos, watermarks, prices, guarantees, or claims. Do not add labels such as Before or After. This is an internal draft visual that requires human review before any publication.`;
}

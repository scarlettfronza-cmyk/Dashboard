export type VisualBriefInput = {
  title: string;
  hook: string;
  angle: string;
  coreMessage: string;
  visualDirection: string;
  format: string;
  targetAudience: string | null;
};

export function buildCreativeVisualPrompt(brief: VisualBriefInput, aspectRatio: "4:5" | "9:16") {
  const orientation = aspectRatio === "9:16" ? "vertical 9:16 social media story or reel cover" : "vertical 4:5 Meta feed advertising visual";
  return `Create a polished ${orientation} for a Brazilian performance marketing campaign in the health and aesthetics sector.

Purpose: create the visual base for the approved creative brief titled "${brief.title}".
Hook concept: ${brief.hook}
Angle: ${brief.angle}
Core message: ${brief.coreMessage}
Target audience: ${brief.targetAudience ?? "adult prospective clients researching a professional service"}
Visual direction: ${brief.visualDirection}
Suggested original format: ${brief.format}

Style: premium, credible, clean, warm clinical lighting, realistic photography, strong focal point in the first second, modern Brazilian clinic aesthetic, enough negative space for a designer to add copy later.
Constraints: use fictional, non-identifiable adults only; do not use logos, watermarks, recognizable brands, readable text, price tags, guarantees, exaggerated outcomes, or deceptive before-and-after comparisons. Do not render any text inside the image. This is a visual base only, not a final published ad.`;
}

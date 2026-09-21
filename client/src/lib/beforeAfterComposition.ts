export type BeforeAfterCompositionInput = {
  beforeUrl: string;
  afterUrl: string;
  aspectRatio: "4:5" | "9:16";
  title: string;
  hook?: string | null;
  callToAction?: string | null;
};

export function compositionSize(aspectRatio: "4:5" | "9:16") {
  return aspectRatio === "9:16" ? { width: 1080, height: 1920 } : { width: 1080, height: 1350 };
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar uma das fotos originais."));
    image.src = url;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  ctx.drawImage(
    image,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number, align: CanvasTextAlign = "left") {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  ctx.textAlign = align;
  lines.slice(0, maxLines).forEach((current, index) => ctx.fillText(current, x, y + index * lineHeight));
  ctx.textAlign = "left";
}

function displayTitle(title: string) {
  if (/sobrancelha/i.test(title)) return "TRANSPLANTE DE SOBRANCELHAS";
  if (/capilar|hairline|transplante/i.test(title)) return "TRANSPLANTE CAPILAR";
  const cleaned = title.replace(/^briefing\s*/i, "").trim();
  return (cleaned || "RESULTADO REAL").toUpperCase();
}

function drawPhotoPanel(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, label: string, labelFill: string) {
  ctx.save();
  roundedRect(ctx, x, y, width, height, 14);
  ctx.clip();
  ctx.fillStyle = "#10141d";
  ctx.fillRect(x, y, width, height);
  drawImageCover(ctx, image, x, y, width, height);
  ctx.restore();

  ctx.save();
  roundedRect(ctx, x, y, width, height, 14);
  ctx.strokeStyle = "#d8b272";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const labelWidth = label === "DEPOIS" ? 220 : 194;
  roundedRect(ctx, x + (width - labelWidth) / 2, y - 30, labelWidth, 62, 28);
  ctx.fillStyle = labelFill;
  ctx.fill();
  ctx.fillStyle = label === "DEPOIS" ? "#1d222b" : "#ffffff";
  ctx.font = "700 28px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + width / 2, y + 10);
  ctx.textAlign = "left";
}

function drawBenefit(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, title: string, icon: "hair" | "shield" | "person") {
  ctx.strokeStyle = "#d8b272";
  ctx.fillStyle = "#d8b272";
  ctx.lineWidth = 3;
  const iconX = x + 35;
  const iconY = y + 20;
  if (icon === "hair") {
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath();
      ctx.arc(iconX + index * 14, iconY + 16, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else if (icon === "shield") {
    ctx.beginPath();
    ctx.moveTo(iconX, iconY);
    ctx.lineTo(iconX + 30, iconY - 12);
    ctx.lineTo(iconX + 60, iconY);
    ctx.lineTo(iconX + 52, iconY + 45);
    ctx.lineTo(iconX + 30, iconY + 62);
    ctx.lineTo(iconX + 8, iconY + 45);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(iconX + 18, iconY + 23);
    ctx.lineTo(iconX + 28, iconY + 34);
    ctx.lineTo(iconX + 45, iconY + 14);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(iconX + 28, iconY + 7, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(iconX + 28, iconY + 55, 25, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(iconX + 56, iconY + 38);
    ctx.lineTo(iconX + 70, iconY + 47);
    ctx.lineTo(iconX + 85, iconY + 28);
    ctx.stroke();
  }
  ctx.fillStyle = "#f4f1ec";
  ctx.font = "500 20px Arial, sans-serif";
  drawWrappedText(ctx, title, x + 118, y + 20, width - 132, 25, 2);
}

function drawCta(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  roundedRect(ctx, x, y, width, height, 18);
  ctx.fillStyle = "#d8b272";
  ctx.fill();
  ctx.strokeStyle = "#f4ddb2";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#242936";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AGENDE SUA AVALIAÇÃO", x + width / 2, y + height / 2 + 11);
  ctx.textAlign = "left";
}

export async function composeBeforeAfterStatic(input: BeforeAfterCompositionInput): Promise<string> {
  const [before, after] = await Promise.all([loadImage(input.beforeUrl), loadImage(input.afterUrl)]);
  const { width, height } = compositionSize(input.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a composição do estático.");

  const isStory = input.aspectRatio === "9:16";
  const photoY = isStory ? 360 : 300;
  const photoHeight = isStory ? 1000 : 710;
  const benefitsY = isStory ? 1465 : 1075;
  const ctaY = isStory ? 1735 : 1245;

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#1d222b");
  background.addColorStop(0.55, "#12151c");
  background.addColorStop(1, "#262c36");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#dcc18d";
  ctx.font = isStory ? "700 52px Arial, sans-serif" : "700 48px Arial, sans-serif";
  drawWrappedText(ctx, displayTitle(input.title), width / 2, isStory ? 96 : 84, width - 80, 60, 1, "center");
  ctx.fillStyle = "#f5f2ed";
  ctx.font = isStory ? "400 27px Arial, sans-serif" : "400 25px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RESULTADOS REAIS, CONFIANÇA RENOVADA.", width / 2, isStory ? 162 : 145);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(216, 178, 114, 0.45)";
  ctx.fillRect(60, isStory ? 205 : 182, width - 120, 1);

  const margin = 28;
  const panelWidth = (width - margin * 3) / 2;
  drawPhotoPanel(ctx, before, margin, photoY, panelWidth, photoHeight, "ANTES", "#505867");
  drawPhotoPanel(ctx, after, margin * 2 + panelWidth, photoY, panelWidth, photoHeight, "DEPOIS", "#dcc18d");

  drawBenefit(ctx, 44, benefitsY, 310, "NATURALIDADE E RESULTADO REAL", "hair");
  ctx.fillStyle = "rgba(216, 178, 114, 0.45)";
  ctx.fillRect(372, benefitsY - 2, 1, 72);
  drawBenefit(ctx, 394, benefitsY, 305, "SEGURANÇA E TECNOLOGIA", "shield");
  ctx.fillStyle = "rgba(216, 178, 114, 0.45)";
  ctx.fillRect(720, benefitsY - 2, 1, 72);
  drawBenefit(ctx, 740, benefitsY, 300, "AUTOESTIMA E CONFIANÇA", "person");

  drawCta(ctx, 220, ctaY, 640, isStory ? 98 : 78);
  return canvas.toDataURL("image/png");
}

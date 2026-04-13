#!/usr/bin/env node
// Instagram Publisher — suporta imagem única e carrossel
// Usage: node --env-file=.env publish.js --images "card.jpg" --caption "..." [--dry-run]
//        node --env-file=.env publish.js --images "s1.jpg,s2.jpg" --caption "..." [--dry-run]

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Argument parsing ──────────────────────────────────────────

export function parseArgs(argv) {
  const args = { images: [], caption: '', dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--images') {
      if (i + 1 < argv.length) args.images = argv[++i].split(',').map(s => s.trim());
    }
    else if (argv[i] === '--caption') {
      if (i + 1 < argv.length) args.caption = argv[++i];
    }
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

// ── Image upload (catbox.moe) ─────────────────────────────────

export async function uploadToCatbox(imagePath) {
  const absolutePath = resolve(imagePath);
  const fileBuffer = readFileSync(absolutePath);
  const fileName = absolutePath.split(/[\\/]/).pop();
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', blob, fileName);
  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`catbox.moe upload failed [${res.status}]: ${await res.text()}`);
  const url = (await res.text()).trim();
  return url;
}

// ── Instagram Graph API ───────────────────────────────────────

const IG_BASE = 'https://graph.facebook.com/v21.0';

export async function getContainerStatus(containerId, accessToken) {
  const params = new URLSearchParams({ fields: 'status_code', access_token: accessToken });
  const res = await fetch(`${IG_BASE}/${containerId}?${params}`);
  if (!res.ok) throw new Error(`getContainerStatus failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).status_code;
}

export async function pollUntilFinished(containerId, accessToken, timeoutMs = 60_000, intervalMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getContainerStatus(containerId, accessToken);
    if (status === 'FINISHED') return;
    if (status === 'ERROR') throw new Error(`Container ${containerId} entered ERROR state`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Container ${containerId} timed out after ${timeoutMs}ms`);
}

export async function publishMedia(userId, containerId, accessToken) {
  const params = new URLSearchParams({ creation_id: containerId, access_token: accessToken });
  const res = await fetch(`${IG_BASE}/${userId}/media_publish?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`publishMedia failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

export async function getPermalink(mediaId, accessToken) {
  const params = new URLSearchParams({ fields: 'permalink', access_token: accessToken });
  const res = await fetch(`${IG_BASE}/${mediaId}?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.permalink ?? null;
}

// ── Single image ──────────────────────────────────────────────

export async function createSingleImageContainer(userId, imageUrl, caption, accessToken) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });
  const res = await fetch(`${IG_BASE}/${userId}/media?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`createSingleImageContainer failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

// ── Carousel ──────────────────────────────────────────────────

export async function createChildContainer(userId, imageUrl, accessToken) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    is_carousel_item: 'true',
    access_token: accessToken,
  });
  const res = await fetch(`${IG_BASE}/${userId}/media?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`createChildContainer failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

export async function createCarouselContainer(userId, childIds, caption, accessToken) {
  const params = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: accessToken,
  });
  const res = await fetch(`${IG_BASE}/${userId}/media?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`createCarouselContainer failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const { images, caption, dryRun } = parseArgs(process.argv);

  if (!images.length) throw new Error('--images is required (e.g. --images "card.jpg")');
  if (!caption) throw new Error('--caption is required');
  if (images.length > 10) throw new Error(`Instagram suporta até 10 imagens (recebeu ${images.length})`);
  if (caption.length > 2200) {
    throw new Error(`Legenda excede o limite de 2200 caracteres do Instagram (${caption.length})`);
  }

  const { INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID } = process.env;
  if (!INSTAGRAM_ACCESS_TOKEN) throw new Error('INSTAGRAM_ACCESS_TOKEN não configurado no .env');
  if (!INSTAGRAM_USER_ID) throw new Error('INSTAGRAM_USER_ID não configurado no .env');

  const isCarousel = images.length > 1;

  console.log(`📸 Enviando ${images.length} imagem(ns) para catbox.moe...`);
  const imageUrls = await Promise.all(images.map(p => uploadToCatbox(p)));
  imageUrls.forEach((url, i) => console.log(`   [${i + 1}] ${url}`));

  let containerId;

  if (isCarousel) {
    if (images.length < 2) throw new Error('Carrossel requer mínimo 2 imagens');

    console.log('\n📦 Criando containers filhos do carrossel...');
    const childIds = await Promise.all(
      imageUrls.map(url => createChildContainer(INSTAGRAM_USER_ID, url, INSTAGRAM_ACCESS_TOKEN))
    );
    console.log(`   IDs: ${childIds.join(', ')}`);

    console.log('\n⏳ Aguardando processamento dos containers...');
    await Promise.all(childIds.map(id => pollUntilFinished(id, INSTAGRAM_ACCESS_TOKEN)));

    console.log('\n🎠 Criando container do carrossel...');
    containerId = await createCarouselContainer(INSTAGRAM_USER_ID, childIds, caption, INSTAGRAM_ACCESS_TOKEN);
    await pollUntilFinished(containerId, INSTAGRAM_ACCESS_TOKEN);
    console.log(`   Container do carrossel: ${containerId}`);
  } else {
    console.log('\n📦 Criando container de imagem única...');
    containerId = await createSingleImageContainer(INSTAGRAM_USER_ID, imageUrls[0], caption, INSTAGRAM_ACCESS_TOKEN);

    console.log('\n⏳ Aguardando processamento...');
    await pollUntilFinished(containerId, INSTAGRAM_ACCESS_TOKEN);
    console.log(`   Container pronto: ${containerId}`);
  }

  if (dryRun) {
    console.log('\n✅ DRY RUN completo — publicação não realizada.');
    console.log(`   Container pronto: ${containerId}`);
    return;
  }

  console.log('\n🚀 Publicando no Instagram...');
  const postId = await publishMedia(INSTAGRAM_USER_ID, containerId, INSTAGRAM_ACCESS_TOKEN);
  const permalink = await getPermalink(postId, INSTAGRAM_ACCESS_TOKEN);
  console.log(`\n✅ Publicado com sucesso!`);
  console.log(`   Post ID: ${postId}`);
  if (permalink) console.log(`   URL: ${permalink}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(err => {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  });
}

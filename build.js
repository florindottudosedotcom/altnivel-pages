#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple YAML frontmatter parser
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  let currentKey = null;
  let currentArray = null;

  match[1].split('\n').forEach(line => {
    if (line.match(/^(\w+):$/)) {
      currentKey = line.replace(':', '');
      meta[currentKey] = [];
      currentArray = meta[currentKey];
    } else if (line.match(/^\s+-\s*\{/)) {
      // Inline object in array
      const obj = {};
      line.match(/(\w+):\s*([^,}]+)/g)?.forEach(pair => {
        const [k, v] = pair.split(':').map(s => s.trim());
        obj[k] = v.replace(/^["']|["']$/g, '');
      });
      if (currentArray) currentArray.push(obj);
    } else if (line.match(/^\s+-\s+name:/)) {
      const obj = { name: line.split('name:')[1].trim() };
      if (currentArray) currentArray.push(obj);
    } else if (line.match(/^\s+role:/)) {
      if (currentArray && currentArray.length > 0) {
        currentArray[currentArray.length - 1].role = line.split('role:')[1].trim();
      }
    } else if (line.match(/^\w+:/)) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      if (value) {
        meta[key] = value;
      } else {
        currentKey = key;
        meta[key] = {};
      }
    } else if (line.match(/^\s+\w+:/) && currentKey && typeof meta[currentKey] === 'object' && !Array.isArray(meta[currentKey])) {
      const [key, ...valueParts] = line.trim().split(':');
      meta[currentKey][key] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
    }
  });

  return { meta, body: match[2] };
}

// Simple markdown to HTML
function markdownToHtml(md) {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^> (.+)$/gm, '<p class="subtitle">$1</p>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n([^<\n].+?)(?=\n\n|$)/g, '\n\n<p>$1</p>')
    .replace(/\n{3,}/g, '\n\n');
}

// Generate HTML page
function generateHtml(meta, bodyHtml) {
  const teamHtml = (meta.team || []).map(m => `
    <div class="team-member">
      <h3>${m.name}</h3>
      <p>${m.role}</p>
    </div>`).join('');

  const deliverablesHtml = bodyHtml.match(/<h2>Ce primesti<\/h2>\s*<ul>([\s\S]*?)<\/ul>/)?.[1] || '';

  const formFieldsHtml = (meta.form_fields || []).map(f => {
    const req = f.required === 'true' || f.required === true ? 'required' : '';
    if (f.type === 'textarea') {
      return `<div class="form-group">
        <label for="${f.name}">${f.label}</label>
        <textarea id="${f.name}" name="${f.name}" rows="4" ${req}></textarea>
      </div>`;
    }
    return `<div class="form-group">
      <label for="${f.name}">${f.label}</label>
      <input type="${f.type}" id="${f.name}" name="${f.name}" ${req}>
    </div>`;
  }).join('\n');

  const price = meta.price || {};

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title} - Alt Nivel Studio</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="hero">
    <div class="container">
      <h1>${meta.title}</h1>
      ${bodyHtml.match(/<p class="subtitle">(.+?)<\/p>/)?.[0] || ''}
    </div>
  </header>

  <main>
    ${bodyHtml
      .replace(/<h1>.*?<\/h1>/, '')
      .replace(/<p class="subtitle">.*?<\/p>/, '')
      .split(/<h2>/)
      .filter(s => s.trim())
      .map(section => {
        const title = section.match(/^(.+?)<\/h2>/)?.[1] || '';
        const content = section.replace(/^.+?<\/h2>/, '');

        if (title === 'Ce primesti') {
          return `<section class="package">
            <div class="container">
              <h2>${title}</h2>
              <div class="package-card">
                <div class="price">
                  <span class="amount">${price.amount || ''}</span>
                  <span class="currency">${price.currency || ''}</span>
                  <span class="note">${price.note || ''}</span>
                </div>
                <ul class="deliverables">${deliverablesHtml}</ul>
                <p class="payment-terms">${meta.payment_terms || ''}</p>
              </div>
            </div>
          </section>`;
        }

        if (title.includes('Echipa') || title === 'team') {
          return `<section class="team">
            <div class="container">
              <h2>Echipa</h2>
              <div class="team-grid">${teamHtml}</div>
            </div>
          </section>`;
        }

        if (title.includes('Rezerva')) {
          return `<section class="cta">
            <div class="container">
              <h2>${title}</h2>
              <p>${content.replace(/<[^>]+>/g, '').trim()}</p>
              <form class="reservation-form" id="reservationForm">
                ${formFieldsHtml}
                <button type="submit" class="submit-btn">Trimite cererea</button>
              </form>
            </div>
          </section>`;
        }

        return `<section>
          <div class="container">
            <h2>${title}</h2>
            ${content}
          </div>
        </section>`;
      }).join('\n')}
  </main>

  <footer>
    <div class="container">
      <p>Alt Nivel Studio - Doua etaje mai sus, infinit la creativitate</p>
      <div class="footer-links">
        <a href="https://www.altnivel.studio">altnivel.studio</a>
        <a href="mailto:hello@altnivel.studio">hello@altnivel.studio</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

// Main
const ofertePath = process.argv[2] || 'oferte/fpd-31e38f3f';
const contentPath = path.join(ofertePath, 'content.md');
const outputPath = path.join(ofertePath, 'index.html');

if (!fs.existsSync(contentPath)) {
  console.error(`File not found: ${contentPath}`);
  process.exit(1);
}

const content = fs.readFileSync(contentPath, 'utf-8');
const { meta, body } = parseFrontmatter(content);
const bodyHtml = markdownToHtml(body);
const html = generateHtml(meta, bodyHtml);

fs.writeFileSync(outputPath, html);
console.log(`Generated: ${outputPath}`);

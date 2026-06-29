import nodemailer from 'nodemailer';
import { config } from './config.js';

function money(value, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN'
  }).format(Number(value || 0));
}

export async function sendTelegramAlert(message) {
  if (!config.telegramBotToken || !config.telegramChatId) return { skipped: true };

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram error: ${text}`);
  }

  return { sent: true };
}

export async function sendEmailAlert(subject, html) {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass || !config.smtp.to) {
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });

  await transporter.sendMail({
    from: config.smtp.from,
    to: config.smtp.to,
    subject,
    html
  });

  return { sent: true };
}

export async function notifyDeal({ product, price, previousPrice, reason, alertId }) {
  const previous = previousPrice ? `\nAntes: ${money(previousPrice, price.currency)}` : '';
  const message = [
    '🔥 <b>Oferta realmente buena detectada</b>',
    `<b>${escapeHtml(product.title)}</b>`,
    `Tienda: ${escapeHtml(product.store)}`,
    `Precio: ${money(price.price, price.currency)}`,
    previous,
    `Motivo: ${escapeHtml(reason)}`,
    product.url
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5">
      <h2>🔥 Oferta realmente buena detectada</h2>
      <p><strong>${escapeHtml(product.title)}</strong></p>
      <p><strong>Tienda:</strong> ${escapeHtml(product.store)}</p>
      <p><strong>Precio:</strong> ${money(price.price, price.currency)}</p>
      ${previousPrice ? `<p><strong>Antes:</strong> ${money(previousPrice, price.currency)}</p>` : ''}
      <p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
      <p><a href="${product.url}">Ver producto</a></p>
      <small>Alerta #${alertId || ''}</small>
    </div>
  `;

  const results = [];
  try {
    results.push(await sendTelegramAlert(message));
  } catch (error) {
    results.push({ telegramError: error.message });
  }

  try {
    results.push(await sendEmailAlert(`Oferta: ${product.title}`, html));
  } catch (error) {
    results.push({ emailError: error.message });
  }

  return results;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

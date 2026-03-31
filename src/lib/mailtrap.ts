import { MailtrapClient } from 'mailtrap';

const TOKEN = process.env.MAILTRAP_TOKEN || '';

const client = new MailtrapClient({ token: TOKEN });

const SENDER = {
  email: 'hello@demomailtrap.co',
  name: 'Marigo Luxe',
};

// ─── Order Confirmation (Buyer) ───────────────────────────────────────────────

export async function sendOrderConfirmation({
  buyerEmail,
  buyerName,
  orderNumber,
  orderId,
  items,
  totalAmount,
  paymentMethod,
  shippingAddress,
}: {
  buyerEmail: string;
  buyerName: string;
  orderNumber: string;
  orderId: string;
  items: Array<{ brand: string; title: string; price: number }>;
  totalAmount: number;
  paymentMethod: 'cod' | 'card';
  shippingAddress: { fullName: string; address: string; city: string; postal: string; country: string };
}) {
  if (!TOKEN) return;

  const itemRows = items
    .map(
      i => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
          <strong>${i.brand}</strong> – ${i.title}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">
          €${i.price.toFixed(2)}
        </td>
      </tr>`
    )
    .join('');

  const paymentLabel =
    paymentMethod === 'cod' ? 'Cash on Delivery' : 'Credit / Debit Card';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:#000;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:300;letter-spacing:4px;">MARIGO</h1>
            <p style="margin:6px 0 0;color:#aaa;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Luxury Fashion Marketplace</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111;">Order Confirmed</h2>
            <p style="margin:0 0 24px;color:#666;font-size:15px;">Hi ${buyerName}, thank you for your purchase. Your order has been received and is being processed.</p>

            <!-- Order Reference -->
            <div style="background:#f9f9f9;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Order Reference</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#111;">#${orderNumber}</p>
            </div>

            <!-- Items -->
            <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:1px;">Items</h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
              <tr>
                <td style="padding:16px 0 0;font-size:16px;font-weight:700;color:#111;">Total</td>
                <td style="padding:16px 0 0;font-size:16px;font-weight:700;color:#111;text-align:right;">€${totalAmount.toFixed(2)}</td>
              </tr>
            </table>

            <!-- Delivery & Payment -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td width="50%" style="vertical-align:top;padding-right:12px;">
                  <h3 style="margin:0 0 8px;font-size:12px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:1px;">Delivery To</h3>
                  <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">
                    ${shippingAddress.fullName}<br>
                    ${shippingAddress.address}<br>
                    ${shippingAddress.city}, ${shippingAddress.postal}<br>
                    ${shippingAddress.country}
                  </p>
                </td>
                <td width="50%" style="vertical-align:top;padding-left:12px;">
                  <h3 style="margin:0 0 8px;font-size:12px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:1px;">Payment</h3>
                  <p style="margin:0;font-size:14px;color:#333;">${paymentLabel}</p>
                  ${
                    paymentMethod === 'card'
                      ? '<p style="margin:6px 0 0;font-size:12px;color:#666;">Funds are held securely in escrow until delivery is confirmed.</p>'
                      : ''
                  }
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin-top:36px;">
              <a href="https://marigoapp.com/profile/orders/${orderId}"
                style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:14px;font-weight:600;letter-spacing:0.5px;">
                Track Your Order
              </a>
            </div>

            <p style="margin:28px 0 0;font-size:13px;color:#999;text-align:center;line-height:1.5;">
              Questions? Reply to this email or visit our <a href="https://marigoapp.com/help" style="color:#000;">Help Center</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">© 2026 Marigo Luxe. All rights reserved.</p>
            <p style="margin:4px 0 0;font-size:12px;color:#aaa;">Albania & EU Luxury Fashion Marketplace</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await client.send({
    from: SENDER,
    to: [{ email: buyerEmail, name: buyerName }],
    subject: `Order Confirmed — #${orderNumber}`,
    html,
    category: 'Order Confirmation',
  });
}

// ─── New Order Notification (Seller) ─────────────────────────────────────────

export async function sendSellerOrderNotification({
  sellerEmail,
  sellerName,
  orderNumber,
  items,
  totalAmount,
}: {
  sellerEmail: string;
  sellerName: string;
  orderNumber: string;
  items: Array<{ brand: string; title: string; price: number }>;
  totalAmount: number;
}) {
  if (!TOKEN) return;

  const itemList = items
    .map(i => `<li style="margin-bottom:6px;font-size:14px;color:#333;"><strong>${i.brand}</strong> – ${i.title} (€${i.price.toFixed(2)})</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        <tr>
          <td style="background:#000;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:300;letter-spacing:4px;">MARIGO</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111;">You have a new sale!</h2>
            <p style="margin:0 0 24px;color:#666;font-size:15px;">Hi ${sellerName}, a buyer has purchased your item. Please ship within <strong>7 days</strong> to avoid automatic cancellation.</p>

            <div style="background:#f9f9f9;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Order Reference</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#111;">#${orderNumber}</p>
            </div>

            <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:1px;">Sold Items</h3>
            <ul style="margin:0 0 24px;padding-left:20px;">${itemList}</ul>

            <p style="font-size:15px;color:#333;"><strong>Total:</strong> €${totalAmount.toFixed(2)}</p>

            <div style="text-align:center;margin-top:32px;">
              <a href="https://marigoapp.com/profile/listings"
                style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:14px;font-weight:600;">
                View Your Listings
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">© 2026 Marigo Luxe. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await client.send({
    from: SENDER,
    to: [{ email: sellerEmail, name: sellerName }],
    subject: `New Sale — Order #${orderNumber}`,
    html,
    category: 'Seller Notification',
  });
}

// ─── New Message Notification ─────────────────────────────────────────────────

export async function sendMessageNotification({
  recipientEmail,
  recipientName,
  senderName,
  productTitle,
  messagePreview,
  conversationId,
}: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  productTitle: string;
  messagePreview: string;
  conversationId: string;
}) {
  if (!TOKEN) return;

  await client.send({
    from: SENDER,
    to: [{ email: recipientEmail, name: recipientName }],
    subject: `New message from ${senderName} about ${productTitle}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        <tr>
          <td style="background:#000;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:300;letter-spacing:4px;">MARIGO</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">New Message</h2>
            <p style="margin:0 0 24px;color:#666;font-size:15px;">
              <strong>${senderName}</strong> sent you a message about <strong>${productTitle}</strong>.
            </p>
            <div style="background:#f9f9f9;border-left:3px solid #000;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:28px;">
              <p style="margin:0;font-size:15px;color:#333;font-style:italic;">"${messagePreview}"</p>
            </div>
            <div style="text-align:center;">
              <a href="https://marigoapp.com/messages/${conversationId}"
                style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:14px;font-weight:600;">
                Reply Now
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">© 2026 Marigo Luxe. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    category: 'Message Notification',
  });
}

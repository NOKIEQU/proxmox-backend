import nodemailer from 'nodemailer';
import config from '../config/index.js'; // Ensure you add SMTP details to your .env and config

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async (to, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: '"SnapHosting" <noreply@snaphosting.pl>', // Customize this
      to,
      subject,
      html: htmlContent,
    });
    console.log(`✉️ Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
  }
};

const buildEmailLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
      background-color: #f4f4f5; 
      color: #1a1d1e; 
      margin: 0; 
      padding: 40px 20px; 
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border: 1px solid #1a1d1e; 
    }
    .header { 
      padding: 30px; 
      border-bottom: 1px solid #1a1d1e; 
      text-align: center; 
      background-color: #fcfcfc;
    }
    .content { 
      padding: 40px 30px; 
    }
    h1, h2, h3 { 
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; 
      text-transform: uppercase; 
      letter-spacing: 0.1em; 
      margin-top: 0; 
      color: #1a1d1e;
    }
    p {
      line-height: 1.6;
      font-size: 14px;
      color: #3f3f46;
    }
    .footer { 
      padding: 25px 30px; 
      border-top: 1px solid #1a1d1e; 
      font-family: ui-monospace, monospace; 
      font-size: 10px; 
      text-transform: uppercase; 
      letter-spacing: 0.1em; 
      color: #71717a; 
      text-align: center; 
      background-color: #fcfcfc; 
    }
    .btn { 
      display: inline-block; 
      padding: 15px 25px; 
      background-color: #1a1d1e; 
      color: #ffffff !important; 
      text-decoration: none; 
      font-family: ui-monospace, monospace; 
      font-size: 12px; 
      font-weight: bold; 
      text-transform: uppercase; 
      letter-spacing: 0.1em; 
      border: 1px solid #1a1d1e;
      margin-top: 20px;
    }
    .data-box { 
      border: 1px solid #1a1d1e; 
      background-color: #fcfcfc; 
      padding: 20px; 
      margin: 25px 0; 
      font-family: ui-monospace, monospace; 
      font-size: 14px; 
    }
    .data-row { 
      margin-bottom: 15px; 
    }
    .data-row:last-child { 
      margin-bottom: 0; 
    }
    .label { 
      font-size: 10px; 
      text-transform: uppercase; 
      color: #71717a; 
      letter-spacing: 0.1em; 
      display: block; 
      margin-bottom: 4px; 
      font-weight: bold;
    }
    .value {
      font-weight: bold;
      color: #1a1d1e;
    }
    .alert-box {
      border: 1px solid #e5484d; 
      background-color: #fff0f0; 
      padding: 20px; 
      margin: 25px 0; 
      border-left: 4px solid #e5484d;
    }
    .alert-title {
      color: #e5484d;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://iili.io/B4pZo9s.png" alt="SnapHosting" style="height: 35px; width: auto; display: block; margin: 0 auto;">
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      SNAPHOSTING.PL &bull; AUTOMATED CLOUD INFRASTRUCTURE<br><br>
      SYSTEM-GENERATED NOTIFICATION &bull; DO NOT REPLY
    </div>
  </div>
</body>
</html>
`;

// ==========================================
// 📨 PRE-DEFINED EMAIL TEMPLATES
// ==========================================

export const sendPasswordResetCode = async (userEmail, code) => {
  const content = `
    <h2>Authentication Request</h2>
    <p>We received a request to reset the password for your SnapHosting account. Enter the 6-digit verification code below to authorize this action.</p>
    
    <div class="data-box" style="text-align: center; padding: 40px 20px;">
      <span class="label">Verification Code</span>
      <div style="font-size: 42px; font-weight: bold; letter-spacing: 8px; margin-top: 10px; color: #1a1d1e;">${code}</div>
    </div>
    
    <p style="font-size: 12px; color: #71717a;">This code will expire in 15 minutes. If you did not request this, please secure your account immediately.</p>
  `;
  return sendMail(userEmail, 'Your Password Reset Code', buildEmailLayout(content));
};

export const sendServerProvisioningEmail = async (userEmail, hostname) => {
  const content = `
    <h2>Deployment Initiated</h2>
    <p>Your payment has been successfully processed. The system is currently allocating resources and building your instance.</p>
    
    <div class="data-box">
      <div class="data-row">
        <span class="label">Target Hostname</span>
        <span class="value">${hostname}</span>
      </div>
      <div class="data-row">
        <span class="label">Current Status</span>
        <span class="value" style="color: #f5a623;">PROVISIONING...</span>
      </div>
    </div>
    
    <p>This process typically takes 60-120 seconds. We will notify you again the moment your server is online with your connection credentials.</p>
  `;
  return sendMail(userEmail, `Snap Hosting | Notification: Deployment Started: ${hostname}`, buildEmailLayout(content));
};

export const sendServerReadyEmail = async (userEmail, hostname, ipAddress, password) => {
  const content = `
    <h2>Deployment Complete</h2>
    <p>Your instance has been successfully provisioned, booted, and is now ready for use. Please retain these credentials for SSH access.</p>
    
    <div class="data-box">
      <div class="data-row">
        <span class="label">Hostname</span>
        <span class="value">${hostname}</span>
      </div>
      <div class="data-row">
        <span class="label">IPv4 Address</span>
        <span class="value">${ipAddress}</span>
      </div>
      <div class="data-row">
        <span class="label">User Login</span>
        <span class="value">ubuntu</span>
      </div>
      
    </div>
    
    <p>You can manage your server's power state, view live metrics, and reinstall the OS directly from the dashboard.</p>
    
    <a href="https://snaphosting.pl/dashboard" class="btn">Access Dashboard &rarr;</a>
  `;
  return sendMail(userEmail, `Snap Hosting | Notification: Server Ready: ${hostname}`, buildEmailLayout(content));
};

export const sendInvoiceEmail = async (userEmail, invoiceUrl, amount, planName) => {
  const content = `
    <h2>Payment Receipt</h2>
    <p>Thank you for your business. Your payment has been successfully processed and applied to your account.</p>
    
    <div class="data-box">
      <div class="data-row">
        <span class="label">Description</span>
        <span class="value">${planName}</span>
      </div>
      <div class="data-row">
        <span class="label">Amount Paid</span>
        <span class="value">£${amount.toFixed(2)}</span>
      </div>
      <div class="data-row">
        <span class="label">Status</span>
        <span class="value" style="color: #10b981;">PAID</span>
      </div>
    </div>
    
    <a href="${invoiceUrl}" class="btn">View / Download Invoice &rarr;</a>
  `;
  return sendMail(userEmail, 'Snap Hosting | Your Invoice Receipt', buildEmailLayout(content));
};

export const sendExpiryWarningEmail = async (userEmail, hostname) => {
  const content = `
    <h2>Action Required</h2>
    <p>This is an automated notification regarding your active infrastructure.</p>
    
    <div class="alert-box">
      <div class="alert-title">Pending Suspension</div>
      <p style="margin: 0; color: #1a1d1e;">Your instance <strong>${hostname}</strong> is scheduled to expire in exactly <strong>3 days</strong>. If the upcoming automatic renewal fails, the server will be suspended.</p>
    </div>
    
    <p>Please ensure the payment method attached to your account is valid and has sufficient funds to avoid any interruption in service.</p>
    
    <a href="https://snaphosting.pl/dashboard/billing" class="btn">Manage Billing &rarr;</a>
  `;
  return sendMail(userEmail, `Snap Hosting | Action Required: ${hostname} Expiring Soon`, buildEmailLayout(content));
};

export const sendServerSuspendedEmail = async (userEmail, hostname) => {
  const content = `
    <h2>Instance Suspended</h2>
    <p>We were unable to process the renewal payment for your infrastructure.</p>
    
    <div class="alert-box">
      <div class="alert-title">Service Interrupted</div>
      <p style="margin: 0; color: #1a1d1e;">Your instance <strong>${hostname}</strong> has been powered off and suspended due to non-payment.</p>
    </div>
    
    <p>To restore access and power on your server, please update your billing information and pay the outstanding invoice immediately. If left unpaid, the server data will be permanently scheduled for deletion.</p>
    
    <a href="https://snaphosting.pl/dashboard/billing" class="btn">Pay Outstanding Balance &rarr;</a>
  `;
  return sendMail(userEmail, `Snap Hosting | Suspension Notice: ${hostname}`, buildEmailLayout(content));
};
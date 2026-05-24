import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { config } from "./config.js";

let _sesClient: SESClient | null = null;

function getSesClient(): SESClient {
  if (!_sesClient) {
    _sesClient = new SESClient({ region: config.sesRegion });
  }
  return _sesClient;
}

export interface ContactEmailParams {
  toAddress: string;
  fromAddress: string;
  replyToAddress: string;
  subject: string;
  name: string;
  message: string;
}

export async function sendContactEmail(params: ContactEmailParams): Promise<void> {
  const { toAddress, fromAddress, replyToAddress, subject, name, message } = params;

  if (!config.sesEnabled) {
    console.log("[contact] SES disabled (SES_ENABLED=false). Would have sent:");
    console.log(`  To: ${toAddress}`);
    console.log(`  From: ${fromAddress}`);
    console.log(`  Reply-To: ${replyToAddress}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Name: ${name}`);
    console.log(`  Message: ${message}`);
    return;
  }

  const ses = getSesClient();
  const bodyText = `Name: ${name}\nEmail: ${replyToAddress}\n\n${message}`;
  const bodyHtml = `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(replyToAddress)}</p><hr/><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;

  const command = new SendEmailCommand({
    Destination: { ToAddresses: [toAddress] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: bodyText, Charset: "UTF-8" },
        Html: { Data: bodyHtml, Charset: "UTF-8" }
      }
    },
    Source: fromAddress,
    ReplyToAddresses: [replyToAddress]
  });

  await ses.send(command);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import { createLogger } from "../utils/logger";
import nodemailer from "nodemailer";
import { marked } from "marked";
import { WebClient } from "@slack/web-api";
import slackifyMd from "slackify-markdown";

const LOGGER = createLogger("ADSNotificationEngine");

// ADSNotificationEngine - Base class that all other notification modules inherit
export abstract class ADSNotificationEngine {
  private agent_description: string;
  private ADS_DEVELOPER_PORTAL_URL: string =
    "https://agentdatashuttle.knowyours.co"; //TODO: Replace with actual URL

  constructor(agent_description: string) {
    this.agent_description = agent_description;
  }

  getNotificationBodyMarkdown = async (body_payload: string) => {
    const timestamp =
      new Date().toLocaleDateString("en-GB", {
        timeZone: "UTC",
      }) +
      " - " +
      new Date().toLocaleTimeString("en-GB", {
        timeZone: "UTC",
      });

    const ellipsisAdsSubscriberAgentDescription =
      this.agent_description.length > 100
        ? this.agent_description.slice(0, 100) + "..."
        : this.agent_description;

    return `## 🚀 Notification from ADS (Agent Data Shuttle)\n\n**Timestamp (UTC):** ${timestamp}\n\n**Triggered Agent's Description:** ${ellipsisAdsSubscriberAgentDescription}\n\n---\n\n### Execution Summary\n\n\n${body_payload}\n\n---\n\n> Sent by **Agent Data Shuttle**\n\n> See more about ADS on _${this.ADS_DEVELOPER_PORTAL_URL}_\n\n`;
  };

  getNotificationBodyHTML = async (body_payload: string) => {
    const timestamp =
      new Date().toLocaleDateString("en-GB", {
        timeZone: "UTC",
      }) +
      " - " +
      new Date().toLocaleTimeString("en-GB", {
        timeZone: "UTC",
      });

    const ellipsisAdsSubscriberAgentDescription =
      this.agent_description.length > 100
        ? this.agent_description.slice(0, 100) + "..."
        : this.agent_description;

    // Convert Markdown to HTML
    let htmlPayload = body_payload;
    try {
      htmlPayload = await marked(body_payload);
    } catch (error) {
      LOGGER.error("Error converting Markdown to HTML:", error);
      htmlPayload = `<pre>${body_payload}</pre>`;
    }

    // Return the complete HTML email body
    return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>ADS Notification</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        @media only screen and (max-width: 640px) {
                        .container {
                            width: 90% !important;
                            padding: 24px !important;
                        }
                        .header {
                            padding: 20px !important;
                            font-size: 20px !important;
                        }
                        }
                    </style>
                </head>
                <body style="margin:0; padding:0; background-color:#f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f5f7">
                        <tr>
                        <td align="center" style="padding: 30px 10px;">
                            <table role="presentation" class="container" width="720" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); width: 720px; max-width: 95%;">
                            
                            <tr>
                                <td class="header" style="background: #1c1c1e; padding: 24px 32px; color: #f5f5f7; font-size: 22px; font-weight: 600; letter-spacing: 0.3px;">
                                🚀 Notification from ADS (Agent Data Shuttle)
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 28px 40px; color: #1c1c1e;">

                                <p style="margin: 0 0 10px; font-size: 14px; color: #555;"><strong style="color:#1c1c1e;">Timestamp (UTC):</strong> ${timestamp}</p>
                                <p style="margin: 0 0 20px; font-size: 14px; color: #555;"><strong style="color:#1c1c1e;">Triggered Agent's Description:</strong> ${ellipsisAdsSubscriberAgentDescription}</p>

                                <div style="border-top: 1px solid #e0e0e0; margin: 20px 0;"></div>

                                <h3 style="margin: 0 0 16px; font-size: 18px; font-weight: 500; color: #1c1c1e;">Execution Summary</h3>

                                <div style="background: #f2f2f2; padding: 16px 20px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                    ${htmlPayload}
                                </div>

                                <div style="border-top: 1px solid #e0e0e0; margin: 20px 0;"></div>

                                <p style="font-size: 12px; color: #888; margin: 0 0 4px;">Sent by <strong>Agent Data Shuttle</strong></p>
                                <p style="font-size: 12px; color: #888; margin: 0;">See more about ADS on <em>${this.ADS_DEVELOPER_PORTAL_URL}</em></p>

                                </td>
                            </tr>

                            </table>
                        </td>
                        </tr>
                    </table>

                </body>
            </html>

    `;
  };

  // fireNotification() - Abstract Method to be implemented by subclasses to send notification
  abstract fireNotification(body_payload: string): Promise<boolean>;

  // channel_name - Abstract property to be implemented by subclasses to return the channel name
  abstract get channel_name(): string;
}

// EmailNotificationChannel - Class that can be used to send emails
export class EmailNotificationChannel extends ADSNotificationEngine {
  channel_name: string = "EmailNotificationChannel";
  private transporter: nodemailer.Transporter;
  private smtp_host: string;
  private smtp_port: number;
  private smtp_username: string;
  private smtp_password: string;
  private from_email_address: string;
  private to_email_address: string;
  private subject: string = "Notification from ADS Subscriber";

  constructor(
    agent_description: string,
    smtp_host: string,
    smtp_port: number,
    smtp_username: string,
    smtp_password: string,
    from_email_address: string,
    to_email_address: string,
    subject: string = "Notification from ADS Subscriber"
  ) {
    if (
      !smtp_host ||
      !smtp_port ||
      !smtp_username ||
      !smtp_password ||
      !from_email_address ||
      !to_email_address
    ) {
      const err = new Error(
        "SMTP configuration needs all fields: host, port, smtp_username, smtp_password, from_email_address, to_email_address."
      );
      LOGGER.error(
        "SMTP configuration needs all fields: host, port, smtp_username, smtp_password, from_email_address, to_email_address.",
        err
      );
      throw err;
    }

    if (smtp_port !== 465 && smtp_port !== 587) {
      const err = new Error(
        "SMTP port must be either 465 (secure) or 587 (non-secure)."
      );
      LOGGER.error(
        "SMTP port must be either 465 (secure) or 587 (non-secure).",
        err
      );
      throw err;
    }

    super(agent_description);

    this.smtp_host = smtp_host;
    this.smtp_port = smtp_port;
    this.smtp_username = smtp_username;
    this.smtp_password = smtp_password;
    this.from_email_address = from_email_address;
    this.to_email_address = to_email_address;
    this.subject = subject;

    this.transporter = nodemailer.createTransport({
      host: this.smtp_host,
      port: this.smtp_port,
      secure: this.smtp_port === 465, // true for 465, false for other ports
      auth: {
        user: this.smtp_username,
        pass: this.smtp_password,
      },
    });
  }

  // fireNotification() - Method to send notification via email
  fireNotification = async (body_payload: string) => {
    try {
      const mailHtmlBody = await this.getNotificationBodyHTML(body_payload);

      const mailOptions = {
        from: `"ADS Notification" <${this.from_email_address}>`,
        to: this.to_email_address,
        subject: this.subject,
        html: mailHtmlBody,
      };

      const info = await this.transporter.sendMail(mailOptions);
      LOGGER.info(`Email sent successfully to '${this.to_email_address}'`);
      LOGGER.debug(`Email info: `, { info: info });
      return true;
    } catch (error) {
      LOGGER.warn("Failed to send email notification", error);
      return false;
    }
  };
}

// SlackNotificationChannel - Class that can be used to send slack notifications
export class SlackNotificationChannel extends ADSNotificationEngine {
  channel_name: string = "SlackNotificationChannel";
  private slack_bot_token: string;
  private slack_channel_name: string;
  private slack_web_client: WebClient;

  constructor(
    agent_description: string,
    slack_bot_token: string,
    slack_channel_name: string
  ) {
    if (
      !agent_description ||
      !slack_bot_token ||
      !slack_channel_name ||
      agent_description === "" ||
      slack_bot_token === "" ||
      slack_channel_name === ""
    ) {
      const err = new Error(
        "Slack configuration needs all fields: agent_description, slack_bot_token, slack_channel_name."
      );
      LOGGER.error(
        "Slack configuration needs all fields: agent_description, slack_bot_token, slack_channel_name.",
        err
      );
      throw err;
    }

    super(agent_description);

    this.slack_bot_token = slack_bot_token;
    this.slack_channel_name = slack_channel_name;

    try {
      this.slack_web_client = new WebClient(this.slack_bot_token);
    } catch (error) {
      LOGGER.error(
        "Failed to initialize Slack WebClient. Please check your Slack bot token.",
        error
      );
      throw new Error("Invalid Slack bot token");
    }
  }

  // fireNotification() - Method to send notification via email
  fireNotification = async (body_payload: string) => {
    try {
      const notifMdBody = await this.getNotificationBodyMarkdown(body_payload);

      // Convert Markdown to Slack-compatible Mrkdown
      const slackifiedMdBody = slackifyMd(notifMdBody);

      const info = await this.slack_web_client.chat.postMessage({
        text: slackifiedMdBody,
        channel: this.slack_channel_name,
      });
      LOGGER.info(
        `Slack notification sent successfully to '${this.slack_channel_name}'`
      );
      LOGGER.debug(`Slack Message info: `, { info: info });
      return true;
    } catch (error) {
      LOGGER.warn("Failed to send Slack notification: ", error);
      return false;
    }
  };
}

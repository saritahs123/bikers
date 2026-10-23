import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let sesClient: SESClient | null = null;

export const getSESClient = () => {
  if (
    process.env.APP_ENV === "test" ||
    process.env.DISABLE_EXTERNAL_SERVICES === "true" ||
    process.env.ENABLE_EMAIL === "false"
  ) {
    return {
      send: async (command: unknown) => {
        console.log("[TEST MODE] Envío de correo interceptado y simulado.");
        return { MessageId: `mock-email-${Date.now()}` };
      }
    } as unknown as SESClient;
  }

  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return sesClient;
};

export const getSenderEmail = () => process.env.AWS_SES_SENDER || "fhernandez@smarttestingrd.com";


import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let sesClient: SESClient | null = null;

export const getSESClient = () => {
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


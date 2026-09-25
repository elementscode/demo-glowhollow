import { Job, email } from "@elements/app";
import MentionEmail from "#app/emails/mention";

export interface SendMentionJobFields {
  to: string;
  recipientName: string;
  senderName: string;
  channelName: string;
  channelId: string;
  body: string;
}

/**
 * Emails a member who was offline when someone mentioned them.
 */
export class SendMentionJob extends Job<SendMentionJobFields> {
  static maxAttempts = 5;

  run() {
    let f = this.fields;

    email({
      to: f.to,
      subject: `${f.senderName} mentioned you in #${f.channelName}`,
      body: new MentionEmail({
        recipientName: f.recipientName,
        senderName: f.senderName,
        channelName: f.channelName,
        channelId: f.channelId,
        body: f.body,
      }),
    });
  }
}

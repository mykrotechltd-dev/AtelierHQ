import type {
  ChannelAdapter,
  MessageChannel,
  MessageContent,
  MessageRecipient,
  MessagingService,
  SendResult,
} from "./types.ts";

/** Attempts each channel in `order`, in sequence, until one accepts the
 *  message. A channel adapter returning status:"failed" is an expected,
 *  handled outcome (the provider rejected it, the number doesn't support
 *  that channel, etc.) and falls through to the next channel — it is not
 *  the same as an adapter throwing, which is treated as a bug and
 *  propagates out uncaught so it surfaces clearly instead of being
 *  silently swallowed as "just another failed channel". */
export class ProviderMessagingService implements MessagingService {
  constructor(private readonly adapters: Record<MessageChannel, ChannelAdapter>) {}

  async sendWithFallback(
    recipient: MessageRecipient,
    content: MessageContent,
    order: readonly MessageChannel[],
  ): Promise<SendResult> {
    let last: SendResult | null = null;
    let attempted = false;

    for (const channel of order) {
      const adapter = this.adapters[channel];
      if (!(await adapter.supports(recipient))) continue;
      attempted = true;
      const result = await adapter.send(recipient, content);
      if (result.status === "accepted") return result;
      last = result; // recorded, then fall through to the next channel
    }

    if (!attempted || !last) {
      throw new Error(
        `No channel in [${order.join(", ")}] supports ${recipient.phoneE164}`,
      );
    }
    // Every attempted channel failed — the caller (index.ts) records this
    // final SendResult on the outbox row rather than treating it as a crash.
    return last;
  }
}

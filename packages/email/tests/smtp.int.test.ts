import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { smtpSender } from '#/adapter/smtp';

const SMTP_PORT = 1025;
const HTTP_PORT = 8025;

const mailpitMessages = z.object({
  messages: z.array(
    z.object({
      ID: z.string(),
      To: z.array(z.object({ Address: z.string() })),
      Subject: z.string(),
    }),
  ),
});

let container: StartedTestContainer;

beforeAll(async () => {
  container = await new GenericContainer(
    'axllent/mailpit:v1.31.5@sha256:94f6b70c1436defae6799d9ac7ff0eeff9540465b842026d5cdb018f1c0234ea',
  )
    .withExposedPorts(SMTP_PORT, HTTP_PORT)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();
}, 120_000);

afterAll(async () => {
  await container.stop();
});

async function listMessages(): Promise<z.infer<typeof mailpitMessages>['messages']> {
  const url = `http://${container.getHost()}:${String(container.getMappedPort(HTTP_PORT))}/api/v1/messages`;
  const response = await fetch(url);
  const body: unknown = await response.json();
  return mailpitMessages.parse(body).messages;
}

describe('smtpSender', () => {
  it('delivers a message an SMTP server accepts and can be read back', async () => {
    const sender = smtpSender({
      host: container.getHost(),
      port: container.getMappedPort(SMTP_PORT),
      from: 'odudu@example.test',
    });

    await sender.send({
      to: 'ada@example.test',
      subject: 'Verify your address',
      text: 'link',
      html: '<p>link</p>',
    });

    const messages = await listMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]?.To[0]?.Address).toBe('ada@example.test');
  });

  it('carries the mark as an inline image the markup can name by content id', async () => {
    const sender = smtpSender({
      host: container.getHost(),
      port: container.getMappedPort(SMTP_PORT),
      from: 'odudu@example.test',
    });
    await sender.send({
      to: 'grace@example.test',
      subject: 'With a mark',
      text: 'text',
      html: '<img src="cid:odudu-mark" width="40" height="40" alt="odudu">',
    });

    const sent = (await listMessages()).find((message) => message.Subject === 'With a mark');
    const origin = `http://${container.getHost()}:${String(container.getMappedPort(HTTP_PORT))}`;
    const detail = z
      .object({
        Inline: z.array(
          z.object({ ContentID: z.string(), ContentType: z.string(), Size: z.number() }),
        ),
      })
      .parse(await (await fetch(`${origin}/api/v1/message/${sent?.ID ?? ''}`)).json());
    expect(detail.Inline).toHaveLength(1);
    expect(detail.Inline[0]?.ContentID).toBe('odudu-mark');
    expect(detail.Inline[0]?.ContentType).toBe('image/png');
  });
});

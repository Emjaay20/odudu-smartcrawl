import { OduduError } from '@odudu/kernel';

export interface PromptIo {
  readonly input: NodeJS.ReadableStream & { isTTY?: boolean; setRawMode?: (on: boolean) => void };
  readonly output: NodeJS.WritableStream;
}

export interface AdminAnswer {
  readonly email: string;
  readonly password: string;
}

const ATTEMPTS = 5;
const CTRL_C = '\x03';
const CTRL_D = '\x04';
const BACKSPACE = new Set(['\x7f', '\b']);

function cancelled(): OduduError {
  return new OduduError('init_invalid_options', 'cancelled');
}

// Pulls lines off a stream one at a time. A chunk can hold several lines
// and a line several chunks, so what is left over stays in `pending`.
class LineReader {
  private pending = '';
  private ended = false;
  private skipLineFeed = false;
  private wake: (() => void) | undefined;

  private readonly input: PromptIo['input'];

  constructor(input: PromptIo['input']) {
    this.input = input;
    input.setEncoding('utf8');
    input.on('data', this.onData);
    input.on('end', this.onEnd);
  }

  close(): void {
    this.input.off('data', this.onData);
    this.input.off('end', this.onEnd);
    this.input.pause();
  }

  async line(editing: boolean): Promise<string> {
    let text = '';
    for (;;) {
      while (this.pending.length > 0) {
        const char = this.pending[0] ?? '';
        this.pending = this.pending.slice(1);
        if (this.skipLineFeed) {
          this.skipLineFeed = false;
          if (char === '\n') continue;
        }
        if (char === '\r' || char === '\n') {
          this.skipLineFeed = char === '\r';
          return text;
        }
        if (editing && char === CTRL_C) throw cancelled();
        if (editing && char === CTRL_D && text === '') throw cancelled();
        if (editing && BACKSPACE.has(char)) text = text.slice(0, -1);
        else text += char;
      }
      if (this.ended) {
        throw new OduduError('init_invalid_options', 'input ended before the prompt was answered');
      }
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
  }

  private readonly onData = (chunk: string | Buffer): void => {
    this.pending += chunk.toString();
    this.wake?.();
  };

  private readonly onEnd = (): void => {
    this.ended = true;
    this.wake?.();
  };
}

async function secretLine(reader: LineReader, io: PromptIo, label: string): Promise<string> {
  io.output.write(label);
  io.input.setRawMode?.(true);
  try {
    return await reader.line(true);
  } finally {
    io.input.setRawMode?.(false);
    io.output.write('\n');
  }
}

// Reads an email and a password from a terminal. The password is read in raw
// mode so nothing the terminal would echo reaches the screen, and raw mode is
// always switched off again, however the read ends.
export async function promptAdmin(
  io: PromptIo,
  validate: (password: string) => string | null,
  presetEmail?: string,
): Promise<AdminAnswer> {
  if (io.input.isTTY !== true || io.input.setRawMode === undefined) {
    throw new OduduError('init_invalid_options', 'there is no terminal to ask for a password on');
  }
  const reader = new LineReader(io.input);
  try {
    let email = presetEmail;
    if (email === undefined) {
      io.output.write('Administrator email: ');
      email = (await reader.line(false)).trim();
    }
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const password = await secretLine(reader, io, 'Password: ');
      const repeated = await secretLine(reader, io, 'Repeat password: ');
      if (password !== repeated) {
        io.output.write('The passwords do not match. Try again.\n');
        continue;
      }
      const refusal = validate(password);
      if (refusal !== null) {
        io.output.write(`${refusal} Try again.\n`);
        continue;
      }
      return { email, password };
    }
    throw new OduduError('init_invalid_options', 'no acceptable password after several tries');
  } finally {
    reader.close();
  }
}

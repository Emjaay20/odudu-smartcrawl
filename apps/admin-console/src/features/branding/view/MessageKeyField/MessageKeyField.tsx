import { use } from 'react';
import {
  INSERT_LABEL,
  INSERT_NOTE,
  KEY_FAILED,
  KEY_LIST_LIMIT,
  KEY_LOADING,
  messageOptions,
  templateReference,
  type MessageEntry,
} from '#/features/branding/service';
import type { Read } from '#/shared/service/read';
import { CodeInsert } from '#/shared/view/CodeField';
import { ComboBoxField } from '#/shared/view/Field';
import { InlineFailed } from '#/shared/view/InlineFailed';

const NONE: MessageEntry[] = [];

// A message key chosen from the catalogue's list, at most KEY_LIST_LIMIT
// drawn at a time and narrowed by typing part of a key or of its text. With a
// custom value allowed, a key typed in full is kept as typed. While the list
// is unread or could not be read the field says so and stays usable as text.
export function MessageKeyField({
  keys,
  label,
  description,
  value,
  onChange,
  error,
  mono,
  custom,
}: {
  keys: Read<MessageEntry[]>;
  label: string;
  description: string;
  value: string;
  onChange: (key: string) => void;
  error?: string | undefined;
  mono?: boolean;
  // Whether text that names no listed key is kept: yes for an override's key,
  // which the server checks; no for a picker that only inserts.
  custom?: boolean;
}) {
  const ready = keys.status === 'ready';
  return (
    <>
      <ComboBoxField
        label={label}
        description={keys.status === 'loading' ? `${description} ${KEY_LOADING}` : description}
        options={messageOptions(keys.status === 'ready' ? keys.data : NONE)}
        limit={KEY_LIST_LIMIT}
        value={value}
        onChange={onChange}
        allowsCustomValue={custom ?? false}
        isDisabled={!ready && custom !== true}
        {...(error === undefined ? {} : { error })}
        {...(mono === undefined ? {} : { mono })}
      />
      {keys.status === 'failed' ? <InlineFailed message={KEY_FAILED} retry={keys.retry} /> : null}
    </>
  );
}

// The picker above a template editor: chooses a message and types a reference
// to it at the caret.
export function InsertMessage({ keys }: { keys: Read<MessageEntry[]> }) {
  const insert = use(CodeInsert);
  return (
    <MessageKeyField
      keys={keys}
      label={INSERT_LABEL}
      description={INSERT_NOTE}
      value=""
      mono
      onChange={(key) => {
        if (key !== '') insert(templateReference(key));
      }}
    />
  );
}

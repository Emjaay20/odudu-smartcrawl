import { now, parseAbsolute, type ZonedDateTime } from '@internationalized/date';
import { use } from 'react';
import { DateField, DateInput, DateSegment, type DateValue } from 'react-aria-components';
import { edgeOfMinute } from '#/shared/service/dateTime';
import { localZone, offsetOf } from '#/shared/service/zones';
import {
  Description,
  FieldGroupIds,
  Header,
  invalid,
  Message,
  partProps,
  VALIDATION,
  type Chrome,
} from '#/shared/view/Field/Field';
import styles from '#/shared/view/Field/Field.module.css';

function zonedOf(value: string, zone: string): ZonedDateTime | null {
  return value === '' ? null : parseAbsolute(value, zone);
}

// A minute in the reader's own zone, kept as the UTC instant the API takes:
// an ISO string, or empty for none. `edge` says which end of the minute an
// inclusive bound stands for.
export function DateTimeField({
  label,
  description,
  error,
  changed,
  isDisabled = false,
  value,
  onChange,
  edge,
  zone = localZone(),
}: Chrome & {
  value: string;
  onChange: (value: string) => void;
  edge: 'start' | 'end';
  zone?: string;
}) {
  const group = use(FieldGroupIds);
  const at = new Date();
  return (
    <DateField
      {...VALIDATION}
      {...invalid(error)}
      {...partProps(group, undefined)}
      isDisabled={isDisabled}
      granularity="minute"
      hourCycle={24}
      value={zonedOf(value, zone)}
      placeholderValue={now(zone)}
      onChange={(picked: DateValue | null) => {
        onChange(picked === null ? '' : edgeOfMinute(picked.toDate(zone).toISOString(), edge));
      }}
      className={styles.field ?? ''}
      data-changed={changed === true || undefined}
    >
      <Header label={label} {...(changed === undefined ? {} : { changed })} />
      <DateInput className={styles.dateInput ?? ''} data-control>
        {(segment) => <DateSegment segment={segment} className={styles.segment ?? ''} />}
      </DateInput>
      <Description>
        {description}
        {description === undefined ? null : ' '}
        {`In ${zone} (${offsetOf(zone, at)}).`}
      </Description>
      <Message error={error} />
    </DateField>
  );
}

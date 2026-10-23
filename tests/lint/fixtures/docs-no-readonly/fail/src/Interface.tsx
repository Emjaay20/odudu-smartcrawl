interface Props {
  readonly label: string;
  readonly onPick: (value: string) => void;
}

export const Inline = (props: { readonly title: string }): string => props.title;
export const Other = (props: Props): string => props.label;

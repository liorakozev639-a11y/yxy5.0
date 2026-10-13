export type Topic = {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  isNone?: boolean;
  suppressLongTermPrompt?: boolean;
  echoEnabled?: boolean;
};

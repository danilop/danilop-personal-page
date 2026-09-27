/** Parse the authoring CLIs without consuming a missing value as another flag. */
export function parseOptions(
  args: string[],
  options: {
    values: Record<string, (value: string) => void>;
    flags?: Record<string, () => void>;
    help: () => void;
  },
) {
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--help") {
      options.help();
      return false;
    }
    const flag =
      options.flags && Object.hasOwn(options.flags, key)
        ? options.flags[key]
        : undefined;
    if (flag) {
      flag();
      continue;
    }
    const accept = Object.hasOwn(options.values, key)
        ? options.values[key]
        : undefined,
      value = args[index + 1];
    if (!accept || !value || value.startsWith("--"))
      throw Error(`Unknown or incomplete option: ${key}`);
    accept(value);
    index++;
  }
  return true;
}

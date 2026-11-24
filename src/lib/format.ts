const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export const formatDate = (date: Date) => `${dateFormatter.format(date)} UTC`;

export const orderRef = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

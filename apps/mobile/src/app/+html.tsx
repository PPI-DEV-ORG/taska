import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Web-only root HTML document
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Akuntra - Mini ERP</title>
        <link rel="icon" type="image/png" href="/favicon.png?v=2" />
        <link rel="shortcut icon" href="/favicon.ico?v=2" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}


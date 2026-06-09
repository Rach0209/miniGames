import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html {
              height: 100%;
              background-color: #121213;
            }
            /* ScrollViewStyleReset 이후에 override */
            body {
              height: 100% !important;
              margin: 0 !important;
              display: flex !important;
              justify-content: center !important;
              background-color: #121213 !important;
            }
            #root {
              display: flex !important;
              flex-direction: column !important;
              width: 100% !important;
              max-width: 1600px !important;
              height: 100vh;
              height: 100dvh;
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

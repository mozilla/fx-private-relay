import Head from "next/head";
import { useLocalization } from "@fluent/react";
import { useRouter } from "next/router";
import favicon from "../../../public/favicon.svg";
import socialMediaImage from "./images/share-relay.jpg";
import { getRuntimeConfig } from "../../config";

export const PageMetadata = () => {
  const { l10n } = useLocalization();
  const router = useRouter();

  return (
    <Head>
      <link rel="icon" type="image/svg+xml" href={favicon.src}></link>
      <title>{l10n.getString("meta-title")}</title>
      <meta name="description" content={l10n.getString("meta-description-2")} />
      <meta
        property="og:url"
        content={getRuntimeConfig().frontendOrigin + router.asPath}
      />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={l10n.getString("meta-title")} />
      <meta
        property="og:description"
        content={l10n.getString("meta-description-2")}
      />
      <meta property="og:image" content={socialMediaImage.src} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@firefox" />
      <meta name="twitter:title" content={l10n.getString("meta-title")} />
      <meta
        name="twitter:description"
        content={l10n.getString("meta-description-2")}
      />
      <meta name="twitter:image" content={socialMediaImage.src} />
    </Head>
  );
};
